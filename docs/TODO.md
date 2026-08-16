# Dealers-Drive — Running TODO

Append one section per day. Never overwrite earlier sections; tick items in place as they're done.

## Day 1 — 2026-08-15

### Must fix before launch

- [ ] `/health/ready` returns `ok` without checking anything — Render will gate deploys on it, so a broken build passes. Add the Postgres `SELECT 1` on Day 3.
- [ ] No tests exist. The error-handler contract (5 mappings + production `detail` stripping) is verified by hand only; a refactor can silently break it. Add vitest + supertest with a test per error class.
- [ ] Sentry not wired — a 500 in production is invisible beyond stdout. `TODO(Day 2)` marks the line in `error-handler.ts`.
- [ ] No rate limiting anywhere. `/health/*` is public and unbounded today; it matters much more the moment auth lands (Day 6).
- [ ] Confirm `app.set('trust proxy', 1)` matches the real hop count on Render (+ Cloudflare). Wrong value ⇒ `req.ip` is the proxy ⇒ IP rate limiting and abuse logging are worthless.
- [ ] Pin `minio/minio` and `axllent/mailpit` to explicit release tags — `:latest` means local infra can drift silently between machines.
- [ ] Make the first git commit and push. 53 files are staged and unversioned; nothing is backed up.

### Should fix soon

- [ ] Move `ProblemDetails` into `packages/contracts` so the web app's fetch wrapper can type error responses (Day 5).
- [ ] Enforce §4.4 rule 2 (only `*.repository.ts` imports prisma) — the ESLint block is scaffolded in `packages/config/eslint/node.js` and turns on with Day 3.
- [ ] Build the API image once and record its size against the sub-400MB budget; the Dockerfile has never been run.
- [ ] Auto-create the `dealers-drive` MinIO bucket in compose (or a `pnpm infra:seed`) before Day 21's upload work.
- [ ] Decide the production `WEB_ORIGIN` values; CORS silently blocks the web app if this is wrong at deploy time.
- [ ] Turbo warns `no output files found for task @dealers-drive/config#typecheck` — the placeholder echo scripts should become real no-op tasks or be dropped from the graph.
- [ ] Add `docs/infrastructure.md` (Day 2) listing every env var, what it does, and which environments have it.

### Nice to have

- [ ] `pino-pretty` for local dev — JSON logs are correct but hard to scan while building.
- [ ] Honour an inbound `X-Request-Id` / `traceparent` header instead of always generating a fresh traceId, so web→API requests correlate end to end.
- [ ] Surface `CONTRACTS_VERSION` and a git SHA in `/health/ready` to make "which build is live?" a one-curl question.
- [ ] Next.js `typedRoutes` once the route tree exists (Day 26+).
- [ ] Decide whether `/health/boom` stays permanently (useful smoke test) or gets deleted after Day 2's pipeline proves itself.
- [ ] A `docs/adr/` entry for the Express-over-NestJS and Postgres-only decisions, per ARCHITECTURE §5.3.
