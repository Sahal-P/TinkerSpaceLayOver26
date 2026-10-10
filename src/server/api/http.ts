import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { MAX_GUIDE_BYTES } from "@/contracts/guide";
import { readBackendEnv } from "@/server/env";

import { ApiError, requestAborted, validationError } from "./errors";

export function backendConfig() {
  try { return readBackendEnv(); } catch {
    throw new ApiError("service_misconfigured", 503, "The backend is not configured.");
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin !== backendConfig().APP_ORIGIN || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError("forbidden_origin", 403, "This request must come from the application.");
  }
}

export async function readLimitedBody(request: Request, maximum: number, parentSignal = request.signal): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw validationError();
  if (length !== null && Number(length) > maximum) {
    throw new ApiError("request_too_large", 413, "The request body is too large.");
  }
  if (!request.body) throw validationError();
  const reader = request.body.getReader();
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(10000)]);
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (signal.aborted) throw requestAborted();
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw requestAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        cancel();
        throw new ApiError("request_too_large", 413, "The request body is too large.");
      }
      chunks.push(value);
    }
    if (length !== null && Number(length) !== size) throw validationError();
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } catch (error) {
    cancel();
    if (signal.aborted) throw requestAborted();
    if (error instanceof ApiError) throw error;
    throw validationError();
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new ApiError("unsupported_media_type", 415, "Use application/json.");
  }
  const bytes = await readLimitedBody(request, MAX_GUIDE_BYTES);
  try {
    const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const result = schema.safeParse(input);
    if (!result.success) throw validationError();
    return result.data;
  } catch { throw validationError(); }
}

export function dataResponse(data: unknown, requestId: string, status = 200): Response {
  return Response.json({ data, requestId }, { status });
}

/** Error details are deliberately curated; SDK exceptions and Zod inputs never escape. */
export async function handleApi(run: (requestId: string) => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  let response: Response;
  try { response = await run(requestId); } catch (error) {
    const safe = error instanceof ApiError ? error : new ApiError("internal_error", 500, "The request could not be completed.");
    response = Response.json({
      error: { code: safe.code, message: safe.message, retryable: safe.retryable }, requestId,
    }, { status: safe.status });
    if (safe.retryAfter !== undefined) response.headers.set("Retry-After", String(safe.retryAfter));
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
