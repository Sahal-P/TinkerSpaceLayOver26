import { handlePublishGuide } from "@/server/guides/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: RouteContext<"/api/guides/[id]/publish">): Promise<Response> {
  return handlePublishGuide(request, (await context.params).id);
}
