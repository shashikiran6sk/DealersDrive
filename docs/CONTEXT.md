# Dealers-Drive — Current Context

Updated: 2026-08-15 (Day 1)

## Stack

Node 22 · pnpm 9.15.9 · Turborepo 2.10 · TypeScript 5.9.3 (`strict` + `noUncheckedIndexedAccess`)
API: Express 5.2 (ESM/NodeNext) · zod 4.4 · pino 10.3 · nanoid 6 · helmet 8 · cors 2.8 · dotenv 17 · tsx
Web: Next 15.5 App Router · React 19.2 · Tailwind 4.3 — Lint: ESLint 9.39 flat + typescript-eslint 8.67
Local infra: Postgres 16 · MinIO · Mailpit. Not installed yet: Prisma, pg-boss, Sentry, test runner

## Repo layout

```
apps/api/src/  {index,server,container,routes}.ts · config/env.ts · types/express.d.ts
               middleware/{request-context,validate,error-handler,not-found,request-logger}.ts
               modules/health/ · platform/{errors.ts,telemetry/logger.ts}
apps/web/src/  app/{layout,page}.tsx · styles/globals.css
packages/      contracts/src/ (empty) · config/{eslint,tsconfig}/
docs/          ARCHITECTURE.md · MVP-SCOPE.md · CONTEXT.md · TODO.md · logs/
root           docker-compose.yml · turbo.json · pnpm-workspace.yaml · .env.example
```

## Built and working

- [x] Day 1: monorepo scaffold, Express skeleton, RFC 9457 error handler, request context, Next.js stub, docker compose
- [ ] ← currently here: Day 2 — deploy pipeline (Dockerfile hardening, CI, Render + Vercel)

## Key file locations

- Error handler: `apps/api/src/middleware/error-handler.ts` · classes: `apps/api/src/platform/errors.ts`
- Request context: `apps/api/src/middleware/request-context.ts`
- Composition root: `apps/api/src/container.ts` · routes: `apps/api/src/routes.ts`
- Env validation: `apps/api/src/config/env.ts` · logger: `apps/api/src/platform/telemetry/logger.ts`
- Lint presets: `packages/config/eslint/`

## Conventions in force

1. Every error response is RFC 9457 Problem Details with `code` + `traceId`, produced only by `error-handler.ts`. The frontend switches on `code`, never on `detail`.
2. `traceId` = `nanoid(10)` per request — in the body, the `X-Trace-Id` header, and every log line (pino mixin over AsyncLocalStorage).
3. Only `*.routes.ts` imports `express`; cross-module imports go through `*.facade.ts`. Both ESLint-enforced.
4. `server.ts` assembles, `index.ts` listens. Middleware order in `server.ts` is the security model.
5. Health lives outside `/v1`; module routers mount under `/v1`. Nothing reads `process.env` outside `config/env.ts`.
6. Validated input comes from `req.valid` via `validated<T>(req, source)` — Express 5 makes `req.query` read-only.

## Environment variables required

`NODE_ENV` · `PORT` (4000) · `HOST` · `LOG_LEVEL` · `WEB_ORIGIN` · `DATABASE_URL` · `NEXT_PUBLIC_API_URL`
All have local-dev defaults; `WEB_ORIGIN` and `DATABASE_URL` are mandatory under `NODE_ENV=production` (boot fails otherwise). See `.env.example`.

## Known issues / deferred

- No tests. The error-handler contract is verified by hand, not by CI.
- `/health/ready` returns `ok` unconditionally — must check Postgres on Day 3 or deploy gating is meaningless.
- Sentry not wired (`TODO(Day 2)` in `error-handler.ts`); no CI, nothing deployed, Dockerfile never built.
- `packages/contracts` empty; `ProblemDetails` lives in the API, moves there Day 5.
- `minio`/`mailpit` on `:latest`; MinIO bucket not auto-created. No auth/permissions/tenant/rate-limit middleware (Days 6–10).
- `git init` done, 55 files staged, no commit yet.
