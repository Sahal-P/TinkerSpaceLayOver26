import "server-only";
import { z } from "zod";
import { ApiError } from "@/server/api/errors";

const diagnosticSchema = z.strictObject({
  stage: z.enum(["translation", "synthesis"]),
  reason: z.enum(["blocked_output", "truncated_output", "missing_output", "invalid_json", "invalid_structure",
    "null_mismatch", "landmark_mismatch", "distance_mismatch", "warning_mismatch", "quantity_mismatch",
    "direction_mismatch", "alternative_mismatch", "negation_missing", "uncertainty_missing",
    "invalid_audio", "silent_audio", "cache_type_mismatch", "candidate_count", "part_count",
    "finish_language", "finish_recitation", "finish_other", "unexpected_finish"]),
  path: z.array(z.union([z.string(), z.number().int().nonnegative()])).max(8),
});
export type SpeechDiagnostic = z.infer<typeof diagnosticSchema>;
const fields = new Set(["instruction", "landmark", "distance", "warnings", "output_audio", "data", "candidates", "parts", "finishReason"]);

export class SpeechOutputError extends ApiError {
  readonly diagnostic: SpeechDiagnostic;
  constructor(stage: SpeechDiagnostic["stage"], reason: SpeechDiagnostic["reason"], path: readonly PropertyKey[] = []) {
    super("invalid_speech_output", 502, stage === "translation"
      ? "The translated voice text could not be validated."
      : reason === "finish_language" ? "The selected voice model does not support this language."
        : reason === "finish_other" ? "The AI voice model could not finish this narration. Retry voice or choose another language."
          : "The generated audio could not be validated.", reason !== "finish_language");
    this.diagnostic = diagnosticSchema.parse({ stage, reason, path: path.slice(0, 8).map(value =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 ? value
        : typeof value === "string" && fields.has(value) ? value : "field") });
  }
}
