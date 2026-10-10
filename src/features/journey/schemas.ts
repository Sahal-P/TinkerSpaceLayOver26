import { z } from "zod";
import type { SceneStopId } from "@/components/scene/stops";
import {
  editableStepSchema,
  type Step as CanonicalStep,
} from "@/contracts/guide";

/** Display-only fields. Canonical steps remain the sole domain state. */
export type Step = Omit<CanonicalStep, "landmark" | "distance" | "evidence"> & {
  anchor: SceneStopId | null;
  landmark: CanonicalStep["landmark"]["label"];
  distanceM: CanonicalStep["distance"]["meters"];
  distanceSpoken: CanonicalStep["distance"]["spoken"];
  original: string;
  note?: string;
  lookFor: string;
};
const nullableText = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  editableStepSchema.shape.landmark.shape.label,
);
const nullableNumber = z.preprocess((value) => {
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    if (!/^\d+(?:\.\d+)?$/.test(raw)) return Number.NaN;
    return Number(raw);
  }
  return value;
}, editableStepSchema.shape.distance.shape.meters);
/** HTML form conversion only; field bounds come from the canonical contract. */
export const stepDraftSchema = z.strictObject({
  instruction: editableStepSchema.shape.instruction,
  landmark: nullableText,
  direction: editableStepSchema.shape.direction,
  incline: z.preprocess(
    (value) => (value === "" ? null : value),
    editableStepSchema.shape.incline,
  ),
  distanceM: nullableNumber,
});
export type StepDraft = z.infer<typeof stepDraftSchema>;
export const LENS_OUTCOMES = ["match", "unsure", "mismatch"] as const;
export const lensScenarioSchema = z.strictObject({
  id: z.enum(["clear", "partial", "wrong"]),
  label: z.string(),
  outcome: z.enum(LENS_OUTCOMES),
  score: z.number().min(0).max(1),
});
export type LensOutcome = (typeof LENS_OUTCOMES)[number];
export type LensScenario = z.infer<typeof lensScenarioSchema>;
