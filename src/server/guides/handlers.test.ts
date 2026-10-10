import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ambiguousFixture, englishFixture } from "@/contracts/fixtures";
import { creationResponseSchema, extractionResponseSchema, publishResponseSchema, retrievalResponseSchema } from "@/contracts/guide";
import { ApiError } from "@/server/api/errors";
import { encodeViewer, newViewer, sessionCookieName, viewerFromRequest } from "@/server/session";
import { audioFixture, audioRequest } from "@/server/testing/audio-fixtures";
import { modelFixture } from "@/server/testing/model-fixtures";
import { FirestoreFake } from "@/server/testing/firestore-fake";

const state = vi.hoisted(() => ({
  db: undefined as FirestoreFake | undefined, generate: vi.fn(),
}));
vi.mock("@/server/firebase", () => ({ getDb: () => {
  if (!state.db) throw new Error("private db credential error");
  return state.db;
} }));
vi.mock("@/server/gemini", () => ({ getGemini: () => ({ models: { generateContent: state.generate } }) }));

import { POST as extract } from "@/app/api/directions/extract/route";
import { POST as create } from "@/app/api/guides/route";
import { DELETE as remove, GET as get } from "@/app/api/guides/[id]/route";
import { POST as publish } from "@/app/api/guides/[id]/publish/route";
import { POST as unpublish } from "@/app/api/guides/[id]/unpublish/route";

