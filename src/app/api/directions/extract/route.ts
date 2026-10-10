import { dataResponse, handleApi, requireSameOrigin } from "@/server/api/http";
import { readAudio, type ValidatedAudio } from "@/server/audio";
import { extractDirections } from "@/server/directions/pipeline";
import { enforceRateLimit } from "@/server/rate-limit";
import { attachViewerCookie, newViewer, viewerFromRequest, type VerifiedViewer } from "@/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(58000)]);
  let audio: ValidatedAudio | undefined;
  let viewer: VerifiedViewer | null = null;
  const response = await handleApi(async (requestId) => {
    requireSameOrigin(request);
    audio = await readAudio(request, signal);
    viewer = viewerFromRequest(request) ?? newViewer();
    await enforceRateLimit("extraction", viewer);
    return dataResponse(await extractDirections(audio, signal, (diagnostic) => {
      console.warn(JSON.stringify({ event: "directions_rejected", requestId, ...diagnostic }));
    }), requestId);
  });
  audio?.bytes.fill(0);
  return viewer ? attachViewerCookie(response, viewer) : response;
}
