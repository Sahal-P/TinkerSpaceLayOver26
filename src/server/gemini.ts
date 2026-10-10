import "server-only";

import { GoogleGenAI } from "@google/genai";

import { readGeminiEnv } from "@/server/env";

let client: GoogleGenAI | undefined;

/** Server-only Gemini client. The API key never reaches the browser. */
export function getGemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: readGeminiEnv().GEMINI_API_KEY });
  return client;
}