const origin = "http://localhost:3000";
const reviewed = (fixture = englishFixture) => ({ ...fixture, steps: fixture.steps.map((step) => ({ ...step, reviewed: true })) });
function request(path: string, body?: unknown, cookie?: string, idempotencyKey = "handler-test-key-1234", method = "POST") {
  const headers = new Headers({ Origin: origin, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey });
  if (cookie) headers.set("Cookie", cookie);
  return new Request(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const context = (id: string) => ({ params: Promise.resolve({ id }) });
async function signalRequest(): Promise<Request> {
  const bytes = await audioFixture();
  // Synthetic nonzero PCM sample; semantic speech output remains an SDK mock.
  bytes[bytes.length - 2] = 1;
  return audioRequest({ bytes });
}
beforeEach(() => {
  state.db = new FirestoreFake(); state.generate.mockReset();
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("SESSION_SECRET", "unit-tests-only-secret-with-32-characters");
  vi.stubEnv("GEMINI_API_KEY", "unit-tests-only-key");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());

describe("route handler integration with mocked SDKs", () => {
  it("extracts audio, establishes an owner, saves reviewed content, and explicitly publishes", async () => {
    const fixture = modelFixture(englishFixture);
    state.generate.mockResolvedValueOnce({ text: JSON.stringify(fixture.transcription) })
      .mockResolvedValueOnce({ text: JSON.stringify(fixture.extraction) });
    const extracted = await extract(await signalRequest());
    expect(extracted.status).toBe(200);
    const output = extractionResponseSchema.parse(await extracted.json());
    const cookie = extracted.headers.get("Set-Cookie")?.split(";")[0];
    expect(cookie).toBeDefined();
    expect(extracted.headers.get("Cache-Control")).toContain("no-store");
    expect([...state.db?.documents.keys() ?? []].some((key) => key.startsWith("guides/"))).toBe(false);
    const saved = await create(request("/api/guides", { guide: reviewed(output.data), confirmed: true }, cookie));
    expect(saved.status).toBe(201);
    const { data: { id } } = creationResponseSchema.parse(await saved.json());
    const repeated = await create(request("/api/guides", { guide: reviewed(output.data), confirmed: true }, cookie));
    expect(repeated.status).toBe(200);
    expect(creationResponseSchema.parse(await repeated.json()).data.id).toBe(id);
    const privateResponse = await get(request("/api/guides/" + id, undefined, cookie, undefined, "GET"), context(id));
    const privatePayload = retrievalResponseSchema.parse(await privateResponse.json());
    expect(privatePayload.data).toHaveProperty("guide.transcript");
    const publicBefore = await get(request("/api/guides/" + id, undefined, undefined, undefined, "GET"), context(id));
    expect(publicBefore.status).toBe(404);
    const published = await publish(request("/api/guides/" + id + "/publish", {}, cookie), context(id));
    const publishedPayload = publishResponseSchema.parse(await published.json());
    expect(publishedPayload.data.url).toBe(origin + "/g/" + id);
    const publicResponse = await get(request("/api/guides/" + id, undefined, undefined, undefined, "GET"), context(id));
    expect(publicResponse.status).toBe(200);
    const publicPayload = retrievalResponseSchema.parse(await publicResponse.json());
    expect(publicPayload.data).not.toHaveProperty("transcript");
    expect(publicPayload.data).not.toHaveProperty("ownerKey");
    expect(JSON.stringify(publicPayload)).not.toContain("evidence");
    expect(publicResponse.headers.get("Cache-Control")).toContain("no-store");
    expect((await unpublish(request("/api/guides/" + id + "/unpublish", {}, cookie), context(id))).status).toBe(200);
    expect((await get(request("/api/guides/" + id, undefined, undefined, undefined, "GET"), context(id))).status).toBe(404);
    expect((await remove(request("/api/guides/" + id, undefined, cookie, undefined, "DELETE"), context(id))).status).toBe(204);
  });
  it("requires confirmation, idempotency keys, same-origin requests, and owner credentials", async () => {
    expect((await create(request("/api/guides", { guide: reviewed(), confirmed: false }))).status).toBe(400);
    expect((await create(request("/api/guides", { guide: reviewed(), confirmed: true }, undefined, "short"))).status).toBe(400);
    expect((await create(request("/api/guides", { guide: englishFixture, confirmed: true }))).status).toBe(400);
    const foreign = request("/api/guides", { guide: reviewed(), confirmed: true });
    foreign.headers.set("Origin", "https://evil.example");
    expect((await create(foreign)).status).toBe(403);
    const saved = await create(request("/api/guides", { guide: reviewed(), confirmed: true }));
    const id = creationResponseSchema.parse(await saved.json()).data.id;
    const wrong = sessionCookieName() + "=" + encodeViewer(newViewer());
    expect((await publish(request("/api/guides/" + id + "/publish", {}, wrong), context(id))).status).toBe(404);
    expect((await remove(request("/api/guides/" + id, undefined, wrong, undefined, "DELETE"), context(id))).status).toBe(404);
    expect((await unpublish(request("/api/guides/" + id + "/unpublish", {}), context(id))).status).toBe(404);
  });
  it("requires explicit uncertainty acknowledgement when publishing", async () => {
    const saved = await create(request("/api/guides", { guide: reviewed(ambiguousFixture), confirmed: true }));
    const cookie = saved.headers.get("Set-Cookie")?.split(";")[0];
    const id = creationResponseSchema.parse(await saved.json()).data.id;
    expect((await publish(request("/api/guides/" + id + "/publish", {}, cookie), context(id))).status).toBe(422);
    expect((await publish(request("/api/guides/" + id + "/publish", { acknowledgeWarnings: true }, cookie), context(id))).status).toBe(200);
  });
  it("returns a safe configuration error without SDK calls when env is absent", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    const response = await extract(await audioRequest());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("unit-tests-only");
    expect(state.generate).not.toHaveBeenCalled();
  });
  it("never calls Gemini for invalid consent/audio and returns retry headers for limits", async () => {
    expect((await extract(await audioRequest({ consent: "false" }))).status).toBe(400);
    expect((await extract(await audioRequest({ bytes: new TextEncoder().encode("corrupt") }))).status).toBe(422);
    expect(state.generate).not.toHaveBeenCalled();
    const owner = newViewer();
    const cookie = sessionCookieName() + "=" + encodeViewer(owner);
    const minute = Math.floor(Date.now() / 60000); const day = Math.floor(Date.now() / 86400000);
    state.db?.documents.set("_rate_limits/global-extraction", { minute, day, minuteCount: 200, dayCount: 200 });
    const input = await audioRequest(); input.headers.set("Cookie", cookie);
    const limited = await extract(input);
    expect(limited.status).toBe(429);
    expect(limited.headers.has("Retry-After")).toBe(true);
    expect(state.generate).not.toHaveBeenCalled();
  });
  it("rejects exact digital silence before model invocation without creating a guide", async () => {
    const rejected = await extract(await audioRequest());
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({ error: { code: "no_speech" } });
    expect(state.generate).not.toHaveBeenCalled();
    expect([...state.db?.documents.keys() ?? []].some((key) => key.startsWith("guides/"))).toBe(false);
  });
  it("preserves the owner cookie after a transient failure", async () => {
    state.generate.mockRejectedValue(new ApiError("upstream_unavailable", 503, "Try again.", true));
    const failed = await extract(await signalRequest());
    expect(failed.status).toBe(503);
    const cookie = failed.headers.get("Set-Cookie")?.split(";")[0];
    expect(viewerFromRequest(request("/", undefined, cookie))).not.toBeNull();
  });
});
