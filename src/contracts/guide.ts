import { z } from "zod";

import { normalizeDistance } from "./distance";
import { contradictoryTurns, hedgedEvidence, supportsDirection, supportsIncline } from "./evidence";

export const MAX_GUIDE_BYTES = 128 * 1024;
export const MAX_STEPS = 40;
export const directionSchema = z.enum(["start", "straight", "slight_left", "left", "slight_right", "right", "u_turn", "arrive", "unknown"]);
export type Direction = z.infer<typeof directionSchema>;
export const confidenceSchema = z.enum(["high", "medium", "low"]);
export const guideIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const idempotencyKeySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const warningSchema = z.string().trim().min(1).max(500);
export const languageCodeSchema = z.string().min(2).max(35).refine((code) => {
  try { new Intl.Locale(code); return true; } catch { return false; }
}, "Use a BCP-47 language code.");
export const languagesSchema = z.strictObject({
  detected: z.array(z.strictObject({ code: languageCodeSchema, confidence: confidenceSchema })).min(1).max(3),
  target: z.literal("en"),
});
export const transcriptSegmentSchema = z.strictObject({
  id: z.string().min(1).max(64),
  original: z.string().min(1).max(4000),
  translation: z.string().min(1).max(4000),
  startSec: z.number().finite().min(0).max(120).nullable(),
  endSec: z.number().finite().min(0).max(120).nullable(),
}).superRefine((segment, ctx) => {
  if ((segment.startSec === null) !== (segment.endSec === null) ||
      (segment.startSec !== null && segment.endSec !== null && segment.endSec <= segment.startSec)) {
    ctx.addIssue({ code: "custom", message: "Segment timestamps must be a valid pair or both null." });
  }
});
export const transcriptSchema = z.strictObject({
  original: z.string().min(1).max(12000),
  translation: z.string().min(1).max(12000),
  segments: z.array(transcriptSegmentSchema).min(1).max(60),
}).superRefine((transcript, ctx) => {
  if (transcript.original !== transcript.segments.map((s) => s.original).join(" ") ||
      transcript.translation !== transcript.segments.map((s) => s.translation).join(" ") ||
      new Set(transcript.segments.map((s) => s.id)).size !== transcript.segments.length) {
    ctx.addIssue({ code: "custom", message: "Transcript must match its uniquely identified segments." });
  }
});
export const evidenceSchema = z.strictObject({
  original: z.string().min(1).max(4000),
  translation: z.string().min(1).max(4000),
  startSec: z.number().finite().min(0).max(120).nullable(),
});
const stepObjectSchema = z.strictObject({
  id: z.string().min(1).max(64),
  instruction: z.string().trim().min(1).max(1000),
  direction: directionSchema,
  incline: z.enum(["up", "down"]).nullable(),
  landmark: z.strictObject({ spoken: z.string().min(1).max(300).nullable(), label: z.string().min(1).max(300).nullable() }),
  distance: z.strictObject({ spoken: z.string().min(1).max(300).nullable(), meters: z.number().finite().min(0).max(1_000_000).nullable() }),
  evidence: evidenceSchema.nullable(),
  source: z.enum(["audio", "user"]),
  confidence: confidenceSchema,
  warnings: z.array(warningSchema).max(10),
  needsReview: z.boolean(),
  reviewed: z.boolean(),
});
export const stepSchema = stepObjectSchema.superRefine((step, ctx) => {
  if ((step.source === "audio" && !step.evidence) || (step.source === "user" && step.evidence !== null)) {
    ctx.addIssue({ code: "custom", message: "Audio steps need evidence; user corrections must not claim audio evidence." });
  }
  if (step.direction === "unknown" && (step.confidence !== "low" || !step.needsReview || step.warnings.length === 0)) {
    ctx.addIssue({ code: "custom", message: "Unknown directions require low confidence and an explicit warning." });
  }
  if ((step.confidence !== "high" || step.warnings.length > 0) && !step.needsReview) {
    ctx.addIssue({ code: "custom", message: "Uncertainty must remain visible even after confirmation." });
  }
  if (step.distance.spoken === null && step.distance.meters !== null) {
    ctx.addIssue({ code: "custom", message: "A normalized distance needs an explicit reference." });
  }
  if (step.source === "audio" && step.evidence) {
    const evidence = step.evidence;
    if (step.instruction !== evidence.translation ||
        !supportsDirection(step.direction, evidence.translation) || !supportsIncline(step.incline, evidence.translation) ||
        (contradictoryTurns(evidence.translation) && step.direction !== "unknown") ||
        (hedgedEvidence(evidence.translation) && step.confidence === "high") ||
        (step.landmark.spoken !== null && !evidence.original.includes(step.landmark.spoken)) ||
        (step.landmark.label !== null && !evidence.translation.toLowerCase().includes(step.landmark.label.toLowerCase())) ||
        ((step.landmark.spoken === null) !== (step.landmark.label === null)) ||
        (step.distance.spoken !== null && !evidence.original.includes(step.distance.spoken)) ||
        (step.distance.meters !== null && normalizeDistance(evidence.translation) !== step.distance.meters)) {
      ctx.addIssue({ code: "custom", message: "An audio-derived claim is not supported by its exact evidence." });
    }
  }
});
export type Step = z.infer<typeof stepSchema>;

