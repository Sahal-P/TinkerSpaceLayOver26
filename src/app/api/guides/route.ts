import { handleCreateGuide } from "@/server/guides/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = handleCreateGuide;
