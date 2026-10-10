import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachViewerCookie, encodeViewer, newViewer, ownerKey, sessionCookieName, verifyViewer, viewerFromRequest } from "./session";

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("SESSION_SECRET", "test-secret-not-a-real-secret-32-characters");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());
describe("anonymous owner capability", () => {
  it("signs random owners and hashes stored identity", () => {
    const a = newViewer(); const b = newViewer();
    expect(a.id).not.toBe(b.id);
    expect(verifyViewer(encodeViewer(a))).toEqual(a);
    expect(ownerKey(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(ownerKey(a)).not.toContain(a.id);
  });
  it("rejects altered, expired, future, malformed, and duplicate cookies", () => {
    const viewer = newViewer(); const token = encodeViewer(viewer);
    expect(verifyViewer(token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(verifyViewer(encodeViewer({ ...viewer, expiresAt: 1 }))).toBeNull();
    expect(verifyViewer(encodeViewer({ ...viewer, expiresAt: viewer.expiresAt + 1000 }))).toBeNull();
    expect(verifyViewer("not.a.cookie")).toBeNull();
    const header = sessionCookieName() + "=" + token;
    expect(viewerFromRequest(new Request("http://localhost", { headers: { Cookie: header } }))).toEqual(viewer);
    expect(viewerFromRequest(new Request("http://localhost", { headers: { Cookie: header + ";" + header } }))).toBeNull();
  });
  it("uses secure, HttpOnly, SameSite host cookies in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = attachViewerCookie(new Response(), newViewer());
    const cookie = response.headers.get("Set-Cookie");
    expect(cookie).toContain("__Host-ltl-owner=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
  });
});
