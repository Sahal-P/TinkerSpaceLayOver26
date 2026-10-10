import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ambiguousFixture, englishFixture } from "@/contracts/fixtures";
import type { GuideDraft } from "@/contracts/guide";
import { newViewer, ownerKey } from "@/server/session";
import { FirestoreFake } from "@/server/testing/firestore-fake";

const state = vi.hoisted(() => ({ db: undefined as FirestoreFake | undefined, ids: [] as string[] }));
vi.mock("@/server/firebase", () => ({
  getDb: () => { if (!state.db) throw new Error("private credential failure"); return state.db; },
}));
vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:crypto")>();
  return { ...original, randomBytes: (size: number) => {
    const id = size === 16 ? state.ids.shift() : undefined;
    return id ? Buffer.from(id, "base64url") : original.randomBytes(size);
  } };
});
import { createGuide, deleteGuide, getGuideForViewer, getPublishedGuide, setPublished } from "./repository";

function reviewed(fixture = englishFixture): GuideDraft {
  return { ...structuredClone(fixture), steps: fixture.steps.map((step) => ({ ...structuredClone(step), reviewed: true })) };
}
beforeEach(() => { state.db = new FirestoreFake(); state.ids = []; });
afterEach(() => vi.restoreAllMocks());
describe("confirmed guide persistence", () => {
  it("atomically deduplicates concurrent creation and rejects key/body conflicts", async () => {
    const owner = newViewer();
    const [a, b] = await Promise.all([createGuide(reviewed(), owner, "same-request-key-123"), createGuide(reviewed(), owner, "same-request-key-123")]);
    expect(a.id).toBe(b.id);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(a.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    await expect(createGuide({ ...reviewed(), title: "Changed title" }, owner, "same-request-key-123")).rejects.toMatchObject({ status: 409 });
    expect([...state.db?.documents.keys() ?? []].filter((key) => key.startsWith("guides/"))).toHaveLength(1);
  });
  it("requires reviewed input and stores no raw audio or credentials", async () => {
    const owner = newViewer();
    await expect(createGuide(englishFixture, owner, "request-unreviewed-123")).rejects.toMatchObject({ status: 400 });
    const result = await createGuide(reviewed(), owner, "request-confirmed-123");
    const serialized = JSON.stringify(state.db?.documents.get("guides/" + result.id));
    expect(serialized).not.toContain(owner.id);
    expect(serialized).not.toContain("audio/wav");
    expect(serialized).not.toContain("PRIVATE_KEY");
    expect(serialized).not.toContain("inlineData");
    expect(serialized).toContain(ownerKey(owner));
  });
  it("protects drafts and every mutation from other owners", async () => {
    const owner = newViewer(); const other = newViewer();
    const result = await createGuide(reviewed(), owner, "owner-isolation-123");
    expect(await getGuideForViewer(result.id, owner)).toHaveProperty("guide.transcript");
    expect(await getGuideForViewer(result.id, other)).toBeNull();
    expect(await getPublishedGuide(result.id)).toBeNull();
    await expect(setPublished(result.id, other, true)).rejects.toMatchObject({ status: 404 });
    await expect(deleteGuide(result.id, other)).rejects.toMatchObject({ status: 404 });
  });
  it("publishes safe projections, is idempotent, and revokes access immediately", async () => {
    const owner = newViewer();
    const result = await createGuide(reviewed(), owner, "publish-safe-123456");
    await setPublished(result.id, owner, true);
    const first = await getPublishedGuide(result.id);
    await setPublished(result.id, owner, true);
    const again = await getPublishedGuide(result.id);
    expect(again?.publishedAt).toBe(first?.publishedAt);
    expect(first).toHaveProperty("steps");
    expect(first).not.toHaveProperty("guide");
    expect(first).not.toHaveProperty("transcript");
    expect(first).not.toHaveProperty("ownerKey");
    expect(first?.steps[0]).not.toHaveProperty("evidence");
    expect(first?.steps[0]).not.toHaveProperty("source");
    await setPublished(result.id, owner, false);
    await setPublished(result.id, owner, false);
    expect(await getPublishedGuide(result.id)).toBeNull();
    await deleteGuide(result.id, owner);
    expect(await getGuideForViewer(result.id, owner)).toBeNull();
    expect([...state.db?.documents.keys() ?? []].filter((key) => key.startsWith("_guide_requests/"))).toHaveLength(0);
  });
  it("retains acknowledged warnings and low confidence on published guides", async () => {
    const owner = newViewer();
    const result = await createGuide(reviewed(ambiguousFixture), owner, "publish-warnings-123");
    await expect(setPublished(result.id, owner, true)).rejects.toMatchObject({ code: "confirmation_required" });
    await setPublished(result.id, owner, true, true);
    const publicGuide = await getPublishedGuide(result.id);
    expect(publicGuide?.steps[0]).toMatchObject({ direction: "unknown", confidence: "low", needsReview: true });
    expect(publicGuide?.warnings.length).toBeGreaterThan(0);
  });
  it("handles random ID collisions without overwriting an existing document", async () => {
    const colliding = Buffer.alloc(16, 0).toString("base64url");
    const fresh = Buffer.alloc(16, 1).toString("base64url");
    state.db?.documents.set("guides/" + colliding, { untouched: true });
    state.ids.push(colliding, fresh);
    const result = await createGuide(reviewed(), newViewer(), "collision-request-123");
    expect(result.id).toBe(fresh);
    expect(state.db?.documents.get("guides/" + colliding)).toEqual({ untouched: true });
  });
  it("fails closed on corrupted documents and database failures", async () => {
    const owner = newViewer();
    const result = await createGuide(reviewed(), owner, "corrupt-record-123456");
    state.db?.documents.set("guides/" + result.id, { id: result.id, status: "published", latitude: 99 });
    await expect(getGuideForViewer(result.id, owner)).rejects.toMatchObject({ code: "storage_unavailable" });
    state.db = undefined;
    await expect(createGuide(reviewed(), owner, "db-unavailable-123456")).rejects.toMatchObject({ code: "storage_unavailable" });
  });
  it("rejects malformed IDs without accessing the database", async () => {
    state.db = undefined;
    expect(await getPublishedGuide("../../private")).toBeNull();
    await expect(deleteGuide("../../private", newViewer())).rejects.toMatchObject({ status: 404 });
  });
});
