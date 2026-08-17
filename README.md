# Dealers-Drive

A B2B2C used-car marketplace for Tamil Nadu. Independent dealers list inventory;
buyers browse publicly without an account. Only dealers and platform admins
authenticate.

|                     |                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Specs**           | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/API-SPEC.md`](docs/API-SPEC.md) · [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md) |
| **Engineering log** | [`CONTEXT.md`](CONTEXT.md) — read this before changing `apps/api`                                                                      |
| **API reference**   | http://localhost:4000/api/docs once running                                                                                            |

## Layout

```
apps/
  web/        Next.js 15 · App Router · TypeScript strict · Tailwind v4
  api/        Express 5 · TypeScript strict · modular monolith
packages/
  contracts/  Zod schemas shared by both apps — the source of truth for every wire shape
  config/     shared eslint + tsconfig presets
```

## Requirements

- Node 22 (`nvm use`)
- pnpm 9 (`corepack enable`)
- Docker (Postgres 16, MinIO, Mailpit)

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env      # the defaults work for local development as-is
docker compose up -d      # postgres, minio, mailpit

cd apps/api
pnpm db:migrate           # apply the 3 migrations
pnpm db:seed              # build the world: 5 dealers, 23 vehicles, 18 live listings
cd ../..

pnpm dev                  # web + api together
```

