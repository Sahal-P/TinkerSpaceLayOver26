import { describe, expect, it } from "vitest";

import { readFirebaseEnv, readGeminiEnv } from "./env";

const serviceAccount = {
  FIREBASE_PROJECT_ID: "demo-project",
  FIREBASE_CLIENT_EMAIL: "app@demo-project.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
};

describe("readGeminiEnv", () => {
  it("returns the API key", () => {
    expect(readGeminiEnv({ GEMINI_API_KEY: "test-key" })).toEqual({ GEMINI_API_KEY: "test-key" });
  });

  it("names the missing variable without echoing values", () => {
    expect(() => readGeminiEnv({ GEMINI_API_KEY: " " })).toThrow(/GEMINI_API_KEY/);
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
});
