import { ApiError as GeminiApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { englishFixture, guideFixtures } from "@/contracts/fixtures";
import type { ValidatedAudio } from "@/server/audio";
import { modelFixture } from "@/server/testing/model-fixtures";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/server/gemini", () => ({ getGemini: () => ({ models: { generateContent: generate } }) }));
import { assembleDraft, extractDirections, PROCESSING_DEADLINE_MS } from "./pipeline";

const audio: ValidatedAudio = { bytes: new Uint8Array([1, 2, 3]), mimeType: "audio/wav", durationMs: 2000, actualDurationMs: 2000, digitalSilence: false, consent: true, languageHint: "auto" };
const response = (output: unknown) => ({ text: JSON.stringify(output), candidates: [{ finishReason: "STOP" }] });
beforeEach(() => { generate.mockReset(); vi.stubEnv("GEMINI_API_KEY", "unit-test-key"); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("source-grounded multilingual extraction", () => {
  it.each(Object.entries(guideFixtures))("extracts the %s representative sample without inventing data", (_, fixture) => {
    const { transcription, extraction } = modelFixture(fixture);
    const draft = assembleDraft(transcription, extraction);
    expect(draft.transcript.original).toBe(fixture.transcript.original);
    expect(draft.steps.map((step) => step.distance.meters)).toEqual(fixture.steps.map((step) => step.distance.meters));
    expect(draft.steps.every((step) => !step.reviewed)).toBe(true);
    expect(draft.steps.every((step) => step.evidence?.startSec === null)).toBe(true);
  });
  it("refuses phantom landmarks, distances, paraphrases, turns, and wrong order", () => {
    for (const change of [
      { landmark: { spoken: "invented temple", label: "temple" } },
      { distance: { spoken: "two hundred meters", translation: "500 meters" } },
      { instruction: "Go 500 meters to the temple." },
      { direction: "right" },
    ]) {
      const { transcription, extraction } = modelFixture(englishFixture);
      Object.assign(extraction.steps[1] ?? {}, change);
      expect(() => assembleDraft(transcription, extraction)).toThrow();
    }
    const { transcription, extraction } = modelFixture(englishFixture);
    extraction.steps.reverse();
    expect(() => assembleDraft(transcription, extraction)).toThrow();
  });
  it("does not treat a landmark on the left as a left turn", () => {
    const { transcription, extraction } = modelFixture(englishFixture);
    const step = extraction.steps[0]; const segment = transcription.segments[0];
    if (!step || !segment) throw new Error("Fixture missing");
    segment.original = segment.translation = "The bus stop is on the left.";
    step.instruction = segment.translation; step.evidence = { ...segment };
    step.direction = "left";
    expect(() => assembleDraft(transcription, extraction)).toThrow();
  });
  it("flags speaker hedging even when the model assigns high confidence", () => {
    const { transcription, extraction } = modelFixture(englishFixture);
    const step = extraction.steps[2]; const segment = transcription.segments[2];
    if (!step || !segment) throw new Error("Fixture missing");
    segment.original = segment.translation = "I think you turn left at the bridge.";
    step.instruction = segment.translation; step.evidence = { ...segment };
    const result = assembleDraft(transcription, extraction);
    expect(result.steps[2]).toMatchObject({ confidence: "medium", needsReview: true });
    expect(result.needsReview).toBe(true);
  });
  it("allows a genuine U-turn with an explicit downhill incline", () => {
    const { transcription, extraction } = modelFixture(englishFixture);
    const step = extraction.steps[2]; const segment = transcription.segments[2];
    if (!step || !segment) throw new Error("Fixture missing");
    segment.original = segment.translation = "Make a U-turn at the bridge and head downhill.";
    step.instruction = segment.translation; step.evidence = { ...segment }; step.direction = "u_turn"; step.incline = "down";
    expect(assembleDraft(transcription, extraction).steps[2]).toMatchObject({ direction: "u_turn", incline: "down" });
  });
});

describe("Gemini boundary, quotas, and cancellation", () => {
  it("makes two bounded structured calls through the existing client", async () => {
    const { transcription, extraction } = modelFixture(englishFixture);
    generate.mockResolvedValueOnce(response(transcription)).mockResolvedValueOnce(response(extraction));
    const result = await extractDirections(audio, new AbortController().signal);
    expect(result.steps).toHaveLength(4);
    expect(generate).toHaveBeenCalledTimes(2);
    const first = generate.mock.calls[0]?.[0];
    expect(first).toMatchObject({
      model: "gemini-3.8-flash",
      config: { responseMimeType: "application/json", maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "LOW" }, httpOptions: { retryOptions: { attempts: 1 } } },
    });
    expect(first.config.responseJsonSchema.additionalProperties).toBe(false);
    expect(JSON.stringify(generate.mock.calls[1]?.[0].contents)).not.toContain("inlineData");
    expect(first.config.tools).toBeUndefined();
  });
  it.each(["not JSON", String.fromCharCode(96).repeat(3) + "json\n{}\n" + String.fromCharCode(96).repeat(3), '{"hasSpeech":true,"latitude":12}', "{}"])("rejects malformed or unapproved output %s", async (text) => {
    generate.mockResolvedValue({ text });
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "invalid_model_output" });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("enforces output array limits even though the provider schema omits expansion bounds", async () => {
    const { transcription, extraction } = modelFixture(englishFixture);
    const first = extraction.steps[0];
    if (!first) throw new Error("Fixture missing");
    generate.mockResolvedValueOnce(response(transcription)).mockResolvedValueOnce(response({ ...extraction, steps: Array.from({ length: 41 }, () => first) }));
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "invalid_model_output" });
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("distinguishes truncation, malformed JSON and structure with safe diagnostics", async () => {
    for (const [reply, reason] of [
      [{ text: "{}", candidates: [{ finishReason: "MAX_TOKENS" }] }, "truncated_output"],
      [{ text: "private invalid JSON" }, "invalid_json"],
      [{ text: JSON.stringify({ private: "input" }) }, "invalid_structure"],
    ] as const) {
      generate.mockReset().mockResolvedValue(reply);
      const diagnostic = vi.fn();
      await expect(extractDirections(audio, new AbortController().signal, diagnostic)).rejects.toMatchObject({ code: "invalid_model_output" });
      expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({ stage: "transcription", reason }));
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private");
    }
  });
  it("instructs the model to retain an unspecified walking heading as unknown instead of inferring straight", async () => {
    const { transcription, extraction } = modelFixture(englishFixture);
    const segment = transcription.segments[0]; const step = extraction.steps[0];
    if (!segment || !step) throw new Error("Fixture missing");
    segment.original = "दुकान तक दो सौ मीटर चलें।";
    segment.translation = "Walk two hundred meters toward the tea shop.";
    Object.assign(step, { instruction: segment.translation, evidence: { ...segment }, direction: "unknown", confidence: "low", needsReview: true,
      landmark: { spoken: "दुकान", label: "tea shop" }, distance: { spoken: "दो सौ मीटर", translation: "two hundred meters" }, warnings: ["The heading was not stated."] });
    generate.mockResolvedValueOnce(response(transcription)).mockResolvedValueOnce(response(extraction));
    const result = await extractDirections(audio, new AbortController().signal);
    expect(result.steps[0]).toMatchObject({ direction: "unknown", confidence: "low", needsReview: true, distance: { meters: 200 } });
    expect(generate.mock.calls[1]?.[0].config.systemInstruction).toContain("Do not infer straight or start");
    step.direction = "straight";
    expect(() => assembleDraft(transcription, extraction)).toThrow();
  });
  it.each([
    ["reached", "You have reached the clinic."],
    ["reaching", "After reaching the clinic, stop."],
    ["reaches", "The path reaches the clinic."],
  ])("accepts explicit %s arrival wording without changing the evidence", (_, quote) => {
    const { transcription, extraction } = modelFixture(englishFixture);
    const segment = transcription.segments[3]; const step = extraction.steps[3];
    if (!segment || !step) throw new Error("Fixture missing");
    segment.original = "क्लिनिक तक पहुँच गए हैं।";
    segment.translation = quote;
    Object.assign(step, { instruction: segment.translation, evidence: { ...segment }, direction: "arrive", incline: null,
      landmark: { spoken: "क्लिनिक", label: "clinic" }, distance: { spoken: null, translation: null } });
    const draft = assembleDraft(transcription, extraction);
    expect(draft.steps[3]).toMatchObject({ direction: "arrive", instruction: segment.translation, evidence: { original: segment.original, translation: segment.translation } });
  });
  it("does not use an incorrect hint to override language detection", async () => {
    const { transcription } = modelFixture(englishFixture);
    transcription.languages = [{ code: "fr", confidence: "high" }];
    generate.mockResolvedValue(response(transcription));
    await expect(extractDirections({ ...audio, languageHint: "en" }, new AbortController().signal)).rejects.toMatchObject({ code: "unsupported_language" });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("stops on silence and flags non-navigation speech", async () => {
    await expect(extractDirections({ ...audio, digitalSilence: true }, new AbortController().signal)).rejects.toMatchObject({ code: "no_speech" });
    expect(generate).not.toHaveBeenCalled();
    generate.mockResolvedValue(response({ hasSpeech: false, languages: [], segments: [], warnings: [] }));
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "no_speech" });
    const { transcription } = modelFixture(englishFixture);
    generate.mockReset().mockResolvedValueOnce(response(transcription)).mockResolvedValueOnce(response({ isDirections: false, steps: [], warnings: [] }));
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "not_directions" });
  });
  it("handles safety blocks and quota exhaustion without retries or private details", async () => {
    generate.mockResolvedValue({ promptFeedback: { blockReason: "SAFETY" } });
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "audio_unprocessable" });
    generate.mockReset().mockRejectedValue(new GeminiApiError({ status: 429, message: "secret-key and raw audio" }));
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "upstream_quota_exceeded", status: 503, retryAfter: 60 });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it.each([400, 401, 403, 404])("does not present permanent provider %s failures as retryable outages", async (status) => {
    generate.mockRejectedValue(new GeminiApiError({ status, message: "private provider details and secret" }));
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "service_misconfigured", status: 503, retryable: false });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("retries at most once across both stages, with SDK retries disabled", async () => {
    const { transcription } = modelFixture(englishFixture);
    generate.mockRejectedValueOnce(new GeminiApiError({ status: 503, message: "private" }))
      .mockResolvedValueOnce(response(transcription))
      .mockRejectedValueOnce(new GeminiApiError({ status: 503, message: "private" }));
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "upstream_unavailable" });
    expect(generate).toHaveBeenCalledTimes(3);
  });
  it("classifies nested connection timeouts instead of calling them service outages", async () => {
    generate.mockRejectedValue(new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }));
    const diagnostics = vi.fn();
    await expect(extractDirections(audio, new AbortController().signal, diagnostics)).rejects.toMatchObject({ code: "request_timeout", status: 504 });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledWith({ reason: "provider_timeout", stage: "transcription", path: [] });
  });
  it("waits one second before its sole transient retry and preserves private error diagnostics", async () => {
    vi.useFakeTimers();
    const { transcription, extraction } = modelFixture(englishFixture);
    generate.mockRejectedValueOnce(new GeminiApiError({ status: 503, message: "secret provider details" }))
      .mockResolvedValueOnce(response(transcription)).mockResolvedValueOnce(response(extraction));
    const diagnostics = vi.fn(); const result = extractDirections(audio, new AbortController().signal, diagnostics);
    await vi.advanceTimersByTimeAsync(999); expect(generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); await expect(result).resolves.toHaveProperty("steps");
    expect(generate).toHaveBeenCalledTimes(3);
    expect(diagnostics).toHaveBeenCalledWith({ reason: "provider_http_503", stage: "transcription", path: [] });
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain("secret");
  });
  it("does not retry connection errors repeatedly or collapse them into overload", async () => {
    vi.useFakeTimers(); generate.mockRejectedValue(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }));
    const result = extractDirections(audio, new AbortController().signal);
    const rejected = expect(result).rejects.toMatchObject({ code: "upstream_network_error", status: 503, retryAfter: 30 });
    await vi.advanceTimersByTimeAsync(1000); await rejected; expect(generate).toHaveBeenCalledTimes(2);
  });
  it("recognizes wrapped quota errors and avoids an immediate retry", async () => {
    generate.mockRejectedValue(new Error("private", { cause: { status: 429 } }));
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "upstream_quota_exceeded", retryAfter: 60 });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("enforces the processing deadline even for a promise that ignores abortSignal", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    generate.mockImplementation(() => new Promise(() => {}));
    const result = extractDirections(audio, new AbortController().signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "request_timeout", status: 504 });
    expect(AbortSignal.timeout).toHaveBeenCalledWith(PROCESSING_DEADLINE_MS);
  });
  it("fails safely with missing credentials without calling the SDK", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(extractDirections(audio, new AbortController().signal)).rejects.toMatchObject({ code: "service_misconfigured" });
    expect(generate).not.toHaveBeenCalled();
  });
});
