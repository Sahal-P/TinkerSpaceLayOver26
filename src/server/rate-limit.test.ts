import { beforeEach, describe, expect, it, vi } from "vitest";

import { newViewer, ownerKey } from "@/server/session";
import { FirestoreFake } from "@/server/testing/firestore-fake";

const state = vi.hoisted(() => ({ db: undefined as FirestoreFake | undefined }));
vi.mock("@/server/firebase", () => ({ getDb: () => {
  if (!state.db) throw new Error("credentials are private");
  return state.db;
} }));
import { enforceRateLimit } from "./rate-limit";

beforeEach(() => { state.db = new FirestoreFake(); });
describe("distributed fail-closed abuse budgets", () => {
  const now = Date.parse("2026-10-10T10:20:30.000Z");
  it("atomically admits only three concurrent extractions per minute", async () => {
    const owner = newViewer();
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => enforceRateLimit("extraction", owner, now)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(state.db?.documents.get("_rate_limits/extraction-" + ownerKey(owner))).toMatchObject({ minuteCount: 3, dayCount: 3 });
    await expect(enforceRateLimit("extraction", owner, now)).rejects.toMatchObject({ status: 429, retryAfter: 30 });
  });
  it("keeps daily owner limits across minute windows and resets on the next UTC day", async () => {
    const owner = newViewer();
    for (let index = 0; index < 20; index++) await enforceRateLimit("extraction", owner, now + index * 60000);
    await expect(enforceRateLimit("extraction", owner, now + 21 * 60000)).rejects.toMatchObject({ status: 429 });
    await expect(enforceRateLimit("extraction", owner, now + 86400000)).resolves.toBeUndefined();
  });
  it("protects global budgets even when the caller changes cookies", async () => {
    const minute = Math.floor(now / 60000); const day = Math.floor(now / 86400000);
    state.db?.documents.set("_rate_limits/global-extraction", { minute, day, minuteCount: 199, dayCount: 199 });
    await enforceRateLimit("extraction", newViewer(), now);
    await expect(enforceRateLimit("extraction", newViewer(), now)).rejects.toMatchObject({ status: 429 });
    state.db?.documents.set("_rate_limits/global-mutation", { minute, day, minuteCount: 1000, dayCount: 1000 });
    await expect(enforceRateLimit("mutation", newViewer(), now)).rejects.toMatchObject({ status: 429 });
    state.db?.documents.set("_rate_limits/global-read", { minute, day, minuteCount: 5000, dayCount: 5000 });
    await expect(enforceRateLimit("read", undefined, now)).rejects.toMatchObject({ status: 429 });
  });
  it("enforces the ten-per-minute mutation budget", async () => {
    const owner = newViewer();
    for (let index = 0; index < 10; index++) await enforceRateLimit("mutation", owner, now);
    await expect(enforceRateLimit("mutation", owner, now)).rejects.toMatchObject({ status: 429 });
  });
  it("does not admit traffic when counter records are corrupted or unavailable", async () => {
    state.db?.documents.set("_rate_limits/global-extraction", { dayCount: "not valid" });
    await expect(enforceRateLimit("extraction", newViewer(), now)).rejects.toMatchObject({ code: "storage_unavailable" });
    state.db = undefined;
    await expect(enforceRateLimit("read")).rejects.toMatchObject({ code: "storage_unavailable" });
  });
});

describe("speech generation budgets", () => {
  it("limits concurrent speech and daily/global use independently of extraction", async () => {
    const now = Date.parse("2026-10-11T12:00:00Z"); const owner = newViewer();
    const results = await Promise.allSettled(Array.from({ length: 13 }, () => enforceRateLimit("speech", owner, now)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(12);
    const minute = Math.floor(now / 60000); const day = Math.floor(now / 86400000);
    state.db?.documents.set("_rate_limits/speech-" + ownerKey(owner), { minute, day, minuteCount: 0, dayCount: 120 });
    await expect(enforceRateLimit("speech", owner, now)).rejects.toMatchObject({ status: 429 });
    state.db?.documents.set("_rate_limits/global-speech", { minute, day, minuteCount: 0, dayCount: 500 });
    await expect(enforceRateLimit("speech", newViewer(), now)).rejects.toMatchObject({ status: 429 });
  });
});
