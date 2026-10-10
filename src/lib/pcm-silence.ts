/** Exact digital silence only: no amplitude threshold or speech inference. */
export function isSilentPcmPacket(data: Uint8Array, codec: string): boolean {
  if (data.byteLength === 0) return false;
  if (codec === "pcm-u8") return data.every((sample) => sample === 128);
  const integerBytes: Record<string, number> = {
    "pcm-s8": 1, "pcm-s16": 2, "pcm-s16be": 2,
    "pcm-s24": 3, "pcm-s24be": 3, "pcm-s32": 4, "pcm-s32be": 4,
  };
  const width = integerBytes[codec];
  if (width) return data.byteLength % width === 0 && data.every((byte) => byte === 0);
  const floatWidth = codec === "pcm-f32" || codec === "pcm-f32be" ? 4
    : codec === "pcm-f64" || codec === "pcm-f64be" ? 8 : 0;
  if (!floatWidth || data.byteLength % floatWidth !== 0) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const littleEndian = !codec.endsWith("be");
  for (let offset = 0; offset < data.byteLength; offset += floatWidth) {
    const sample = floatWidth === 4 ? view.getFloat32(offset, littleEndian) : view.getFloat64(offset, littleEndian);
    if (sample !== 0) return false; // Both +0 and -0 are silent; NaN/infinity are not.
  }
  return true;
}
