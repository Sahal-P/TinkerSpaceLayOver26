import {
  englishNarration, narrationText, speechChunks, speechErrorSchema, translationResponseSchema,
  type NarrationInput, type NarrationSections, type SpeechLanguage,
} from "@/contracts/speech";

export class VoiceError extends Error {
  constructor(message: string, public readonly retryAt = 0, public readonly requestId: string | null = null, public readonly retryable = false) { super(message); }
}
export type PreparedNarration = { sections: NarrationSections; clips: Blob[] };
const cache = new Map<string, { data: PreparedNarration; bytes: number }>();
const failures = new Map<string, VoiceError>();
const pending = new Map<string, { work: Promise<PreparedNarration>; signal: AbortSignal }>();
let bytes = 0; let epoch = 0;
export function resetSpeechCache() { cache.clear(); pending.clear(); failures.clear(); bytes = 0; epoch++; }
async function keyFor(input: NarrationInput, language: SpeechLanguage): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([1, input, language]));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function request(path: string, body: unknown, signal: AbortSignal): Promise<Response> {
  let response: Response;
  try { response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) }); }
  catch {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    throw new VoiceError("Voice guidance could not connect. Try again.", 0, null, true);
  }
  if (!response.ok) {
    let raw: unknown; try { raw = await response.json(); } catch { throw new VoiceError("The voice service returned an invalid response."); }
    const parsed = speechErrorSchema.safeParse(raw);
    if (!parsed.success) throw new VoiceError("The voice service returned an invalid response.");
    const retry = response.headers.get("Retry-After");
    const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 0;
    throw new VoiceError(parsed.data.error.message, Date.now() + seconds * 1000, parsed.data.requestId, parsed.data.error.retryable);
  }
  return response;
}
export async function prepareNarration(input: NarrationInput, language: SpeechLanguage, signal: AbortSignal, retry = false): Promise<PreparedNarration> {
  const epochAtStart = epoch; const key = await keyFor(input, language);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const failed = failures.get(key);
  if (failed && (!retry || !failed.retryable || failed.retryAt > Date.now())) throw failed;
  if (retry) failures.delete(key);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit.data; }
  const existing = pending.get(key); if (existing && !existing.signal.aborted) return existing.work;
  const work = (async () => {
    let sections = englishNarration(input);
    if (language !== "en") {
      const response = await request("/api/speech/translate", { ...input, language }, signal);
      let value: unknown; try { value = await response.json(); } catch { throw new VoiceError("The translated narration could not be validated."); }
      const parsed = translationResponseSchema.safeParse(value);
      if (!parsed.success || parsed.data.data.language !== language) throw new VoiceError("The translated narration could not be validated.");
      sections = parsed.data.data.sections;
    }
    const clips: Blob[] = [];
    for (const text of speechChunks(narrationText(sections))) {
      const response = await request("/api/speech", { text: text.trim(), language }, signal);
      if (response.headers.get("Content-Type")?.split(";")[0] !== "audio/wav") throw new VoiceError("The voice service returned invalid audio.");
      const length = response.headers.get("Content-Length");
      if (length && Number(length) > 4 * 1024 * 1024) throw new VoiceError("The voice clip is too large.");
      if (!response.body) throw new VoiceError("The voice clip is empty.");
      const reader = response.body.getReader(); const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > 4 * 1024 * 1024 || signal.aborted) { await reader.cancel(); throw new VoiceError("The voice clip could not be loaded."); }
          chunks.push(Uint8Array.from(part.value));
        }
      } finally { reader.releaseLock(); }
      const blob = new Blob(chunks, { type: "audio/wav" });
      const { inspectAudioSource } = await import("@/lib/audio-inspection");
      try {
        const inspected = await inspectAudioSource(blob, signal, 1);
        if (inspected.mimeType !== "audio/wav" || inspected.digitalSilence) throw new Error("Invalid clip");
      } catch { throw new VoiceError("The generated voice clip could not be validated."); }
      if (clips.reduce((sum, clip) => sum + clip.size, 0) + blob.size > 16 * 1024 * 1024) throw new VoiceError("This step's narration is too long. Shorten it or read it on screen.");
      clips.push(blob);
    }
    const data = { sections, clips }; const size = clips.reduce((sum, clip) => sum + clip.size, 0) + new TextEncoder().encode(JSON.stringify(sections)).length;
    if (!signal.aborted && epoch === epochAtStart && size <= 16 * 1024 * 1024) {
      while (cache.size >= 128 || bytes + size > 16 * 1024 * 1024) {
        const first = cache.keys().next().value; if (first === undefined) break;
        bytes -= cache.get(first)?.bytes ?? 0; cache.delete(first);
      }
      cache.set(key, { data, bytes: size }); bytes += size;
    }
    return data;
  })();
  pending.set(key, { work, signal });
  try { return await work; } catch (reason) {
    if (!signal.aborted && epoch === epochAtStart && reason instanceof VoiceError) {
      if (failures.size >= 128) { const first = failures.keys().next().value; if (first) failures.delete(first); }
      failures.set(key, reason);
    }
    throw reason;
  } finally { if (pending.get(key)?.work === work) pending.delete(key); }
}
