import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type AppOptions } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { readFirebaseEnv, type FirebaseEnv } from "@/server/env";

/**
 * Explicit service-account credentials when configured (hosts without ADC, e.g. Vercel);
 * otherwise Application Default Credentials (Firebase App Hosting, Cloud Run, gcloud).
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

  return { projectId, credential: applicationDefault() };
}

let db: Firestore | undefined;

/** Server-only Firestore client. Reuses the existing app across dev hot reloads. */
export function getDb(): Firestore {
  if (!db) {
    const app = getApps()[0] ?? initializeApp(resolveAppOptions(readFirebaseEnv()));
    db = getFirestore(app);
  }
  return db;
}
