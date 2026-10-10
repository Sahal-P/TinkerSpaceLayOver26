import "server-only";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Two-second synthetic silence fixtures; no real recordings or personal data. */
export async function audioFixture(format: "wav" | "mp3" | "m4a" | "ogg" | "webm" | "flac" = "wav"): Promise<Uint8Array> {
  return new Uint8Array(await readFile(fileURLToPath(new URL("./audio/silence." + format, import.meta.url))));
}
export async function audioRequest(options: {
  type?: string; consent?: string; duration?: string; bytes?: Uint8Array; languageHint?: string; duplicate?: boolean;
} = {}): Promise<Request> {
  const form = new FormData();
  const bytes = options.bytes ?? await audioFixture();
  form.set("audio", new File([Uint8Array.from(bytes)], "clip", { type: options.type ?? "audio/wav" }));
  form.set("durationMs", options.duration ?? "2000");
  form.set("consent", options.consent ?? "true");
  form.set("languageHint", options.languageHint ?? "auto");
  if (options.duplicate) form.append("audio", new File([Uint8Array.from(bytes)], "duplicate", { type: "audio/wav" }));
  return new Request("http://localhost:3000/api/directions/extract", {
    method: "POST", headers: { Origin: "http://localhost:3000" }, body: form,
  });
}
