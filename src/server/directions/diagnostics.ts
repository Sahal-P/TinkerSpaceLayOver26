import "server-only";
import { z } from "zod";
import { ApiError } from "@/server/api/errors";

const diagnosticSchema = z.strictObject({
  stage: z.enum(["transcription", "extraction", "assembly"]),
  reason: z.enum(["truncated_output", "invalid_json", "invalid_structure", "quote_mismatch", "evidence_ordering", "unsupported_direction", "unsupported_incline", "distance_mismatch", "landmark_mismatch", "transcript_bounds", "language_invalid", "guide_bounds"]),
  path: z.array(z.union([z.string(), z.number().int().nonnegative()])).max(8),
});
export type ExtractionDiagnostic = z.infer<typeof diagnosticSchema>;
export type DiagnosticSink = (diagnostic: ExtractionDiagnostic) => void;
const fields = new Set(["steps", "instruction", "direction", "incline", "landmark", "spoken", "label", "distance", "translation", "evidence", "original", "segments", "languages", "code", "warnings", "needsReview", "confidence", "transcript"]);
/** Only fixed reason codes and schema field names can enter diagnostics. */
export function rejectedOutput(
  reason: ExtractionDiagnostic["reason"], stage: ExtractionDiagnostic["stage"],
  path: readonly PropertyKey[] = [], sink?: DiagnosticSink,
): ApiError {
  const safePath = path.slice(0, 8).map(value => typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value : typeof value === "string" && fields.has(value) ? value : "field");
  sink?.(diagnosticSchema.parse({ stage, reason, path: safePath }));
  return new ApiError("invalid_model_output", 502, "The AI returned directions that could not be validated.", true);
}
