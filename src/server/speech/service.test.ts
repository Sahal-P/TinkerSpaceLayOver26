import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ApiError as GeminiApiError } from "@google/genai";
import { audioFixture } from "@/server/testing/audio-fixtures";
import { englishNarration, narrationInput } from "@/contracts/speech";
import { englishFixture } from "@/contracts/fixtures";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), tts: vi.fn() }));
vi.mock("@/server/gemini", () => ({ getGemini: () => ({ models: { generateContent: mocks.generate }, interactions: { create: mocks.tts } }) }));
import { synthesizeSpeech, translateNarration, validTranslation, speechCacheKey } from "./service";
beforeEach(() => { vi.stubEnv("GEMINI_API_KEY", "unit-test-key"); mocks.generate.mockReset(); mocks.tts.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
const input = narrationInput(englishFixture.steps[0], []);
if (!input) throw new Error("Missing fixture");

describe("Gemini speech and translation boundaries", () => {
  it("validates short real WAV signals and caches by session/content/language", async () => {
    const bytes = await audioFixture(); bytes[bytes.length - 2] = 1;
    mocks.tts.mockResolvedValue({ output_audio: { type: "audio", mime_type: "audio/wav", data: Buffer.from(bytes).toString("base64") } });
    const owner = randomUUID(); const signal = new AbortController().signal;
    expect(await synthesizeSpeech("Turn left", "en", owner, signal)).toEqual(bytes);
    await synthesizeSpeech("Turn left", "en", owner, signal); expect(mocks.tts).toHaveBeenCalledTimes(1);
    await synthesizeSpeech("Turn left", "hi", owner, signal); expect(mocks.tts).toHaveBeenCalledTimes(2);
    expect(mocks.tts.mock.calls[0]?.[0]).toMatchObject({ model: "gemini-3.8-flash-tts", store: false });
    expect(mocks.tts.mock.calls[0]?.[1]).toMatchObject({ maxRetries: 0 });
    expect(speechCacheKey(owner, "audio", "Turn left", "model", "en")).not.toContain("Turn left");
  });
  it("rejects corrupt or silent output and quota/configuration failures safely", async () => {
    const signal = new AbortController().signal;
    mocks.tts.mockResolvedValue({ output_audio: { type: "audio", mime_type: "audio/wav", data: "Y29ycnVwdA==" } });
    await expect(synthesizeSpeech("Corrupt", "en", randomUUID(), signal)).rejects.toMatchObject({ code: "invalid_speech_output" });
    mocks.tts.mockRejectedValue(new GeminiApiError({ status: 429, message: "secret provider text" }));
    await expect(synthesizeSpeech("Quota", "en", randomUUID(), signal)).rejects.toMatchObject({ code: "upstream_quota_exceeded", retryAfter: 60 });
    mocks.tts.mockRejectedValue(new GeminiApiError({ status: 400, message: "private" }));
    await expect(synthesizeSpeech("Config", "en", randomUUID(), signal)).rejects.toMatchObject({ code: "service_misconfigured", retryable: false });
  });
  it("cancels promises ignoring abort and validates translated fields/quantities/negation", async () => {
    const controller = new AbortController(); mocks.tts.mockImplementation(() => new Promise(() => {}));
    const work = synthesizeSpeech("Pending", "en", randomUUID(), controller.signal); controller.abort();
    await expect(work).rejects.toMatchObject({ code: "request_timeout" });
    const source = { instruction: "Do not go straight for 200 meters. Maybe turn left.", landmark: "bridge", distance: "three to five meters", warnings: ["Unknown direction"] };
    const translated = { ...source, instruction: "मत सीधे जाएँ 200 meters. शायद बाएँ मुड़ें।", warnings: ["अज्ञात दिशा"] };
    expect(validTranslation(source, translated, "hi")).toBe(true);
    expect(validTranslation(source, { ...translated, distance: "5 meters" }, "hi")).toBe(false);
    expect(validTranslation(source, { ...translated, instruction: "जाएँ 200 meters" }, "hi")).toBe(false);
    expect(validTranslation(source, { ...translated, landmark: "invented" }, "hi")).toBe(false);
    expect(validTranslation(source, { ...translated, instruction: "मत सीधे जाएँ 200 meters. शायद दाएँ मुड़ें।" }, "hi")).toBe(false);
    expect(validTranslation({ ...source, instruction: "Turn left or right at the bridge." }, { ...translated, instruction: "bridge पर बाएँ और दाएँ मुड़ें।" }, "hi")).toBe(false);
  });
  it("translates structured narration without changing domain data; rejects malformed output", async () => {
    const sections = englishNarration(input);
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...sections, instruction: "bus stop से शुरू करें।" }) });
    expect((await translateNarration(input, "hi", randomUUID(), new AbortController().signal)).landmark).toBe(sections.landmark);
    mocks.generate.mockResolvedValue({ text: '{"latitude":12}' });
    await expect(translateNarration(input, "ml", randomUUID(), new AbortController().signal)).rejects.toMatchObject({ code: "invalid_speech_output" });
  });
});
