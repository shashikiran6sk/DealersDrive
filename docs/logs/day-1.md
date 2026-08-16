# Day 1 — Monorepo + Express skeleton

**Date:** 2026-08-15
**Duration:** ~1 hour
**Status:** COMPLETE

## What we set out to build

Scaffold the complete monorepo from an empty folder: `apps/web` (Next.js 15, App Router, TypeScript strict, Tailwind v4), `apps/api` (Express 5 + TypeScript), `packages/contracts` (empty Zod package) and `packages/config` (shared eslint + tsconfig presets), wired with Turborepo + pnpm so a single `pnpm dev` at the root starts both apps. Build the Express skeleton exactly as in MVP-SCOPE §4.1 — `server.ts`, `container.ts`, `routes.ts`, `config/env.ts`, and the middleware folder — with `request-context` (AsyncLocalStorage + traceId) and `error-handler` (RFC 9457 Problem Details) implemented for real, not stubbed, because everything built over the next 39 days plugs into them. Plus `docker-compose.yml` for Postgres, MinIO and Mailpit, and two working health endpoints.

## What was actually built

### Files created

| File                                           | Purpose                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `package.json`                                 | Root workspace, turbo scripts, `packageManager: pnpm@9.15.9`                           |
| `pnpm-workspace.yaml`                          | Workspace globs: `apps/*`, `packages/*`                                                |
| `turbo.json`                                   | Task graph: build/dev/lint/typecheck/clean, `dev` depends on `^build`                  |
| `.nvmrc`                                       | `22`                                                                                   |
| `.npmrc`                                       | `auto-install-peers`, non-strict peers                                                 |
| `.gitignore`                                   | node_modules, dist, .next, .turbo, .env, next-env.d.ts                                 |
| `.dockerignore`                                | Keeps build context small for the API image                                            |
| `.prettierrc.json` / `.prettierignore`         | Single quotes, 100 cols, trailing commas                                               |
| `docker-compose.yml`                           | postgres:16-alpine, minio, mailpit — all with healthchecks and named volumes           |
| `.env.example`                                 | Every key needed now, plus commented keys for Days 3/6/7/21                            |
| `.env`                                         | Local copy of the above (gitignored)                                                   |
| `README.md`                                    | Getting started, service URLs, the five enforced conventions                           |
| `docs/ARCHITECTURE.md`                         | The original architecture doc, moved into `docs/`                                      |
| `docs/MVP-SCOPE.md`                            | The 8-week MVP doc, moved into `docs/`                                                 |
| `packages/config/package.json`                 | Exports map for tsconfig + eslint presets                                              |
| `packages/config/tsconfig/base.json`           | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, no unused locals/params  |
| `packages/config/tsconfig/node.json`           | NodeNext ESM preset for the API and contracts                                          |
| `packages/config/tsconfig/next.json`           | Bundler resolution, `jsx: preserve`, next plugin                                       |
| `packages/config/eslint/base.js`               | Type-aware flat config: js recommended + tseslint recommendedTypeChecked + prettier    |
| `packages/config/eslint/node.js`               | Adds MVP-SCOPE §4.4 rules 1 and 3 as real lint errors                                  |
| `packages/config/eslint/next.js`               | Adds `@next/next` core-web-vitals + react-hooks rules                                  |
| `packages/contracts/package.json`              | ESM, builds to `dist`, zod dependency                                                  |
| `packages/contracts/tsconfig.json`             | Emits declarations for both apps to consume                                            |
| `packages/contracts/eslint.config.mjs`         | Consumes the node preset                                                               |
| `packages/contracts/src/index.ts`              | `CONTRACTS_VERSION` only — intentionally empty until Day 5                             |
| `apps/api/package.json`                        | Express 5, pino, zod, nanoid, helmet, cors, dotenv; tsx for dev                        |
| `apps/api/tsconfig.json`                       | Extends the node preset, emits to `dist`                                               |
| `apps/api/eslint.config.mjs`                   | Consumes the node preset                                                               |
| `apps/api/Dockerfile`                          | Multi-stage, workspace-aware, non-root, healthcheck on `/health/ready`                 |
| `apps/api/src/index.ts`                        | Entrypoint: builds container, listens, graceful SIGTERM/SIGINT shutdown                |
| `apps/api/src/server.ts`                       | Express app assembly only — middleware order documented as the security model          |
| `apps/api/src/container.ts`                    | Composition root stub; wires `env` + `logger`, §4.2 target shape in comments           |
| `apps/api/src/routes.ts`                       | Mounts `/health`; empty `/v1` router ready for Day 6                                   |
| `apps/api/src/config/env.ts`                   | Zod-validated `process.env`; dev fallbacks, strict in production, `exit(1)` on failure |
| `apps/api/src/middleware/request-context.ts`   | AsyncLocalStorage: `traceId` (nanoid 10) + `ip`, optional `userId`/`dealerId`          |
| `apps/api/src/middleware/error-handler.ts`     | **Real** RFC 9457 implementation — the full mapping table                              |
| `apps/api/src/middleware/not-found.ts`         | Unmatched route → `NotFoundError` → Problem Details                                    |
| `apps/api/src/middleware/validate.ts`          | `validate({body,query,params})`, collects issues from all three into one ZodError      |
| `apps/api/src/middleware/request-logger.ts`    | One line per completed request; health probes demoted to `debug`                       |
| `apps/api/src/platform/errors.ts`              | `AppError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `DomainError`      |
| `apps/api/src/platform/telemetry/logger.ts`    | pino JSON; mixin injects traceId into every line emitted during a request              |
| `apps/api/src/modules/health/health.routes.ts` | `/health/live`, `/health/ready`, `/health/boom` (non-production only)                  |
| `apps/api/src/types/express.d.ts`              | `req.valid` augmentation for validated data                                            |
| `apps/web/package.json`                        | Next 15.5, React 19.2, Tailwind 4.3                                                    |
| `apps/web/tsconfig.json`                       | Extends the next preset, `@/*` path alias                                              |
| `apps/web/next.config.ts`                      | Strict mode, no powered-by header, transpiles `@dealers-drive/contracts`               |
| `apps/web/postcss.config.mjs`                  | `@tailwindcss/postcss`                                                                 |
| `apps/web/eslint.config.mjs`                   | Consumes the next preset                                                               |
| `apps/web/src/app/layout.tsx`                  | Root layout + metadata template                                                        |
| `apps/web/src/app/page.tsx`                    | "Dealers-Drive — coming soon"                                                          |
| `apps/web/src/styles/globals.css`              | Tailwind v4 `@theme` design-token stubs for Day 4                                      |

### Files modified

| File                                        | What changed                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/config/eslint/node.js`            | Facade rule rewritten twice — glob → anchored regex, then restated in both blocks (see errors below) |
| `apps/api/src/middleware/request-logger.ts` | Capture `req.path` at middleware entry instead of reading it inside the `finish` handler             |
| `apps/api/src/middleware/error-handler.ts`  | Added body-parser error mapping (400 / 413 / 415) so client mistakes stop reading as 500 bugs        |
| `.gitignore`                                | Added `.claude/settings.local.json`                                                                  |
| `README.md`, `packages/*/package.json`      | Prettier reformatting                                                                                |
| `dealers-drive-architecture.md`             | Moved → `docs/ARCHITECTURE.md`                                                                       |
| `dealers-drive-8week-mvp.md`                | Moved → `docs/MVP-SCOPE.md`                                                                          |

### Commands run (in order)

```bash
# 0. survey the environment
node -v && pnpm -v && docker -v && corepack -v

