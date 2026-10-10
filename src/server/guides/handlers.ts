import "server-only";

import { z } from "zod";

import { createGuideSchema, idempotencyKeySchema, publishGuideSchema } from "@/contracts/guide";
import { notFound, validationError } from "@/server/api/errors";
import { backendConfig, dataResponse, handleApi, readJson, requireSameOrigin } from "@/server/api/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { attachViewerCookie, newViewer, requireViewer, viewerFromRequest, type VerifiedViewer } from "@/server/session";

import { createGuide, deleteGuide, getGuideForViewer, setPublished } from "./repository";

export async function handleCreateGuide(request: Request): Promise<Response> {
  let viewer: VerifiedViewer | null = null;
  const response = await handleApi(async (requestId) => {
    requireSameOrigin(request);
    const input = await readJson(request, createGuideSchema);
    const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
    if (!key.success) throw validationError();
    viewer = viewerFromRequest(request) ?? newViewer();
    await enforceRateLimit("mutation", viewer);
    const result = await createGuide(input.guide, viewer, key.data);
    return dataResponse({ id: result.id, status: result.status }, requestId, result.created ? 201 : 200);
  });
  return viewer ? attachViewerCookie(response, viewer) : response;
}
export function handleGetGuide(request: Request, id: string): Promise<Response> {
  return handleApi(async (requestId) => {
    const guide = await getGuideForViewer(id, viewerFromRequest(request));
    if (!guide) throw notFound();
    return dataResponse(guide, requestId);
  });
}
export function handlePublishGuide(request: Request, id: string): Promise<Response> {
  return handleApi(async (requestId) => {
    requireSameOrigin(request);
    const viewer = requireViewer(request);
    const input = await readJson(request, publishGuideSchema);
    await enforceRateLimit("mutation", viewer);
    const result = await setPublished(id, viewer, true, input.acknowledgeWarnings);
    return dataResponse({ ...result, url: backendConfig().APP_ORIGIN + "/g/" + result.id }, requestId);
  });
}
export function handleUnpublishGuide(request: Request, id: string): Promise<Response> {
  return handleApi(async (requestId) => {
    requireSameOrigin(request);
    const viewer = requireViewer(request);
    if (request.body) await readJson(request, z.strictObject({}));
    await enforceRateLimit("mutation", viewer);
    return dataResponse(await setPublished(id, viewer, false), requestId);
  });
}
export function handleDeleteGuide(request: Request, id: string): Promise<Response> {
  return handleApi(async () => {
    requireSameOrigin(request);
    const viewer = requireViewer(request);
    if (request.body) await readJson(request, z.strictObject({}));
    await enforceRateLimit("mutation", viewer);
    await deleteGuide(id, viewer);
    return new Response(null, { status: 204 });
  });
}
