import { describe, expect, it } from "vitest";
import { inspectAudioSource } from "@/lib/audio-inspection";
import { pcmToWav } from "./pcm-audio";

describe("Gemini 2.5 PCM audio boundary", () => {
  const mimeType = "audio/L16;codec=pcm;rate=24000";
  it("wraps 24 kHz mono little-endian PCM without altering samples", async () => {
    const pcm = Buffer.alloc(96000); pcm.writeInt16LE(-2000, 0); pcm.writeInt16LE(2000, 2);
    const wav = pcmToWav({ mimeType, data: pcm.toString("base64") });
    expect(wav.slice(44)).toEqual(pcm);
    expect(Buffer.from(wav).toString("ascii", 0, 4)).toBe("RIFF");
    expect(await inspectAudioSource(wav, new AbortController().signal, 1)).toMatchObject({ mimeType: "audio/wav", actualDurationMs: 2000, digitalSilence: false });
  });
  it("rejects unknown encodings, rates, channels and malformed/oversized samples", () => {
    for (const mime of ["audio/wav", "audio/L16", "audio/L16;rate=16000", "audio/L16;rate=24000;channels=2", "audio/L16;rate=24000;rate=24000", "audio/L16;rate=24000;codec=mp3"]) {
      expect(() => pcmToWav({ mimeType: mime, data: "AQI=" })).toThrow();
    }
    for (const data of ["", "A===", "AA", "AQ==", "AB==", "private text", Buffer.alloc(4 * 1024 * 1024).toString("base64")]) {
      expect(() => pcmToWav({ mimeType, data })).toThrow();
    }
  });
});