# 1. put the specs where the 40-day plan expects them
mkdir -p docs
mv dealers-drive-architecture.md docs/ARCHITECTURE.md
mv dealers-drive-8week-mvp.md    docs/MVP-SCOPE.md

# 2. (all scaffold files written at this point)
cp .env.example .env

# 3. install
corepack enable
pnpm install                       # 306 packages, pnpm 9.15.9, 1m24s

# 4. first verification pass
pnpm typecheck                     # 5/5 pass
pnpm lint                          # FAILED — facade rule misfired, see errors table
# ...fix packages/config/eslint/node.js...
pnpm lint                          # 5/5 pass

# 5. prove the lint rules are not dead
mkdir -p apps/api/src/modules/_probe   # throwaway probe.service.ts + probe.routes.ts
pnpm exec eslint src/modules/_probe    # 3 expected errors
rm -rf apps/api/src/modules/_probe

# 6. infrastructure
docker compose up -d
docker compose ps                  # postgres, minio, mailpit — all (healthy)

# 7. both apps
pnpm dev                           # api :4000, web :3000

# 8. acceptance checks
curl -i localhost:4000/health/live
curl    localhost:4000/health/ready
curl -s localhost:3000/ | grep "coming soon"
curl -i localhost:4000/this-does-not-exist
curl -i localhost:4000/health/boom
curl -D - -o /dev/null localhost:4000/nope   # grab X-Trace-Id, grep it in the logs
curl -X POST localhost:4000/health/live -H 'content-type: application/json' -d '{"bad":'

