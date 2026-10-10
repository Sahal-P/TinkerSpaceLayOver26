import { speechHandler } from "@/server/speech/handlers";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return speechHandler(request, "translation"); }
