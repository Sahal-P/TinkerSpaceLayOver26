import { z } from "zod";

import { SCENE_STOP_IDS } from "@/components/scene/stops";
import { CONFIDENCE_LEVELS, DIRECTIONS } from "@/lib/wayfinding";

export const stepSchema = z.object({
  id: z.string().min(1),
  /** Landmark in the 3D scene this step points at; null for steps the traveler added. */
  anchor: z.enum(SCENE_STOP_IDS).nullable(),
  direction: z.enum(DIRECTIONS),
  instruction: z.string().trim().min(3, "Describe the step in a few words.").max(160, "Keep it under 160 characters."),
  landmark: z.string().trim().min(2, "Name the landmark to look for.").max(60, "Keep the name under 60 characters."),
  distanceM: z.number().int().min(0).max(5000),
  /** The phrase in the speaker's language. */
  original: z.string(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  /** Why the AI is unsure, shown for medium and low confidence. */
  note: z.string().optional(),
  /** What the Lens check compares against. */
  lookFor: z.string(),
  /** The traveler confirmed an uncertain step. */
  reviewed: z.boolean(),
});

export type Step = z.infer<typeof stepSchema>;

/** Fields editable in Review; values arrive as form strings. */
export const stepDraftSchema = z.object({
  instruction: stepSchema.shape.instruction,
  landmark: stepSchema.shape.landmark,
  direction: stepSchema.shape.direction,
  distanceM: z.coerce
    .number({ error: "Enter a distance in meters." })
    .int("Use whole meters.")
    .min(0, "Distance can't be negative.")
    .max(5000, "That's over 5 km. Split it into steps."),
});

export type StepDraft = z.infer<typeof stepDraftSchema>;

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  startSec: z.number().min(0),
  original: z.string().min(1),
  translation: z.string().min(1),
  /** Landmark phrases to highlight, in each language. */
  highlights: z.array(z.object({ original: z.string(), translation: z.string() })),
});

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const journeySchema = z.object({
  id: z.string(),
  title: z.string(),
  area: z.string(),
  city: z.string(),
  from: z.string(),
  to: z.string(),
  speaker: z.object({ name: z.string(), role: z.string() }),
  sourceLanguage: z.object({ code: z.string(), label: z.string() }),
  targetLanguage: z.object({ code: z.string(), label: z.string() }),
  recordedAt: z.iso.datetime(),
  durationSec: z.number().positive(),
  transcript: z.array(transcriptSegmentSchema).min(1),
  steps: z.array(stepSchema).min(1),
});

export type Journey = z.infer<typeof journeySchema>;

export const processingStageSchema = z.object({
  id: z.enum(["transcribe", "translate", "landmarks", "route"]),
  label: z.string(),
  detail: z.string(),
  durationMs: z.number().int().positive(),
});

export type ProcessingStage = z.infer<typeof processingStageSchema>;

export const LENS_OUTCOMES = ["match", "unsure", "mismatch"] as const;
export type LensOutcome = (typeof LENS_OUTCOMES)[number];

export const lensScenarioSchema = z.object({
  id: z.enum(["clear", "partial", "wrong"]),
  label: z.string(),
  outcome: z.enum(LENS_OUTCOMES),
  score: z.number().min(0).max(1),
});

export type LensScenario = z.infer<typeof lensScenarioSchema>;
