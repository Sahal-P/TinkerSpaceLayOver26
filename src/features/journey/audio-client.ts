import { MAX_AUDIO_BYTES } from "@/contracts/audio";

export type AudioClip = { file: File; durationMs: number };
/** Imported on file selection, not in the landing or initial recording bundle. */
export async function prepareClip(
  blob: Blob,
  signal: AbortSignal,
): Promise<AudioClip> {
  if (blob.size > MAX_AUDIO_BYTES)
    throw new Error("Audio must be at most 4 MiB.");
  const { inspectAudioSource } = await import("@/lib/audio-inspection");
  const inspected = await inspectAudioSource(blob, signal);
  const mime =
    inspected.mimeType === "audio/m4a" ? "audio/mp4" : inspected.mimeType;
  const extension =
    (
      {
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
        "audio/webm": "webm",
        "audio/flac": "flac",
      } as Record<string, string>
    )[mime] ?? "audio";
  return {
    file: new File([blob], "directions." + extension, { type: mime }),
    durationMs: inspected.actualDurationMs,
  };
}
