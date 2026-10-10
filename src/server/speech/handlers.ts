import "server-only";
import { speechRequestSchema, translationRequestSchema } from "@/contracts/speech";
import { dataResponse, handleApi, readJson, requireSameOrigin } from "@/server/api/http";
import { attachViewerCookie, newViewer, ownerKey, viewerFromRequest, type VerifiedViewer } from "@/server/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { synthesizeSpeech, translateNarration } from "./service";

export async function speechHandler(request: Request, kind: "audio" | "translation"): Promise<Response> {
  let viewer: VerifiedViewer | undefined;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(58000)]);
  const response = await handleApi(async requestId => {
    requireSameOrigin(request);
    const input = kind === "audio" ? await readJson(request, speechRequestSchema) : await readJson(request, translationRequestSchema);
    viewer = viewerFromRequest(request) ?? newViewer();
    await enforceRateLimit("speech", viewer);
    if ("text" in input) {
      const audio = await synthesizeSpeech(input.text, input.language, ownerKey(viewer), signal);
      return new Response(Uint8Array.from(audio), { headers: { "Content-Type": "audio/wav" } });
    }
    return dataResponse({ language: input.language, sections: await translateNarration(input, input.language, ownerKey(viewer), signal) }, requestId);
  });
  return viewer ? attachViewerCookie(response, viewer) : response;
}
