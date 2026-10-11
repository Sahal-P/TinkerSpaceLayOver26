import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_AUDIO_BYTES, MAX_AUDIO_MS, MIN_AUDIO_MS } from "@/contracts/audio";
import { inspectAudio } from "@/server/audio";
import {
  fetchSampleClip,
  SAMPLE_CLIP_URL,
  SampleClipError,
} from "./sample-clip";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the bundled sample clip", () => {
  const bytes = new Uint8Array(
    readFileSync(new URL(`../../../public${SAMPLE_CLIP_URL}`, import.meta.url)),
  );

  it("fits the upload limits", () => {
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(bytes.byteLength).toBeLessThanOrEqual(MAX_AUDIO_BYTES);
  });

  it("is audio the server accepts, within the duration limits", async () => {
    const inspected = await inspectAudio(
      bytes,
      "audio/mpeg",
      new AbortController().signal,
    );
    expect(inspected.mimeType).toBe("audio/mpeg");
    expect(inspected.digitalSilence).toBe(false);
    expect(inspected.actualDurationMs).toBeGreaterThanOrEqual(MIN_AUDIO_MS);
    expect(inspected.actualDurationMs).toBeLessThanOrEqual(MAX_AUDIO_MS);
  });
});

describe("fetchSampleClip", () => {
  it("returns the clip bytes from the same origin", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    const blob = await fetchSampleClip(signal);
    expect(fetcher).toHaveBeenCalledWith(SAMPLE_CLIP_URL, { signal });
    expect(blob.size).toBe(3);
  });

  it("reports a missing file or a network failure without leaking details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    await expect(
      fetchSampleClip(new AbortController().signal),
    ).rejects.toBeInstanceOf(SampleClipError);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("private network detail");
      }),
    );
    const failure = await fetchSampleClip(new AbortController().signal).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(SampleClipError);
    expect((failure as Error).message).not.toContain("private");
  });

  it("passes a cancellation through instead of reporting a failure", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort();
        throw new DOMException("Aborted", "AbortError");
      }),
    );
    const failure = await fetchSampleClip(controller.signal).catch(
      (error: unknown) => error,
    );
    expect(failure).not.toBeInstanceOf(SampleClipError);
    expect((failure as DOMException).name).toBe("AbortError");
  });
});
