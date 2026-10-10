import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { FirestoreFake } from "@/server/testing/firestore-fake";
import { englishFixture } from "@/contracts/fixtures";
import { narrationInput, translationResponseSchema } from "@/contracts/speech";
const state = vi.hoisted(() => ({ db: undefined as FirestoreFake | undefined, audio: vi.fn(), translation: vi.fn() }));
vi.mock("@/server/firebase", () => ({ getDb: () => { if (!state.db) throw new Error("private credential error"); return state.db; } }));
vi.mock("./service", () => ({ synthesizeSpeech: state.audio, translateNarration: state.translation }));
import { POST as audio } from "@/app/api/speech/route";
import { POST as translate } from "@/app/api/speech/translate/route";
import { viewerFromRequest } from "@/server/session";
const origin = "http://localhost:3000";
function request(body: unknown, cookie?: string, from = origin) {
  return new Request(origin + "/api/speech", { method: "POST", headers: { Origin: from, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}
beforeEach(() => {
  state.db = new FirestoreFake(); state.audio.mockReset(); state.translation.mockReset();
  vi.stubEnv("APP_ORIGIN", origin); vi.stubEnv("SESSION_SECRET", "unit-test-secret-at-least-32-characters"); vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());

describe("private speech routes", () => {
  it("establishes a signed session and returns private binary audio", async () => {
    state.audio.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const response = await audio(request({ text: "Turn left", language: "en" }));
    expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(response.headers.get("Cache-Control")).toContain("no-store"); expect(response.headers.get("X-Request-Id")).toBeTruthy();
    const cookie = response.headers.get("Set-Cookie")?.split(";")[0];
    expect(viewerFromRequest(request({}, cookie))).not.toBeNull();
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });
  it("validates request bounds, language, origin and refuses unavailable rate protection", async () => {
    expect((await audio(request({ text: "x".repeat(601), language: "en" }))).status).toBe(400);
    expect((await audio(request({ text: "Route", language: "fr" }))).status).toBe(400);
    expect((await audio(request({ text: "Route", language: "en" }, undefined, "https://evil.example"))).status).toBe(403);
    state.db = undefined;
    const response = await audio(request({ text: "Route", language: "en" }));
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: { code: "storage_unavailable" } });
    expect(state.audio).not.toHaveBeenCalled();
  });
  it("protects cached routes with atomic limits and handles cookie tampering", async () => {
    state.audio.mockResolvedValue(new Uint8Array([1]));
    let cookie: string | undefined;
    for (let i = 0; i < 12; i++) { const response = await audio(request({ text: "Route", language: "en" }, cookie)); expect(response.status).toBe(200); cookie = response.headers.get("Set-Cookie")?.split(";")[0]; }
    const limited = await audio(request({ text: "Route", language: "en" }, cookie));
    expect(limited.status).toBe(429); expect(limited.headers.has("Retry-After")).toBe(true);
    expect((await audio(request({ text: "Route", language: "en" }, "ltl-owner=tampered"))).status).toBe(200);
    expect(state.audio).toHaveBeenCalledTimes(13);
  });
  it("returns a validated translation envelope without private guide data", async () => {
    state.translation.mockResolvedValue({ instruction: "बस स्टॉप से शुरू करें।", landmark: "bus stop", distance: null, warnings: [] });
    const response = await translate(request({ ...narrationInput(englishFixture.steps[0], []), language: "hi" }));
    expect(translationResponseSchema.parse(await response.json()).data.language).toBe("hi");
  });
});
