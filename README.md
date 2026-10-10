# Local to Lens

Record a local's directions in any language. Gemini turns them into a landmark-by-landmark guide you
can follow, check with your camera, and share.

The current build is UI-first: the whole journey runs on demo data, with no backend calls.

## Quick start

Requires Node.js >= 22.13 and pnpm (the pinned version is selected automatically).

```bash
pnpm install
pnpm dev
```

Then open the landing page, or jump into the flow: `/record` → `/processing` → `/review` → `/guide` →
`/lens` → `/share`. Add `?no-webgl` to any page to see the illustrated fallback instead of the 3D scene,
and use `/guide?step=N` to open the guide at a given step.

## Scripts

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Start the dev server             |
| `pnpm lint`      | Lint with ESLint                 |
| `pnpm typecheck` | Generate route types and run tsc |
| `pnpm test`      | Run Vitest once                  |
| `pnpm build`     | Production build                 |

## Docs

- [AGENTS.md](AGENTS.md): coding standards, ownership and workflow
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, routes, 3D scene, contract
- [docs/PHASES.md](docs/PHASES.md): roadmap
