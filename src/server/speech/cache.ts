import "server-only";
import { ApiError } from "@/server/api/errors";

/** Process-local, private, bounded LRU. No raw text is used as a cache key. */
export class SpeechCache<T> {
  private entries = new Map<string, { value: T; bytes: number; expires: number }>();
  private pending = new Map<string, { work: Promise<T>; signal: AbortSignal }>();
  private bytes = 0;
  constructor(private maximumBytes: number, private maximumEntries: number, private ttlMs: number) {}
  get(key: string, now = Date.now()): T | undefined {
    this.expire(now);
    const item = this.entries.get(key);
    if (!item) return;
    this.entries.delete(key); this.entries.set(key, item);
    return item.value;
  }
  private expire(now: number) {
    for (const [key, item] of this.entries) if (item.expires <= now) this.remove(key);
  }
  private remove(key: string) {
    const item = this.entries.get(key);
    if (item) this.bytes -= item.bytes;
    this.entries.delete(key);
  }
  async run(key: string, create: () => Promise<T>, size: (value: T) => number, signal: AbortSignal): Promise<T> {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const hit = this.get(key); if (hit !== undefined) return hit;
    const existing = this.pending.get(key); if (existing && !existing.signal.aborted) return existing.work;
    // Bound in-flight work as well as completed entries.
    if (this.pending.size >= this.maximumEntries) throw new ApiError("speech_busy", 503, "Voice guidance is busy. Try again shortly.", true, 5);
    const work = (async () => {
      const value = await create(); const bytes = size(value);
      if (!signal.aborted && bytes <= this.maximumBytes) {
        this.expire(Date.now());
        while (this.entries.size >= this.maximumEntries || this.bytes + bytes > this.maximumBytes) {
          const first = this.entries.keys().next().value; if (first === undefined) break; this.remove(first);
        }
        this.entries.set(key, { value, bytes, expires: Date.now() + this.ttlMs }); this.bytes += bytes;
      }
      return value;
    })();
    this.pending.set(key, { work, signal });
    try { return await work; } finally { if (this.pending.get(key)?.work === work) this.pending.delete(key); }
  }
}