Then open http://localhost:3000. You are already acting as the development dealer
— there is no login step, by design (see [Authentication](#authentication)).

| Service                        | URL                                                                  |
| ------------------------------ | -------------------------------------------------------------------- |
| Web                            | http://localhost:3000                                                |
| Dealer console                 | http://localhost:3000/dealer                                         |
| Admin console                  | http://localhost:3000/admin                                          |
| API                            | http://localhost:4000/health/live                                    |
| **API reference (Swagger UI)** | http://localhost:4000/api/docs                                       |
| OpenAPI JSON / YAML            | http://localhost:4000/api/docs/openapi.json · `.yaml`                |
| Postgres                       | `postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive` |
| MinIO console                  | http://localhost:9001 (dealersdrive / dealersdrive)                  |
| Mailpit inbox                  | http://localhost:8025                                                |

The seed models the **Vellore district** — `vellore`, `katpadi`, `arcot`,
`ranipet`, `gudiyattam`. There is no `chennai`, so `/cars?city=chennai`
legitimately returns nothing. That looks like a bug and is not one.

## Scripts

| Command            | Does                                 |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | runs web + api together (turbo)      |
| `pnpm build`       | builds every workspace package       |
| `pnpm lint`        | eslint, type-aware, across the repo  |
| `pnpm typecheck`   | tsc across the repo                  |
| `pnpm test`        | vitest across the repo (114 tests)   |
| `pnpm format`      | prettier write                       |
| `pnpm infra:up`    | `docker compose up -d`               |
| `pnpm infra:reset` | wipes the local volumes and restarts |

In `apps/api`:

| Command           | Does                                                        |
| ----------------- | ----------------------------------------------------------- |
| `pnpm db:migrate` | `prisma migrate dev`                                        |
| `pnpm db:seed`    | rebuilds the seeded world (idempotent — it truncates first) |
| `pnpm db:reset`   | migrate reset + seed                                        |
| `pnpm db:studio`  | Prisma Studio                                               |
| `pnpm test`       | the integration suite (needs Postgres running)              |

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` **must all pass** before
calling anything done.

## What works today

Everything below is implemented and verified end to end — by the 114-test suite,
and by driving the running app in a browser.

### Public marketplace

- **Homepage** — city-scoped featured cars, body-type tiles with live counts, a
  verified-dealer strip
- **Search** (`/cars`) — filter by city, make/model/variant, price, year, km,
  fuel, transmission, body type, owners, seats, airbags, colour, RTO and dealer;
  six sort orders; facet counts beside every option (zero-count options render
  disabled rather than vanishing); the URL is the only state store, so every
  result set is linkable and back/forward work
- **Vehicle detail** (`/car/[slug]`) — gallery with a keyboard-navigable lightbox
  (Tab trapped, Esc/←/→, focus restored to the opener), specification table,
  features, EMI estimate, similar cars, and
  `Vehicle`/`Offer`/`AutoDealer`/`BreadcrumbList` JSON-LD
- **Reveal contact** — the dealer's number is absent from page source and arrives
  only on click, rate-limited hourly and daily per IP, and recorded as a lead in
  the dealer's inbox
- **Enquiry form** — inline, no account, deduplicated per phone+vehicle over 24
  hours, honeypot-protected, with a reference number on success
- **Dealer directory and profile** (`/dealers`, `/dealers/[slug]`) — with a
  filterable portfolio per dealership
- **Saved cars** (`/saved`) — `localStorage`, hydrated through a BFF route; a car
  that has left the catalogue degrades to "unavailable" instead of breaking the
  page
- **SEO** — one indexing-policy resolver, `robots.ts`, `sitemap.ts`, canonicals

### Dealer console (`/dealer`)

- Dashboard: stats, credit balance, recent leads, listings needing attention
- Inventory with status tabs and search
- **Add-vehicle wizard** — catalogue-driven basics, details, real
  direct-to-storage photo upload (client-side compression, presign → PUT →
  commit → poll), drag-reorder, price, and a review step showing credits after
  publish
- Submit for review, which **holds one credit** atomically
- Enquiry inbox with live tab counts, status transitions and notes
- **Credit wallet and purchase** — packs, GST, invoice, immediate credit; the
  ledger shows every movement with its running balance
- Profile and KYC document upload

### Admin console (`/admin`)

- Platform metrics, moderation queue sorted oldest-first
- Listing review with advisory automated flags; approve / reject / request
  changes / take down
- Dealer verification, KYC review, suspend and reinstate (which pulls every one
  of that dealer's cars out of the catalogue, and back)
- Manual credit grants and adjustments, payments, platform configuration

### API

73 endpoints across public, dealer and admin surfaces, fully documented at
`/api/docs`. RFC 9457 problem responses throughout, `.strict()` validation on
every input, cursor and offset pagination, per-IP and per-dealer rate limits, a
transactional outbox + pg-boss for async work, and structured pino logs carrying
a `traceId` on every line.

## Authentication

**There is no login screen, and that is deliberate.** Identity verification is
the one thing this build bypasses: `SessionResolver` is a seam, and the
development resolver reads a server-configured identity (`DEV_DEALER_SLUG`,
`DEV_ADMIN_EMAIL`) rather than a cookie. Swap the resolver for a
`CookieSessionResolver` and nothing downstream changes.

Everything _downstream_ of identity is production-grade and tested: the
permission table, dealer scoping on every repository call, ownership re-checked
inside the writing transaction, and cross-tenant reads answering **404 rather
than 403** so an id's existence is never leaked. To act as a different
dealership, restart with a different `DEV_DEALER_SLUG` — there is no header that
could do it, which is exactly the property that makes tenant isolation testable.

Payments are mocked the same way: the development provider settles inline through
the same function a Razorpay webhook will call, so no gateway page is involved —
while the credit ledger itself is append-only, row-locked and real.

See [`CONTEXT.md` §6](CONTEXT.md) for the full boundary between what is mocked
and what is not.

## Roadmap

Ordered by what unblocks the most. In every case the abstraction already exists
and only the adapter is missing — [`CONTEXT.md` §12](CONTEXT.md) has the
step-by-step for each.

### 1. Real authentication — prerequisite for everything else

Implement `CookieSessionResolver` against the existing `SessionResolver` port
(the `Session` model and `tokenHash` column are already in the schema), add the
OTP round trip, and swap it in at the composition root. No authorization code
changes.

### 2. Payment integration (Razorpay)

`PaymentProvider` port exists with `DevelopmentPaymentProvider`. Remaining:

- `razorpay.provider.ts` — order creation, client-handshake verification, webhook
  signature verification
- `POST /v1/webhooks/razorpay` with raw-body verification. The `WebhookEvent`
  model already exists for idempotency, so **insert the event first** and let a
  duplicate delivery collide on `gatewayEventId`.
- Route the capture into the existing `settleCapturedPayment` — the only path
  that adds purchased credits. Do not write a second one.
- `settlement: 'deferred'` makes `verifyOrder` return 202 with
  `pollAfterSeconds`; that branch is already written and documented. Credits
  appear when the webhook lands, never because a client said so.
- Refunds: `admin:payment:refund` is in the permission table with no endpoint
  behind it yet.

### 3. Monitoring, logging and observability

Structured logging is already good — pino, one JSON line per event, a mixin that
stamps `traceId` (plus `userId`/`dealerId` after auth) on every line emitted
anywhere in a request, and a redact list covering `authorization`, `cookie`,
`set-cookie` and password fields. What is missing is somewhere for the logs to go
and something watching them:

- **Error tracking** — Sentry, at the marked TODO in `error-handler.ts`, tagged
  with `traceId`. 5xx only; a 422 `INSUFFICIENT_CREDITS` is not an exception.
- **Log shipping** — stdout to a hosted sink (Better Stack, Axiom, Datadog). No
  in-process transport; the container's stdout is the interface.
- **Metrics** — the four that matter here: enquiry-notification latency (it is
  the product), moderation queue depth and age, **credit-ledger drift**
  (`Dealer.creditBalance` vs the newest `balanceAfter` — always zero, so an alert
  on non-zero catches any future write path that bypasses `moveCredits`), and
  pg-boss failed-job count.
- **Tracing** — OpenTelemetry if a second service appears; the `traceId` in
  `request-context.ts` is the natural span id.
- **Uptime** — poll `/health/ready`, not `/health/live`: readiness names the
  failing dependency, liveness deliberately touches nothing.
- **Job and audit visibility** — pg-boss keeps state in the `pgboss` schema and
  nothing surfaces failed jobs yet; `GET /v1/admin/audit-logs` exists and is
  documented but has no console screen.

### 4. Real infrastructure adapters

`ResendMailer` / `Msg91Sms` against the existing `MailerPort` and `SmsPort`
(console adapters today), and an R2 adapter against `StoragePort` — the local
adapter already implements the same presign → PUT → commit contract, HMAC
included.

### 5. PostgreSQL row-level security

Layers 1, 2 and 4 of the four-layer tenancy model are done and tested.
`withTenant` already issues `SET LOCAL app.dealer_id`, so the policies have a
hook waiting — the migration that creates them is not written.

### 6. Deployment

`apps/api/Dockerfile` exists and its `HEALTHCHECK` already polls
`/health/ready`. Still needed: a separate worker entrypoint — today
`WORKER_INLINE=true` runs job handlers inside the HTTP process, so scaling the
API horizontally would run them N times over — and `prisma migrate deploy` in the
release step.

### 7. Product work not started

Photo requests, team members, saved searches, deeper dealer analytics, and mobile
and tablet layouts (this build was scoped to desktop). Buyer accounts are
explicitly out of scope.

## Conventions that are enforced, not suggested

1. Only `*.routes.ts` imports from `express`. Services never see `req`/`res`.
2. Only `*.repository.ts` imports `prisma`.
3. Cross-module imports go through `*.facade.ts` only — ESLint blocks the rest.
4. Every dealer-scoped repository method takes `dealerId` as its first argument,
   so an unscoped query is a type error.
5. Every error response is RFC 9457 Problem Details with a `traceId`, produced by
   exactly one place: `apps/api/src/middleware/error-handler.ts`.
6. Money is integer paise everywhere. No floats, in either direction.
7. Every API input schema lives in `packages/contracts` and is `.strict()`.
8. Adding a route without documenting it in `<module>.docs.ts` **fails the test
   suite** — `tests/openapi.test.ts` walks the router and compares.

The numbered rules behind these are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §5.5 and §8.3.
