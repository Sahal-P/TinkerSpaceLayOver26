# Implementation phases

Every phase ends with `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passing, docs updated,
and explicit approval before the next phase starts. Open decisions are resolved at phase kickoff.

## Phase 0: Foundation (awaiting approval)

Goal: a clean, scalable base with no product features.

- [x] Next.js 16 App Router + TypeScript (strict) on pnpm
- [x] ESLint (flat config) and Vitest + Testing Library
- [x] Feature-based structure and shared UI primitives (`Button`, `Container`)
- [x] Centralized design tokens: warm editorial palette, light + system dark, Fraunces + Geist
- [x] Server-only env validation (Zod) plus Firestore and Gemini clients
- [x] Minimal landing page: hero and "how it works"
- [x] Security headers and supply-chain settings
- [x] `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PHASES.md`

Acceptance: all four checks pass with no `.env` present, and the landing page renders on mobile and
desktop in light and dark mode.

## Phase 1: Recording

Goal: a traveler captures moments on their phone and uploads them.

- `features/recording`: audio and short-video capture with `MediaRecorder`, permission states,
  preview, retake, and delete.
- Upload pipeline with type, size, and duration limits enforced on both client and server.
- Trip/session model in Firestore with Zod schemas, plus an anonymous session identity (no auth).
- Playwright end-to-end setup.

Open decisions:

- Media storage: Cloud Storage for Firebase via signed URLs, or direct to the Gemini Files API.
- Duration and size limits.
- Behavior offline or on poor connectivity.
- Anonymous identity scheme.

## Phase 2: Gemini processing

Goal: turn a trip's recordings into a structured guide draft.

- Choose models and pin their IDs in one config module.
- Server-side processing: Files API for media, structured output from Zod-derived JSON schemas, and
  Zod validation of every response before persisting.
- Processing states (queued, processing, ready, failed), with retries, timeouts, and idempotency.
- Cost and abuse guards: per-session quotas and rate limiting.

Open decisions:

- Synchronous versus background processing (polling or a queue).
- Prompt design.
- Safety settings.

## Phase 3: Guides

Goal: a polished guide that is easy to share.

- Server-rendered guide page with a stop list (and map), where the traveler can edit and reorder
  stops and regenerate sections.
- Share links with unguessable IDs, plus Open Graph images.

Open decisions:

- Map provider.
- Editing scope.
- Link privacy model.

## Phase 4: Hardening and launch

- Nonce-based CSP, Firestore Security Rules that deny client access, rate limiting, and upload abuse controls.
- Observability (errors and logs without PII), performance budgets, and an accessibility audit.
- Deployment target (Firebase App Hosting or Vercel), CI pipeline, and environments.
