import "server-only";

import { z } from "zod";

type EnvSource = Record<string, string | undefined>;

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().trim().min(1).max(100).default("gemini-3.8-flash"),
});

const backendEnvSchema = z.object({
  SESSION_SECRET: z.string().min(32),
  APP_ORIGIN: z.url().refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash;
  }, "Use an HTTP(S) origin without credentials, a path, query, or fragment."),
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
export type BackendEnv = z.infer<typeof backendEnvSchema>;

export function readBackendEnv(source: EnvSource = process.env): BackendEnv {
  const env = parseEnv(backendEnvSchema, source, "Backend");
  const url = new URL(env.APP_ORIGIN);
  if (source.NODE_ENV === "production" && url.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Invalid Backend environment variables: APP_ORIGIN must use HTTPS in production.");
  }
  return { ...env, APP_ORIGIN: url.origin };
}

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
