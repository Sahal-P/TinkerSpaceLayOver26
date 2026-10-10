import { beforeEach, describe, expect, it, vi } from "vitest";

const { applicationDefault, cert } = vi.hoisted(() => ({
  applicationDefault: vi.fn(() => ({ kind: "adc" })),
  cert: vi.fn(() => ({ kind: "cert" })),
}));

vi.mock("firebase-admin/app", () => ({
  applicationDefault,
  cert,
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: vi.fn() }));

import { resolveAppOptions } from "./firebase";

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
});