export const guideDraftSchema = z.strictObject({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120).optional(),
  languages: languagesSchema,
  transcript: transcriptSchema,
  steps: z.array(stepSchema).min(1).max(MAX_STEPS),
  warnings: z.array(warningSchema).max(20),
  needsReview: z.boolean(),
}).superRefine((guide, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(guide)).byteLength > MAX_GUIDE_BYTES) {
    ctx.addIssue({ code: "custom", message: "Guide is too large." });
  }
  if (new Set(guide.steps.map((step) => step.id)).size !== guide.steps.length) {
    ctx.addIssue({ code: "custom", message: "Step IDs must be unique." });
  }
  let position = 0;
  for (const [index, step] of guide.steps.entries()) {
    if (step.source !== "audio" || !step.evidence) continue;
    const offset = guide.transcript.original.indexOf(step.evidence.original, position);
    const evidence = step.evidence;
    const pairedSegment = guide.transcript.segments.some((segment) =>
      segment.original.includes(evidence.original) && segment.translation.includes(evidence.translation) &&
      (evidence.startSec === null || evidence.startSec === segment.startSec));
    if (offset < 0 || !pairedSegment) {
      ctx.addIssue({ code: "custom", path: ["steps", index, "evidence"], message: "Evidence must occur in the transcript in source order." });
    } else position = offset;
  }
  if ((guide.warnings.length > 0 || guide.steps.some((step) => step.needsReview)) && !guide.needsReview) {
    ctx.addIssue({ code: "custom", message: "Guide uncertainty must remain visible." });
  }
  if (guide.languages.detected.some(({ code }) =>
    languageCodeSchema.safeParse(code).success && !["ml", "hi", "en"].includes(new Intl.Locale(code).language))) {
    ctx.addIssue({ code: "custom", message: "Only Malayalam, Hindi, and English are supported." });
  }
});
export type GuideDraft = z.infer<typeof guideDraftSchema>;
export const reviewedGuideSchema = guideDraftSchema.superRefine((guide, ctx) => {
  if (guide.steps.some((step) => !step.reviewed)) {
    ctx.addIssue({ code: "custom", message: "Confirm every step before saving." });
  }
});
export type ReviewedGuide = z.infer<typeof reviewedGuideSchema>;
export const createGuideSchema = z.strictObject({ guide: reviewedGuideSchema, confirmed: z.literal(true) });
export const publishGuideSchema = z.strictObject({ acknowledgeWarnings: z.boolean().default(false) });
export const publishedStepSchema = stepObjectSchema.omit({ evidence: true, source: true, reviewed: true });
export const guideSummarySchema = z.strictObject({ id: guideIdSchema, status: z.enum(["draft", "published"]) });
export const privateGuideSchema = z.strictObject({
  id: guideIdSchema, status: z.enum(["draft", "published"]), guide: reviewedGuideSchema,
  createdAt: z.iso.datetime(), publishedAt: z.iso.datetime().nullable(),
});
export const publishedGuideSchema = z.strictObject({
  version: z.literal(1), id: guideIdSchema, status: z.literal("published"), title: z.string().min(1).max(120),
  steps: z.array(publishedStepSchema).min(1).max(MAX_STEPS), warnings: z.array(warningSchema).max(20),
  needsReview: z.boolean(), createdAt: z.iso.datetime(), publishedAt: z.iso.datetime(),
});
export type PrivateGuide = z.infer<typeof privateGuideSchema>;
export type PublishedGuide = z.infer<typeof publishedGuideSchema>;
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({ code: z.string(), message: z.string(), retryable: z.boolean() }),
  requestId: z.uuid(),
});
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;
export const extractionResponseSchema = z.strictObject({ data: guideDraftSchema, requestId: z.uuid() });
export const creationResponseSchema = z.strictObject({ data: guideSummarySchema, requestId: z.uuid() });
export const publishResponseSchema = z.strictObject({
  data: guideSummarySchema.extend({ status: z.literal("published"), url: z.url() }), requestId: z.uuid(),
});
export const retrievalResponseSchema = z.strictObject({
  data: z.union([privateGuideSchema, publishedGuideSchema]), requestId: z.uuid(),
});
export type CreateGuideRequest = z.infer<typeof createGuideSchema>;
export type PublishGuideRequest = z.infer<typeof publishGuideSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
export type CreationResponse = z.infer<typeof creationResponseSchema>;
export type PublishResponse = z.infer<typeof publishResponseSchema>;
export type RetrievalResponse = z.infer<typeof retrievalResponseSchema>;
