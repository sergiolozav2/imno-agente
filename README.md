# Imno Agente

Nx + pnpm monorepo scaffold. Everything here is structural: the projects exist,
resolve each other, typecheck, lint and test, but contain no business logic yet.

## Requirements

- Node >= 20
- pnpm 10 (`corepack enable && corepack prepare pnpm@10.30.3 --activate`)
- Docker (for the local WhatsApp/Evolution stack)

## Getting started

```bash
pnpm install
cp .env.sample .env   # a local .env with generated secrets is already present
```

## Workspace layout

| Path                      | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `apps/frontend`           | Next 15 + Tailwind 4 public app (port 3000)     |
| `apps/api`                | Next 15 BFF / API, Cloudflare-ready (port 3001) |
| `apps/agent`              | Mastra agent worker (port 3002)                 |
| `packages/contracts`      | Zod schemas and shared types                    |
| `packages/domain`         | Framework-neutral domain model                  |
| `packages/agent-core`     | Agent use cases                                 |
| `packages/content-core`   | Content use cases                               |
| `packages/runtime-config` | Env parsing and runtime configuration           |
| `packages/integration-*`  | Adapters: Evolution API, LLM, ffmpeg            |
| `packages/test-support`   | Shared test fixtures and builders               |
| `tools/local-stack`       | Local stack helper scripts                      |

Packages are consumed as source through the `@imno/*` aliases in
`tsconfig.base.json`, so there is no build step between them.

## Scripts

Run from the repo root.

| Script              | What it does                         |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | All apps in parallel                 |
| `pnpm dev:frontend` | Frontend only, http://localhost:3000 |
| `pnpm dev:api`      | API only, http://localhost:3001      |
| `pnpm dev:agent`    | Agent worker in watch mode           |
| `pnpm typecheck`    | `tsc --noEmit` across every project  |
| `pnpm lint`         | ESLint across every project          |
| `pnpm test`         | Vitest across every project          |
| `pnpm build`        | Build target for every project       |
| `pnpm format`       | Prettier write                       |
| `pnpm graph`        | Open the Nx project graph            |

### Local Evolution (WhatsApp) stack

| Script             | What it does                                       |
| ------------------ | -------------------------------------------------- |
| `pnpm stack:up`    | Evolution API + Postgres + Redis, waits for health |
| `pnpm stack:down`  | Stop containers, keep volumes                      |
| `pnpm stack:reset` | Stop containers and delete volumes                 |
| `pnpm stack:logs`  | Tail container logs                                |

Evolution listens on http://localhost:8081 and reaches host services through
`host.docker.internal` (mapped to the host gateway for Linux).

## Conventions

- ESLint forbids `contracts`, `domain`, `*-core` and `runtime-config` from
  importing Next, React, Payload, Mastra or any `integration-*` package.
- Nx caches `build`, `typecheck`, `lint` and `test`.
- `.env` is gitignored; keep `.env.sample` in sync when adding variables.
