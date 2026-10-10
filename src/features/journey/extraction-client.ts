import { z } from "zod";
import {
  apiErrorSchema,
  extractionResponseSchema,
  MAX_GUIDE_BYTES,
  type GuideDraft,
} from "@/contracts/guide";
import { audioMetadataSchema } from "@/contracts/audio";
import type { AudioClip } from "./audio-client";

export const extractionFailureSchema = apiErrorSchema.shape.error.extend({
  requestId: z.uuid().nullable(),
  retryAt: z.number().nullable(),
});
export type ExtractionFailure = z.infer<typeof extractionFailureSchema>;
export class ExtractionError extends Error {
  constructor(public readonly failure: ExtractionFailure) {
    super(failure.message);
  }
}
function localFailure(
  code: string,
  message: string,
  retryable = true,
): ExtractionError {
  return new ExtractionError({
    code,
    message,
    retryable,
    requestId: null,
    retryAt: null,
  });
}
export function retryAtFromHeader(
  header: string | null,
  now = Date.now(),
): number | null {
  if (!header) return null;
  const value = /^\d+$/.test(header)
    ? now + Number(header) * 1000
    : Date.parse(header);
  return Number.isFinite(value)
    ? Math.max(now, Math.min(value, now + 86400000))
    : null;
}
export function submitExtraction(
  clip: AudioClip,
  languageHint: string,
  consent: boolean,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<{ guide: GuideDraft; requestId: string }> {
  const metadata = audioMetadataSchema.safeParse({
    languageHint,
    durationMs: clip.durationMs,
    consent,
  });
  if (!metadata.success)
    return Promise.reject(
      localFailure(
        "consent_required",
        "Confirm recording permission and Gemini processing before continuing.",
        false,
      ),
    );
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      run();
    };
    const abort = () => {
      xhr.abort();
      finish(() =>
        reject(localFailure("cancelled", "Processing cancelled.", false)),
      );
    };
    xhr.open("POST", "/api/directions/extract");
    xhr.withCredentials = true;
    xhr.timeout = 60000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && !settled)
        onProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.upload.onload = () => {
      if (!settled) onProgress(1);
    };
    xhr.onerror = () =>
      finish(() =>
        reject(
          localFailure(
            "network_error",
            "The connection failed. Your clip is still available to retry.",
          ),
        ),
      );
    xhr.ontimeout = () =>
      finish(() =>
        reject(
          localFailure(
            "request_timeout",
            "Processing timed out. You can retry this clip.",
          ),
        ),
      );
    xhr.onabort = () =>
      finish(() =>
        reject(localFailure("cancelled", "Processing cancelled.", false)),
      );
    xhr.onload = () =>
      finish(() => {
        try {
          if (
            new TextEncoder().encode(xhr.responseText).byteLength >
            MAX_GUIDE_BYTES + 4096
          )
            throw new Error("Response too large");
          const raw: unknown = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = extractionResponseSchema.parse(raw);
            resolve({ guide: result.data, requestId: result.requestId });
          } else {
            const result = apiErrorSchema.parse(raw);
            // Provider text is never rendered; the API returns curated safe messages.
            reject(
              new ExtractionError({
                ...result.error,
                requestId: result.requestId,
                retryAt: retryAtFromHeader(
                  xhr.getResponseHeader("Retry-After"),
                ),
              }),
            );
          }
        } catch {
          reject(
            localFailure(
              "invalid_response",
              "The response could not be validated. Try again or record a clearer clip.",
            ),
          );
        }
      });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    const form = new FormData();
    form.set("audio", clip.file, clip.file.name);
    form.set("languageHint", metadata.data.languageHint);
    form.set("durationMs", String(clip.durationMs));
    form.set("consent", "true");
    xhr.send(form);
  });
}
