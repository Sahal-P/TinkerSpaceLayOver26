import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BufferSource, Input, WEBM } from "mediabunny";
import { describe, expect, it } from "vitest";

import { MAX_AUDIO_BYTES } from "@/contracts/audio";
import { audioFixture, audioRequest } from "@/server/testing/audio-fixtures";

import { inspectAudio, readAudio } from "./audio";

describe("audio validation with real container fixtures", () => {
  it.each([
    ["wav", "audio/wav"], ["mp3", "audio/mpeg"], ["m4a", "audio/mp4"],
    ["ogg", "audio/ogg;codecs=opus"], ["webm", "audio/webm;codecs=opus"], ["flac", "audio/flac"],
  ] as const)("validates %s without invoking an external service or decoder", async (format, mime) => {
    const result = await inspectAudio(await audioFixture(format), mime, new AbortController().signal);
    expect(result.actualDurationMs).toBeGreaterThanOrEqual(2000);
    expect(result.actualDurationMs).toBeLessThan(2500);
  });
  it("computes duration for the WebM live header with missing metadata", async () => {
    const bytes = await readFile(fileURLToPath(new URL("./testing/audio/silence.webm", import.meta.url)));
    const input = new Input({ source: new BufferSource(bytes), formats: [WEBM] });
    try { expect(await input.getDurationFromMetadata(undefined, { skipLiveWait: true })).toBeNull(); }
    finally { input.dispose(); }
    expect((await inspectAudio(bytes, "audio/webm", new AbortController().signal)).actualDurationMs).toBeGreaterThanOrEqual(2000);
  });
  it("confirms digital silence only across all PCM packets", async () => {
    const wav = await audioFixture();
    expect((await inspectAudio(wav, "audio/wav", new AbortController().signal)).digitalSilence).toBe(true);
    // A signal in the final sample must prevent a false silence classification.
    wav[wav.length - 2] = 1;
    expect((await inspectAudio(wav, "audio/wav", new AbortController().signal)).digitalSilence).toBe(false);
    expect((await inspectAudio(await audioFixture("webm"), "audio/webm", new AbortController().signal)).digitalSilence).toBe(false);
  });
  it("rejects corrupt, empty, oversized, spoofed-type, and unsupported input", async () => {
    const signal = new AbortController().signal;
    await expect(inspectAudio(new Uint8Array(), "audio/wav", signal)).rejects.toMatchObject({ code: "invalid_audio" });
    await expect(inspectAudio(new TextEncoder().encode("not audio"), "audio/wav", signal)).rejects.toMatchObject({ code: "invalid_audio" });
    await expect(inspectAudio(new Uint8Array(MAX_AUDIO_BYTES + 1), "audio/wav", signal)).rejects.toMatchObject({ status: 413 });
    await expect(inspectAudio(await audioFixture(), "audio/mp4", signal)).rejects.toMatchObject({ status: 415 });
    await expect(inspectAudio(await audioFixture(), "text/plain", signal)).rejects.toMatchObject({ status: 415 });
  });
  it("rejects a valid MP4 that contains video even when declared as audio", async () => {
    const bytes = await readFile(fileURLToPath(new URL("./testing/audio/silence-video.mp4", import.meta.url)));
    await expect(inspectAudio(bytes, "audio/mp4", new AbortController().signal)).rejects.toMatchObject({ code: "invalid_audio" });
  });
  it("enforces real minimum and maximum duration", async () => {
    for (const [sampleCount, code] of [[16000, "audio_too_short"], [16000 * 121, "audio_too_long"]] as const) {
      const wav = new Uint8Array(44 + sampleCount * 2);
      const view = new DataView(wav.buffer);
      for (const [offset, text] of [[0, "RIFF"], [8, "WAVE"], [12, "fmt "], [36, "data"]] as const) wav.set(new TextEncoder().encode(text), offset);
      view.setUint32(4, wav.length - 8, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
      view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, sampleCount * 2, true);
      await expect(inspectAudio(wav, "audio/wav", new AbortController().signal)).rejects.toMatchObject({ code });
    }
  });
  it("rejects a cancelled inspection", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(inspectAudio(await audioFixture(), "audio/wav", controller.signal)).rejects.toMatchObject({ code: "request_timeout" });
  });
});

describe("multipart boundary", () => {
  it("accepts recording MIME parameters and validates actual duration and hint", async () => {
    const audio = await readAudio(await audioRequest({ languageHint: "ml-IN" }));
    expect(audio.languageHint).toBe("ml-IN");
    expect(audio.mimeType).toBe("audio/wav");
    audio.bytes.fill(0);
  });
  it("rejects consent, duplicate audio, a false duration, invalid hints, and missing files", async () => {
    await expect(readAudio(await audioRequest({ consent: "false" }))).rejects.toMatchObject({ code: "consent_required" });
    await expect(readAudio(await audioRequest({ duplicate: true }))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(readAudio(await audioRequest({ duration: "5000" }))).rejects.toMatchObject({ code: "invalid_audio" });
    await expect(readAudio(await audioRequest({ duration: "garbage" }))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(readAudio(await audioRequest({ languageHint: "fr-FR" }))).rejects.toMatchObject({ code: "unsupported_language" });
    const form = new FormData(); form.set("consent", "true"); form.set("durationMs", "2000");
    await expect(readAudio(new Request("http://localhost", { method: "POST", body: form }))).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("rejects malformed multipart", async () => {
    await expect(readAudio(new Request("http://localhost", {
      method: "POST", headers: { "Content-Type": "multipart/form-data;boundary=missing" }, body: "invalid",
    }))).rejects.toMatchObject({ status: 400 });
  });
});
