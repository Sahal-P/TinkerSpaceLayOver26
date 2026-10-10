# Architecture

Local to Lens is a single Next.js App Router application. The product is built **UI-first**: the
landing and 3D foundation remain, while the integrated flow uses real audio and canonical backend
contracts. An explicit, isolated demo uses an English script of the Lisbon example. Server Components render static structure, and client
components own interaction, animation and the 3D scene. Server-only modules own every secret and SDK.

## Layers

```
src/
  app/          Routes: layouts, pages, templates. Thin; composes features.
  features/     One folder per capability: landing, journey.
  components/   Shared, feature-agnostic UI: ui/ primitives, shared visuals, scene/ (3D).
  lib/          Pure isomorphic helpers: cn, motion, format, wayfinding vocabulary.
  config/       Public, non-secret configuration: site metadata, photo registry.
  server/       Server-only infrastructure (backend track).
  styles/       Design tokens.
```

### Dependency rules

Imports point downward only:

```
app → features → components, lib, config, server
      components → lib, config
      server     → lib
```

- A feature never imports another feature's internals. Shared visuals (`Photo`, `Waveform`,
  `DirectionIndicator`, `RouteSketch`, `QrCode`, `Viewfinder`, `LensArt`) live in `components/` so
  landing and journey can both use them.
- `lib/` and `components/` never import from `server/` or `features/`.
- Client Components never import server modules; `import "server-only"` makes that a build error.

## Routes

| Route         | Screen                                                                 | Rendering |
| ------------- | ---------------------------------------------------------------------- | --------- |
| `/`           | Landing: split hero with the 3D island, photo bento of the demo route, feature panel, how-it-works, Lens band, CTA | Static |
| `/record`     | Recorder: consent, live waveform, timer, playback, upload states        | Static    |
| `/processing` | Staged transcription → translation → landmarks → route                 | Static    |
| `/review`     | Transcript, editable steps, uncertainty resolution, confirmation       | Static    |
| `/guide`      | Step cards, compass dial, progress, interactive 3D route; `?step=N` opens step N | Static |
| `/lens`       | Camera/upload viewfinder and mock comparison verdicts                   | Static    |
| `/share`      | Guide postcard, publish with warning acknowledgement, QR, completion    | Static    |
| `/g/[id]`     | Public guide (planned; server-rendered from the backend contract)       | Dynamic   |

The flow routes share `app/(flow)/layout.tsx` (journey state + header with back, progress and close)
and `app/(flow)/template.tsx` (a soft entrance on every navigation). Direct entry with empty state offers recording or explicit demo selection. Live guides require
review; reload clears temporary state. There are no dead ends: each screen has
Back, a forward action, and the 404 page links home. The landing page's photo cards deep-link into the
guide with `/guide?step=N`. A tiny client leaf reads the query inside `<Suspense>`, so the page stays
static.

## Journey state

`features/journey/journey-store.tsx` stores one canonical `GuideDraft`, a temporary audio clip,
consent, request state, review state, and navigation. `presentation.ts` derives display-only steps;
anchors are null for live guides. No audio/transcript persistence or automatic fixture fallback exists.
XHR starts only from a user action, has a single active attempt, real upload progress, a 60-second
client deadline, cancellation, and explicit retry respecting `Retry-After`.

Both model stages derive their provider JSON schema from Zod. Provider schemas omit `maxItems`
to avoid nested-array expansion failures observed in live calls; the unchanged Zod schemas enforce
all array limits on returned output before it can enter the guide. Enum/null/required/strict-field
constraints remain in the provider schema. Permanent provider 400/401/403/404 failures return a
safe, non-retryable configuration error. Transient and quota errors retain their bounded behavior.

The recorder uses browser MediaRecorder, mono preference/64 kbps, an encoding-safe 119-second cap,
real audio-element playback, and complete track/context/object-URL cleanup. Media inspection is
shared in `lib/audio-inspection.ts` and dynamically imported in the browser; the server repeats it.
For PCM, every packet is checked for exact digital silence (signed/float zero or unsigned midpoint).
The server rejects confirmed digital silence with `no_speech` before Gemini. This is not speech
detection: compressed audio, quiet speech, ambient noise, and nonzero signals still rely on Gemini.
Upload controls wait for hydration so early WebKit file events are not lost. Audio stays in memory
for retry and is released on success/reset/flow exit.

## Guide voice guidance

