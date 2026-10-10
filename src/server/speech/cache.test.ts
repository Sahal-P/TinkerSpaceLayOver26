import { describe, expect, it, vi } from "vitest";
import { SpeechCache } from "./cache";

describe("bounded session-keyed speech cache", () => {
  it("deduplicates in-flight work and hits, expires, and evicts by LRU and bytes", async () => {
    const cache = new SpeechCache<string>(5, 2, 50); const signal = new AbortController().signal;
    const factory = vi.fn(async () => "aaa");
    expect(await Promise.all([cache.run("owner:a", factory, v => v.length, signal), cache.run("owner:a", factory, v => v.length, signal)])).toEqual(["aaa", "aaa"]);
    expect(factory).toHaveBeenCalledTimes(1);
    await cache.run("owner:b", async () => "bb", v => v.length, signal);
    expect(cache.get("owner:a")).toBe("aaa");
    await cache.run("other:c", async () => "cc", v => v.length, signal);
    expect(cache.get("owner:b")).toBeUndefined();
    expect(cache.get("other:c", Date.now() + 100)).toBeUndefined();
  });
  it("does not cache failures, cancellation, or oversized entries", async () => {
    const cache = new SpeechCache<string>(2, 1, 100); const controller = new AbortController();
    await expect(cache.run("a", async () => { throw new Error("failure"); }, v => v.length, controller.signal)).rejects.toThrow();
    expect(cache.get("a")).toBeUndefined();
    await cache.run("big", async () => "large", v => v.length, controller.signal);
    expect(cache.get("big")).toBeUndefined();
    const result = cache.run("cancel", async () => { controller.abort(); return "a"; }, v => v.length, controller.signal);
    await result; expect(cache.get("cancel")).toBeUndefined();
    await expect(cache.run("a", async () => "a", v => v.length, controller.signal)).rejects.toThrow();
  });
});

it("bounds in-flight work and returns a safe retry interval", async () => {
  const cache = new SpeechCache<string>(10, 1, 1000); const signal = new AbortController().signal;
  let finish: ((value: string) => void) | undefined;
  const pending = cache.run("a", () => new Promise(resolve => { finish = resolve; }), v => v.length, signal);
  await expect(cache.run("b", async () => "b", v => v.length, signal)).rejects.toMatchObject({ code: "speech_busy", retryAfter: 5 });
  finish?.("a"); await pending;
});
