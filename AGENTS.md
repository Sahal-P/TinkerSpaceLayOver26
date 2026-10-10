# AGENTS.md: Local to Lens

Rules for AI coding agents and humans working in this repo. Read this first, then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PHASES.md](docs/PHASES.md).

## Product

A traveler records a local giving directions, in any language. Gemini transcribes and translates the
recording and turns it into landmark-by-landmark steps, flagging anything the speaker was unsure about.
The traveler reviews the steps, follows them with an illustrated route, checks uncertain landmarks
with the camera (Lens check), and shares the guide. Expect most use on a phone, outdoors, one-handed.

## Current phase

**Phase 3a, Backend integration and real audio.** The default flow captures/uploads Malayalam,
Hindi, English, or mixed audio, extracts a canonical draft, and reviews it into a temporary local guide.
An explicitly selected English demo preserves the Lisbon scene. Save/publish APIs are installed,
but their UI, public guide pages, and real Lens analysis are deferred. Local keyless ADC and Firestore
access are verified. Opt-in Gemini guide narration supports English, Hindi and Malayalam with
session memory caching; the processing loader covers upload and indeterminate processing.
Native speech/iPhone verification remains an acceptance prerequisite. Implement only the approved phase.

## Ownership

A separate backend track owns `src/server/**`, `src/app/api/**`, `src/contracts/**`, backend
fixtures and tests, `.env.example` and `docs/API.md`. The UI track owns everything else: pages,
features, components, the 3D scene and styles. Coordinate on shared files: `package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next.config.ts`, and the docs.

## Commands

```bash
pnpm install       # install (pnpm 11 via the packageManager field)
pnpm dev           # dev server (Turbopack)
pnpm lint          # ESLint
pnpm typecheck     # next typegen + tsc --noEmit
pnpm test          # Vitest, single run (pnpm test:watch to watch)
pnpm build         # production build
pnpm test:e2e      # Chrome and WebKit, mocked APIs
```

**Definition of done:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass, the change
is checked in a browser at phone and desktop sizes in light and dark, and docs are updated for any new
rule, service, or env var.

## Stack

| Area      | Choice                                                       | Notes                                                                                               |
| --------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16.4 App Router, React 19.3                          | Turbopack. Version-matched docs: `node_modules/next/dist/docs/`. Read them before writing Next code. |
| Language  | TypeScript 6.0, strict + `noUncheckedIndexedAccess`          | Not 7.x yet: typescript-eslint supports `<6.1`.                                                     |
| Styling   | Tailwind CSS 4.3, CSS-first tokens                           | `src/styles/tokens.css` is the only source of design values.                                        |
| Motion    | `motion` 14 (`motion/react`)                                 | Client Components only.                                                                             |
| 3D        | `three` 0.186, `@react-three/fiber` 9, `@react-three/drei` 10 | Client-only, lazy-loaded chunk. See "3D" below.                                                     |
| Icons     | `lucide-react` 1.x                                           | Import named icons. Decorative icons get `aria-hidden`.                                             |
| QR        | `uqr`                                                        | Encodes only; we render the SVG ourselves.                                                          |
| Schemas   | Zod 4                                                        | At every boundary.                                                                                  |
| AI        | `@google/genai` 2                                            | Server-only, via `getGemini()` (backend track).                                                     |
| Database  | Firestore via `firebase-admin` 14                            | Server-only, via `getDb()` (backend track). No client Firebase SDK.                                 |
| Testing   | Vitest 5, Testing Library, jsdom                             |                                                                                                     |
| Lint      | ESLint 10 + `eslint-config-next` (flat config)               | Peer-range override documented in `pnpm-workspace.yaml`.                                            |
| Tooling   | pnpm 11, Node >= 22.13                                       |                                                                                                     |

Next.js 16 differs from older training data: request APIs (`cookies()`, `headers()`, `params`) are
async, `middleware.ts` is now `proxy.ts`, and `next lint` is gone (use `pnpm lint`).

## Project map

