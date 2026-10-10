import { z } from "zod";

import { languageCodeSchema } from "./guide";

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
export const MIN_AUDIO_MS = 2000;
export const MAX_AUDIO_MS = 120000;
export const audioMetadataSchema = z.strictObject({
  languageHint: z.union([z.literal("auto"), languageCodeSchema]).default("auto"),
  durationMs: z.number().finite().min(MIN_AUDIO_MS).max(MAX_AUDIO_MS),
  consent: z.literal(true),
});
export type AudioMetadata = z.infer<typeof audioMetadataSchema>;
