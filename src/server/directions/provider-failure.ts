import "server-only";
import { z } from "zod";

const failureSchema = z.strictObject({
  kind: z.enum(["timeout", "quota", "configuration", "unavailable", "network", "unknown"]),
  status: z.number().int().min(400).max(599).nullable(),
});
export type ProviderFailure = z.infer<typeof failureSchema>;
const timeoutCodes = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);
const networkCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_SOCKET"]);
function field(value: object, key: string): unknown { return key in value ? Reflect.get(value, key) : undefined; }
/** Inspect fixed status/name/code fields; never expose exception messages or causes. */
export function classifyProviderFailure(error: unknown): ProviderFailure {
  let current: unknown = error; const seen = new Set<object>();
  let status: number | null = null; let timeout = false; let network = false;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth++) {
    if (seen.has(current)) break; seen.add(current);
    const candidate = field(current, "status");
    if (status === null && typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) status = candidate;
    const name = field(current, "name"); const code = field(current, "code");
    if (["AbortError", "TimeoutError", "APIConnectionTimeoutError"].includes(typeof name === "string" ? name : "") ||
      timeoutCodes.has(typeof code === "string" ? code : "")) timeout = true;
    if (networkCodes.has(typeof code === "string" ? code : "")) network = true;
    const message = field(current, "message");
    if (name === "TypeError" && typeof message === "string" && /^(?:fetch failed|failed to fetch|NetworkError when attempting to fetch resource)/i.test(message.slice(0, 80))) network = true;
    current = field(current, "cause");
  }
  const kind = status === 429 ? "quota" : [400, 401, 403, 404].includes(status ?? 0) ? "configuration"
    : [408, 504].includes(status ?? 0) || timeout ? "timeout" : status !== null && status >= 500 ? "unavailable"
    : network ? "network" : "unknown";
  return failureSchema.parse({ kind, status });
}
