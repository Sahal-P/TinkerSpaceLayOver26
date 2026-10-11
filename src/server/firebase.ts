import "server-only";

import { Firestore as CloudFirestore } from "@google-cloud/firestore";
import { getVercelOidcToken } from "@vercel/oidc";
import { applicationDefault, cert, getApps, initializeApp, type AppOptions } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { ExternalAccountClient } from "google-auth-library";

import { readFirebaseEnv, type FirebaseEnv } from "@/server/env";

/**
 * Explicit service-account credentials when configured, otherwise Application Default Credentials
 * (Firebase App Hosting, Cloud Run, gcloud). Vercel has neither, so it fails here before reaching ADC.
 */
export function resolveAppOptions(env: FirebaseEnv): AppOptions {
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: privateKey } = env;

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      // Env files and dashboards store the PEM key with escaped newlines.
      credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
    };
  }

  // ADC on Vercel rejects in the background and exits the function. Throwing here lets the request
  // return storage_unavailable instead.
  if (env.VERCEL) {
    throw new Error("Firestore has no credentials on Vercel. Set the GCP_* workload identity values.");
  }

  return { projectId, credential: applicationDefault() };
}

type WorkloadIdentity = {
  projectId: string;
  projectNumber: string;
  poolId: string;
  providerId: string;
  serviceAccountEmail: string;
};

/**
 * Keyless Firestore access for Vercel. Firebase Admin accepts only certificate or ADC credentials, so this
 * builds the client directly. google-auth-library exchanges Vercel's OIDC token at Google STS, impersonates
 * the runtime service account, and caches and renews the access token itself.
 */
function workloadIdentityFirestore({
  projectId,
  projectNumber,
  poolId,
  providerId,
  serviceAccountEmail,
}: WorkloadIdentity): Firestore {
  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  });
  if (!authClient) throw new Error("Workload identity configuration is invalid.");
  // google-gax reads authClient from these settings. The published Firestore settings type omits it.
  const settings = { projectId, authClient };
  return new CloudFirestore(settings);
}

/** Builds the Firestore client for the configured credential source. */
export function createFirestore(env: FirebaseEnv): Firestore {
  const {
    FIREBASE_PROJECT_ID: projectId,
    GCP_PROJECT_NUMBER: projectNumber,
    GCP_WORKLOAD_IDENTITY_POOL_ID: poolId,
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: providerId,
    GCP_SERVICE_ACCOUNT_EMAIL: serviceAccountEmail,
  } = env;

  if (projectId && projectNumber && poolId && providerId && serviceAccountEmail) {
    return workloadIdentityFirestore({ projectId, projectNumber, poolId, providerId, serviceAccountEmail });
  }

  const app = getApps()[0] ?? initializeApp(resolveAppOptions(env));
  return getFirestore(app);
}

let db: Firestore | undefined;

/** Server-only Firestore client. Reuses the existing client across dev hot reloads. */
export function getDb(): Firestore {
  if (!db) {
    db = createFirestore(readFirebaseEnv());
  }
  return db;
}
