import {
  BlobSource,
  BufferSource,
  EncodedPacketSink,
  FLAC,
  Input,
  MP3,
  MP4,
  OGG,
  WAVE,
  WEBM,
} from "mediabunny";
import { MAX_AUDIO_BYTES, MAX_AUDIO_MS, MIN_AUDIO_MS } from "@/contracts/audio";
import { isSilentPcmPacket } from "./pcm-silence";
export class AudioInspectionError extends Error {
  constructor(
    public readonly code:
      | "invalid_audio"
      | "audio_too_large"
      | "audio_too_short"
      | "audio_too_long"
      | "request_timeout",
    message: string,
  ) {
    super(message);
  }
}
function invalidAudio(): AudioInspectionError {
  return new AudioInspectionError(
    "invalid_audio",
    "The file is not a valid supported audio clip.",
  );
}
const containerTypes: Record<string, string> = {
  "audio/wav": "audio/wav",
  "audio/mpeg": "audio/mpeg",
  "video/mp4": "audio/m4a",
  "audio/mp4": "audio/m4a",
  "application/ogg": "audio/ogg",
  "audio/ogg": "audio/ogg",
  "video/ogg": "audio/ogg",
  "video/webm": "audio/webm",
  "audio/webm": "audio/webm",
  "audio/flac": "audio/flac",
};
export async function inspectAudioSource(
  source: Uint8Array | Blob,
  signal: AbortSignal,
  minimumDurationMs = MIN_AUDIO_MS,
): Promise<{ mimeType: string; actualDurationMs: number; digitalSilence: boolean }> {
  const size = source instanceof Uint8Array ? source.byteLength : source.size;
  if (size === 0) throw invalidAudio();
  if (size > MAX_AUDIO_BYTES)
    throw new AudioInspectionError(
      "audio_too_large",
      "Audio must be at most 4 MiB.",
    );
  const input = new Input({
    source:
      source instanceof Uint8Array
        ? new BufferSource(source)
        : new BlobSource(source),
    formats: [WAVE, MP3, MP4, OGG, WEBM, FLAC],
  });
  const inspectionSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  const dispose = () => input.dispose();
  inspectionSignal.addEventListener("abort", dispose, { once: true });
  try {
    if (inspectionSignal.aborted)
      throw new AudioInspectionError(
        "request_timeout",
        "Audio inspection was cancelled or timed out.",
      );
    const format = await input.getFormat();
    const mimeType = containerTypes[format.mimeType];
    if (!mimeType) throw invalidAudio();
    const tracks = await input.getAudioTracks();
    if (tracks.length !== 1 || (await input.getVideoTracks()).length > 0)
      throw invalidAudio();
    const track = tracks[0];
    if (!track) throw invalidAudio();
    const codec = await track.getCodec();
    if (
      !codec ||
      !(
        ["aac", "mp3", "opus", "vorbis", "flac"].includes(codec) ||
        codec.startsWith("pcm-")
      )
    )
      throw invalidAudio();
    const sink = new EncodedPacketSink(track);
    const firstPacket = await sink.getFirstPacket({ skipLiveWait: true });
    if (!firstPacket || firstPacket.data.byteLength === 0) throw invalidAudio();
    // Some codecs have a short final packet; take the larger duration so it cannot evade the cap.
    const computedEnd = await track.computeDuration({ skipLiveWait: true });
    const metadataEnd = await track.getDurationFromMetadata({
      skipLiveWait: true,
    });
    if (
      !Number.isFinite(computedEnd) ||
      (metadataEnd !== null && !Number.isFinite(metadataEnd))
    )
      throw invalidAudio();
    const duration =
      Math.max(computedEnd, metadataEnd ?? 0) -
      (await track.getFirstTimestamp());
    const actualDurationMs = Math.round(duration * 1000);
    if (!Number.isFinite(actualDurationMs) || actualDurationMs <= 0)
      throw invalidAudio();
    if (actualDurationMs < minimumDurationMs)
      throw new AudioInspectionError(
        "audio_too_short",
        "Audio must last at least two seconds.",
      );
    if (actualDurationMs > MAX_AUDIO_MS)
      throw new AudioInspectionError(
        "audio_too_long",
        "Audio must last at most two minutes.",
      );
    // Compressed silence needs decoding; do not guess from encoded bytes. For PCM,
    // check every packet, stopping as soon as any nonzero sample is found.
    let digitalSilence = codec.startsWith("pcm-");
    if (digitalSilence) {
      for await (const packet of sink.packets(firstPacket, undefined, { skipLiveWait: true })) {
        if (inspectionSignal.aborted) break;
        if (!isSilentPcmPacket(packet.data, codec)) {
          digitalSilence = false;
          break;
        }
      }
    }
    if (inspectionSignal.aborted)
      throw new AudioInspectionError(
        "request_timeout",
        "Audio inspection was cancelled or timed out.",
      );
    return { mimeType, actualDurationMs, digitalSilence };
  } catch (error) {
    if (inspectionSignal.aborted)
      throw new AudioInspectionError(
        "request_timeout",
        "Audio inspection was cancelled or timed out.",
      );
    if (error instanceof AudioInspectionError) throw error;
    throw invalidAudio();
  } finally {
    inspectionSignal.removeEventListener("abort", dispose);
    input.dispose();
  }
}
