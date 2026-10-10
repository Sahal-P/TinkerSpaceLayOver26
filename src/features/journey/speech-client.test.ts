import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { englishFixture } from "@/contracts/fixtures";
import { narrationInput } from "@/contracts/speech";
import { prepareNarration, resetSpeechCache } from "./speech-client";
const input = narrationInput(englishFixture.steps[0], []);
if (!input) throw new Error("Missing fixture");
beforeEach(() => resetSpeechCache());
afterEach(() => vi.unstubAllGlobals());
async function audioResponse() {
  const bytes = new Uint8Array(await readFile(new URL("../../server/testing/audio/silence.wav", import.meta.url))); bytes[bytes.length - 2] = 1;
  return new Response(bytes, { headers: { "Content-Type": "audio/wav" } });
}
describe("session speech requests and memory cache", () => {
  it("deduplicates requests and reuses cached audio; reset releases it", async () => {
    const fetcher = vi.fn(audioResponse); vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    const results = await Promise.all([prepareNarration(input, "en", signal), prepareNarration(input, "en", signal)]);
    expect(results[0]).toEqual(results[1]); expect(fetcher).toHaveBeenCalledTimes(1);
    await prepareNarration(input, "en", signal); expect(fetcher).toHaveBeenCalledTimes(1);
    resetSpeechCache(); await prepareNarration(input, "en", signal); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("validates translated responses and binary audio; language changes invalidate reuse", async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith("translate") ? Response.json({ data: { language: "hi", sections: { instruction: "bus stop से शुरू करें।", landmark: "bus stop", distance: null, warnings: [] } }, requestId: randomUUID() }) : audioResponse());
    vi.stubGlobal("fetch", fetcher);
    expect((await prepareNarration(input, "hi", new AbortController().signal)).sections.instruction).toContain("bus stop");
    expect(fetcher).toHaveBeenCalledTimes(2);
    resetSpeechCache(); fetcher.mockImplementation(async () => new Response("garbage", { headers: { "Content-Type": "audio/wav" } }));
    await expect(prepareNarration(input, "en", new AbortController().signal)).rejects.toThrow(/validated/);
  });
  it("requires explicit retry after failure, respecting Retry-After", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: { code: "upstream_quota_exceeded", message: "Quota", retryable: true }, requestId: randomUUID() }, { status: 503, headers: { "Retry-After": "60" } }));
    vi.stubGlobal("fetch", fetcher); const signal = new AbortController().signal;
    await expect(prepareNarration(input, "en", signal)).rejects.toMatchObject({ message: "Quota" });
    await expect(prepareNarration(input, "en", signal, true)).rejects.toMatchObject({ message: "Quota" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects already-cancelled attempts without sending text", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const controller = new AbortController(); controller.abort();
    await expect(prepareNarration(input, "en", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("never sends generated review warnings to translation or speech", async () => {
    const warned = { ...input, step: { ...input.step, instruction: "Maybe turn left.", warnings: ["Not certain. Confirm with the speaker."] }, routeWarnings: ["The heading was not specified."] };
    const bodies: unknown[] = [];
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      bodies.push(JSON.parse(String(options.body)));
      return url.endsWith("translate") ? Response.json({ data: { language: "ml", sections: {
        instruction: "ഒരുപക്ഷേ ഇടത്തേക്ക് തിരിയുക.", landmark: null, distance: null, warnings: ["Not certain"],
      } }, requestId: randomUUID() }) : audioResponse();
    });
    vi.stubGlobal("fetch", fetcher);
    await prepareNarration(warned, "ml", new AbortController().signal);
    expect(JSON.stringify(bodies)).not.toContain("Not certain"); expect(JSON.stringify(bodies)).not.toContain("heading");
    expect(JSON.stringify(bodies)).toContain("ഒരുപക്ഷേ");
    expect(warned.step.warnings).toEqual(["Not certain. Confirm with the speaker."]);
  });
});
