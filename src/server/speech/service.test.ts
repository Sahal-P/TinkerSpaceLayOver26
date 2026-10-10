import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ApiError as GeminiApiError } from "@google/genai";
import { pcmToWav } from "./pcm-audio";
import { englishNarration, narrationInput } from "@/contracts/speech";
import { englishFixture } from "@/contracts/fixtures";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), tts: vi.fn() }));
vi.mock("@/server/gemini", () => ({ getGemini: () => ({ models: { generateContent: (params: { model: string }) => params.model === "gemini-2.5-flash-preview-tts" ? mocks.tts(params) : mocks.generate(params) } }) }));
import { synthesizeSpeech, translateNarration, validTranslation, speechCacheKey } from "./service";
beforeEach(() => { vi.stubEnv("GEMINI_API_KEY", "unit-test-key"); mocks.generate.mockReset(); mocks.tts.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
const input = narrationInput(englishFixture.steps[0], []);
if (!input) throw new Error("Missing fixture");

describe("Gemini speech and translation boundaries", () => {
  it("validates short real WAV signals and caches by session/content/language", async () => {
    const pcm = Buffer.alloc(96000); pcm.writeInt16LE(1000, 0);
    const data = { mimeType: "audio/L16;codec=pcm;rate=24000", data: pcm.toString("base64") };
    const bytes = pcmToWav(data);
    mocks.tts.mockResolvedValue({ candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: data }] } }] });
    const owner = randomUUID(); const signal = new AbortController().signal;
    expect(await synthesizeSpeech("Turn left", "en", owner, signal)).toEqual(bytes);
    await synthesizeSpeech("Turn left", "en", owner, signal); expect(mocks.tts).toHaveBeenCalledTimes(1);
    await synthesizeSpeech("Turn left", "hi", owner, signal); expect(mocks.tts).toHaveBeenCalledTimes(2);
    expect(mocks.tts.mock.calls[0]?.[0]).toMatchObject({ model: "gemini-2.5-flash-preview-tts", config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }, httpOptions: { retryOptions: { attempts: 1 } } } });
    expect(mocks.tts.mock.calls[0]?.[0].config.speechConfig).not.toHaveProperty("languageCode");
    expect(speechCacheKey(owner, "audio", "Turn left", "model", "en")).not.toContain("Turn left");
  });
  it("rejects corrupt or silent output and quota/configuration failures safely", async () => {
    const signal = new AbortController().signal;
    mocks.tts.mockResolvedValue({ candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: { mimeType: "audio/wav", data: "Y29ycnVwdA==" } }] } }] });
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
  it("recognizes Malayalam negative inflections and spoken hedges without dropping guards", () => {
    const source = { instruction: "The heading was not specified. Maybe turn left.", landmark: null, distance: null, warnings: [] };
    const translated = { ...source, instruction: "ദിശ വ്യക്തമാക്കിയിട്ടില്ല. ഒരുപക്ഷേ ഇടത്തേക്ക് തിരിയുക." };
    expect(validTranslation(source, translated, "ml")).toBe(true);
    expect(validTranslation(source, { ...translated, instruction: "ദിശ വ്യക്തമാണ്. ഒരുപക്ഷേ ഇടത്തേക്ക് തിരിയുക." }, "ml")).toBe(false);
    expect(validTranslation(source, { ...translated, instruction: "ദിശ വ്യക്തമാക്കിയിട്ടില്ല. ഇടത്തേക്ക് തിരിയുക." }, "ml")).toBe(false);
    expect(validTranslation(source, { ...translated, instruction: "ദിശ വ്യക്തമാക്കിയിട്ടില്ല. ഒരുപക്ഷേ വലത്തേക്ക് തിരിയുക." }, "ml")).toBe(false);
    expect(validTranslation({ ...source, instruction: "Do not turn left." }, { ...translated, instruction: "വില്ലേജിൽ ഇടത്തേക്ക് തിരിയുക." }, "ml")).toBe(false);
    const uncertain = { ...source, instruction: "I think the bridge is nearby." };
    expect(validTranslation(uncertain, { ...uncertain, instruction: "പാലം അടുത്താണെന്ന് തോന്നുന്നു." }, "ml")).toBe(true);
  });
  it("accepts common Hindi nasal spellings without accepting the opposite turn", () => {
    const source = { instruction: "Turn left at the bridge.", landmark: "bridge", distance: null, warnings: [] };
    expect(validTranslation(source, { ...source, instruction: "bridge पर बाएं मुड़ें।" }, "hi")).toBe(true);
    expect(validTranslation(source, { ...source, instruction: "bridge पर दाएं मुड़ें।" }, "hi")).toBe(false);
    expect(validTranslation({ ...source, instruction: "Turn right at the bridge." }, { ...source, instruction: "bridge पर दाएं मुड़ें।" }, "hi")).toBe(true);
  });
  it("omits generated warnings before Malayalam translation and identifies failed safeguards", async () => {
    const warned = { ...input, step: { ...input.step, instruction: "Maybe turn left.", landmark: { spoken: null, label: null }, warnings: ["Not certain. Confirm with the speaker."] }, routeWarnings: ["The heading was not specified."] };
    const sections = { instruction: "ഒരുപക്ഷേ ഇടത്തേക്ക് തിരിയുക.", landmark: null, distance: null, warnings: [] };
    mocks.generate.mockResolvedValue({ text: JSON.stringify(sections) });
    expect(await translateNarration(warned, "ml", randomUUID(), new AbortController().signal)).toEqual(sections);
    const providerInput = mocks.generate.mock.calls[0]?.[0].contents[0].parts[0].text;
    expect(providerInput).not.toContain("Not certain"); expect(providerInput).not.toContain("heading");
    expect(warned.step.warnings).toHaveLength(1); expect(warned.routeWarnings).toHaveLength(1);
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...sections, instruction: "ഇടത്തേക്ക് തിരിയുക." }) });
    await expect(translateNarration(warned, "ml", randomUUID(), new AbortController().signal)).rejects.toMatchObject({
      code: "invalid_speech_output", diagnostic: { stage: "translation", reason: "uncertainty_missing", path: ["instruction"] },
    });
  });
  it("rejects truncated, blocked, silent and missing speech rather than using another model", async () => {
    const signal = new AbortController().signal;
    for (const response of [{ candidates: [{ finishReason: "MAX_TOKENS" }] }, { promptFeedback: { blockReason: "SAFETY" } }, {}]) {
      mocks.tts.mockResolvedValue(response);
      await expect(synthesizeSpeech("Turn left", "ml", randomUUID(), signal)).rejects.toMatchObject({ code: "invalid_speech_output", diagnostic: { stage: "synthesis" } });
    }
    mocks.tts.mockResolvedValue({ candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: Buffer.alloc(48000).toString("base64") } }] } }] });
    await expect(synthesizeSpeech("Turn left", "ml", randomUUID(), signal)).rejects.toMatchObject({ diagnostic: { reason: "silent_audio" } });
    expect(mocks.tts).toHaveBeenCalledTimes(4); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("reports model generation failures distinctly and never retries or substitutes a model", async () => {
    const signal = new AbortController().signal;
    mocks.tts.mockResolvedValue({ candidates: [{ finishReason: "OTHER" }] });
    await expect(synthesizeSpeech("ഇടത്തേക്ക് തിരിയുക.", "ml", randomUUID(), signal)).rejects.toMatchObject({
      diagnostic: { reason: "finish_other" }, message: "The AI voice model could not finish this narration. Retry voice or choose another language.", retryable: true,
    });
    mocks.tts.mockResolvedValue({ candidates: [{ finishReason: "LANGUAGE" }] });
    await expect(synthesizeSpeech("ഇടത്തേക്ക് തിരിയുക.", "ml", randomUUID(), signal)).rejects.toMatchObject({ diagnostic: { reason: "finish_language" }, retryable: false });
    expect(mocks.tts).toHaveBeenCalledTimes(2); expect(mocks.generate).not.toHaveBeenCalled();
  });
});
