import "server-only";

import type { GuideDraft } from "@/contracts/guide";
import type { ExtractionModelOutput, TranscriptionModelOutput } from "@/server/directions/pipeline";

export function modelFixture(guide: GuideDraft): { transcription: TranscriptionModelOutput; extraction: ExtractionModelOutput } {
  return {
    transcription: {
      hasSpeech: true, languages: guide.languages.detected,
      segments: guide.transcript.segments.map(({ original, translation }) => ({ original, translation })),
      warnings: guide.warnings,
    },
    extraction: {
      isDirections: true, warnings: guide.warnings,
      steps: guide.steps.map((step) => ({
        instruction: step.instruction, direction: step.direction, incline: step.incline, landmark: step.landmark,
        distance: {
          spoken: step.distance.spoken,
          translation: step.distance.spoken === null ? null : step.distance.meters === 200 ? "two hundred meters" : "a little further",
        },
        evidence: { original: step.evidence?.original ?? "", translation: step.evidence?.translation ?? "" },
        confidence: step.confidence, warnings: step.warnings, needsReview: step.needsReview,
      })),
    },
  };
}
