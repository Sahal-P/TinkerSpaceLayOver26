import { handleDeleteGuide, handleGetGuide } from "@/server/guides/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: RouteContext<"/api/guides/[id]">): Promise<Response> {
  return handleGetGuide(request, (await context.params).id);
}
export async function DELETE(request: Request, context: RouteContext<"/api/guides/[id]">): Promise<Response> {
  return handleDeleteGuide(request, (await context.params).id);
}
