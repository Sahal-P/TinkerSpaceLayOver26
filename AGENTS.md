# AGENTS.md: Local to Lens

Rules for AI coding agents and humans working in this repo. Read this first, then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PHASES.md](docs/PHASES.md).

## Product

Travelers record moments on a trip or layover (voice notes, short clips). Gemini turns those
recordings into a personal, shareable travel guide. Expect most use on a phone, outdoors, often one-handed.

## Current phase

**Phase 0, Foundation.** Implement only the phase you are asked to. Never build ahead: no recording,
Gemini processing, or guide features until their phase starts.

## Commands

```bash
pnpm install       # install (pnpm 11 via the packageManager field)
pnpm dev           # dev server (Turbopack)
pnpm lint          # ESLint
pnpm typecheck     # next typegen + tsc --noEmit
pnpm test          # Vitest, single run (pnpm test:watch to watch)
pnpm build         # production build
```

**Definition of done:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass, and docs are
updated for any new rule, service, or env var.

## Stack

| Area      | Choice                                                     | Notes                                                                                               |
| --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16.4 App Router, React 19.3                        | Turbopack. Version-matched docs: `node_modules/next/dist/docs/`. Read them before writing Next code. |
| Language  | TypeScript 6.0, strict + `noUncheckedIndexedAccess`        | Not 7.x yet: typescript-eslint supports `<6.1`.                                                     |
| Styling   | Tailwind CSS 4.3, CSS-first tokens                         | `src/styles/tokens.css` is the only source of design values.                                        |
| Motion    | `motion` 14 (`motion/react`)                               | Client Components only.                                                                             |
| Icons     | `lucide-react` 1.x                                         | Import named icons. Decorative icons get `aria-hidden`.                                             |
| Schemas   | Zod 4                                                      | At every boundary.                                                                                  |
| AI        | `@google/genai` 2                                          | Server-only, via `getGemini()`.                                                                     |
| Database  | Firestore via `firebase-admin` 14                          | Server-only, via `getDb()`. No client Firebase SDK.                                                 |
| Testing   | Vitest 5, Testing Library, jsdom                           |                                                                                                     |
| Lint      | ESLint 10 + `eslint-config-next` (flat config)             | Peer-range override documented in `pnpm-workspace.yaml`.                                            |
| Tooling   | pnpm 11, Node >= 22.13                                     |                                                                                                     |

Next.js 16 differs from older training data: request APIs (`cookies()`, `headers()`, `params`) are
async, `middleware.ts` is now `proxy.ts`, and `next lint` is gone (use `pnpm lint`).

## Project map

```
src/
  app/                    routes only (layout, pages, route handlers); thin, composes features
  features/<name>/        one folder per capability
    components/           feature UI
    server/               server actions, data access ("server-only")
    schemas.ts            Zod schemas + inferred types
  components/ui/          shared, feature-agnostic primitives (Button, Container)
  components/             shared app-level components (MotionProvider)
  lib/                    pure isomorphic helpers (cn, motion presets); no secrets, no SDKs
  config/                 public, non-secret config (site metadata)
  server/                 shared server-only infra: env validation, Firestore, Gemini
  styles/tokens.css       design tokens
```

## Coding standards

### TypeScript

- No `any`, no `@ts-ignore`, no `!` non-null assertions to silence errors.
- Validate external input with Zod at the boundary: env vars, request bodies, form data, Gemini
  output, Firestore reads. Derive types with `z.infer`; never hand-write a duplicate type.
- Named exports. Default exports only where Next.js requires them (`page.tsx`, `layout.tsx`, ...).
- File names in kebab-case (`hero-visual.tsx`), components in PascalCase, hooks as `use-*.ts`.
- Use the `@/` alias for imports outside the current folder, relative paths for siblings. No barrel `index.ts` files.

### React and Next.js

- Server Components by default. Put `"use client"` on the smallest interactive leaf
  (example: `features/landing/components/hero-visual.tsx`).
- Fetch data in Server Components. Mutate through Server Actions or Route Handlers that validate input with Zod.
- Keep primary content (headings, LCP text) server-rendered and visible without JavaScript. Animate
  decorative elements, not the content itself.

### Server and secrets

- Secrets and SDK clients live only in `src/server/**` and `src/features/*/server/**`. Each file starts with
  `import "server-only"`.
- Get clients only through `getDb()` and `getGemini()`. Never instantiate SDKs anywhere else.
- Never prefix secrets with `NEXT_PUBLIC_`. Never log env values or credentials.
- A new env var goes in two places: the schema in `src/server/env.ts` and `.env.example`.
- Pass only plain, serializable data to Client Components. Never pass SDK objects or secrets.

### Styling

- Use only the semantic utilities generated from `src/styles/tokens.css` (`bg-surface`, `text-ink-muted`,
  `bg-accent`, ...). The default Tailwind palette is disabled on purpose. No hex, rgb, or arbitrary
  color values in components: add a token instead.
- Mobile-first: base classes target phones, then add `sm:`/`md:`. Touch targets at least 44px. Use
  `Container`/`px-gutter` for safe-area-aware padding, and `min-h-dvh` instead of `h-screen`.
- Merge classes with `cn()`. Components accept `className` for layout adjustments only.

### Motion

- Import from `motion/react`, only in Client Components. Use shared timings from `src/lib/motion.ts`.
- `MotionProvider` sets `reducedMotion="user"`. Looping or decorative animation also checks `useReducedMotion()`.

### Accessibility

- Use semantic landmarks, headings in order, and keyboard-reachable controls with the global
  `:focus-visible` ring.
- Icon-only controls need an accessible name. Decorative visuals get `aria-hidden`.
- Text contrast at least 4.5:1 (the tokens are tuned for light and dark).

### Testing

- Colocate tests as `*.test.ts(x)`. Default environment is `node`. Component tests start with
  `// @vitest-environment jsdom`.
- Query by role and name with Testing Library. Mock SDK modules and never call real services.
- Cover schemas, boundaries, credential and config logic, and rendering of key content.

### Dependencies

- Add a dependency only when it removes real complexity. Prefer platform APIs.
- pnpm blocks dependency install scripts. Review every new `allowBuilds` entry and record the
  reason in `pnpm-workspace.yaml`. Keep pnpm's default 1-day `minimumReleaseAge`.

## Agent workflow

1. Read the relevant docs (this file, `docs/`, the bundled Next.js docs) before coding.
2. Keep changes inside the current phase. Ask before expanding scope.
3. Update `docs/ARCHITECTURE.md` when adding a layer, service, or rule. Tick items in `docs/PHASES.md`.
4. Run the Definition of done. Never commit secrets, and only commit when asked.
