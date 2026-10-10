# Architecture

Local to Lens is a single Next.js App Router application. Server Components render the UI.
Server-only modules own every secret and third-party SDK. Firestore (via `firebase-admin`) is the
system of record, and Gemini (via `@google/genai`) does multimodal processing. There is no
authentication in the current scope.

## Layers

```
src/
  app/          Routes: layouts, pages, route handlers. Thin; composes features.
  features/     One folder per capability: landing (now), recording, processing, guides (later).
    <feature>/components/   UI for the feature
    <feature>/server/       Server Actions, data access, Gemini calls ("server-only")
    <feature>/schemas.ts    Zod schemas and inferred types for the feature's data
  components/   Shared, feature-agnostic UI. ui/ holds primitives (Button, Container).
  lib/          Pure isomorphic helpers (cn, motion presets). No secrets, no SDKs.
  config/       Public, non-secret configuration (site metadata).
  server/       Shared server-only infrastructure: env validation, Firestore, Gemini.
  styles/       Design tokens.
```

### Dependency rules

Imports point downward only:

```
app → features → components, lib, config, server
      components → lib, config
      server     → lib
```

- A feature never imports another feature's internals. If two features need the same code, move it
  to `components/`, `lib/`, or `server/`.
- `lib/` and `components/` never import from `server/`.
- Client Components never import server modules. `import "server-only"` turns a violation into a build error.

## Server / client boundary

- Server Components by default; `"use client"` only on interactive leaves.
- Data reaches Client Components only as plain, serializable props.
- Mutations go through Server Actions or Route Handlers that validate input with Zod.

## Configuration and secrets

- `src/server/env.ts` has one Zod schema per service, parsed lazily when a client is first created.
  Builds and static pages need no secrets. A misconfiguration fails at first use with a message that
  names the variable without echoing its value. Blank values count as unset.
- `.env.example` documents every variable. Real values go in `.env.local` (git-ignored) or the host's
  secret manager.
- There are no `NEXT_PUBLIC_` variables. Anything with that prefix ships to the browser.

## Services

### Firestore: `src/server/firebase.ts`

- `getDb()` returns a memoized Firestore instance and reuses the existing Firebase app across dev hot
  reloads (`getApps()`).
- Credential selection (`resolveAppOptions`):
  1. If `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` + `FIREBASE_PROJECT_ID` are set, use `cert()`.
     This is for hosts without Application Default Credentials, such as Vercel.
  2. Otherwise use `applicationDefault()`: the Firebase App Hosting or Cloud Run service identity, or
     `gcloud auth application-default login` locally. This is preferred because no long-lived key exists.
- `FIRESTORE_EMULATOR_HOST` routes traffic to the local emulator automatically.
- Firestore is accessed only from the server, so Security Rules can deny all direct client access.

### Gemini: `src/server/gemini.ts`

- `getGemini()` returns a memoized `GoogleGenAI` client built from `GEMINI_API_KEY`.
- The independent backend track implements transcription/translation followed by quoted direction
  extraction in `src/server/directions/pipeline.ts`. Model ID defaults to `gemini-3.8-flash`;
  requests use inline audio, bounded deadlines and strict Zod validation.

### Backend contracts, APIs and ownership

- `src/contracts/**` owns client-safe Zod contracts, source-grounding helpers and multilingual
  fixtures. It imports no server SDK or UI code.
- `src/app/api/**` contains thin Node route handlers; `src/server/**` owns audio validation,
  errors, signed anonymous ownership, Firestore quotas and guide persistence.
- User confirmation is required before saving; publication is separate and retains acknowledged
  warnings. Public responses omit transcripts, evidence and ownership metadata.
- No raw-audio persistence, Firebase Auth, client SDK, queue or cloud infrastructure is
  introduced. Existing Firestore client rules continue to deny direct access.
- Contracts, environment variables, integration examples and verification limits are in [API.md](API.md).

## Planned data flow (Phases 1–3)

```
Phone browser (MediaRecorder)
  → upload (storage decided in Phase 1)
  → Server Action / Route Handler (Zod-validated)
  → Gemini: Files API + structured output, validated with Zod
  → Firestore: guides/{id}
  → server-rendered guide page → share link
```

## Styling system

- Tailwind CSS 4, configured CSS-first. `src/styles/tokens.css` has three layers:
  1. A raw palette in private CSS variables.
  2. Semantic tokens for light and system dark (`prefers-color-scheme`).
  3. A Tailwind theme via `@theme inline`, so `bg-surface`, `text-ink-muted`, `bg-accent`, ... follow the color scheme.
- The default Tailwind colors are disabled (`--color-*: initial`), so only semantic colors exist.
- Typography: Fraunces for display (`font-display`) and Geist Sans for body (`font-sans`), loaded with
  `next/font`. Fonts are self-hosted at build time, with no runtime requests to Google.
- Animation: Motion for React. `MotionProvider` enables `reducedMotion="user"` app-wide. The CSS
  `--ease-out-soft` token mirrors `easeOutSoft` in `src/lib/motion.ts`.
- Mobile-first layout: `Container` and `px-gutter` add safe-area-aware side padding, and
  `viewportFit: "cover"` lets the layout extend under device notches.

## Testing strategy

- **Unit:** schemas, pure helpers, and service configuration, with SDK modules mocked.
- **Component:** Testing Library on jsdom for primitives and page rendering. Vitest can't render async
  Server Components, so cover those with end-to-end tests.
- **End-to-end:** Playwright, added in Phase 1 once there are user flows.

## Security baseline

- Headers (`next.config.ts`):
  - `X-Content-Type-Options: nosniff`
  - strict `Referrer-Policy`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy` allowing camera and microphone for our own origin only
  - no `X-Powered-By`
- Secrets: server-only, validated, never logged. `.env*` (except `.env.example`), `*.pem`, and
  service-account JSON files are git-ignored.
- Supply chain (pnpm 11):
  - dependency install scripts blocked unless explicitly allowed
  - 1-day minimum release age
  - exotic subdependencies blocked
  - lockfile committed
- Planned (Phase 4): nonce-based CSP, rate limiting and abuse controls for unauthenticated uploads,
  Firestore rules denying client access, upload size and type validation.
