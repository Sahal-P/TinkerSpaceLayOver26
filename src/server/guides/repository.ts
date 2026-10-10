import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { guideIdSchema, idempotencyKeySchema, privateGuideSchema, publishedGuideSchema, publishedStepSchema, reviewedGuideSchema, type GuideDraft, type PrivateGuide, type PublishedGuide } from "@/contracts/guide";
import { ApiError, notFound, storageError } from "@/server/api/errors";
import { withStorageDeadline } from "@/server/api/deadline";
import { getDb } from "@/server/firebase";
import { enforceRateLimit } from "@/server/rate-limit";
import { ownerKey, type VerifiedViewer } from "@/server/session";

const storedGuideSchema = privateGuideSchema.extend({
  ownerKey: z.string().regex(/^[a-f0-9]{64}$/),
  requestKey: z.string().regex(/^[a-f0-9]{64}$/),
}).superRefine((document, ctx) => {
  if ((document.status === "published") !== (document.publishedAt !== null)) {
    ctx.addIssue({ code: "custom", message: "Publication metadata is inconsistent." });
  }
});
type StoredGuide = z.infer<typeof storedGuideSchema>;
const requestRecordSchema = z.strictObject({
  guideId: guideIdSchema, bodyHash: z.string().regex(/^[a-f0-9]{64}$/), ownerKey: z.string().regex(/^[a-f0-9]{64}$/),
});
function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function privateProjection(document: StoredGuide): PrivateGuide {
  return privateGuideSchema.parse({
    id: document.id, status: document.status, guide: document.guide, createdAt: document.createdAt, publishedAt: document.publishedAt,
  });
}
export function publicProjection(document: PrivateGuide): PublishedGuide {
  if (document.status !== "published" || !document.publishedAt) throw notFound();
  return publishedGuideSchema.parse({
    version: 1, id: document.id, status: "published", title: document.guide.title ?? "Local directions",
    steps: document.guide.steps.map((step) => publishedStepSchema.parse({
      id: step.id, instruction: step.instruction, direction: step.direction, incline: step.incline,
      landmark: step.landmark, distance: step.distance, confidence: step.confidence,
      warnings: step.warnings, needsReview: step.needsReview,
    })),
    warnings: document.guide.warnings, needsReview: document.guide.needsReview,
    createdAt: document.createdAt, publishedAt: document.publishedAt,
  });
}

export async function createGuide(guide: GuideDraft, viewer: VerifiedViewer, idempotencyKey: string): Promise<{ id: string; status: "draft" | "published"; created: boolean }> {
  const parsedKey = idempotencyKeySchema.safeParse(idempotencyKey);
  const parsedGuide = reviewedGuideSchema.safeParse(guide);
  if (!parsedKey.success || !parsedGuide.success) throw new ApiError("invalid_request", 400, "A confirmed guide and a valid Idempotency-Key are required.");
  const owner = ownerKey(viewer);
  const requestKey = digest(owner + ":" + parsedKey.data);
  const bodyHash = digest(JSON.stringify(parsedGuide.data));
  try {
    const db = getDb();
    const requestRef = db.collection("_guide_requests").doc(requestKey);
    for (let collision = 0; collision < 3; collision++) {
      const id = randomBytes(16).toString("base64url");
      const guideRef = db.collection("guides").doc(id);
      const result = await withStorageDeadline(db.runTransaction(async (transaction) => {
        const previous = await transaction.get(requestRef);
        if (previous.exists) {
          const record = requestRecordSchema.parse(previous.data());
          if (record.ownerKey !== owner || record.bodyHash !== bodyHash) {
            throw new ApiError("idempotency_conflict", 409, "This Idempotency-Key was used for a different guide.");
          }
          const existing = storedGuideSchema.parse((await transaction.get(db.collection("guides").doc(record.guideId))).data());
          if (existing.ownerKey !== owner || existing.requestKey !== requestKey) throw storageError();
          return { id: existing.id, status: existing.status, created: false };
        }
        if ((await transaction.get(guideRef)).exists) return null;
        const document = storedGuideSchema.parse({
          id, status: "draft", guide: parsedGuide.data, ownerKey: owner, requestKey,
          createdAt: new Date().toISOString(), publishedAt: null,
        });
        transaction.create(guideRef, document);
        transaction.create(requestRef, { guideId: id, bodyHash, ownerKey: owner });
        return { id, status: "draft" as const, created: true };
      }, { maxAttempts: 3 }));
      if (result) return result;
    }
    throw storageError();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw storageError();
  }
}

async function readDocument(id: string): Promise<StoredGuide | null> {
  if (!guideIdSchema.safeParse(id).success) return null;
  try {
    const snapshot = await withStorageDeadline(getDb().collection("guides").doc(id).get());
    if (!snapshot.exists) return null;
    const document = storedGuideSchema.parse(snapshot.data());
    if (document.id !== id) throw storageError();
    return document;
  } catch { throw storageError(); }
}

/** Server pages call these functions directly; no self-fetch or client Firebase SDK. */
export async function getGuideForViewer(id: string, viewer: VerifiedViewer | null): Promise<PrivateGuide | PublishedGuide | null> {
  if (!guideIdSchema.safeParse(id).success) return null;
  await enforceRateLimit("read");
  const document = await readDocument(id);
  if (!document) return null;
  if (viewer && document.ownerKey === ownerKey(viewer)) return privateProjection(document);
  return document.status === "published" ? publicProjection(document) : null;
}
export async function getPublishedGuide(id: string): Promise<PublishedGuide | null> {
  const guide = await getGuideForViewer(id, null);
  return guide ? publishedGuideSchema.parse(guide) : null;
}

export async function setPublished(id: string, viewer: VerifiedViewer, publish: boolean, acknowledgeWarnings = false): Promise<{ id: string; status: "draft" | "published" }> {
  if (!guideIdSchema.safeParse(id).success) throw notFound();
  try {
    const db = getDb();
    const ref = db.collection("guides").doc(id);
    return await withStorageDeadline(db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw notFound();
      const document = storedGuideSchema.parse(snapshot.data());
      if (document.id !== id || document.ownerKey !== ownerKey(viewer)) throw notFound();
      if (publish && (document.guide.needsReview || document.guide.warnings.length > 0 ||
          document.guide.steps.some((step) => step.needsReview || step.warnings.length > 0)) && !acknowledgeWarnings) {
        throw new ApiError("confirmation_required", 422, "Acknowledge all remaining uncertainty before publishing.");
      }
      const status = publish ? "published" as const : "draft" as const;
      if (document.status !== status) {
        transaction.update(ref, { status, publishedAt: publish ? new Date().toISOString() : null });
      }
      return { id, status };
    }, { maxAttempts: 3 }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw storageError();
  }
}
export async function deleteGuide(id: string, viewer: VerifiedViewer): Promise<void> {
  if (!guideIdSchema.safeParse(id).success) throw notFound();
  try {
    const db = getDb();
    const ref = db.collection("guides").doc(id);
    await withStorageDeadline(db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw notFound();
      const document = storedGuideSchema.parse(snapshot.data());
      if (document.id !== id || document.ownerKey !== ownerKey(viewer)) throw notFound();
      const requestRef = db.collection("_guide_requests").doc(document.requestKey);
      const record = requestRecordSchema.parse((await transaction.get(requestRef)).data());
      if (record.guideId !== id || record.ownerKey !== document.ownerKey) throw storageError();
      transaction.delete(ref);
      transaction.delete(requestRef);
    }, { maxAttempts: 3 }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw storageError();
  }
}