# 9. production build + production behaviour
pnpm build
NODE_ENV=production node apps/api/dist/index.js            # expect exit 1, missing env
NODE_ENV=production PORT=4100 WEB_ORIGIN=... DATABASE_URL=... node apps/api/dist/index.js
# plus a throwaway probe app importing dist/ to exercise every error class in prod mode

# 10. tidy
pnpm format
pnpm lint && pnpm typecheck        # green
git init && git add -A             # 53 files staged, NOT committed
```

### Decisions made

| Decision                   | What I chose                                                  | Why                                                                                                                      | Revisit when                                   |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Error format               | RFC 9457 Problem Details, one shape everywhere                | `code` is the machine contract the frontend switches on; `traceId` turns a support ticket into one log query             | Never — this is the contract                   |
| TypeScript version         | 5.9.3, not 7.x                                                | typescript-eslint 8 peer-caps at `<6.1.0`; type-aware linting is worth more than the version number                      | When typescript-eslint ships TS 7 support      |
| Next.js version            | 15.5.23, not 16                                               | Spec says Next 15; no reason to absorb a major during week 1                                                             | After launch                                   |
| Module system (api)        | ESM (`"type": "module"`, NodeNext, `.js` import specifiers)   | nanoid 6 is ESM-only; matches Node 22 and the rest of the toolchain                                                      | Never                                          |
| API entrypoint             | `index.ts` listens, `server.ts` only assembles                | Keeps `createApp()` importable by tests without opening a port                                                           | Never                                          |
| `getContext()` return type | `RequestContext \| undefined` + a throwing `requireContext()` | The logger mixin calls it at boot, outside any request; a throwing-only API would crash on the first log line            | Never                                          |
| Validated data location    | `req.valid`, read via `validated<T>(req, 'query')`            | Express 5 makes `req.query` a getter — assigning to it throws                                                            | Never                                          |
| Env strictness             | Local-dev fallbacks that disappear when `NODE_ENV=production` | Fresh clone boots with no `.env`; a production deploy missing `DATABASE_URL` dies at boot instead of aiming at localhost | If a var ever needs a real production default  |
| Body-parser errors         | Mapped to 400 / 413 / 415, not 500                            | A malformed body is a client mistake; it should not page anyone or pollute the 5xx rate                                  | Never                                          |
| §4.4 conventions           | Enforced as ESLint errors, probe-tested                       | A convention nobody can violate beats a convention in a README                                                           | Rule 2 (prisma) turns on Day 3                 |
| Health endpoint placement  | `/health/*` outside `/v1`                                     | Infrastructure probes it, not clients — it must not move when the API version does                                       | Never                                          |
| `/health/boom`             | Dev-only route that throws                                    | Makes the 500-path acceptance test runnable on any machine, forever                                                      | If it ever appears in a production route table |
| Dockerfile today           | Written now, hardened Day 2                                   | "Deployable" was a Day 1 goal; Day 2 owns CI, caching, size budget and rollback                                          | Tomorrow                                       |
| Spec docs                  | Moved to `docs/ARCHITECTURE.md` + `docs/MVP-SCOPE.md`         | The 40-day plan pastes from those exact paths                                                                            | Never                                          |
| Git                        | `git init` + staged, no commit                                | The first commit is the owner's to make                                                                                  | Immediately                                    |

### Packages installed

| Package                   | Version | Where               | Purpose                                          |
| ------------------------- | ------- | ------------------- | ------------------------------------------------ |
| turbo                     | 2.10.10 | root                | Task graph, one `pnpm dev` for both apps         |
| typescript                | 5.9.3   | root + all          | Type checking                                    |
| prettier                  | 3.9.6   | root                | Formatting                                       |
| express                   | 5.2.1   | apps/api            | HTTP framework (async errors propagate natively) |
| zod                       | 4.4.3   | apps/api, contracts | Schema validation                                |
| pino                      | 10.3.1  | apps/api            | Structured JSON logging                          |
| nanoid                    | 6.0.1   | apps/api            | traceId generation (10 chars)                    |
| helmet                    | 8.3.0   | apps/api            | Security headers                                 |
| cors                      | 2.8.6   | apps/api            | Browser origin allow-list                        |
| dotenv                    | 17.4.2  | apps/api            | Loads `.env` from app dir then repo root         |
| tsx                       | 4.23.12 | apps/api (dev)      | TS watch mode                                    |
| @types/express            | 5.0.6   | apps/api (dev)      | Express 5 types                                  |
| @types/cors               | 2.8.19  | apps/api (dev)      | —                                                |
| @types/node               | 22.20.1 | all (dev)           | Matches `.nvmrc` (Node 22)                       |
| next                      | 15.5.23 | apps/web            | App Router framework                             |
| react / react-dom         | 19.2.8  | apps/web            | —                                                |
| tailwindcss               | 4.3.3   | apps/web (dev)      | Styling                                          |
| @tailwindcss/postcss      | 4.3.3   | apps/web (dev)      | Tailwind v4 PostCSS plugin                       |
| @types/react              | 19.2.18 | apps/web (dev)      | —                                                |
| @types/react-dom          | 19.2.4  | apps/web (dev)      | —                                                |
| eslint                    | 9.39.5  | all                 | Linting                                          |
| typescript-eslint         | 8.67.0  | packages/config     | Type-aware rules                                 |
| @eslint/js                | 9.39.5  | packages/config     | Recommended JS rules                             |
| eslint-config-prettier    | 10.1.8  | packages/config     | Disables stylistic conflicts                     |
| eslint-plugin-react-hooks | 7.1.1   | packages/config     | Hook rules for web                               |
| @next/eslint-plugin-next  | 15.5.23 | packages/config     | core-web-vitals rules                            |
| globals                   | 16.5.0  | packages/config     | Node/browser global sets                         |

## What is working right now

- [x] `docker compose up` starts postgres, minio, mailpit — all three report `(healthy)`
- [x] `pnpm dev` starts both apps from the repo root
- [x] `localhost:3000` shows the Next.js page ("Dealers-Drive — coming soon")
- [x] `localhost:4000/health/live` returns `{"status":"ok"}`
- [x] `localhost:4000/health/ready` returns `{"status":"ok"}`
- [x] `pnpm lint` passes at the root (5/5 tasks)
- [x] `pnpm typecheck` passes at the root (5/5 tasks)
- [x] `curl localhost:4000/this-does-not-exist` returns Problem Details JSON with a traceId, `content-type: application/problem+json`
- [x] That same traceId appears in the API's log output (both the `request rejected` and `request completed` lines) and in the `X-Trace-Id` response header
- [x] `throw new Error('test')` in a route (`/health/boom`) returns a 500 Problem Details body, not an Express HTML page
- [x] Bonus, verified against the production build: ZodError → 400 with `errors[]`, NotFound → 404, Forbidden → 403, DomainError → 422 with its own code, unknown error → 500 with `detail` **absent** in production
- [x] Boot fails with `exit 1` and a readable list when required env is missing under `NODE_ENV=production`
- [x] `pnpm build` produces `apps/api/dist` and a static Next build
- [x] The §4.4 lint rules were probe-tested and genuinely fire

## What is NOT working / deferred

- **No tests.** No vitest, no supertest, no regression test pinning the error-handler contract. Everything above was verified by hand with curl this session. This is the biggest gap.
- **`/health/ready` is a liar.** It returns `ok` unconditionally because there are no dependencies yet. Day 3 must make it check Postgres, otherwise Day 2's deploy gating is meaningless.
- **Sentry not wired.** There is a `TODO(Day 2)` on the exact line in `error-handler.ts`.
- **`packages/contracts` is empty** by design — exports only `CONTRACTS_VERSION`. The `ProblemDetails` interface currently lives in the API and should move here on Day 5.
- **No CI, no deploy.** That is Day 2. The Dockerfile exists and is workspace-aware but has never been built or size-checked.
- **Rate limiting, auth, permissions, tenant middleware** — not written. MVP-SCOPE §4.1 lists them; they land Days 6–10.
- **Rule 2 of §4.4** (only `*.repository.ts` imports prisma) is not enforced yet — nothing to point it at until Day 3.
- **MinIO bucket is not auto-created.** Day 21 needs a `dealers-drive` bucket; today the container just runs.
- **`minio/minio` and `axllent/mailpit` use `:latest`.** Postgres is pinned to 16-alpine; the other two should be pinned too.
- **No commit made.** 53 files staged, first commit left to the owner.

## Errors encountered and how they were fixed

| Error                                                                                                | Cause                                                                                                                                                                    | Fix                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `'../../config/env.js' import is restricted` on a legitimate import                                  | `no-restricted-imports` `group` patterns use gitignore semantics, so `../*/*` matched `../../config/env.js` as a suffix rather than as an anchored path                  | Replaced the glob with an anchored regex: `^\.\./(?!\.\./)[^/]+/(?!.*\.facade(\.js)?$).+$`                            |
| Facade rule silently did nothing on `*.service.ts` (probe file linted clean when it should not have) | A second flat-config block set `no-restricted-imports` for service files; ESLint **replaces** rule options rather than merging them, so the facade pattern was dropped   | Extracted `facadeOnlyPattern` / `noExpressPath` constants and restated the patterns in every block that sets the rule |
| `/health/live` logged at `info` instead of `debug`                                                   | The level was computed inside the `res.on('finish')` callback, and Express rewrites `req.url` while routing into a mounted router — at finish time the path read `/live` | Capture `const path = req.path` at middleware entry, before routing                                                   |
| 2 MB JSON body would have returned `500 INTERNAL`                                                    | Only `SyntaxError` from the body parser was special-cased; `entity.too.large` fell through to the "anything else → 500" branch                                           | Map body-parser `type` codes: `entity.parse.failed`→400, `entity.too.large`→413, `encoding.unsupported`→415           |
| `pnpm format:check` failed on 3 files                                                                | Hand-written JSON/markdown didn't match Prettier's output                                                                                                                | `pnpm format`                                                                                                         |
| `.claude/settings.local.json` got staged by `git add -A`                                             | Not in `.gitignore`                                                                                                                                                      | Added to `.gitignore`, `git rm -r --cached .claude`                                                                   |

## Key code snippets (the parts future-me most needs to understand)

**The error contract — `apps/api/src/middleware/error-handler.ts`.** One function decides every error response the API will ever produce.

```ts
function toProblem(error: unknown, traceId: string): ProblemDetails {
  // ZodError -> 400 VALIDATION_FAILED, with per-field errors.
  if (error instanceof ZodError) {
    return build(
      400,
      'VALIDATION_FAILED',
      traceId,
      'The request did not match the expected shape.',
      fieldErrorsFromZod(error),
      'Validation failed',
    );
  }

  // NotFoundError -> 404, ForbiddenError -> 403, UnauthorizedError -> 401,
  // DomainError -> 422 with its own code. Each error carries its own mapping.
  if (error instanceof AppError) {
    return build(error.status, error.code, traceId, error.detail, error.errors, error.title);
  }

  if (isBodyParserError(error)) {
    const mapped = BODY_PARSER_CODES[error.type];
    if (mapped) return build(mapped.status, mapped.code, traceId, mapped.detail);
    return build(400, 'MALFORMED_BODY', traceId, 'The request body could not be read.');
  }

  // Anything else is a bug. Never leak its message in production.
  return build(
    500,
    'INTERNAL',
    traceId,
    env.isProduction
      ? undefined
      : error instanceof Error
        ? error.message
        : `Non-error thrown: ${String(error)}`,
    undefined,
    'Internal server error',
  );
}
```

The handler itself bails to `next(error)` if `res.headersSent`, logs 5xx at `error` and 4xx at `warn` with the traceId bound explicitly, then `res.status(...).type('application/problem+json').json(problem)`.

**The traceId spine — `apps/api/src/middleware/request-context.ts` + the pino mixin.** These two pieces are why nothing else in the codebase ever has to pass a traceId around.

```ts
const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext: RequestHandler = (req, res, next) => {
  const context: RequestContext = {
    traceId: nanoid(10),
    ip: clientIp(req.ip, req.socket.remoteAddress),
  };
  res.setHeader(TRACE_ID_HEADER, context.traceId);
  storage.run(context, next); // everything downstream, including async, inherits this
};

