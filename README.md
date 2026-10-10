# Local to Lens

Record moments as you travel; Gemini turns them into a personal, shareable travel guide.

## Quick start

Requires Node.js >= 22.13 and pnpm (the pinned version is selected automatically).

```bash
pnpm install
cp .env.example .env.local   # only needed once features use Firestore or Gemini
pnpm dev
```

## Scripts

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Start the dev server             |
| `pnpm lint`      | Lint with ESLint                 |
| `pnpm typecheck` | Generate route types and run tsc |
| `pnpm test`      | Run Vitest once                  |
| `pnpm build`     | Production build                 |

## Docs

- [AGENTS.md](AGENTS.md): coding standards and workflow
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, services, security
- [docs/PHASES.md](docs/PHASES.md): roadmap