```
src/
  app/                      routes only; thin, composes features
    (flow)/                 record, processing, review, guide, lens, share + shared layout/template
  features/
    landing/components/     landing sections (hero, featured route, how-it-works, lens band, ...)
    journey/                the whole record → share flow
      schemas.ts            Zod schemas + inferred types (UI view-models for now)
      fixtures.ts           typed mock data, validated against the schemas in tests
      journey-store.tsx     in-memory flow state (reducer + provider)
      flow.ts               screen order and back links
      components/<screen>/  one folder per screen
  components/
    ui/                     feature-agnostic primitives (Button, Badge, Field, ChoiceChips, ...)
    scene/                  the miniature 3D world, its layout math and 2D fallback
      canvas/               everything that imports three; loaded only through dynamic import
    *.tsx                   shared visuals (Photo, Waveform, DirectionIndicator, RouteSketch, QrCode, ...)
  lib/                      pure isomorphic helpers (cn, motion, format, wayfinding vocabulary)
  config/                   public, non-secret config (site metadata, photo registry)
  server/                   server-only infra (backend track)
  styles/tokens.css         design tokens
```

## Coding standards

### TypeScript

- No `any`, no `@ts-ignore`, no `!` non-null assertions to silence errors.
- Validate external input with Zod at the boundary: env vars, request bodies, form data, Gemini
  output, Firestore reads. Derive types with `z.infer`; never hand-write a duplicate type.
- Named exports. Default exports only where Next.js requires them (`page.tsx`, `layout.tsx`, ...) and
  for modules loaded with `next/dynamic`.
- File names in kebab-case (`hero-visual.tsx`), components in PascalCase, hooks as `use-*.ts`.
- Use the `@/` alias for imports outside the current folder, relative paths for siblings. No barrel `index.ts` files.
- Constants shared by client and server code (enums, labels) live in plain modules such as
  `src/lib/wayfinding.ts`, never in a `"use client"` file.

### React and Next.js

- Server Components by default. Put `"use client"` on the smallest interactive leaf.
- Fetch data in Server Components. Mutate through Server Actions or Route Handlers that validate input with Zod.
- Keep primary content (headings, LCP text) server-rendered and visible without JavaScript. First-paint
  entrances use the CSS `animate-rise` token; animate decorative elements, not the content itself.
- No hydration mismatches: don't branch markup on `window`, `Date.now()` or `Math.random()` during
  render. Use `useSyncExternalStore` with a server snapshot, or `seededRandom`.
- React Compiler lint rules are on: never mutate values from hooks (`useMemo`, props, state). Keep
  per-frame scratch objects in refs.

### Server and secrets

- Secrets and SDK clients live only in `src/server/**` and `src/features/*/server/**`. Each file starts with
  `import "server-only"`.
- Get clients only through `getDb()` and `getGemini()`. Never instantiate SDKs anywhere else.
- Never prefix secrets with `NEXT_PUBLIC_`. Never log env values or credentials.
- A new env var goes in two places: the schema in `src/server/env.ts` and `.env.example`.
- Pass only plain, serializable data to Client Components. Never pass SDK objects or secrets.

### Styling

- Palette: navy (`#0D1B2A`), teal (`#4B6B7C`), sky blue (`#C8D9E6`), beige (`#F2EFE7`)
  and white, supported by deep navy, steel blue, airy blue and pale blue from the reference.
  Use `text-accent-ink` for accent copy and `text-on-accent` on accent fills. Use only the semantic
  utilities generated from `src/styles/tokens.css`
  (`bg-surface`, `text-ink-muted`, `bg-accent`, ...). The default Tailwind palette is disabled on
  purpose. No hex, rgb, or arbitrary color values in components: add a token instead. Exceptions: the
  WebGL palette in `components/scene/palette.ts` and browser theme colors in `config/site.ts`.
- Mobile-first: base classes target phones, then add `sm:`/`md:`/`lg:`. Touch targets at least 44px. Use
  `Container`/`px-gutter` for safe-area-aware padding, and `min-h-dvh`/`svh` instead of `h-screen`.
