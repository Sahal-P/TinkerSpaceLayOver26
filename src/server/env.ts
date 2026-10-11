import "server-only";

import { z } from "zod";

type EnvSource = Record<string, string | undefined>;

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().trim().min(1).max(100).default("gemini-3.8-flash"),
});

const speechEnvSchema = z.object({
  GEMINI_TTS_MODEL: z.literal("gemini-2.5-flash-preview-tts").default("gemini-2.5-flash-preview-tts"),
});
export function readSpeechEnv(source: EnvSource = process.env) {
  return parseEnv(speechEnvSchema, source, "Speech");
}

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
    // Keyless Vercel access through Workload Identity Federation: set all four or none.
    GCP_PROJECT_NUMBER: z.string().regex(/^\d+$/).optional(),
    GCP_WORKLOAD_IDENTITY_POOL_ID: z.string().min(1).optional(),
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: z.string().min(1).optional(),
    GCP_SERVICE_ACCOUNT_EMAIL: z.email().optional(),
    // Set by Vercel at runtime. Vercel has no Application Default Credentials.
    VERCEL: z.string().min(1).optional(),
  })
  .refine((env) => Boolean(env.FIREBASE_CLIENT_EMAIL) === Boolean(env.FIREBASE_PRIVATE_KEY), {
    message:
      "Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY together, or neither to use Application Default Credentials.",
    path: ["FIREBASE_PRIVATE_KEY"],
  })
  .refine((env) => !env.FIREBASE_CLIENT_EMAIL || Boolean(env.FIREBASE_PROJECT_ID), {
    message: "FIREBASE_PROJECT_ID is required with service-account credentials.",
    path: ["FIREBASE_PROJECT_ID"],
  })
  .refine(
    (env) => {
      const workloadIdentity = [
        env.GCP_PROJECT_NUMBER,
        env.GCP_WORKLOAD_IDENTITY_POOL_ID,
        env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
        env.GCP_SERVICE_ACCOUNT_EMAIL,
      ];
      const set = workloadIdentity.filter(Boolean).length;
      return set === 0 || set === workloadIdentity.length;
    },
    {
      message:
        "Set GCP_PROJECT_NUMBER, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID and GCP_SERVICE_ACCOUNT_EMAIL together, or none.",
      path: ["GCP_PROJECT_NUMBER"],
    },
  )
  .refine((env) => !env.GCP_PROJECT_NUMBER || Boolean(env.FIREBASE_PROJECT_ID), {
    message: "FIREBASE_PROJECT_ID is required with workload identity federation.",
    path: ["FIREBASE_PROJECT_ID"],
  })
  .refine((env) => !(env.FIREBASE_CLIENT_EMAIL && env.GCP_PROJECT_NUMBER), {
    message: "Use either FIREBASE_CLIENT_EMAIL or the GCP_* workload identity values, not both.",
    path: ["GCP_PROJECT_NUMBER"],
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
