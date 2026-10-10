import "server-only";

import { BufferSource, EncodedPacketSink, FLAC, Input, MP3, MP4, OGG, WAVE, WEBM } from "mediabunny";

import { audioMetadataSchema, MAX_AUDIO_BYTES, MAX_AUDIO_MS, MAX_MULTIPART_BYTES, MIN_AUDIO_MS, type AudioMetadata } from "@/contracts/audio";
import { ApiError, requestAborted, validationError } from "@/server/api/errors";
import { readLimitedBody } from "@/server/api/http";

const declaredTypes: Record<string, string> = {
  "audio/wav": "audio/wav", "audio/wave": "audio/wav", "audio/x-wav": "audio/wav",
  "audio/mp3": "audio/mpeg", "audio/mpeg": "audio/mpeg",
  "audio/mp4": "audio/m4a", "audio/m4a": "audio/m4a", "audio/x-m4a": "audio/m4a",
  "audio/ogg": "audio/ogg", "audio/opus": "audio/ogg",
  "audio/webm": "audio/webm", "audio/flac": "audio/flac", "audio/x-flac": "audio/flac",
};
const containerTypes: Record<string, string> = {
  "audio/wav": "audio/wav", "audio/mpeg": "audio/mpeg", "video/mp4": "audio/m4a",
  "audio/mp4": "audio/m4a", "application/ogg": "audio/ogg", "audio/ogg": "audio/ogg",
  "video/ogg": "audio/ogg", "video/webm": "audio/webm", "audio/webm": "audio/webm", "audio/flac": "audio/flac",
};
export type ValidatedAudio = AudioMetadata & { bytes: Uint8Array; mimeType: string; actualDurationMs: number };
function invalidAudio(): ApiError { return new ApiError("invalid_audio", 422, "The file is not a valid supported audio clip."); }

export async function inspectAudio(bytes: Uint8Array, declared: string, signal: AbortSignal): Promise<{ mimeType: string; actualDurationMs: number }> {
  if (bytes.byteLength === 0) throw invalidAudio();
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new ApiError("audio_too_large", 413, "Audio must be at most 4 MiB.");
  const normalized = declaredTypes[declared.split(";")[0]?.trim().toLowerCase() ?? ""];
  if (!normalized) throw new ApiError("unsupported_media_type", 415, "Use WAV, MP3, M4A, Ogg, WebM, or FLAC audio.");
  const input = new Input({ source: new BufferSource(bytes), formats: [WAVE, MP3, MP4, OGG, WEBM, FLAC] });
  const inspectionSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  const dispose = () => input.dispose();
  inspectionSignal.addEventListener("abort", dispose, { once: true });
  try {
    if (inspectionSignal.aborted) throw requestAborted();
    const format = await input.getFormat();
    const mimeType = containerTypes[format.mimeType];
    if (mimeType !== normalized) throw new ApiError("unsupported_media_type", 415, "The declared audio type does not match the file.");
    const tracks = await input.getAudioTracks();
    if (tracks.length !== 1 || (await input.getVideoTracks()).length > 0) throw invalidAudio();
    const track = tracks[0];
    if (!track) throw invalidAudio();
    const codec = await track.getCodec();
    if (!codec || !(["aac", "mp3", "opus", "vorbis", "flac"].includes(codec) || codec.startsWith("pcm-"))) throw invalidAudio();
    const sink = new EncodedPacketSink(track);
    const firstPacket = await sink.getFirstPacket({ skipLiveWait: true });
    if (!firstPacket || firstPacket.data.byteLength === 0) throw invalidAudio();
    // Some codecs have a short final packet; take the larger duration so it cannot evade the cap.
    const computedEnd = await track.computeDuration({ skipLiveWait: true });
    const metadataEnd = await track.getDurationFromMetadata({ skipLiveWait: true });
    if (!Number.isFinite(computedEnd) || (metadataEnd !== null && !Number.isFinite(metadataEnd))) throw invalidAudio();
    const duration = Math.max(computedEnd, metadataEnd ?? 0) - (await track.getFirstTimestamp());
    const actualDurationMs = Math.round(duration * 1000);
    if (!Number.isFinite(actualDurationMs) || actualDurationMs <= 0) throw invalidAudio();
    if (actualDurationMs < MIN_AUDIO_MS) throw new ApiError("audio_too_short", 422, "Audio must last at least two seconds.");
    if (actualDurationMs > MAX_AUDIO_MS) throw new ApiError("audio_too_long", 422, "Audio must last at most two minutes.");
    if (inspectionSignal.aborted) throw requestAborted();
    return { mimeType, actualDurationMs };
  } catch (error) {
    if (inspectionSignal.aborted) throw requestAborted();
    if (error instanceof ApiError) throw error;
    throw invalidAudio();
  } finally {
    inspectionSignal.removeEventListener("abort", dispose);
    input.dispose();
  }
}

export async function readAudio(request: Request, signal = request.signal): Promise<ValidatedAudio> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";")[0]?.trim().toLowerCase() !== "multipart/form-data") {
    throw new ApiError("unsupported_media_type", 415, "Use multipart/form-data.");
  }
  let body: Uint8Array;
  try { body = await readLimitedBody(request, MAX_MULTIPART_BYTES, signal); } catch (error) {
    if (error instanceof ApiError && error.status === 413) throw new ApiError("audio_too_large", 413, "Audio must be at most 4 MiB.");
    throw error;
  }
  let form: FormData;
  try {
    form = await new Response(Uint8Array.from(body), { headers: { "Content-Type": contentType } }).formData();
  } catch { throw validationError(); } finally { body.fill(0); }
  const allowed = new Set(["audio", "languageHint", "durationMs", "consent"]);
  const entries = [...form.entries()];
  if (entries.some(([key]) => !allowed.has(key) || form.getAll(key).length !== 1)) throw validationError();
  if (form.get("consent") !== "true") throw new ApiError("consent_required", 400, "Recording consent must be confirmed.");
  const file = form.get("audio");
  if (!(file instanceof File)) throw validationError();
  if (file.size > MAX_AUDIO_BYTES) throw new ApiError("audio_too_large", 413, "Audio must be at most 4 MiB.");
  const duration = form.get("durationMs");
  if (typeof duration !== "string" || !/^\d+(?:\.\d+)?$/.test(duration)) throw validationError();
  const result = audioMetadataSchema.safeParse({
    languageHint: form.get("languageHint") ?? "auto", durationMs: Number(duration), consent: true,
  });
  if (!result.success) throw validationError();
  if (result.data.languageHint !== "auto" && !["ml", "hi", "en"].includes(new Intl.Locale(result.data.languageHint).language)) {
    throw new ApiError("unsupported_language", 422, "Use Malayalam, Hindi, or English audio.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const inspected = await inspectAudio(bytes, file.type, signal);
    if (Math.abs(inspected.actualDurationMs - result.data.durationMs) > 1000) throw invalidAudio();
    return { ...result.data, ...inspected, bytes };
  } catch (error) { bytes.fill(0); throw error; }
}
