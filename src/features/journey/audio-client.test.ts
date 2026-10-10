import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { MAX_AUDIO_BYTES } from "@/contracts/audio";
import { prepareClip } from "./audio-client";
describe("local media inspection", () => {
  it.each(["wav", "mp3", "m4a", "ogg", "webm", "flac"])(
    "checks real %s containers and normalizes only after verification",
    async (extension) => {
      const bytes = await readFile(
        new URL(
          "../../server/testing/audio/silence." + extension,
          import.meta.url,
        ),
      );
      const prepared = await prepareClip(
        new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
        new AbortController().signal,
      );
      expect(prepared.durationMs).toBeGreaterThanOrEqual(2000);
      expect(prepared.file.type).toMatch(/^audio\//);
      expect(prepared.file.name).toMatch(/^directions\./);
    },
  );
  it("rejects corrupt/video/oversize files and cancellation", async () => {
    await expect(
      prepareClip(new Blob(["corrupt"]), new AbortController().signal),
    ).rejects.toThrow();
    const bytes = await readFile(
      new URL("../../server/testing/audio/silence-video.mp4", import.meta.url),
    );
    await expect(
      prepareClip(
        new Blob([new Uint8Array(bytes)]),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    await expect(
      prepareClip(
        new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/4 MiB/);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      prepareClip(new Blob(["corrupt"]), cancelled.signal),
    ).rejects.toThrow();
  });
});
