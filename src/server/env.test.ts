import { describe, expect, it } from "vitest";

import { readBackendEnv, readFirebaseEnv, readGeminiEnv, readSpeechEnv } from "./env";

const serviceAccount = {
  FIREBASE_PROJECT_ID: "demo-project",
  FIREBASE_CLIENT_EMAIL: "app@demo-project.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
};

const workloadIdentity = {
  FIREBASE_PROJECT_ID: "demo-project",
  GCP_PROJECT_NUMBER: "498069664220",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel",
  GCP_SERVICE_ACCOUNT_EMAIL: "ltl-vercel-runtime@demo-project.iam.gserviceaccount.com",
};

describe("readGeminiEnv", () => {
  it("returns the API key", () => {
    expect(readGeminiEnv({ GEMINI_API_KEY: "test-key" })).toEqual({ GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-3.8-flash" });
  });

  it("names the missing variable without echoing values", () => {
    expect(() => readGeminiEnv({ GEMINI_API_KEY: " " })).toThrow(/GEMINI_API_KEY/);
  });
});

describe("readBackendEnv", () => {
  const settings = { SESSION_SECRET: "unit-test-secret-of-at-least-32-characters", APP_ORIGIN: "https://example.com" };
  it("requires secrets only at first use", () => {
    expect(() => readBackendEnv({})).toThrow(/SESSION_SECRET/);
    expect(readBackendEnv(settings)).toEqual(settings);
  });
  it("rejects insecure production origins and embedded credentials", () => {
    expect(() => readBackendEnv({ ...settings, NODE_ENV: "production", APP_ORIGIN: "http://example.com" })).toThrow(/APP_ORIGIN/);
    expect(() => readBackendEnv({ ...settings, APP_ORIGIN: "https://user:password@example.com" })).toThrow(/APP_ORIGIN/);
    expect(() => readBackendEnv({ ...settings, APP_ORIGIN: "https://example.com/path" })).toThrow(/APP_ORIGIN/);
  });
  it("allows localhost and normalizes the origin", () => {
    expect(readBackendEnv({ ...settings, NODE_ENV: "production", APP_ORIGIN: "http://localhost:3000/" }).APP_ORIGIN).toBe("http://localhost:3000");
  });
  it("never includes secret values in validation failures", () => {
    try { readBackendEnv({ ...settings, SESSION_SECRET: "tiny-secret", APP_ORIGIN: "bad" }); }
    catch (error) { expect(String(error)).not.toContain("tiny-secret"); }
  });
});

describe("readFirebaseEnv", () => {
  it("allows no credentials, for Application Default Credentials", () => {
    expect(readFirebaseEnv({})).toEqual({});
  });

  it("treats blank values as unset", () => {
    expect(readFirebaseEnv({ FIREBASE_PROJECT_ID: "", FIREBASE_CLIENT_EMAIL: " ", FIREBASE_PRIVATE_KEY: "" })).toEqual({});
  });

  it("accepts a complete service account", () => {
    expect(readFirebaseEnv(serviceAccount)).toEqual(serviceAccount);
  });

  it("rejects a client email without a private key", () => {
    expect(() => readFirebaseEnv({ ...serviceAccount, FIREBASE_PRIVATE_KEY: undefined })).toThrow(
      /FIREBASE_PRIVATE_KEY/,
    );
  });

  it("requires a project ID with a service account", () => {
    expect(() => readFirebaseEnv({ ...serviceAccount, FIREBASE_PROJECT_ID: undefined })).toThrow(
      /FIREBASE_PROJECT_ID/,
    );
  });

  it("rejects a malformed client email", () => {
    expect(() => readFirebaseEnv({ ...serviceAccount, FIREBASE_CLIENT_EMAIL: "not-an-email" })).toThrow(
      /FIREBASE_CLIENT_EMAIL/,
    );
  });

  it("accepts the keyless workload identity values", () => {
    expect(readFirebaseEnv(workloadIdentity)).toEqual(workloadIdentity);
  });

  it("requires all four workload identity values together", () => {
    expect(() => readFirebaseEnv({ ...workloadIdentity, GCP_SERVICE_ACCOUNT_EMAIL: undefined })).toThrow(
      /together, or none/,
    );
  });

  it("requires a project ID with workload identity", () => {
    expect(() => readFirebaseEnv({ ...workloadIdentity, FIREBASE_PROJECT_ID: undefined })).toThrow(
      /FIREBASE_PROJECT_ID/,
    );
  });

  it("rejects a non-numeric project number", () => {
    expect(() => readFirebaseEnv({ ...workloadIdentity, GCP_PROJECT_NUMBER: "demo-project" })).toThrow(
      /GCP_PROJECT_NUMBER/,
    );
  });

  it("rejects a service account and workload identity at the same time", () => {
    expect(() => readFirebaseEnv({ ...serviceAccount, ...workloadIdentity })).toThrow(/not both/);
  });
});

describe("readSpeechEnv", () => {
  it("uses the approved Gemini API TTS model and validates lazily", () => {
    expect(readSpeechEnv({})).toEqual({ GEMINI_TTS_MODEL: "gemini-2.5-flash-preview-tts" });
    expect(() => readSpeechEnv({ GEMINI_TTS_MODEL: "x".repeat(101) })).toThrow(/GEMINI_TTS_MODEL/);
    expect(() => readSpeechEnv({ GEMINI_TTS_MODEL: "gemini-2.5-flash-lite-preview-tts" })).toThrow(/GEMINI_TTS_MODEL/);
  });
});
