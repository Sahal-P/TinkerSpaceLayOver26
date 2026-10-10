# Implementation phases

The product is built UI-first: the complete experience runs on mock data before any backend is wired
in, while a separate backend track builds the pipeline against the agreed contract. Every phase ends
with `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passing, a browser check, updated docs,
and explicit approval before the next phase starts.

## Phase 0: Foundation (done)

- [x] Next.js 16 App Router + TypeScript (strict) on pnpm, with ESLint and Vitest
- [x] Feature-based structure, design tokens, UI primitives
- [x] Server-only env validation plus Firestore and Gemini clients
- [x] Security headers, supply-chain settings, AGENTS.md and docs

## Phase 1: Premium UI and immersive 3D (awaiting approval)

Goal: the full journey, art-directed and production-quality, on typed mocks. No Gemini calls, no
Firebase operations, no real recording.

- [x] Palette and tokens: navy, muted teal, sky blue, beige and white from the reference,
      with steel/airy/pale-blue supporting tones and accessible light/dark modes
- [x] Navbar light/dark toggle, persisted preference, synchronized 3D day/night theme
- [x] Shared animation system (Motion + CSS tokens) and primitives (Badge, Field, ChoiceChips,
      ProgressBar)
- [x] 3D miniature world (Three.js, React Three Fiber, Drei):
  - terrain, village, landmarks and destination pin
  - animated route and cinematic camera
  - day and night themes
  - quality tiers
  - 2D fallback
- [x] Landing:
  - cinematic 3D hero
  - photo bento of the demo route and a feature panel
  - scroll-told how-it-works with a sticky phone
  - Lens check band, CTA
- [x] Record: consent, live waveform, timer, playback scrubbing, upload states, sample recording
- [x] Processing: staged transcription → translation → landmarks → route, with a live preview
- [x] Review: transcript with highlighted landmarks; edit, reorder, add or remove steps with Zod validation; resolve uncertainty
- [x] Journey guide: swipeable step cards, compass dial, progress, interactive 3D route, arrival
- [x] Lens check: camera/upload viewfinder, scan animation, match / unsure / mismatch verdicts
- [x] Share: guide postcard, publish with warning acknowledgement, QR code, Web Share or copy, completion
- [x] Accessibility and reduced motion; no dead ends; 404 page
- [x] Design refresh (editorial travel direction):
  - soft type (Fraunces with the SOFT axis, Figtree), sans caps and lighter surfaces; no numbered kickers
  - split hero with a coastline-masked 3D island at sea
  - photo bento of the demo route and a teal feature panel
  - real, credited Pexels photography
  - `/guide?step=N` deep links

Acceptance: every screen works opened directly and through the flow, on phone and desktop, light and
dark, with and without WebGL.

## Phase 2: Backend pipeline (backend track, in parallel)

Owned by the backend track. Details live in `docs/API.md`.

- `POST /api/directions/extract`:
  - multipart audio, at most 4 MiB and 120 s
  - fields `languageHint`, `durationMs` and `consent`
  - synchronous, with a 45 s deadline
  - returns `{ data: draft, requestId }`
- `POST /api/guides` saves a reviewed draft (`confirmed: true`). `GET /api/guides/:id` returns owner
  drafts or published guides. `POST /api/guides/:id/publish` requires `acknowledgeWarnings` when
  warnings remain. Owner unpublish/delete.
- Anonymous, signed, HttpOnly same-browser ownership. Random share IDs. Public projections exclude
  transcripts, evidence and audio.
- Client-safe contract in `src/contracts/guide.ts`.

## Phase 3a: Backend integration and real audio (code complete; live acceptance pending)

- [x] UI baseline `c14cd4c`; backend review `f8752e8` cherry-picked as `8be28b6` without its seed
- [x] Canonical guide state, nullable values, full direction/incline vocabulary, and display-only anchors
- [x] Conservative distance/negation guards and non-reusable exact evidence occurrences
- [x] Real recording/upload, 4 MiB/2–120 s validation, playback, consent, and resource cleanup
- [x] Real XHR upload progress, validated extraction responses, cancellation and bounded explicit retries
- [x] Review preserves uncertainty/provenance and validates the whole guide before local navigation
- [x] Explicit English six-stop Lisbon demo; no live fallback or simulated live Lens/publication
- [x] Mocked Chrome/WebKit browser tests at phone/desktop sizes, themes, reduced motion and fallback
- [ ] Controlled multilingual speech generation and native-speaker review
- [x] Local keyless ADC token acquisition and read-only Firestore access
- [x] Real browser negative case: digital-silence PCM rejected before Gemini, no guide/fallback
- [ ] Physical iPhone Safari capture/playback/submission

On 2026-10-11, model metadata and a live structured transcription request reached Gemini.
The model inconsistently classified exact digital silence as speech; PCM silence is now rejected
deterministically before provider invocation. Compressed silence and real multilingual accuracy
remain unverified. A diagnostic second-stage request failed with safe `upstream_unavailable`.
ADC and Firestore access are verified; live successful guide extraction and physical Safari remain
pending. Follow [AUDIO-VERIFICATION.md](AUDIO-VERIFICATION.md).

## Phase 3b: Saved and shared guides (deferred)

Wire confirmed saves, publishing/revocation, canonical share URLs/QR, and `/g/[id]` through the
installed repositories. Keep owner/public projection boundaries and warning acknowledgement.
Real Lens analysis, offline handling and post-publication editing require separate scope decisions.

## Phase 4: Hardening and launch

- Nonce-based CSP, rate limiting and abuse controls, Firestore Security Rules.
- Self-host the editorial photography, which is currently loaded from the Pexels CDN.
- Observability (errors and logs without PII), performance budgets for the 3D chunk, and an accessibility audit.
- Deployment target (Firebase App Hosting or Vercel), CI pipeline, and environments.

## Backend review integrated

The isolated backend review commit `f8752e8` is integrated on `feat/backend-integration`.
Only its review changes were applied; the foundation seed was excluded.
Gemini extraction and Firestore APIs are installed; the temporary local journey is wired.
See [API.md](API.md) for canonical contracts and verification limits.
