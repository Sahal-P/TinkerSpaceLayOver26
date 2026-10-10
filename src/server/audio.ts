import "server-only";

import {
  AudioInspectionError,
  inspectAudioSource,
} from "@/lib/audio-inspection";

import {
  audioMetadataSchema,
  MAX_AUDIO_BYTES,
  MAX_MULTIPART_BYTES,
  type AudioMetadata,
} from "@/contracts/audio";
import { ApiError, requestAborted, validationError } from "@/server/api/errors";
import { readLimitedBody } from "@/server/api/http";

const declaredTypes: Record<string, string> = {
  "audio/wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/mp3": "audio/mpeg",
  "audio/mpeg": "audio/mpeg",
  "audio/mp4": "audio/m4a",
  "audio/m4a": "audio/m4a",
  "audio/x-m4a": "audio/m4a",
  "audio/ogg": "audio/ogg",
  "audio/opus": "audio/ogg",
  "audio/webm": "audio/webm",
  "audio/flac": "audio/flac",
  "audio/x-flac": "audio/flac",
};
export type ValidatedAudio = AudioMetadata & Awaited<ReturnType<typeof inspectAudio>> & {
  bytes: Uint8Array;
};
function invalidAudio(): ApiError {
  return new ApiError(
    "invalid_audio",
    422,
    "The file is not a valid supported audio clip.",
  );
}

export async function inspectAudio(
  bytes: Uint8Array,
  declared: string,
  signal: AbortSignal,
): Promise<Awaited<ReturnType<typeof inspectAudioSource>>> {
  const normalized =
    declaredTypes[declared.split(";")[0]?.trim().toLowerCase() ?? ""];
  if (!normalized)
    throw new ApiError(
      "unsupported_media_type",
      415,
      "Use WAV, MP3, M4A, Ogg, WebM, or FLAC audio.",
    );
  try {
    const inspected = await inspectAudioSource(bytes, signal);
    if (inspected.mimeType !== normalized)
      throw new ApiError(
        "unsupported_media_type",
        415,
        "The declared audio type does not match the file.",
      );
    return inspected;
  } catch (error) {
    if (error instanceof AudioInspectionError) {
      if (error.code === "request_timeout") throw requestAborted();
      throw new ApiError(
        error.code,
        error.code === "audio_too_large" ? 413 : 422,
        error.message,
      );
    }
    throw error;
  }
}

export async function readAudio(
  request: Request,
  signal = request.signal,
): Promise<ValidatedAudio> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.split(";")[0]?.trim().toLowerCase() !== "multipart/form-data"
  ) {
    throw new ApiError(
      "unsupported_media_type",
      415,
      "Use multipart/form-data.",
    );
  }
  let body: Uint8Array;
  try {
    body = await readLimitedBody(request, MAX_MULTIPART_BYTES, signal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 413)
      throw new ApiError(
        "audio_too_large",
        413,
        "Audio must be at most 4 MiB.",
      );
    throw error;
  }
  let form: FormData;
  try {
    form = await new Response(Uint8Array.from(body), {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw validationError();
  } finally {
    body.fill(0);
  }
  const allowed = new Set(["audio", "languageHint", "durationMs", "consent"]);
  const entries = [...form.entries()];
  if (
    entries.some(([key]) => !allowed.has(key) || form.getAll(key).length !== 1)
  )
    throw validationError();
  if (form.get("consent") !== "true")
    throw new ApiError(
      "consent_required",
      400,
      "Recording consent must be confirmed.",
    );
  const file = form.get("audio");
  if (!(file instanceof File)) throw validationError();
  if (file.size > MAX_AUDIO_BYTES)
    throw new ApiError("audio_too_large", 413, "Audio must be at most 4 MiB.");
  const duration = form.get("durationMs");
  if (typeof duration !== "string" || !/^\d+(?:\.\d+)?$/.test(duration))
    throw validationError();
  const result = audioMetadataSchema.safeParse({
    languageHint: form.get("languageHint") ?? "auto",
    durationMs: Number(duration),
    consent: true,
  });
  if (!result.success) throw validationError();
  if (
    result.data.languageHint !== "auto" &&
    !["ml", "hi", "en"].includes(
      new Intl.Locale(result.data.languageHint).language,
    )
  ) {
    throw new ApiError(
      "unsupported_language",
      422,
      "Use Malayalam, Hindi, or English audio.",
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const inspected = await inspectAudio(bytes, file.type, signal);
    if (Math.abs(inspected.actualDurationMs - result.data.durationMs) > 1000)
      throw invalidAudio();
    return { ...result.data, ...inspected, bytes };
  } catch (error) {
    bytes.fill(0);
    throw error;
  }
}
