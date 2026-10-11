# Local to Lens

Record a local's directions in any language. Gemini turns them into a landmark-by-landmark guide you
can follow, check with your camera, and share.

> **Current phase: 3a, backend integration and real audio.** Recording or uploading Malayalam,
> Hindi, English or mixed audio works end to end against Gemini, and the result is reviewed into a
> temporary guide held in browser memory. Lens check and Share are demo previews. Saving,
> publishing and public guide pages are built on the server but not wired into the UI yet. See
> [Status](#status).

## How it works

1. **Record.** Capture with the microphone, upload a clip, or try the bundled sample, after
   explicit consent.
2. **Process.** The server validates the audio. Gemini transcribes and translates it, then extracts
   ordered steps that quote the transcript. Anything the speaker was unsure about is flagged, not
   guessed.
3. **Review.** The traveler checks the transcript, edits, reorders, adds or removes steps, and
   acknowledges any remaining uncertainty before the guide opens.
4. **Follow.** Step cards with a direction cue and an illustrative 3D route, plus optional voice
   narration in English, Hindi or Malayalam.
5. **Check and share.** Compare a landmark with the camera, then publish a link and QR code. Both
   are demo previews today.

The guide is a sequence of landmarks, not a map. Nothing is geocoded, and no city, GPS position,
total distance or walking time is ever inferred.

## Status

Phase 3a is code complete. Live acceptance is still pending.

| Route         | Screen                                                        | Backed by                             |
| ------------- | ------------------------------------------------------------- | ------------------------------------- |
| `/`           | Landing page with the 3D island hero                          | Static content                        |
| `/record`     | Record, upload or use the sample clip; consent; language hint | Real audio                            |
| `/processing` | Real upload progress, then Gemini processing; cancel or retry | `POST /api/directions/extract`        |
| `/review`     | Transcript, editable steps, uncertainty acknowledgement       | The extracted draft                   |
| `/guide`      | Step cards, direction cue, 3D route, opt-in voice             | The reviewed draft; voice uses Gemini |
| `/lens`       | Compare a landmark photo with what the speaker described      | Scripted demo only                    |
| `/share`      | Publish, link and QR code                                     | Scripted demo only                    |
| `/g/[id]`     | Public guide page                                             | Not built yet                         |

**Demo guide.** "Explore demo" (on any empty flow screen) and "Try the demo guide" (on `/record`)
load a scripted English route through Alfama, Lisbon: "Tram stop to viewpoint", six stops. It makes
no service calls unless you turn on voice, and it never stands in for a failed live extraction. It
is the only path where Lens check and Share are interactive, and even there they use deterministic
verdicts and a mock link. Photos stay on the device and are not analyzed, and nothing is saved or
published. Live guides see a "coming later" screen instead. Reloading clears any guide.

**Sample clip.** "Use sample audio" on `/record` loads a bundled synthetic Hindi recording (about a
minute and a half, generated with ElevenLabs), so reviewers can try the whole flow without a
microphone or a file of their own. It is validated exactly like an upload and still needs the
consent checkbox. It then goes through the real pipeline, so processing it needs the live setup
below and counts against the extraction limits. It is not a canned result, and like any long clip
it can time out and be retried.

**Still unverified.** Automated tests mock Gemini, so these remain open: native-speaker review of
Malayalam and Hindi extraction and narration, a mixed-language clip that produced a valid draft but
missed the strict four-step comparison, compressed or noisy silence (only exact digital silence in
PCM is rejected deterministically), physical iPhone Safari capture, playback and autoplay, and
Firestore access from the deployed host. See [docs/PHASES.md](docs/PHASES.md) and
[docs/AUDIO-VERIFICATION.md](docs/AUDIO-VERIFICATION.md).

## Quick start

Requires Node.js >= 22.13 and pnpm 11 (the version pinned in `package.json` is selected
automatically).

```bash
git clone https://github.com/Sahal-P/TinkerSpaceLayOver26.git
cd TinkerSpaceLayOver26
pnpm install
pnpm dev
```

Open <http://localhost:3000>. With no configuration you get the landing page, the 3D scene and the
demo guide. Configuration is read lazily, so `pnpm lint`, `pnpm test` and `pnpm build` need no
credentials either.

### Run the live flow

Live extraction and voice need Gemini, a signing secret and Firestore access.

```bash
cp .env.example .env.local   # git-ignored; every value is server-only
```

| Variable           | Required | Purpose                                                                          |
| ------------------ | -------- | -------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`   | Yes      | Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)       |
| `SESSION_SECRET`   | Yes      | At least 32 random characters; signs the anonymous owner cookie                  |
| `APP_ORIGIN`       | Yes      | Exact origin the browser uses, such as `http://localhost:3000`: no path or query |
| `GEMINI_MODEL`     | No       | Defaults to `gemini-3.8-flash`; change only after multilingual evaluation        |
| `GEMINI_TTS_MODEL` | No       | The only accepted value, and the default, is `gemini-2.5-flash-preview-tts`      |

Generate a secret with:

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

Firestore holds the rate-limit counters, so extraction and voice requests fail closed without it.
Pick one credential source:

- **Application Default Credentials** (the default): run `gcloud auth application-default login`
  with access to your project, or use a Google runtime such as Firebase App Hosting or Cloud Run.
  `FIREBASE_PROJECT_ID` is optional here.
- **Service account:** set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`
  together, keeping the `\n` escapes in the key.
- **Vercel:** keyless Workload Identity Federation. Set `FIREBASE_PROJECT_ID` and all four `GCP_*`
  values. See [Deployment](#deployment).
- **Emulator:** set `FIRESTORE_EMULATOR_HOST`, which `firebase-admin` reads automatically.

### Useful URLs and flags

- Add `?no-webgl` to any page to see the illustrated 2D fallback instead of the 3D scene.
- `/guide?step=N` opens the guide at step N once a confirmed guide exists. Without one, it offers
  the demo at that step.
- Browsers only allow the microphone on `localhost` or HTTPS. To test on a phone, use a trusted
  HTTPS origin and set `APP_ORIGIN` to match.

### Troubleshooting

- `forbidden_origin`: `APP_ORIGIN` does not exactly match the browser's origin, including the
  scheme and port.
- `service_misconfigured`: `SESSION_SECRET`, `APP_ORIGIN` or the Gemini settings are missing or
  invalid, or Gemini rejected the key or model.
- `storage_unavailable`: no usable Firestore credentials.

## Scripts

| Command          | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Dev server (Turbopack)                                          |
| `pnpm build`     | Production build                                                |
| `pnpm start`     | Serve the production build                                      |
| `pnpm lint`      | ESLint                                                          |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit`                       |
| `pnpm test`      | Vitest, single run (`pnpm test:watch` to watch)                 |
| `pnpm test:e2e`  | Playwright in Chrome and WebKit, phone and desktop, APIs mocked |

Before you call a change done, `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass.

## Under the hood

### Extraction pipeline

`POST /api/directions/extract` runs inside a 45-second processing deadline, within a 60-second route
budget:

1. **Validate the upload.** One audio file of at most 4 MiB and 2 to 120 seconds, in a real
   container that matches its declared type (WAV, MP3, M4A/MP4 AAC, Ogg, WebM or FLAC), with
   consent. Duration is read from the media itself. PCM that is exact digital silence is rejected
   with `no_speech` before Gemini is called.
2. **Transcribe and translate.** Gemini returns original-language segments with English
   translations and the languages it heard. Only Malayalam, Hindi and English are supported, and the
   language hint never overrides detection.
3. **Extract steps.** A second Gemini call selects ordered navigation steps as exact quotes. Audio
   and transcripts are treated as untrusted prompt data.
4. **Ground the result.** Server code rejects, and does not repair, any step whose quotes are out of
   order or missing from either language, whose turn or incline was not explicitly spoken, or whose
   landmark or distance is not in its quote. Contradictory or unclear wording is kept but marked
   `unknown` with low confidence and a warning, and hedges such as "I think" lower confidence and
   add one. Distances become meters only from explicit numbers and units; vague ones stay `null`.
5. **Return a `GuideDraft`,** validated against the Zod contract in
   [`src/contracts/guide.ts`](src/contracts/guide.ts).

Each step carries an instruction (an exact English quote), a `direction` (`start`, `straight`,
`slight_left`, `left`, `slight_right`, `right`, `u_turn`, `arrive` or `unknown`), an `incline`
(`up`, `down` or none), a landmark and distance with their spoken originals, bilingual evidence, a
`confidence` of `high`, `medium` or `low`, and warnings.

### Trust model

- Grounding proves consistency with the model's transcript, not accuracy against the recording or
  the real world. Review is required, and no claim of error-free speech recognition is made.
- Unknown headings and unresolved references such as "there" keep low confidence and a visible
  warning. A dependent phrase such as "after reaching there" is joined to its next action using
  exact source text and never becomes a card of its own.
- Confirming a step acknowledges it. It does not clear warnings or raise confidence. Edited or
  reordered steps are marked `source: "user"` and carry no audio evidence.

### Voice guidance

Voice is off by default and separate from recording consent. When enabled, it reads the selected
step's instruction, landmark and distance in English, Hindi or Malayalam. Navigation stays manual.

Non-English narration is a Gemini translation that is checked for names, quantities, turns,
negation and uncertainty, and then spoken with Gemini speech (`gemini-2.5-flash-preview-tts`). The
translated text is previewed on screen. Generated review warnings stay visible but are not read
aloud. Translations and clips live only in memory (server 64 MiB, browser 16 MiB). Hindi and
Malayalam narration still need native-speaker review.

### 3D scene

An island at sea built with React Three Fiber, lazy-loaded as its own chunk, with day and night
themes that follow the light/dark toggle. Without WebGL, with a software renderer or after a lost
context, it falls back to an illustrated 2D scene. Both views share one layout module and are
explicitly illustrative.

## Project structure

```
src/
  app/                  Routes only: (flow)/ journey screens, api/ route handlers, the landing page
  features/
    landing/            Landing sections
    journey/            The record to share flow: store, API clients, recorder, voice, screens
  components/
    ui/                 Feature-agnostic primitives
    scene/              3D world, layout math and 2D fallback (three is imported only in canvas/)
  contracts/            Client-safe Zod schemas and grounding rules shared by UI and server
  server/               Server-only: env, Gemini and Firestore clients, pipeline, guides, speech,
                        rate limits and sessions
  lib/                  Pure helpers: cn, motion, formatting, audio inspection, wayfinding vocabulary
  config/               Site metadata and the photo registry
  styles/tokens.css     Design tokens, the only source of design values
docs/                   Architecture, API contract, phases and verification notes
e2e/                    Playwright specs
public/samples/         The bundled synthetic sample clip
```

Imports point downward: `app` to `features` to `components`, `lib`, `config` and `server`. Client
code cannot import `server/`, because every server module starts with `import "server-only"`.

## Tech stack

| Area      | Choice                                                                            |
| --------- | --------------------------------------------------------------------------------- |
| Framework | Next.js 16.4 (App Router, Turbopack) and React 19.3                               |
| Language  | TypeScript 6.0, strict with `noUncheckedIndexedAccess`                            |
| Styling   | Tailwind CSS 4.3 with CSS-first tokens; `motion` 14; `lucide-react` icons         |
| 3D        | three 0.186, React Three Fiber 9, drei 10                                         |
| Schemas   | Zod 4 at every boundary                                                           |
| AI        | Gemini through `@google/genai` 2, server-only                                     |
| Data      | Firestore, server-only: `firebase-admin` 14 (`@google-cloud/firestore` on Vercel) |
| Audio     | `mediabunny` inspects containers and durations in both browser and server         |
| Testing   | Vitest 5, Testing Library, Playwright                                             |
| Tooling   | ESLint 10, pnpm 11, Node.js >= 22.13                                              |

The palette is navy, teal, sky blue, beige and white, defined in
[`src/styles/tokens.css`](src/styles/tokens.css) for light and dark. Type is Fraunces (soft
display), Figtree (body) and Geist Mono (data). The UI uses semantic landmarks, a skip link,
keyboard-reachable controls, reduced-motion support and 44px touch targets.

## API

All endpoints are same-origin Node route handlers with a 60-second duration. Success returns
`{ data, requestId }`; failure returns `{ error: { code, message, retryable }, requestId }`.
Responses are `private, no-store`. Cross-origin clients are deliberately unsupported.

| Endpoint                                         | Purpose                                             | In the UI |
| ------------------------------------------------ | --------------------------------------------------- | --------- |
| `POST /api/directions/extract`                   | Multipart audio to a validated `GuideDraft`         | Yes       |
| `POST /api/speech/translate`                     | Translate one step for narration (`en`, `hi`, `ml`) | Opt-in    |
| `POST /api/speech`                               | Synthesize up to 600 characters to `audio/wav`      | Opt-in    |
| `POST /api/guides`                               | Save a reviewed guide (`confirmed: true`)           | Not yet   |
| `GET` and `DELETE /api/guides/[id]`              | Read an owner draft or published guide; delete      | Not yet   |
| `POST /api/guides/[id]/publish` and `/unpublish` | Publish with warning acknowledgement; revoke        | Not yet   |

Once saved, a guide lives in Firestore against a hashed anonymous owner ID. A published guide is an
unlisted link with a random 128-bit ID, and its public projection keeps the warnings but omits
transcripts, evidence and audio.

Firestore-backed transactional limits apply per anonymous session and globally:

| Operation                          | Per session            | Global      |
| ---------------------------------- | ---------------------- | ----------- |
| Extraction                         | 3 a minute, 20 a day   | 200 a day   |
| Voice (translation and each chunk) | 12 a minute, 120 a day | 500 a day   |
| Guide mutations                    | 10 a minute            | 1,000 a day |
| Guide reads                        | None                   | 5,000 a day |

Days are UTC. The full contract, error codes and storage model are in [docs/API.md](docs/API.md).

## Security and privacy

- **Consent first.** Recording and sending audio to Gemini needs an explicit consent checkbox. Voice
  guidance is a separate opt-in, and enabling it sends the current step to Gemini.
- **Audio is not stored by the app.** It is validated, sent inline to the Gemini API from the server
  and kept only in memory: in the browser so a failed clip can be retried, and on the server for the
  length of the request. Google's own terms govern what Gemini retains.
- **Secrets stay on the server.** SDK clients exist only behind `getGemini()` and `getDb()`. Env
  values are validated with Zod, never logged and never prefixed with `NEXT_PUBLIC_`. Logs carry
  request IDs and fixed reason codes, never audio, transcripts or provider errors.
- **Same-origin API.** Mutating requests must carry an `Origin` equal to `APP_ORIGIN` and must not
  be cross-site.
- **Anonymous ownership.** A signed, HttpOnly, SameSite=Lax cookie (`__Host-ltl-owner` in
  production, `ltl-owner` locally, 30 days) identifies the browser. There are no accounts and no
  recovery if the cookie or `SESSION_SECRET` is lost.
- **Limits fail closed.** If rate-limit storage is unavailable, requests are denied.
- **Headers.** `nosniff`, a strict referrer policy, `X-Frame-Options: DENY`, a Permissions-Policy
  that grants camera and microphone to the app's own origin only, and no `X-Powered-By`. A
  nonce-based CSP is planned.
- **Third parties.** Editorial photos currently load from the Pexels CDN. They will be self-hosted
  before launch.

## Testing

```bash
pnpm test                                    # unit and component tests
pnpm exec playwright install chrome webkit   # once, for the browser tests
pnpm test:e2e
```

- **Unit and component:** colocated `*.test.ts(x)`, Node by default and jsdom for components. The
  Gemini and Firestore SDKs are mocked, and automated tests never call live services. One test
  validates the bundled sample clip against the upload limits.
- **End to end:** Playwright runs Chrome and WebKit at 375 by 812 and 1440 by 900. It starts its own
  dev server on port 3210 (or reuses one already there) and intercepts the APIs, so it needs no
  credentials. Chrome uses a fake microphone. The microphone capture test is skipped on WebKit
  until it is verified on a physical iPhone.
- **Live checks:** a bounded manual procedure with consented recordings is in
  [docs/AUDIO-VERIFICATION.md](docs/AUDIO-VERIFICATION.md). Never commit recordings, credentials or
  full transcripts. Generated verification clips are git-ignored.

## Deployment

Any Node.js >= 22.13 host works if it allows outbound requests to Gemini and Firestore, request
bodies for a 4 MiB clip plus multipart overhead, and the 60-second duration the API routes declare.
Set the same `SESSION_SECRET` on every instance and `APP_ORIGIN` to the exact HTTPS origin.

Firestore credentials depend on the host:

- **Google runtimes** (Firebase App Hosting, Cloud Run): Application Default Credentials. Leave the
  client email and private key empty.
- **Vercel:** it has no Application Default Credentials, so use keyless Workload Identity
  Federation. Set `FIREBASE_PROJECT_ID` plus `GCP_PROJECT_NUMBER`,
  `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` and
  `GCP_SERVICE_ACCOUNT_EMAIL`. Vercel's OIDC token is exchanged for a runtime service account, so no
  key is stored. The identity setup is in [docs/API.md](docs/API.md).
- **Anywhere else:** a service-account key pair, as in [Run the live flow](#run-the-live-flow).

The repository has no CI pipeline or deployment automation yet. Both are Phase 4 work.

## Roadmap

| Phase | Scope                                                                            | State                                  |
| ----- | -------------------------------------------------------------------------------- | -------------------------------------- |
| 0     | Foundation: Next.js, tokens, server-only env and clients                         | Done                                   |
| 1     | The whole journey and the 3D world on typed mocks                                | Done                                   |
| 2     | Backend: Gemini extraction and Firestore guide APIs                              | Done                                   |
| 3a    | Real audio, canonical review, voice guidance                                     | Code complete; live acceptance pending |
| 3b    | Saved and shared guides: save and publish UI, `/g/[id]`, share URLs and QR codes | Deferred                               |
| 4     | Nonce-based CSP, abuse controls, self-hosted photos, observability, CI, deploy   | Planned                                |

Real Lens analysis, offline handling and editing after publication need separate scope decisions.

## Documentation

- [AGENTS.md](AGENTS.md): coding standards, ownership and workflow
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, routes, journey state, 3D scene, styling
- [docs/API.md](docs/API.md): endpoints, limits, errors, environment, Firestore and verification
- [docs/PHASES.md](docs/PHASES.md): roadmap and per-phase checklists
- [docs/AUDIO-VERIFICATION.md](docs/AUDIO-VERIFICATION.md): bounded live audio procedure and results
- [docs/HINDI-CLIP-FIX.md](docs/HINDI-CLIP-FIX.md) and
  [docs/NAVIGATION-REFINEMENT.md](docs/NAVIGATION-REFINEMENT.md): extraction corrections
- [src/server/speech/VERIFICATION.md](src/server/speech/VERIFICATION.md): voice guidance findings

## Contributing

Read [AGENTS.md](AGENTS.md) first. In short:

- A backend track owns `src/server/**`, `src/app/api/**`, `src/contracts/**`, backend fixtures and
  tests, `.env.example` and `docs/API.md`. The UI track owns everything else. Coordinate on
  `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next.config.ts` and the docs.
- Keep changes inside the current phase.
- A change is done when lint, typecheck, tests and build pass, it has been checked in a browser at
  phone and desktop sizes in light and dark, and the docs cover any new rule, service or env var.
- Next.js 16 differs from older releases: request APIs are async, `middleware.ts` is now
  `proxy.ts`, and `next lint` is gone. Version-matched docs ship in `node_modules/next/dist/docs/`.
- Never commit secrets or personal recordings. The one bundled sample clip is synthetic speech.

## Credits

Photography of Alfama and Lisbon from [Pexels](https://www.pexels.com) by Masood Aslami, ArtHouse
Studio, Max Avans, Stephan Leuzinger and Mel Legarda, also credited in the site footer. Type is
Fraunces, Figtree and Geist Mono through `next/font`.

The sample clip is synthetic Hindi speech generated with [ElevenLabs](https://elevenlabs.io).