- `cn()` only joins classes; it does not resolve conflicts. Never pass two utilities for the same
  property (for example `relative` and `absolute`): compute one. Components that need positioning
  (`JourneyScene`) leave it to the caller.
- Type is soft on purpose:
  - Fraunces for display (`font-display`), with its SOFT axis at 100 and WONK at 0 (set once on
    `body`). Sizes and weights come from the `text-display/headline/title` tokens.
  - Figtree for body text and sans `caps` labels.
  - Geist Mono only for data such as timers and scores.
- Keep it editorial, not template-like:
  - hairline borders (`border-line`) and few shadows
  - italic accents only in the hero headline and the feature panel
  - no numbered or zero-padded kickers
  - avoid glassmorphism, heavy gradients, decorative particles and grids of identical cards
- Photography is real, never AI-generated:
  - Register each photo in `src/config/photos.ts` with alt text and credit, and render it with `<Photo>`.
  - Text on a photo sits on a `scrim` gradient and uses `photo-ink`.
  - The footer credits every photographer.
- Check for horizontal overflow at 375px; rows of buttons must fit or wrap.

### Motion

- Import from `motion/react`, only in Client Components. Use shared timings from `src/lib/motion.ts`.
- `MotionProvider` sets `reducedMotion="user"`. Looping or decorative animation also checks
  `useReducedMotion()`, and CSS animations use the `motion-safe:` variant.

### 3D

- The world is an island in an open sea: no plinth, no contact shadow. The sea is unlit and untoned
  so it fogs exactly into the `--sea` haze behind the canvas; keep `background` in `scene/palette.ts`
  equal to `--sea`.
- The public entry is `components/scene/journey-scene.tsx` (no three import). It shows the 2D
  `RouteSketch` fallback first, and permanently without WebGL (`?no-webgl` forces it), then crossfades
  to the canvas.
- Everything importing three lives in `components/scene/canvas/` and loads only via `next/dynamic` with `ssr: false`.
- Budgets: DPR capped (1.5 on phones, 2 on desktop) and lowered by `PerformanceMonitor`; two quality
  tiers (`canvas/quality.ts`); instanced meshes for repeated objects; shared materials per theme;
  rendering pauses offscreen (`frameloop="never"`) and goes on-demand with reduced motion.
- Scene layout is pure math in `scene/layout.ts`, shared with the 2D fallback. Journey steps point at
  landmarks through UI-only `anchor` values; never persist them.

### Accessibility

- Use semantic landmarks, headings in order, and keyboard-reachable controls with the global
  `:focus-visible` ring.
- Icon-only controls need an accessible name. Decorative visuals get `aria-hidden`.
- The 3D scene is supplementary: every action it offers (selecting a step) also exists as a regular control.
- Text contrast at least 4.5:1 (the tokens are tuned for light and dark).

### Testing

- Colocate tests as `*.test.ts(x)`. Default environment is `node`. Component tests start with
  `// @vitest-environment jsdom`. `vitest.setup.ts` stubs `server-only` and the layout observers.
- Query by role and name with Testing Library. Content behind `AnimatePresence` appears asynchronously:
  use `findBy*`.
- Mock SDK modules and never call real services in automated tests. Controlled manual checks use the bounded procedure in `docs/AUDIO-VERIFICATION.md`. Keep fixtures valid against their schemas
  (`fixtures.test.ts`).

### Dependencies

- Add a dependency only when it removes real complexity. Prefer platform APIs.
- pnpm blocks dependency install scripts. Review every new `allowBuilds` entry and record the
  reason in `pnpm-workspace.yaml`. Keep pnpm's default 1-day `minimumReleaseAge`.

## Agent workflow

1. Read the relevant docs (this file, `docs/`, the bundled Next.js docs) before coding.
2. Keep changes inside the current phase and your track. Ask before expanding scope.
3. Update `docs/ARCHITECTURE.md` when adding a layer, service, or rule. Tick items in `docs/PHASES.md`.
4. Run the Definition of done. Never commit secrets, and only commit when asked.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
