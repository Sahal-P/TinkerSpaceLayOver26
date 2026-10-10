import { describe, expect, it } from "vitest";
import { isSilentPcmPacket } from "./pcm-silence";

describe("exact PCM digital silence", () => {
  it.each(["pcm-s8", "pcm-s16", "pcm-s16be", "pcm-s24", "pcm-s24be", "pcm-s32", "pcm-s32be"])(
    "checks all %s sample bytes without an amplitude threshold", (codec) => {
      const samples = new Uint8Array(24);
      expect(isSilentPcmPacket(samples, codec)).toBe(true);
      samples[23] = 1;
      expect(isSilentPcmPacket(samples, codec)).toBe(false);
    },
  );
  it("uses the unsigned 8-bit midpoint", () => {
    expect(isSilentPcmPacket(new Uint8Array([128, 128]), "pcm-u8")).toBe(true);
    expect(isSilentPcmPacket(new Uint8Array([128, 0]), "pcm-u8")).toBe(false);
  });
  it.each(["pcm-f32", "pcm-f32be", "pcm-f64", "pcm-f64be"])("checks %s positive/negative zero and offset views", (codec) => {
    const width = codec.includes("32") ? 4 : 8;
    const storage = new Uint8Array(width * 2 + 2).fill(255);
    const samples = storage.subarray(1, 1 + width * 2);
    const view = new DataView(samples.buffer, samples.byteOffset, samples.byteLength);
    const write = (offset: number, value: number) => width === 4
      ? view.setFloat32(offset, value, !codec.endsWith("be"))
      : view.setFloat64(offset, value, !codec.endsWith("be"));
    write(0, 0); write(width, -0);
    expect(isSilentPcmPacket(samples, codec)).toBe(true);
    for (const value of [Number.MIN_VALUE, 0.000001, Number.NaN, Infinity]) {
      write(width, value);
      // A value rounded by float32 to exact zero really is silent in that encoding.
      if (width === 4 && value === Number.MIN_VALUE) continue;
      expect(isSilentPcmPacket(samples, codec)).toBe(false);
    }
  });
  it("does not infer silence from empty, malformed or compressed bytes", () => {
    expect(isSilentPcmPacket(new Uint8Array(), "pcm-s16")).toBe(false);
    expect(isSilentPcmPacket(new Uint8Array(3), "pcm-s16")).toBe(false);
    expect(isSilentPcmPacket(new Uint8Array(3), "pcm-f32")).toBe(false);
    expect(isSilentPcmPacket(new Uint8Array(24), "opus")).toBe(false);
  });
});