`contracts/speech.ts` derives narration fields from canonical step fields. Guide voice is opt-in,
English by default, follows manually selected steps, and never advances the route. It reads the
instruction, existing landmark/distance and deduplicated step/route warnings. Missing details remain
null. English route cards stay unchanged; Hindi/Malayalam voice translations have an expandable preview.
Landmark names, quantity literals and the distance section stay verbatim rather than being inferred.
Translation guards check structure, nulls, warning alignment, quantities, turn/alternative wording, negation and uncertainty
markers; these conservative checks can reject valid translations and do not prove semantic truth.
Native-speaker review is still required. Demo narration calls Gemini only after opt-in.

Server-only speech endpoints use `getGemini()` and the existing signed session/origin protections.
Translation uses the structured-output model; speech uses `GEMINI_TTS_MODEL`, prebuilt Kore and
`store:false`. Binary WAV is inspected, including very short speech clips; recording uploads retain
the two-second minimum. Provider calls have a 45-second deadline and no automatic retry.

The browser uses one reusable audio element, lossless 600-character chunks, attempt identities,
abort signals, and revoked object URLs. Playback stops on voice-off, step/language change, page hiding
or exit; returning from a hidden page requires a tap. Blocked autoplay has a Tap to play control.
Service errors latch until explicit retry, with Retry-After cooldown. Navigation remains usable.

Translation and audio caches are private memory only, keyed by session/content/language/model/voice
on the server. Server cache: 64 MiB / 128 entries, lazy 30-minute TTL and in-flight deduplication.
Browser cache: 16 MiB / 128 entries, reset on draft replacement/edit, journey unmount or reload.
Only the next step is prefetched, after current playback completes. No Storage, IndexedDB, CDN,
filesystem or Firestore audio is used by the app. Atomic Firestore speech budgets limit all API
requests (including server cache hits) to 12/minute and 120/day per session, 500/day globally.

Processing shows real upload progress plus an animated loader, then an indeterminate spinner/line.
Stage dots stay pending until the validated response; they never simulate stage completion.
Reduced motion suppresses the decorative loops while keeping an accessible status visible.

## Canonical contracts and review

`contracts/guide.ts` owns domain schemas and inferred types. UI schemas convert HTML form values,
including blank fields to null; they do not duplicate persisted contracts. Unknown directions,
separate inclines, original/English transcripts and nullable timestamps remain intact.
Acknowledgement does not change confidence or warnings. Semantic edits and reordered steps use
user provenance without audio evidence. Whole-guide validation and explicit warning acknowledgement
precede Guide; unsaved or invalid editors cannot confirm. No city, identity, GPS, total-route distance,
or walking time is inferred. The unchanged island is an illustrative sequence, not a map.

Live Lens and Share show unavailable states. Their explicit demo previews do not publish or analyze
real guides. Save/publish endpoints remain installed for a later approved phase. See [API.md](API.md).

## 3D scene

```
JourneyScene (client, main bundle)      2D RouteSketch fallback, WebGL detection,
  │                                     color scheme, reduced motion, in-view state
  └─ next/dynamic(ssr: false) ─► canvas/scene-canvas.tsx
                                   Canvas · PerformanceMonitor · lights
                                   └─ Diorama: island terrain · sea and shallows · route
                                      · landmarks · instanced village and trees · lighthouse
                                      · boat · clouds · pin · CameraRig
```

- **One world, two modes.** `hero` drifts slowly, follows the pointer, dollies with scroll, and draws
  the route before a traveler walks it. `guide` flies between steps, looks slightly ahead, rings the
  active landmark, and lets you tap landmarks to jump to a step.
- **Shared layout.** `scene/layout.ts` (terrain height, route, landmark anchors) is pure math, also
  used by the 2D fallback and the share-card map, so every view shows the same place.
- **Island at sea.** The terrain sinks below the water toward the rim along an uneven shore, so the
  island has a real coastline (`coastline()` in `layout.ts`, also drawn by the 2D fallback). The sea is
  a large unlit, untoned plane. Fog fades it exactly into the `--sea` haze behind the canvas, and a
  ring of paler shallows softens the shore.
- **Themes.** Day (warm beige light) and night (sky-blue moonlight, glowing windows, lighthouse beam) follow
  the shared color scheme (navbar preference, otherwise `prefers-color-scheme`). The scene palette mirrors the CSS tokens.
- **Performance.**
  - DPR is capped per tier and adapts through `PerformanceMonitor`.
  - Terrain is a single faceted mesh; the village and trees use six instanced meshes; materials are shared.
  - One shadow-casting light with PCF shadows; the sea and shallows are unlit.
  - Rendering stops offscreen and goes on-demand under reduced motion.