export function setContextValue<K extends keyof RequestContext>(key: K, value: RequestContext[K]) {
  const context = storage.getStore();
  if (context) context[key] = value; // Day 8 auth writes userId here; Day 10 writes dealerId
}
```

```ts
// platform/telemetry/logger.ts
mixin() {
  const context = getContext();
  if (!context) return {};
  return {
    traceId: context.traceId,
    ...(context.userId ? { userId: context.userId } : {}),
    ...(context.dealerId ? { dealerId: context.dealerId } : {}),
  };
}
```

**The composition root — `apps/api/src/container.ts`.** Empty today, but the shape is the whole architecture: no DI framework, ever.

```ts
export interface Container {
  readonly env: Env;
  readonly logger: Logger;
}

export function buildContainer(): Container {
  return { env, logger };
}

// Grows into (MVP-SCOPE §4.2):
//   const storage  = createR2Storage(env);
//   const queue    = createQueue(env.DATABASE_URL);
//   const vehicles = createVehiclesModule({ prisma, catalog: catalog.facade, events });
//   return { auth, vehicles, ..., queue, events };
// Each module returns { router, facade }: router is mounted in routes.ts,
// facade is the only thing other modules may import.
```

**Middleware order in `server.ts` is the security model** — `requestContext` first (so even body-parser errors get a traceId), then helmet/cors, then bounded body parsers, then `requestLogger`, then routes, then `notFound`, then `errorHandler` last.

## What Day 2 needs from today

Day 2 is the deploy pipeline, and almost none of it is code — it is accounts and dashboards, so have them ready before starting. Needed: a **GitHub** repo with this scaffold pushed as its first commit (currently staged but uncommitted, and the pipeline has nothing to build until it exists); a **Render** Web Service pointed at the repo with root directory `.` and Dockerfile path `apps/api/Dockerfile` — the Dockerfile is already written and workspace-aware, so tomorrow hardens it (layer caching, sub-400MB budget, healthcheck gating, previous-image-tag rollback) rather than creating it; a **Vercel** project scoped to `apps/web` using `npx turbo-ignore` as the ignored build step; a **Neon** project for the real production `DATABASE_URL`; and optionally a **Sentry** DSN, since `error-handler.ts` already carries the `TODO(Day 2)` marking the exact line for `Sentry.captureException(error, { tags: { traceId } })`. Two decisions must be made before writing `docs/infrastructure.md`: the production value of `WEB_ORIGIN` (CORS reads it, comma-separated), and whether the API gets its own subdomain behind Cloudflare — that determines whether `app.set('trust proxy', 1)` in `server.ts` is still the right hop count, which in turn decides whether IP-based rate limiting will work correctly from Day 6 onward. Finally, keep chasing the MSG91 DLT registration started on Day 0; it is the only item on the critical path that cannot be compressed by working harder.
