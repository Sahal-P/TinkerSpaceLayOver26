import { beforeEach, describe, expect, it, vi } from "vitest";

const { applicationDefault, cert } = vi.hoisted(() => ({
  applicationDefault: vi.fn(() => ({ kind: "adc" })),
  cert: vi.fn(() => ({ kind: "cert" })),
}));
const { CloudFirestore, fromJSON, getFirestore, getVercelOidcToken } = vi.hoisted(() => ({
  CloudFirestore: vi.fn(),
  fromJSON: vi.fn(() => ({ kind: "external-account" })),
  getFirestore: vi.fn(),
  getVercelOidcToken: vi.fn(async () => "vercel-oidc-token"),
}));

vi.mock("firebase-admin/app", () => ({
  applicationDefault,
  cert,
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/firestore", () => ({ getFirestore }));
vi.mock("@google-cloud/firestore", () => ({ Firestore: CloudFirestore }));
vi.mock("google-auth-library", () => ({ ExternalAccountClient: { fromJSON } }));
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken }));

import { createFirestore, resolveAppOptions } from "./firebase";

const workloadIdentity = {
  FIREBASE_PROJECT_ID: "local-to-lens",
  GCP_PROJECT_NUMBER: "498069664220",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel",
  GCP_SERVICE_ACCOUNT_EMAIL: "ltl-vercel-runtime@local-to-lens.iam.gserviceaccount.com",
  VERCEL: "1",
};

describe("resolveAppOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the service account and unescapes the private key", () => {
    const options = resolveAppOptions({
      FIREBASE_PROJECT_ID: "demo-project",
      FIREBASE_CLIENT_EMAIL: "app@demo-project.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "line-1\\nline-2",
    });

    expect(cert).toHaveBeenCalledWith({
      projectId: "demo-project",
      clientEmail: "app@demo-project.iam.gserviceaccount.com",
      privateKey: "line-1\nline-2",
    });
    expect(applicationDefault).not.toHaveBeenCalled();
    expect(options).toEqual({ projectId: "demo-project", credential: { kind: "cert" } });
  });

  it("falls back to Application Default Credentials", () => {
    expect(resolveAppOptions({})).toEqual({ projectId: undefined, credential: { kind: "adc" } });
    expect(cert).not.toHaveBeenCalled();
  });

  it("refuses Application Default Credentials on Vercel before they are constructed", () => {
    expect(() => resolveAppOptions({ VERCEL: "1" })).toThrow(/Vercel/);
    expect(applicationDefault).not.toHaveBeenCalled();
  });
});

describe("createFirestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects Vercel keylessly through workload identity federation", () => {
    createFirestore(workloadIdentity);

    expect(fromJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "external_account",
        audience:
          "//iam.googleapis.com/projects/498069664220/locations/global/workloadIdentityPools/vercel/providers/vercel",
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        token_url: "https://sts.googleapis.com/v1/token",
        service_account_impersonation_url:
          "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/ltl-vercel-runtime@local-to-lens.iam.gserviceaccount.com:generateAccessToken",
        subject_token_supplier: { getSubjectToken: expect.any(Function) },
      }),
    );
    expect(CloudFirestore).toHaveBeenCalledWith({
      projectId: "local-to-lens",
      authClient: { kind: "external-account" },
    });
    expect(applicationDefault).not.toHaveBeenCalled();
  });

  it("uses Application Default Credentials locally", () => {
    createFirestore({});

    expect(applicationDefault).toHaveBeenCalled();
    expect(CloudFirestore).not.toHaveBeenCalled();
    expect(getFirestore).toHaveBeenCalled();
  });

  it("fails on Vercel without any credential, without touching ADC", () => {
    expect(() => createFirestore({ VERCEL: "1" })).toThrow(/Vercel/);
    expect(applicationDefault).not.toHaveBeenCalled();
    expect(CloudFirestore).not.toHaveBeenCalled();
  });
});
