import type { GuideDraft, Step as CanonicalStep } from "@/contracts/guide";
import { SCENE_STOP_IDS } from "@/components/scene/stops";
import type { Step } from "./schemas";

export function presentStep(
  step: CanonicalStep,
  index: number,
  demo = false,
): Step {
  const { landmark, distance, evidence, ...fields } = step;
  return {
    ...fields,
    landmark: landmark.label,
    distanceM: distance.meters,
    distanceSpoken: distance.spoken,
    original: evidence?.original ?? "",
    note: step.warnings.join(" ") || undefined,
    lookFor: landmark.label ?? step.instruction,
    anchor: demo ? (SCENE_STOP_IDS[index] ?? null) : null,
  };
}
export function detectedLanguageLabel(guide: GuideDraft): string {
  const names: Record<string, string> = {
    ml: "Malayalam",
    hi: "Hindi",
    en: "English",
  };
  return guide.languages.detected
    .map(({ code }) => names[new Intl.Locale(code).language] ?? code)
    .join(" + ");
}

/** Preserve the canonical scalar rather than rounding a positive distance to zero. */
export function formatGuideDistance(meters: number): string {
  return (
    new Intl.NumberFormat("en", { maximumSignificantDigits: 21 }).format(
      meters,
    ) + " m"
  );
}
