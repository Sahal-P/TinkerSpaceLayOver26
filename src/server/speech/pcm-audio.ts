import "server-only";
import { z } from "zod";
import { SpeechOutputError } from "./diagnostics";

const pcmSchema = z.object({ mimeType: z.string().max(200), data: z.string().min(4).max(5600000) });
/** Gemini 2.5 TTS returns signed little-endian 16-bit PCM, 24 kHz, mono. */
export function pcmToWav(output: unknown): Uint8Array {
  const parsed = pcmSchema.safeParse(output);
  if (!parsed.success) throw new SpeechOutputError("synthesis", "invalid_structure", ["data"]);
  const [type, ...parameters] = parsed.data.mimeType.toLowerCase().split(";").map(value => value.trim());
  const values = new Map<string, string>();
  for (const parameter of parameters) {
    const pair = parameter.split("=");
    const key = pair[0]?.trim(); const value = pair[1]?.trim();
    if (pair.length !== 2 || !key || !value || values.has(key)) throw new SpeechOutputError("synthesis", "invalid_audio");
    values.set(key, value);
  }
  if (type !== "audio/l16" || values.get("rate") !== "24000" ||
    (values.has("codec") && values.get("codec") !== "pcm") ||
    (values.has("channels") && values.get("channels") !== "1") ||
    [...values.keys()].some(key => !["rate", "codec", "channels"].includes(key))) {
    throw new SpeechOutputError("synthesis", "invalid_audio");
  }
  const encoded = parsed.data.data;
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new SpeechOutputError("synthesis", "invalid_audio");
  const pcm = Buffer.from(encoded, "base64");
  if (!pcm.length || pcm.length % 2 !== 0 || pcm.length + 44 > 4 * 1024 * 1024 || pcm.toString("base64") !== encoded) {
    pcm.fill(0); throw new SpeechOutputError("synthesis", "invalid_audio");
  }
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + pcm.length, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36);
  wav.writeUInt32LE(pcm.length, 40); pcm.copy(wav, 44); pcm.fill(0);
  return wav;
}
