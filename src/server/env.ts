import "server-only";

import { z } from "zod";

type EnvSource = Record<string, string | undefined>;

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
});

const firebaseEnvSchema = z
  .object({
    FIREBASE_PROJECT_ID: z.string().min(1).optional(),
    FIREBASE_CLIENT_EMAIL: z.email().optional(),
    FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  })
  .refine((env) => Boolean(env.FIREBASE_CLIENT_EMAIL) === Boolean(env.FIREBASE_PRIVATE_KEY), {
    message:
      "Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY together, or neither to use Application Default Credentials.",
    path: ["FIREBASE_PRIVATE_KEY"],
  })
  .refine((env) => !env.FIREBASE_CLIENT_EMAIL || Boolean(env.FIREBASE_PROJECT_ID), {
    message: "FIREBASE_PROJECT_ID is required with service-account credentials.",
    path: ["FIREBASE_PROJECT_ID"],
  });

export type GeminiEnv = z.infer<typeof geminiEnvSchema>;
export type FirebaseEnv = z.infer<typeof firebaseEnvSchema>;

/** Validated lazily, when a client is first created, so builds never need secrets. */
export function readGeminiEnv(source: EnvSource = process.env): GeminiEnv {
  return parseEnv(geminiEnvSchema, source, "Gemini");
}

export function readFirebaseEnv(source: EnvSource = process.env): FirebaseEnv {
  return parseEnv(firebaseEnvSchema, source, "Firebase");
}

function parseEnv<T extends z.ZodType>(schema: T, source: EnvSource, service: string): z.output<T> {
  // Blank values (e.g. `KEY=` copied from .env.example) count as unset.
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value?.trim()));
  const result = schema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid ${service} environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
