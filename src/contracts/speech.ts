import { z } from "zod";
import { editableStepSchema, apiErrorSchema, stepSchema, type Step } from "./guide";

export const speechLanguageSchema = z.enum(["en", "ml", "hi"]);
export type SpeechLanguage = z.infer<typeof speechLanguageSchema>;
export const narrationInputSchema = z.strictObject({
  step: editableStepSchema.extend({ warnings: stepSchema.shape.warnings }),
  routeWarnings: z.array(z.string().trim().min(1).max(500)).max(20),
});
export type NarrationInput = z.infer<typeof narrationInputSchema>;
export function narrationInput(step: Step | undefined, routeWarnings: string[]): NarrationInput | null {
  if (!step) return null;
  const { instruction, direction, incline, landmark, distance, warnings } = step;
  return { step: { instruction, direction, incline, landmark, distance, warnings }, routeWarnings };
}
export const narrationSectionsSchema = z.strictObject({
  instruction: z.string().trim().min(1).max(1500),
  landmark: z.string().trim().min(1).max(500).nullable(),
  distance: z.string().trim().min(1).max(500).nullable(),
  warnings: z.array(z.string().trim().min(1).max(750)).max(30),
});
export type NarrationSections = z.infer<typeof narrationSectionsSchema>;
export const translationRequestSchema = narrationInputSchema.extend({ language: speechLanguageSchema });
export const translationResponseSchema = z.strictObject({
  data: z.strictObject({ language: speechLanguageSchema, sections: narrationSectionsSchema }), requestId: z.uuid(),
});
export const speechRequestSchema = z.strictObject({ text: z.string().trim().min(1).max(600), language: speechLanguageSchema });
export { apiErrorSchema as speechErrorSchema };

/** Narrate route facts and spoken hedges; generated review warnings stay on screen. */
export function englishNarration(input: NarrationInput): NarrationSections {
  return narrationSectionsSchema.parse({
    instruction: input.step.instruction,
    landmark: input.step.landmark.label,
    distance: input.step.distance.meters !== null ? `${input.step.distance.meters} meters`
      : input.step.distance.spoken,
    warnings: [],
  });
}
export function narrationText(sections: NarrationSections): string {
  return [sections.instruction, sections.landmark, sections.distance]
    .filter((part) => part !== null)
    .reduce((text, part) => text ? text + (/[.!?।]$/.test(text.trimEnd()) ? " " : ". ") + part : part, "");
}
/** Lossless bounded pieces; never cut a surrogate pair. */
export function speechChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 600) {
    const prefix = remaining.slice(0, 600);
    const boundary = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("। "), prefix.lastIndexOf(" "));
    let cut = boundary >= 300 ? boundary + 1 : 600;
    if (/^[\uDC00-\uDFFF]$/.test(remaining[cut] ?? "")) cut--;
    chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
