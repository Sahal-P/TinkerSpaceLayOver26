import { handleUnpublishGuide } from "@/server/guides/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: RouteContext<"/api/guides/[id]/unpublish">): Promise<Response> {
  return handleUnpublishGuide(request, (await context.params).id);
}
