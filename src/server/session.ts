import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import { backendConfig } from "@/server/api/http";

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const viewerSchema = z.strictObject({
  version: z.literal(1), id: z.string().regex(/^[A-Za-z0-9_-]{43}$/), expiresAt: z.number().int().positive(),
});
export type VerifiedViewer = z.infer<typeof viewerSchema>;
export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-ltl-owner" : "ltl-owner";
}
export function newViewer(now = Date.now()): VerifiedViewer {
  return { version: 1, id: randomBytes(32).toString("base64url"), expiresAt: Math.floor(now / 1000) + SESSION_SECONDS };
}
function signature(payload: string): Buffer {
  return createHmac("sha256", backendConfig().SESSION_SECRET).update(payload).digest();
}
export function encodeViewer(viewer: VerifiedViewer): string {
  const payload = Buffer.from(JSON.stringify(viewerSchema.parse(viewer))).toString("base64url");
  return payload + "." + signature(payload).toString("base64url");
}
export function verifyViewer(value: string | undefined, now = Date.now()): VerifiedViewer | null {
  if (!value || value.length > 512) return null;
  const [payload, digest, extra] = value.split(".");
  if (!payload || !digest || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(digest)) return null;
  const actual = Buffer.from(digest, "base64url");
  if (actual.length !== 32 || actual.toString("base64url") !== digest || !timingSafeEqual(actual, signature(payload))) return null;
  try {
    const result = viewerSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!result.success || result.data.expiresAt <= Math.floor(now / 1000) ||
        result.data.expiresAt > Math.floor(now / 1000) + SESSION_SECONDS) return null;
    return result.data;
  } catch { return null; }
}
export function viewerFromRequest(request: Request): VerifiedViewer | null {
  const matches = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(sessionCookieName() + "="));
  if (matches.length !== 1) return null;
  return verifyViewer(matches[0]?.slice(sessionCookieName().length + 1));
}
export async function getViewerFromCookies(): Promise<VerifiedViewer | null> {
  return verifyViewer((await cookies()).get(sessionCookieName())?.value);
}
export function requireViewer(request: Request): VerifiedViewer {
  const viewer = viewerFromRequest(request);
  if (!viewer) throw new ApiError("not_found", 404, "Guide not found.");
  return viewer;
}
export function ownerKey(viewer: VerifiedViewer): string {
  return createHash("sha256").update(viewer.id).digest("hex");
}
export function attachViewerCookie(response: Response, viewer: VerifiedViewer): Response {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", sessionCookieName() + "=" + encodeViewer(viewer) +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + Math.max(0, viewer.expiresAt - Math.floor(Date.now() / 1000)) + secure);
  return response;
}