- **Resilience.** No WebGL, a software renderer (`failIfMajorPerformanceCaveat`) or a lost context
  all fall back to the illustrated 2D scene. `?no-webgl` forces this for testing.

## Styling and motion

- The landing and journey headers share `ThemeToggle`. `lib/use-color-scheme.ts` keeps the CSS
  tokens and scene in sync through `data-theme` on `<html>`. Explicit light/dark choices persist in
  local storage; before choosing, the OS preference applies. A small validated inline script in the
  root layout restores the choice before first paint, while pages remain statically rendered.

- Tailwind CSS 4, configured CSS-first. `src/styles/tokens.css` has three layers:
  1. The palette in private variables.
  2. Semantic tokens for light and dark.
  3. A Tailwind theme via `@theme inline`, so only semantic utilities exist.
- Palette: the reference uses navy (`#0D1B2A`), muted teal (`#4B6B7C`), sky blue
  (`#C8D9E6`), warm beige (`#F2EFE7`) and white (`#FFFFFF`), supported by deep navy
  (`#1B263B`), steel blue (`#3D5A80`), airy blue (`#98B4C7`) and pale blue (`#D8E6F2`).
  The labeled hex values are used instead of the screenshot's shaded/compressed pixel colors.
  - Light: beige page, white raised surfaces, ice-blue sunken panels, navy copy, teal actions and
    feature panels, sky-blue sea haze.
  - Dark: navy page, deep-navy raised surfaces and sea haze, pale-blue copy and action fills.
  - `accent-ink` supplies readable accent copy and meaningful route/direction marks. In light mode
    it uses a deeper teal because the reference teal falls just below 4.5:1 on a pale-blue badge.
  - Confidence states use steel blue, teal/beige and navy/sky pairs; their words and icons convey
    the status as well as color. Photo scrims and QR codes use navy/white in either mode.
  - The 2D illustrations, WebGL materials/lighting, app icon and browser theme colors follow the
    same navy, teal, beige and blue family. Scene `background` exactly matches each mode's `--sea`.
- Type, self-hosted by `next/font`:
  - Fraunces: display, made soft with `"SOFT" 100, "WONK" 0`. Italic accents appear only in the hero
    and the feature panel.
  - Figtree: body and sans caps labels.
  - Geist Mono: data only.
- Shapes: the hero frame uses the `mask-coast` / `mask-coast-sm` coastline masks. Buttons are
  `rounded-xl`, tags are pills, and the card and panel radii are tokens.

## Photography

- Real photos of Alfama and Lisbon from Pexels (free license), registered in `src/config/photos.ts`
  with alt text, credit and focal point. The footer credits every photographer.
- `components/photo.tsx` wraps `next/image` with a loader for the Pexels CDN, which resizes on the
  fly. No `images` config or Next.js image proxy is needed.
- Before launch, self-host the files so visitors' browsers never contact a third party (Phase 4).
- Motion: Motion for interaction and state changes. CSS tokens cover first paint (`animate-rise`),
  route drawing (`animate-draw`) and the Lens scan line. Shared easing lives in
  `src/lib/motion.ts` and mirrors the CSS easings.

## Testing strategy

- **Unit:** the reducer, schemas and fixtures, scene layout math, formatting, server env/credentials.
- **Component (jsdom):** landing render, consent gating, review validation, guide navigation,
  publish acknowledgement, reduced motion. WebGL is absent in jsdom, so tests exercise the fallback.
- **Browser checks:** phone and desktop, light and dark, `?no-webgl`, horizontal overflow, and console
  warnings, run with the in-app browser before reporting.
- **End-to-end (Playwright):** added with the integration phase.

## Security baseline

- **Headers** (`next.config.ts`):
  - `X-Content-Type-Options: nosniff`
  - strict `Referrer-Policy`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy` allowing camera and microphone for our own origin only
  - no `X-Powered-By`
- **Audio:** consented processing sends inline audio to Gemini through the server. Audio is not saved.
  Demo Lens photos remain local, with revoked object URLs. Live Lens is unavailable.
- **Secrets:** server-only, validated, never logged. Supply-chain protections come from pnpm (see AGENTS.md).
- **Planned:**
  - nonce-based CSP
  - `noindex` on public guides

Atomic Firestore limits protect extraction, guide mutations and published reads; unavailable
protection fails closed. Client Firestore rules deny all access. Local development now uses approved
user-account ADC outside Git; deployment must use an approved attached runtime identity.
