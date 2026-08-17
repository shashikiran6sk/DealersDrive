# Dealers-Drive

A B2B2C used-car marketplace. Independent dealers list inventory; buyers browse
publicly without an account. Only dealers and admins authenticate.

Specs live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/MVP-SCOPE.md`](docs/MVP-SCOPE.md). Read §4 of MVP-SCOPE before adding
anything to `apps/api`.

## Layout

```
apps/
  web/        Next.js 15 · App Router · TypeScript strict · Tailwind v4
  api/        Express 5 · TypeScript strict · modular monolith
packages/
  contracts/  Zod schemas shared by both apps
  config/     shared eslint + tsconfig presets
```

## Requirements

- Node 22 (`nvm use`)
- pnpm 9 (`corepack enable`)
- Docker (Postgres, MinIO, Mailpit)

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

| Service       | URL                                               |
| ------------- | ------------------------------------------------- |
| Web           | http://localhost:3000                             |
| API           | http://localhost:4000/health/live                 |
| API reference | http://localhost:4000/api/docs                    |
| Postgres      | postgresql://dealersdrive@localhost:5432          |
| MinIO console | http://localhost:9001 (dealersdrive/dealersdrive) |
| Mailpit inbox | http://localhost:8025                             |

## Scripts

| Command            | Does                                 |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | runs web + api together (turbo)      |
| `pnpm build`       | builds every workspace package       |
| `pnpm lint`        | eslint, type-aware, across the repo  |
| `pnpm typecheck`   | tsc across the repo                  |
| `pnpm test`        | vitest across the repo               |
| `pnpm format`      | prettier write                       |
| `pnpm infra:up`    | `docker compose up -d`               |
| `pnpm infra:reset` | wipes the local volumes and restarts |

## Conventions that are enforced, not suggested

1. Only `*.routes.ts` imports from `express`. Services never see `req`/`res`.
2. Only `*.repository.ts` imports `prisma`.
3. Cross-module imports go through `*.facade.ts` only — ESLint blocks the rest.
4. Every dealer-scoped repository method takes `dealerId` as its first argument.
5. Every error response is RFC 9457 Problem Details with a `traceId`, produced
   by exactly one place: `apps/api/src/middleware/error-handler.ts`.
