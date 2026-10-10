# Architecture

Local to Lens is a single Next.js App Router application. The product is built **UI-first**: the
complete journey runs on typed mock fixtures (Phase 1), while a separate backend track builds the
server pipeline against an agreed contract. Server Components render static structure, and client
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
and `app/(flow)/template.tsx` (a soft entrance on every navigation). Every screen works when opened
directly, because the state starts from the demo journey. There are no dead ends: each screen has
Back, a forward action, and the 404 page links home. The landing page's photo cards deep-link into the
guide with `/guide?step=N`. A tiny client leaf reads the query inside `<Suspense>`, so the page stays
static.

## Journey state

`features/journey/journey-store.tsx` holds the flow state in a reducer: language hint, recording,
edited steps, confirmation, guide position, arrival and Lens results. It lives in the `(flow)` layout,
so it survives navigation between screens and resets on a full reload. The reducer is pure and unit
tested. Persistence arrives with the backend phases.

## Contract with the backend track

The backend track will publish a client-safe Zod contract in `src/contracts/guide.ts`. The agreed shape:

- Steps carry `direction` (including `unknown`), `incline`, `landmark {spoken, label}`,
  `distance {spoken, meters}`, `confidence`, `warnings`, `needsReview` and `reviewed`.
- Provenance: `source: "audio"` with exact quotes as evidence; `source: "user"` with `evidence: null`.
- Publishing requires `acknowledgeWarnings: true` while warnings remain.

The UI's `features/journey/schemas.ts` is a view-model for the mock phase. During integration it
maps from the contract instead of the fixtures. UI-only fields such as the 3D `anchor` and walking
time estimates are never stored.

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
- **Mock phase:** nothing leaves the device. Lens photos are previewed with local object URLs and
  revoked; no audio is captured.
- **Secrets:** server-only, validated, never logged. Supply-chain protections come from pnpm (see AGENTS.md).
- **Planned:**
  - nonce-based CSP
  - rate limiting for the anonymous extraction endpoint
  - Firestore rules denying client access
  - `noindex` on public guides
