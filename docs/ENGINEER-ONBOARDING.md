# Dealers-Drive — Engineer Onboarding

**Audience:** an engineer who is comfortable with the MERN stack and is now taking
shared ownership of a production-shaped system.

**How to read this.** Every section follows the same spine: *what the concept is →
why production needs it → how you'd do it in a plain MERN app → why that breaks
here → what this repo actually does → where the code is → what goes wrong.*

**The rule I held myself to while writing this.** Everything below is traced from
the code in this repository. Where documentation and implementation disagree, I
say so rather than picking a side. Where something is mocked, development-only or
simply absent, it is marked:

> **NOT IMPLEMENTED** — nothing behind this yet.
> **DEV-ONLY** — real code, but not the production behaviour.
> **SPEC ≠ CODE** — the docs promise something the code doesn't do.

There is a consolidated list of all three in **Part 29** at the end. Read that
before you promise anyone a feature.

---

> ### 📚 Looking for a structured way through this?
>
> **[`docs/learning-path/`](learning-path/README.md)** turns this reference into a
> **20-day programme**: one document per day, each naming the exact sections to
> read, the exact files to open in order, hands-on exercises, self-check questions
> and a deliverable checklist.
>
> Start at **[`learning-path/README.md`](learning-path/README.md)**, then work
> through `day-01.md` → `day-20.md`. A Word version of the whole programme is at
> `learning-path/Dealers-Drive-Learning-Path.docx`.
>
> This document is the *explanation*. The learning path is the *sequence*.

---

## Table of contents

| Part | Subject |
|---|---|
| 1 | Big picture — what the system is, and why the stack is this stack |
| 2 | Repository structure and the module boundaries |
| 3 | The request lifecycle, end to end |
| 4 | Authentication — Google OAuth, OIDC, PKCE |
| 5 | Cookies and sessions |
| 6 | Authentication vs authorization |
| 7 | Multi-tenancy |
| 8 | TOCTOU and double authorization |
| 9 | PostgreSQL, from a MongoDB brain |
| 10 | Credits and the ledger |
| 11 | The listing state machine |
| 12 | Public visibility and the read model |
| 13 | Background jobs, the outbox, and pg-boss |
| 14 | File uploads and object storage |
| 15 | Payments |
| 16 | Zod contracts |
| 17 | OpenAPI and Postman |
| 18 | Next.js architecture |
| 19 | Security architecture |
| 20 | Error handling |
| 21 | Observability |
| 22 | Testing strategy |
| 23 | Production architecture — what actually runs on AWS |
| 24 | Eight complete user journeys |
| 25 | "What happens if…" — the troubleshooting table |
| 26 | Why did we build it this way? |
| 27 | Code reading guide — day 1, day 3, week 1 |
| 28 | Glossary |
| 29 | Consolidated list of gaps, mocks and spec/code conflicts |
| **30** | **Turborepo and the monorepo build system** |
| **31** | **CI/CD — from a pull request to production** |
| **32** | **Database operations — provisioning, migrations, backups, PITR, DR** |
| **33** | **Scaling — 10 users to 100,000+** |
| **34** | **The concepts, from first principles** |
| **35** | **Reference links for learning** |

**Parts 30–35 were added, and Part 23 was rewritten, in the revision dated
2026-08-24.** If you are new, Part 34 is the one to keep open beside the others:
every term the rest of the document uses is built up there from first principles
and then connected back to the file that implements it.

### Where to look for the six things people ask about most

| Question | Read |
|---|---|
| How does "Sign in with Google" actually work? | §34-B7 → §34-B8 → §34-B9 → **Part 4** |
| What is the difference between a token, a session and a cookie? | **§34-B2**, then §34-B3, §34-B4, then Part 5 |
| How do images get uploaded and served? | §34-D1 → §34-D2 → **Part 14** → §33.3 |
| What happens when I merge a PR? | **Part 31**, §31.4 |
| How is the database backed up, and how do I recover? | **Part 32**, §32.6–§32.7 |
| What breaks first when we grow? | **Part 33**, §33.9 and §33.11 |

---
---

# Part 1 — The big picture

## 1.1 What Dealers-Drive is

A **B2B2C used-car marketplace** for the Vellore district of Tamil Nadu.

"B2B2C" is worth unpacking, because it dictates the entire architecture:

- **B2B** — the paying customers are *independent car dealerships*. They buy
  listing credits, manage inventory, and receive leads.
- **2C** — the traffic is *anonymous consumers* browsing for a car. They never
  create an account. There is no buyer login anywhere in this system.

So the platform sits between two very different populations, and the money flows
from the businesses while the traffic comes from the consumers. Every design
decision downstream — SEO-first public pages, credit ledgers, moderation queues,
lead notifications — falls out of that shape.

## 1.2 Who the users are

| User | Authenticates? | What they can do |
|---|---|---|
| **Buyer** (anonymous) | No | Browse, search, filter, save cars to `localStorage`, send an enquiry, reveal a dealer's phone number |
| **Dealer** (`OWNER` / `MANAGER` / `SALES`) | Yes — Google sign-in | Manage one dealership's inventory, submit listings for review, buy credits, work their lead inbox |
| **Platform admin** (`SUPPORT` / `MODERATOR` / `SUPER_ADMIN`) | Yes — email + Argon2id password | Approve dealers, moderate listings, review KYC, grant credits, read audit logs — across all tenants |

Note the asymmetry: **buyers do not authenticate at all.** That is why the
public marketplace can be aggressively cached and server-rendered, and why the
`/saved` page is backed by browser `localStorage` plus a `POST /v1/vehicles/batch`
hydration call, not a database table.

## 1.3 The three surfaces

One repo, one API, three front-end surfaces:

| Surface | Routes | Rendering | Tenant scope |
|---|---|---|---|
| **Public marketplace** | `/`, `/cars`, `/car/[slug]`, `/dealers`, `/dealers/[slug]`, `/saved` | RSC + ISR (60s) | none — cross-tenant reads |
| **Dealer console** | `/dealer/**` | RSC, `force-dynamic` | exactly one dealership, resolved server-side |
| **Admin console** | `/admin/**` | RSC, `no-store` | all tenants, every write audit-logged |

They correspond one-to-one with the three API mount points in
`apps/api/src/routes.ts`:

```
/v1/…          public, IP rate-limited, no principal
/v1/auth/…     mixed — sign-in must work without a session
/v1/dealer/…   requireDealer   → dealerId enters the request context here
/v1/admin/…    requireAdmin
```

That file is 89 lines and is the entire authorization model at a glance. Read it
first, always.

## 1.4 How the pieces interact

```
                    ┌──────────────────────────────────────────┐
   anonymous buyer  │                BROWSER                   │  dealer / admin
   ────────────────▶│  (HTML, no API token, no localStorage    │◀────────────────
                    │   session — only a dd_session cookie)    │
                    └───────────────┬──────────────────────────┘
                                    │ HTTPS
                    ┌───────────────▼──────────────────────────┐
                    │            NEXT.JS 15 (App Router)       │
                    │  · Server Components fetch server-side   │
                    │  · Server Actions perform mutations      │
                    │  · /api/* BFF handlers for the 4 things  │
                    │    the browser genuinely must call       │
                    └───────────────┬──────────────────────────┘
                                    │ fetch, forwarding dd_session
                    ┌───────────────▼──────────────────────────┐
                    │        EXPRESS 5 — MODULAR MONOLITH      │
                    │  request-context → helmet/cors → parsers │
                    │  → logger → routes → notFound → errors   │
                    └───────────────┬──────────────────────────┘
                                    │ Prisma 6
                    ┌───────────────▼──────────────────────────┐
                    │             POSTGRESQL 16                │
                    │  28 models · 4 migrations · listing_search│
                    │  · pgboss schema · CHECK constraints     │
                    └──────────────────────────────────────────┘
```

## 1.5 Why the backend is a modular monolith

**MERN mental model:** one Express app, `routes/`, `controllers/`, `models/`.
As it grows you either let it become a mud ball or you split it into services.

**Production mental model:** a monolith with *enforced internal boundaries* gives
you most of the benefit of services and none of the distributed-systems tax.

**Dealers-Drive:** `apps/api/src/modules/<name>/` with five file types, and the
boundaries are enforced *by ESLint*, not by good intentions
(`packages/config/eslint/index.js`):

- `*.routes.ts` — the **only** file in a module that may `import express`
- `*.service.ts` — all logic; never sees `req`/`res` (a `no-restricted-imports`
  rule blocks `express` here)
- `*.repository.ts` — the **only** file that may import Prisma
- `*.facade.ts` — the **only** file another module may import
- `*.docs.ts` — the OpenAPI operations for this module

The concrete reason this matters is transactions. §10 below shows a credit hold
and a listing state change committing together. In a microservice split those
two writes live in different databases, and you have to replace one `BEGIN…COMMIT`
with a saga, a compensating transaction, and a reconciliation job. For a team
this size that is a large amount of machinery bought to solve a problem the
product does not have.

## 1.6 Why PostgreSQL — and why not MongoDB

This is the decision everything else rests on, so it gets the most space.

**The MERN reflex:** MongoDB. Flexible schema, no migrations, you ship fast.

**Why that fails here:** the invariants in this product are *relational and
financial*.

- A dealer's credit balance must never go negative — even when two HTTP requests
  arrive in the same millisecond.
- A vehicle may have at most one `APPROVED` listing at a time.
- An `APPROVED` listing must have an expiry date.
- Every credit movement must have a ledger row.

In MongoDB those are all application-level checks. An application-level check is
a *suggestion* under concurrency: two Node processes both read balance = 1, both
decide "yes, they can afford it", both write. In PostgreSQL they are:

```sql
-- apps/api/prisma/migrations/20260816183500_search_and_invariants/migration.sql
CREATE UNIQUE INDEX listings_one_approved_per_vehicle
  ON listings ("vehicleId") WHERE status = 'APPROVED';

ALTER TABLE listings ADD CONSTRAINT approved_has_expiry
  CHECK (status <> 'APPROVED' OR "expiresAt" IS NOT NULL);

ALTER TABLE dealers ADD CONSTRAINT credit_balance_non_negative
  CHECK ("creditBalance" >= 0);

ALTER TABLE users ADD CONSTRAINT only_admins_have_passwords
  CHECK ("passwordHash" IS NULL OR "isPlatformAdmin" = true);
```

Those hold **no matter what the application code does**, including code you have
not written yet. That is the entire argument. Write it on a sticky note:

> **The database is where invariants live. The application is where policy lives.**

The other half of the argument is that the *main product feature* is a
cross-tenant search with facets: "SUVs under ₹8 Lakh, petrol, in Katpadi, with a
sunroof, sorted by price". That is a relational query with GIN indexes and a
`tsvector`, which is exactly what Postgres is for
(`listing_search` in the same migration).

## 1.7 Why Prisma

Type-safe query builder, migrations as checked-in SQL files, and — critically for
this codebase — `prisma.$transaction()` gives a real transaction handle that
services pass around as the `Tx` type (`platform/db/prisma.ts`). That is what lets
`moveCredits(tx, …)` and `tx.listing.update(…)` commit or roll back together.

Prisma is not an ORM in the ActiveRecord sense — there is no `vehicle.save()`.
It is closer to a typed SQL builder, and where it is not enough the code drops to
raw SQL (`$queryRaw`, `$executeRaw`) without ceremony. Look at
`credits.service.ts:66` (`SELECT … FOR UPDATE`) and
`search.repository.ts:197` (`SELECT … FROM listing_search`).

## 1.8 Why Redis is not here

**MERN reflex:** "we need a cache and a queue, so Redis."

**What Redis would be used for here, and what replaces it:**

| Need | Usual answer | Here |
|---|---|---|
| Job queue | BullMQ on Redis | **pg-boss on the same Postgres** (`platform/jobs/queue.ts`) |
| Session store | Redis sessions | **`sessions` table** (`modules/auth/session.service.ts`) |
| Rate limiting | Redis counters | **in-process `Map`** (`middleware/rate-limit.ts`) |
| Page cache | Redis | **Next.js ISR + `Cache-Control` headers** |

The honest trade-off, stated in `middleware/rate-limit.ts` itself: the rate
limiter is **per-process**, so with N API instances a client effectively gets N×
the limit. The file names the fix (a `CachePort` swap, "half a day") and the
comment is doing real work — it tells you the limitation is known, not
overlooked. That is the correct way to defer infrastructure.

## 1.9 Why not GraphQL, and why not microservices

- **GraphQL** solves over-fetching for many heterogeneous clients. This system
  has exactly one client, written by the same team, in the same repo, sharing the
  same Zod schemas. What GraphQL would add is a resolver layer, an N+1 problem,
  and a second place for authorization to be forgotten. REST + shared contracts
  gets the type-safety benefit with none of that.
- **Microservices** would break the transactional guarantees in §10 and buy
  nothing at this scale. See §1.5.

## 1.10 Why a shared contracts package

`packages/contracts` holds Zod schemas that are simultaneously:

1. the API's **runtime request validator** (`validate({ body: CreateVehicleInput })`),
2. the **TypeScript types** for both apps (`z.infer`),
3. the source the **OpenAPI document** is generated from (`docs/schemas.ts` runs
   `z.toJSONSchema()` over every export),
4. the **response parser** the tests use (`tests/contracts.test.ts`).

One definition, four consumers. A renamed field cannot drift out of the docs
because there is no second copy to drift from.

## 1.11 Why there is a job system

Because some work must happen *because of* a request but not *during* it. When an
admin approves a listing, four things need to happen:

1. the listing row flips to `APPROVED` — **must be synchronous and transactional**
2. the credit hold settles — **must be in the same transaction**
3. the search index is written — **must not be able to roll back the approval**
4. the dealer gets an email — **definitely must not roll back the approval**

Items 3 and 4 go through the outbox → bus → pg-boss chain (§13).

## 1.12 Why there is object storage

A 10 MB phone photo should never traverse your API process. §14 covers the
presign → PUT → commit contract. The one-line version: the API signs a URL, the
browser uploads directly to storage, the API verifies afterwards.

## 1.13 The expanded architecture diagram

```
                        ┌─────────────────────────────────────────────┐
                        │  BROWSER                                    │
                        │  · dd_session cookie (HttpOnly, SameSite=Lax)│
                        │  · dd_oauth cookie (10 min, during sign-in)  │
                        │  · localStorage: saved-car ids only          │
                        └───────┬──────────────────────┬───────────────┘
                                │                      │ direct PUT
                                │ HTTPS                │ (presigned)
                        ┌───────▼──────────────┐       │
                        │  NEXT.JS 15          │       │
                        │  ┌────────────────┐  │       │
                        │  │ RSC pages      │  │       │
                        │  │ (public: ISR)  │  │       │
                        │  ├────────────────┤  │       │
                        │  │ Server Actions │  │       │
                        │  │ (mutations)    │  │       │
                        │  ├────────────────┤  │       │
                        │  │ /api/* BFF     │  │       │
                        │  └────────────────┘  │       │
                        │  lib/api.ts forwards │       │
                        │  dd_session          │       │
                        └───────┬──────────────┘       │
                                │                      │
   ┌────────────────────────────▼──────────────────────┼─────────────────┐
   │  EXPRESS 5 API                                    │                 │
   │                                                   │                 │
   │  1. requestContext   nanoid traceId, AsyncLocalStorage              │
   │  2. helmet + cors    security headers, one-origin allow-list        │
   │  3. json/urlencoded  1 MB cap                     │                 │
   │     cookieParser     unsigned                     │                 │
   │  4. requestLogger    one JSON line per request    │                 │
   │  5. ROUTES ──────────────────────────────────────┐│                 │
   │       /health            no auth                 ││                 │
   │       /uploads           local storage stand-in ◀─┼┘  (DEV/MinIO)    │
   │       /api/docs          Swagger UI (off in prod)││                 │
   │       /v1/…              public + rate limit     ││                 │
   │       /v1/auth/…         mixed                   ││                 │
   │       /v1/dealer/…       requireDealer ──────────┼┼──▶ requireDealerActive
   │       /v1/admin/…        requireAdmin            ││    requirePermission
   │  6. notFound         → NotFoundError             ││                 │
   │  7. errorHandler     → RFC 9457 problem+json     ││                 │
   └─────┬──────────────────────┬─────────────┬───────┴┴─────────────────┘
         │                      │             │
   ┌─────▼──────┐    ┌──────────▼───────┐  ┌──▼──────────────┐
   │ SERVICES   │    │ platform/audit   │  │ platform/telemetry
   │ business   │    │ AuditLog rows,   │  │ pino, JSON lines,
   │ logic only │    │ inside the tx    │  │ traceId mixin
   └─────┬──────┘    └──────────────────┘  └─────────────────┘
         │
   ┌─────▼───────────┐
   │ REPOSITORIES    │  dealerId is always the first argument
   └─────┬───────────┘
         │ Prisma
   ┌─────▼─────────────────────────────────────────────────────────┐
   │ POSTGRESQL 16                                                 │
   │  ┌───────────┐ ┌──────────────┐ ┌───────────────┐ ┌─────────┐ │
   │  │ write     │ │ listing_     │ │ outbox_events │ │ pgboss  │ │
   │  │ model     │ │ search       │ │ (transactional│ │ schema  │ │
   │  │ (28 models│ │ (read model, │ │  outbox)      │ │ (jobs)  │ │
   │  │  + CHECKs)│ │  denormalized│ │               │ │         │ │
   │  └───────────┘ └──────────────┘ └───────┬───────┘ └────┬────┘ │
   └────────────────────────────────────────┬┴──────────────┴──────┘
                                            │ polled every 2s
                     ┌──────────────────────▼────────────────────┐
                     │ OutboxPublisher → EventBus → pg-boss jobs │
                     │  · search.index-listing                   │
                     │  · notification.enquiry-to-dealer (p=100) │
                     │  · listings.expire-sweep (cron 02:15 IST) │
                     │  · counters.reconcile   (cron 03:30 IST)  │
                     └──────┬─────────────────┬──────────────────┘
                            │                 │
                   ┌────────▼──────┐  ┌───────▼─────────┐
                   │ MailerPort    │  │ SmsPort         │
                   │ console only  │  │ console | msg91 │
                   │ **DEV-ONLY**  │  │ msg91 never sent│
                   └───────────────┘  └─────────────────┘

   ┌───────────────────────────┐   ┌────────────────────────────┐
   │ StoragePort               │   │ PaymentProvider            │
   │  local | minio | r2       │   │  development  ← active      │
   │  (one S3 adapter for both │   │  razorpay     ← NOT WRITTEN │
   │   minio and r2)           │   │                            │
   └───────────────────────────┘   └────────────────────────────┘
```

### Every box, briefly

| Box | What it is | File |
|---|---|---|
| `requestContext` | Creates a `traceId` and stores it in `AsyncLocalStorage` so every later log line carries it without being passed one | `middleware/request-context.ts` |
| Session | Opaque random token in a cookie; the truth is a row in `sessions` | `modules/auth/session.service.ts` |
| Guards | `requireDealer`, `requireSignedIn`, `requireAdmin`, then `requireDealerActive`, `requirePermission` | `middleware/auth.ts` |
| Services | All business logic. Never touch `req`/`res` | `modules/*/**.service.ts` |
| Repositories | Only place Prisma is imported. `dealerId` first argument | `modules/*/**.repository.ts` |
| `listing_search` | Denormalized read model; membership *is* public visibility | migration `…_search_and_invariants` |
| `outbox_events` | Side effects written inside the business transaction | `platform/events/bus.ts` |
| pg-boss | Real queue (retries, backoff, cron) on the same database | `platform/jobs/queue.ts` |
| `audit_logs` | Every admin write, with actor, before/after, IP and traceId | `platform/audit/audit.service.ts` |
| pino logger | One JSON line per event, `traceId`/`userId`/`dealerId` auto-stamped, secrets redacted | `platform/telemetry/logger.ts` |
| StoragePort | Presign/head/get/put/delete/publicUrl/signedReadUrl | `platform/storage/storage.port.ts` |
| PaymentProvider | `createOrder` + `verifyClientHandshake`. Only `development` exists | `platform/payments/` |

---
---

# Part 2 — Repository structure

## 2.1 From the root

```
dealers-drive/
├── apps/
│   ├── api/          Express 5 monolith  (@dealers-drive/api)
│   └── web/          Next.js 15          (@dealers-drive/web)
├── packages/
│   ├── contracts/    Zod schemas + inferred types, shared by BOTH apps
│   └── config/       eslint + tsconfig presets
├── docs/             ARCHITECTURE · API-SPEC · DESIGN-SPEC · CLAUDE.md
│   └── postman/      generated, committed, byte-compared in CI
├── deploy/           single-box EC2 deployment: nginx, systemd, compose
├── scripts/browse.mjs  headless-Chrome driver for visual QA
├── docker-compose.yml  postgres + minio + mailpit for local dev
├── turbo.json          task graph
└── CONTEXT.md          the engineering log — read this before changing anything
```

**Why a monorepo.** `packages/contracts` must be importable *as source* by both
apps. If the API and the web app lived in separate repos, the contract would be
a published npm package, and "the frontend is one version behind the API" becomes
a class of bug you have to manage forever. Here it is impossible: both apps
import the same file.

## 2.2 `apps/api/src` — directory by directory

```
apps/api/src/
├── config/env.ts        validated, frozen env
├── container.ts         the composition root
├── routes.ts            every mount point, one file
├── server.ts            express assembly — the middleware ORDER is the security model
├── index.ts             listen(), signal handlers — NOT imported by tests
├── docs/                OpenAPI + Postman generation
├── middleware/          request-context · auth · validate · rate-limit · error-handler
├── modules/<name>/      the business
├── platform/            db · events · jobs · storage · notify · payments · audit · telemetry
└── types/express.d.ts   `req.principal`, `req.valid`
```

### `config/`
**Responsibility:** parse and validate `process.env` exactly once, freeze it,
export it.

**Belongs here:** the Zod env schema, cross-field rules
("`S3_ACCESS_KEY_ID` is required when `STORAGE_DRIVER=r2`"), and helpers like
`googleCredentials()`.

**Must NOT be here:** anything that reads `process.env` at the point of use.
The file says it: *"Validated, frozen, import-anywhere. Reading `process.env`
elsewhere is a bug."*

**Why the boundary:** a typo'd variable name should crash the process at boot
with a readable message, not silently make a feature not work at 3 a.m. Look at
`loadEnv()` — on failure it prints every problem and calls `process.exit(1)`.

### `container.ts` — the composition root
**Responsibility:** construct every dependency, by hand, in dependency order, and
pass them down as plain arguments.

This replaces a DI framework. There are no decorators, no `@Injectable`, no
reflection. `buildContainer(overrides)` is 80 lines of `const x = createX(deps)`.

**Why this matters more than it looks:** `ContainerOverrides` is the *test seam*:

```ts
export interface ContainerOverrides {
  prisma?: PrismaClient;
  sessions?: SessionResolver;   // ← how tenant-isolation tests act as another dealer
  oauth?: OAuthProvider;        // ← how sign-in is tested without ever calling Google
  payments?: PaymentProvider;
  queue?: Queue;
  storage?: StoragePort;
}
```

Every provider choice — sessions, oauth, storage, sms, payments — is made in this
one file. **No module knows which implementation it got.**

### `routes.ts`
**Responsibility:** mount every router. Nothing else.

**Read the comment on lines 61–68 carefully:**

```ts
v1.use('/auth', createPublicAuthRouter(container.auth));
v1.use('/auth', container.guards.requireSignedIn, createSessionAuthRouter(container.auth));
```

Two routers on one prefix, in that order. The first answers the paths that must
work without a session (sign-in cannot require being signed in) and falls through
for everything else; the second guards what is left. **Swapping those two lines
would leave `POST /v1/auth/onboarding` open to the internet.** That is what
"the middleware order is the security model" means in practice.

### `server.ts`
**Responsibility:** assemble the Express app. No routes, no logic, no `listen()`.

The order is documented in the file and is load-bearing:

```
1. request-context  — FIRST, so even body-parser errors have a traceId
2. helmet / cors    — reject before doing any work
3. body parsers     — bounded at 1 MB, so a huge body cannot exhaust memory
   + cookie parser  — before routes, so the session resolver can read it
4. request-logger   — after context, so its lines carry the traceId
5. routes
6. not-found        — anything unmatched becomes a NotFoundError
7. error-handler    — LAST, always
```

Not calling `listen()` here is deliberate: it keeps the app importable from tests
without opening a port. `index.ts` does the listening.

### `middleware/`
**Belongs here:** cross-cutting concerns that need `req`/`res`.
**Must NOT be here:** business rules. `requireDealerActive` checks a status field;
it does not decide *what a suspended dealer may do* beyond "not publish".

### `modules/<name>/` — the five file types

| File | Rule | Enforced by |
|---|---|---|
| `<name>.routes.ts` | the only file in the module importing `express` | ESLint `no-restricted-imports` |
| `<name>.service.ts` | all logic; never sees `req`/`res` | ESLint blocks importing `express` here |
| `<name>.repository.ts` | the only file importing Prisma | convention + `platform/db/prisma.ts` docblock |
| `<name>.facade.ts` | the **only** file another module may import | ESLint `facadeOnlyPattern` |
| `<name>.docs.ts` | this module's OpenAPI operations, beside the routes | `tests/openapi.test.ts` fails if missing |

### `platform/`
**Responsibility:** infrastructure adapters and cross-module utilities that
**no single module owns**.

```
platform/
├── db/          prisma client, Tx type, withTenant / withTransaction
├── events/      DomainEvent envelope, in-process bus, outbox publisher
├── jobs/        pg-boss Queue port + handlers + cron schedules
├── storage/     StoragePort + local / s3 adapters + factory
├── notify/      MailerPort, SmsPort, msg91 adapter
├── payments/    PaymentProvider port + development provider
├── audit/       AuditService
├── config/      PlatformConfigService (runtime-tunable settings from the DB)
├── media/       mediaUrl() — moved here because no module owned it
├── telemetry/   pino logger + LOGGER_OPTIONS
├── errors.ts    the whole error vocabulary
└── pagination.ts cursor encode/decode
```

**The test for "does this belong in platform?":** would two unrelated modules
both reasonably need it? `mediaUrl` and the cursor helpers moved here for exactly
that reason (recorded in `CONTEXT.md` §10.3).

## 2.3 Why modules may not import each other's internals

`vehicles.service.ts` needs to move credits. The naive import is:

```ts
import { moveCredits } from '../billing/credits.service.js';   // ❌
```

What it actually does:

```ts
import { moveCredits, currentBalance, refreshHeldCount }
  from '../billing/billing.facade.js';                        // ✅
```

`billing.facade.ts` is a two-line re-export file. Why bother?

1. **It makes the public surface of a module a written decision.** If
   `credits.service.ts` grows a helper you did not intend for outsiders, nobody
   can accidentally depend on it.
2. **It makes refactors local.** Rename or split `credits.service.ts` and you
   change one line in the facade, not 26 import statements across the codebase.
3. **It is greppable.** `grep -rn "billing.facade" src/modules` tells you exactly
   who depends on billing.

This was learned the hard way and is recorded in `CONTEXT.md` §10.3: ARCHITECTURE
mandated facades, none existed, and **26 imports had reached into other modules'
internals**. The linter had been catching it the whole time — nobody had run
`pnpm lint` at the root. That is why `pnpm lint && pnpm typecheck && pnpm test &&
pnpm build` is a working agreement, not a suggestion.

## 2.4 `apps/web/src`

```
apps/web/src/
├── app/
│   ├── (public)/      marketplace — RSC + ISR
│   ├── (dealer)/dealer/  console — force-dynamic
│   ├── (admin)/admin/    moderation — no-store
│   ├── (auth)/           login / onboarding screens
│   ├── api/              BFF handlers — ONLY where the browser must fetch
│   ├── sitemap.ts, robots.ts
│   └── layout.tsx
├── components/        ui primitives · vehicle · dealers · search · layout · forms
├── features/          per-feature client components + 'use server' actions
├── lib/               api client · seo · session · client-ip · url · cn · config
└── styles/globals.css design tokens
```

`(public)`, `(dealer)`, `(admin)`, `(auth)` are **route groups** — the parentheses
mean the folder name does not appear in the URL. They exist so each group can
have its own `layout.tsx` with its own caching policy and its own guard.

There are only **seven** BFF handlers under `app/api/`, and each one exists for a
stated reason (media presign, media delete, document presign/commit, enquiry tab
switch, invoice download, saved-car batch). Everything else goes through RSC
fetches or Server Actions. The rule from `CONTEXT.md` rule 9 — *no unnecessary
`NEXT_PUBLIC_*`* — is what forces this: if the browser never learns the API base
URL, it cannot call the API directly, so it must go through the Next server.

---
---

# Part 3 — The request lifecycle

We will trace **`GET /v1/dealer/vehicles`** — a dealer opening their inventory
page — from browser to Postgres and back.

## 3.1 The 19 stages

```
 1  Browser issues GET http://localhost:4000/v1/dealer/vehicles?limit=20
 2  Cookie dd_session=<43-char base64url> attached automatically
 3  Express receives it; `trust proxy = 1` makes req.ip the real client
 4  requestContext middleware  → AsyncLocalStorage { traceId, ip }
 5  x-trace-id response header set
 6  helmet sets security headers; cors checks Origin against env.webOrigins
 7  express.json (1 MB cap); cookieParser populates req.cookies
 8  requestLogger arms an res.on('finish') timer
 9  routes.ts: /v1 → /dealer → dealer.use(requireDealer)
10  requireDealer → sessions.resolveDealer(req)
11      readSessionToken(req)            → cookie value
12      sessions.resolve(token,'DEALER') → SHA-256 → sessions row (not revoked, not expired)
13      prisma.dealerMember.findFirst    → dealerId, role, dealerStatus
14      → DealerPrincipal { userId, dealerId, dealerSlug, role, dealerStatus, permissions }
15  req.principal set; setContextValue('userId'), setContextValue('dealerId')
16  requirePermission('vehicle:read')    → principal.permissions.includes(…)
17  validate({ query: InventoryQuery })  → .strict() Zod parse → req.valid.query
18  handler: const { dealerId } = dealerPrincipal(req)  ← the ONLY source of dealerId
19  service.inventory(dealerId, query) → repo.listForDealer(dealerId, …) → Prisma → SQL
20  toInventoryRow() maps rows → DTO; BigInt paise → Number
21  res.json(...)  → res 'finish' fires → one JSON log line with traceId + durationMs
```

## 3.2 Stage by stage, with the code

### Stage 4 — the request context

```ts
// middleware/request-context.ts
export const requestContext: RequestHandler = (req, res, next) => {
  const context: RequestContext = {
    traceId: nanoid(10),
    ip: clientIp(req.ip, req.socket.remoteAddress),
  };
  res.setHeader(TRACE_ID_HEADER, context.traceId);
  storage.run(context, next);          // ← AsyncLocalStorage
};
```

**Why `AsyncLocalStorage` and not a parameter?** Because otherwise every function
signature in the codebase grows a `ctx` argument, and the one place you forget to
thread it is the one place you need the trace id. The pino logger reads it in a
`mixin`, so *every log line emitted anywhere inside this request* automatically
carries `traceId`, plus `userId`/`dealerId` once auth has run:

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

**This must be first.** If it were second, an error thrown by `express.json()`
would reach the error handler with no `traceId` and no way to correlate it with
anything.

### Stage 6 — helmet and CORS

```ts
app.use(helmet());
app.use(cors({ origin: env.webOrigins, credentials: true, maxAge: 86_400 }));
```

`credentials: true` is what allows the browser to send `dd_session` on
cross-origin XHR — and it is only safe because `origin` is an explicit allow-list
built from `WEB_ORIGIN`, never `*`. (The spec forbids the combination anyway, but
the point is the allow-list is the thing doing the work.)

### Stage 7 — bounded body parsing

`express.json({ limit: '1mb' })`. Without the cap, a single `POST` of a 2 GB body
is a denial-of-service with no code required. When the cap trips, the error is a
`BodyParserError` with `type: 'entity.too.large'`, which the error handler maps
to a clean `413 PAYLOAD_TOO_LARGE` — see `BODY_PARSER_CODES` in
`middleware/error-handler.ts`. Without that mapping it would be a 500.

`cookieParser()` is deliberately **unsigned**. The comment explains why: the
session cookie's value is random and verified against the database, and the OAuth
cookie carries its own HMAC. A signing secret here "would imply a guarantee the
session design does not rely on."

### Stages 10–15 — authentication

```ts
// middleware/auth.ts
const requireDealer: RequestHandler = (req, _res, next) => {
  void (async () => {
    try {
      const principal = await sessions.resolveDealer(req);
      if (!principal) throw new UnauthorizedError();
      req.principal = principal;
      setContextValue('userId', principal.userId);
      setContextValue('dealerId', principal.dealerId);
      next();
    } catch (error) { next(error); }
  })();
};
```

**Everything after this line has a `dealerId`, and it came from the session.**
Nothing else in the codebase writes `req.principal`.

### Stage 16 — authorization

```ts
export function requirePermission(permission: string): RequestHandler {
  return (req, _res, next) => {
    const principal = req.principal;
    if (!principal) { next(new UnauthorizedError()); return; }
    if (!principal.permissions.includes(permission)) {
      next(new ForbiddenError(`This action needs the ${permission} permission.`));
      return;
    }
    next();
  };
}
```

The permission list was computed in stage 14 by `permissionsForRole(role)` from
the table in `session.port.ts`. A `SALES` seat has `vehicle:read` but not
`vehicle:write` — so it can open the inventory and cannot create a car.

### Stage 17 — validation

```ts
// middleware/validate.ts — the important subtlety
// Express 5 makes req.query a GETTER, so parsed values are written to req.valid
req.valid = { ...req.valid, ...valid };
```

You read them back with `validated<InventoryQuery>(req, 'query')`, which *throws*
if the route forgot to declare the schema. That is deliberate: a missing schema is
a programmer error, and the alternative — silently reading unvalidated
`req.query` — is exactly the bug class `.strict()` exists to prevent.

### Stage 18 — the handler

```ts
// modules/vehicles/vehicles.routes.ts
router.get('/vehicles',
  requirePermission('vehicle:read'),
  validate({ query: InventoryQuery }),
  (req, res, next) => { void (async () => {
    try {
      const { dealerId } = dealerPrincipal(req);            // ← rule 1, on one line
      const query = validated<InventoryQueryType>(req, 'query');
      res.json(await service.inventory(dealerId, query));
    } catch (error) { next(error); }
  })(); },
);
```

Note the shape: **the handler is four lines and contains no logic.** It extracts
the tenant from the principal, extracts the validated input, calls the service,
and serialises. Everything interesting is one layer down.

`dealerPrincipal(req)` throws a plain `Error` (→ 500) if the route is missing its
guard. That is the right behaviour: a route without `requireDealer` must never
degrade into "no tenant filter".

### Stage 19 — service and repository

```ts
// vehicles.repository.ts
async listForDealer(dealerId: string, filter: {...}) {
  return prisma.vehicle.findMany({
    where: { dealerId, deletedAt: null, ... },
    include: vehicleInclude,
    orderBy: { createdAt: 'desc' },
    take: filter.limit + 1,        // +1 = "is there a next page?"
  });
}
```

`dealerId` is the **first required parameter**. There is no `findMany(filter)`
overload. Omitting the tenant is a *type error*, not a data leak. That is layer 2
of the four-layer tenancy model (§7).

### Stage 20–21 — response and log

`BigInt` paise become `Number` explicitly in the mapper. `installBigIntJson()`
exists as a safety net (`BigInt.prototype.toJSON`) but the code calls `Number()`
deliberately — the comment says the conversion "must be deliberate."

Then:

```json
{"level":"info","time":"2026-08-19T…","service":"dealers-drive-api",
 "traceId":"V1StGXR8_Z","userId":"…","dealerId":"…",
 "method":"GET","url":"/v1/dealer/vehicles?limit=20","status":200,
 "durationMs":18.42,"msg":"request completed"}
```

## 3.3 Why the order matters — a table of what breaks if you move things

| Move | What breaks |
|---|---|
| `requestContext` after `helmet` | body-parser and CORS errors log with no traceId; the `x-trace-id` header is missing on early failures |
| `cookieParser` after routes | `readSessionToken(req)` returns `undefined` → **every authenticated request 401s** |
| `requireDealer` after the route handler | the handler runs with `req.principal === undefined` → `dealerPrincipal()` throws → 500 (fails closed, but noisily) |
| `validate` before `requirePermission` | a caller with no permission gets a 400 for a malformed body instead of a 403 — leaks that the endpoint exists and what shape it wants |
| `requirePermission` before `requireDealer` | `req.principal` is undefined → `UnauthorizedError` → 401 instead of the real answer |
| `notFound` before routes | **everything 404s** |
| `errorHandler` not last | Express falls back to its default HTML error page, leaking stack traces |
| the two `/auth` routers swapped | `POST /v1/auth/onboarding` becomes unauthenticated |

## 3.4 What happens when each layer fails

| Layer | Failure | Client sees | Logged as |
|---|---|---|---|
| body parser | malformed JSON | `400 MALFORMED_BODY` | `warn` |
| body parser | > 1 MB | `413 PAYLOAD_TOO_LARGE` | `warn` |
| CORS | disallowed origin | browser blocks; no `Access-Control-Allow-Origin` | — |
| `requireDealer` | no/expired/revoked cookie | `401 NOT_AUTHENTICATED` | `warn` |
| `requireDealerActive` | dealer not `ACTIVE` | `403 DEALER_NOT_ACTIVE` | `warn` |
| `requirePermission` | seat lacks permission | `403 FORBIDDEN` | `warn` |
| `validate` | unknown field | `400 VALIDATION_FAILED` + `errors[].code = UNRECOGNIZED_KEY` naming the key | `warn` |
| service | business rule | `409` (`ConflictError`) or `422` (`DomainError`) with a code | `warn` |
| service | cross-tenant id | `404 NOT_FOUND` — never 403 | `warn` |
| repository/Prisma | unexpected DB error | `500 INTERNAL`, **detail omitted in production** | `error` + full `err` object |
| anywhere | already streaming | socket destroyed (`res.headersSent` branch) | — |

---
---

# Part 4 — Authentication

## 4.1 The mental model you are probably arriving with

```
POST /login { email, password }
  → bcrypt.compare
  → jwt.sign({ userId }, SECRET, { expiresIn: '7d' })
  → res.json({ token })
  → localStorage.setItem('token', token)
  → every request: headers.Authorization = 'Bearer ' + token
```

Four things are wrong with this **for this product**, and it is worth being
precise about each, because "JWT bad" is not an argument.

1. **`localStorage` is readable by any JavaScript on the page.** One XSS — one
   compromised npm package in your dependency tree — and every session is
   exfiltrated. An `HttpOnly` cookie is not readable by JavaScript at all.
2. **A JWT cannot be revoked.** An admin suspends a fraudulent dealer. That
   dealer's token is valid for another six days. The usual fix is a denylist —
   which is a database lookup on every request, i.e. exactly what a session table
   is, only bolted on and easier to forget.
3. **A JWT carries stale claims.** If `role` is baked into the token, demoting
   someone from `OWNER` to `SALES` does nothing until they sign in again.
4. **You would be storing a password.** For dealers, this system stores none —
   Google is the verifier.

## 4.2 The vocabulary, precisely

| Term | Definition | In this codebase |
|---|---|---|
| **Authentication** | Establishing *who you are* | `SessionResolver` |
| **Authorization** | Deciding *what you may do* | `requirePermission`, `PERMISSIONS` table |
| **Identity** | A verified assertion by some authority about a person | `OAuthIdentity` row — Google's `sub` |
| **Account** | This system's record of a person | `User` row |
| **Principal** | The in-memory answer to "who is making *this* request" | `DealerPrincipal \| PendingPrincipal \| AdminPrincipal` |
| **Session** | A server-side record that a browser is currently acting as an account | `Session` row + `dd_session` cookie |
| **Membership** | A link between an account and a tenant, with a role | `DealerMember` row |
| **OAuth 2.0** | A protocol for *delegated authorization* — getting a token to act on a resource | the Google redirect dance |
| **OIDC** | A thin identity layer **on top of** OAuth 2.0 — adds an `id_token` making claims about *who the user is* | the `id_token` this API decodes |
| **Authorization Code Flow** | The OAuth flow where the browser gets a short-lived `code`, and the *server* exchanges it for tokens using its client secret | `google.provider.ts` |
| **PKCE** | Proof Key for Code Exchange — proves the party redeeming the code is the same one that started the flow | `codeVerifier` / `code_challenge` |
| **nonce** | A one-time value echoed inside the `id_token`, tying that token to *this* sign-in | `claims.nonce !== expected.nonce → reject` |
| **`sub`** | The provider's **stable** identifier for an account | `OAuthIdentity.providerSubject` |
| **state** | A CSRF token for the redirect itself | `transaction.state` |

The distinction that trips people up most: **OAuth 2.0 alone does not tell you
who the user is.** It gets you an access token for an API. OIDC adds the
`id_token`, a signed JWT of claims about the user. Dealers-Drive uses OIDC and
never uses the access token at all — it asks for `access_type=online` specifically
so Google does not hand back a refresh token it has no use for.

## 4.3 Why "the account is the `sub`, not the email"

This is the single most important sentence in the auth module, so here is the
attack it prevents.

Suppose you look up accounts by email:

```ts
const user = await prisma.user.findUnique({ where: { email: claims.email } });  // ❌
```

`owner@sri-lakshmi-motors.in` registered two years ago. The dealership let the
domain lapse. Someone buys `sri-lakshmi-motors.in`, creates a Google Workspace
account at that address, and signs in. Google honestly verifies the email. Your
code finds the existing account and hands over the entire dealership: inventory,
leads, credit balance, KYC documents.

Google's `sub` never changes and is never reissued. So:

```prisma
model OAuthIdentity {
  provider        OAuthProvider
  providerSubject String            // Google's `sub`
  email           String            // refreshed on every login, NEVER looked up by
  @@unique([provider, providerSubject])
}
```

and in `auth.service.ts`:

```ts
const existing = await prisma.oAuthIdentity.findUnique({
  where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject } },
  include: { user: true },
});
```

The email is stored, refreshed on every sign-in, and shown on the onboarding
screen. It is never a lookup key.

**And when the email *does* collide with an existing account?** `createIdentity()`
refuses:

```ts
if (collision) {
  throw new ConflictError('ACCOUNT_LINK_REQUIRED',
    'An account already uses this email address. Contact support to link Google sign-in to it.');
}
```

That is a deliberate stopping point, documented in `CONTEXT.md` §12.1: silently
merging on a matching string *is* an account-takeover primitive. The deliberate
linking path (admin-initiated, or a confirmation to the existing address) is
**NOT IMPLEMENTED**. Today, support links an account by inserting the
`oauth_identities` row manually.

## 4.4 The full Google sign-in flow

```
 ┌─────────┐                ┌──────────┐               ┌────────┐        ┌──────────┐
 │ Browser │                │ Next.js  │               │  API   │        │  Google  │
 └────┬────┘                └────┬─────┘               └───┬────┘        └────┬─────┘
      │  click "Continue with Google"                      │                  │
      │───────────────────────────────────────────────────▶│                  │
      │            GET /v1/auth/google/start?returnTo=/dealer                  │
      │                                                    │                  │
      │                              1. createOAuthTransaction():             │
      │                                 state        = 32 random bytes        │
      │                                 nonce        = 32 random bytes        │
      │                                 codeVerifier = 32 random bytes        │
      │                                 returnTo     = safeReturnTo(input)    │
      │                              2. seal with HMAC-SHA256(SESSION_SECRET)  │
      │                                                    │                  │
      │  ◀── 302 to accounts.google.com                    │                  │
      │      Set-Cookie: dd_oauth=<sealed>; HttpOnly; Max-Age=600             │
      │                                                    │                  │
      │      …?client_id&redirect_uri&response_type=code&scope=openid email   │
      │        profile&state=…&nonce=…&code_challenge=BASE64URL(SHA256(v))    │
      │        &code_challenge_method=S256&access_type=online                 │
      │        &prompt=select_account                                          │
      │──────────────────────────────────────────────────────────────────────▶│
      │                                                    │                  │
      │            [ user picks an account, consents ]      │                  │
      │                                                    │                  │
      │  ◀── 302 to API/v1/auth/google/callback?code=…&state=…                │
      │───────────────────────────────────────────────────▶│                  │
      │      Cookie: dd_oauth=<sealed>   ← SameSite=Lax allows this           │
      │                                                    │                  │
      │                              3. openTransaction(cookie)               │
      │                                 · verify HMAC (timingSafeEqual)       │
      │                                 · verify age < 600s                   │
      │                              4. clearOAuthCookie() — single use       │
      │                              5. transaction.state === query.state ?   │
      │                                 no → 401 OAUTH_STATE_INVALID          │
      │                                                    │                  │
      │                              6. POST /token ───────┼─────────────────▶│
      │                                 code, client_id, client_secret,       │
      │                                 redirect_uri, grant_type,             │
      │                                 code_verifier   ← PKCE proof          │
      │                                                    │◀── { id_token }  │
      │                              7. decode id_token payload:              │
      │                                 iss ∈ {accounts.google.com}           │
      │                                 aud === our client_id                 │
      │                                 exp + 60s leeway > now                │
      │                                 nonce === transaction.nonce           │
      │                                 sub present                           │
      │                                 email present && email_verified       │
      │                                                    │                  │
      │                              8. OAuthIdentity.findUnique(             │
      │                                   provider+providerSubject)           │
      │                                 found?   → refresh email/name/picture │
      │                                 not?     → createIdentity()           │
      │                                            (refuses on email collision)│
      │                              9. DealerMember.findFirst(userId, ACTIVE) │
      │                             10. sessions.issue({ userId, scope:DEALER })│
      │                                 token = 32 random bytes base64url     │
      │                                 INSERT sessions(tokenHash=SHA256(tok)) │
      │                                                    │                  │
      │  ◀── 302 to WEB_BASE_URL + returnTo                │                  │
      │      Set-Cookie: dd_session=<token>; HttpOnly; SameSite=Lax;          │
      │                  Secure(prod); Expires=+30d                            │
      │                                                    │                  │
      │  every later request carries dd_session automatically                 │
```

## 4.5 Every step, and what it defends against

### `startGoogle()` — `modules/auth/auth.service.ts:147`

```ts
const transaction = createOAuthTransaction(safeReturnTo(returnTo));
```

**`safeReturnTo`** is an open-redirect defence:

```ts
export function safeReturnTo(candidate: string | undefined, fallback = '/dealer'): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  if (candidate.includes('\\') || candidate.includes('\n')) return fallback;
  return candidate;
}
```

The `//` check is not paranoia: `//evil.com` is a *protocol-relative URL*. A
browser redirected to `//evil.com` goes to `https://evil.com`. That is the classic
way an OAuth callback becomes a phishing launcher.

### The `dd_oauth` transaction cookie — `oauth-transaction.ts`

Four values have to survive a round trip through Google's servers: `state`,
`nonce`, `codeVerifier`, `returnTo`.

**Why a cookie rather than an `oauth_states` table?** The row would exist only
between two requests seconds apart, and would need its own expiry sweep. The
cookie is already scoped to precisely the browser that must present it.

**Why HMAC it?** Because the browser holds it. Without the signature a user could
edit `returnTo`, or replace `nonce`, or blank `state`. The seal is
`<base64url(json)>.<HMAC-SHA256(body, SESSION_SECRET)>`, and verification uses
`timingSafeEqual` — a naïve `===` on an HMAC is a timing oracle.

**Why 10 minutes?** Longer than any human takes at Google's account chooser,
short enough that a cookie captured from a shared machine is worthless.

### `state` — CSRF for the redirect

Without `state`, an attacker can start their *own* Google sign-in, capture the
resulting `code`, and then trick your browser into visiting
`/v1/auth/google/callback?code=<attacker's code>`. Your browser would end up
logged in **as the attacker** — which sounds harmless until you realise you then
upload your KYC documents into their dealership.

The check is one line and comes before the code is worth anything:

```ts
if (!transaction || transaction.state !== input.state) {
  throw new UnauthorizedError('…', { code: 'OAUTH_STATE_INVALID' });
}
```

### PKCE — `code_challenge` / `code_verifier`

**What it defends against:** authorization-code interception. On mobile and SPA
clients, the redirect back from the identity provider can be intercepted (a
malicious app registering the same custom URL scheme, a shoulder-surfed browser
history, a proxy). If someone steals the `code`, PKCE means they cannot use it —
redeeming it requires the `code_verifier`, and only the party that started the
flow has it.

```ts
// google.provider.ts
url.searchParams.set('code_challenge', challengeFor(request.codeVerifier));
url.searchParams.set('code_challenge_method', 'S256');
…
function challengeFor(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}
```

Google stores the challenge, and at token exchange demands the verifier that
hashes to it. This is a confidential client (there *is* a client secret), so PKCE
is defence in depth rather than strictly required — which is the right posture.

### The `nonce` — replay protection for the identity token

`state` protects the *redirect*; `nonce` protects the *token*. It is placed in
the authorization request, Google embeds it in the `id_token`, and this API
checks it:

```ts
if (claims.nonce !== expected.nonce) reject('That sign-in could not be verified.');
```

Without it, an `id_token` obtained elsewhere (from another application session,
or replayed from a log) could be presented here.

### Why the ID token's signature is *not* verified — and why that is correct

This surprises people, so read the docblock in `google.provider.ts:99`:

> OpenID Connect Core §3.1.3.7 item 6: a token received directly from the token
> endpoint over a TLS connection whose server certificate has been validated may
> be trusted without checking its signature. This code holds exactly that
> position — it POSTed to `oauth2.googleapis.com` itself, with a client secret,
> over Node's TLS stack. The token never passed through a browser, so there is no
> untrusted hop between Google and this function.

The claims *are* all checked: `iss`, `aud`, `exp` (with 60s clock skew leeway),
`nonce`, `sub`, `email`, `email_verified`.

**When would this be wrong?** If the `id_token` arrived via the browser (the
implicit or hybrid flow). Then you must fetch Google's JWKS and verify the RS256
signature. This code does not use those flows.

### `email_verified !== true` is a refusal, not a warning

```ts
if (claims.email_verified !== true) {
  reject('Your Google account email is not verified. Verify it with Google, then sign in again.');
}
```

An unverified email on a Google Workspace domain is an assertion nobody has
checked. Accepting it would make the collision protection in §4.3 meaningless.

### `PendingPrincipal` — a verified human who is not yet a tenant

This is a state most tutorials skip, and it is the reason onboarding is safe.

After a successful first sign-in there is a `User` and an `OAuthIdentity` but no
`DealerMember`. `CookieSessionResolver` returns:

```ts
if (!membership) {
  return { kind: 'PENDING', userId, email, fullName, phone, permissions: [] };
}
```

`permissions: []` — always empty. The comment says why it exists at all:
*"Present so `requirePermission` reads one shape, not two."*

A `PendingPrincipal` holds a real, valid session and can reach exactly three
endpoints — `GET /v1/auth/me`, `POST /v1/auth/onboarding`, `POST /v1/auth/logout`
— because those are the routes behind `requireSignedIn` rather than
`requireDealer`. It cannot reach `/v1/dealer/**` at all, because
`resolveDealer` narrows:

```ts
async resolveDealer(req) {
  const principal = await signedIn(req);
  return principal?.kind === 'DEALER' ? principal : null;   // PENDING → null → 401
}
```

### Onboarding — one transaction turns a person into a tenant

`auth.service.ts:289`. Inside a single `withTransaction`:

1. re-check "does this user already have a dealership?" **inside the transaction**
   (a second call must not create a second tenant)
2. `user.update` — name, roleTitle, E.164 phone
3. `dealer.create` — **`status: 'DRAFT'`, always**
4. `dealerMember.create` — role `OWNER`
5. three `dealerDocument` rows (`GST_CERTIFICATE`, `PAN_CARD`, `ADDRESS_PROOF`)
   in status `REQUIRED`
6. `audit.record(tx, …)` — in the same transaction, so the audit row cannot
   outlive a rolled-back write

The comment on step 3 is the rule stated in code:

> `DRAFT`, always. Becoming `ACTIVE` is the admin's decision, reached through
> `POST /v1/dealer/submit` and the moderation queue — never by a field on this
> request.

Phone uniqueness is checked *before* the transaction and enforced by a unique
index on `users.phone`. That index is why `users.phone` had to become nullable in
the Google migration — otherwise "a stranger's first sign-in" would write a
placeholder phone and squat on a real dealership's number. The migration says
exactly that.

## 4.6 Admin sign-in — a completely separate world

```ts
// auth.service.ts:412
const user = await prisma.user.findFirst({ where: { email, isPlatformAdmin: true } });

const ok = user?.passwordHash
  ? await verifyPassword(user.passwordHash, input.password)
  : await verifyDecoy(input.password);          // ← burns the same CPU

if (!ok || !user?.adminRole || user.status !== 'ACTIVE') {
  throw new UnauthorizedError('That email and password do not match.',
    { code: 'INVALID_CREDENTIALS' });
}
```

Three things to notice:

1. **`verifyDecoy`** — when the email does not exist, the code still performs a
   full Argon2id verification against a hash of a random value. Without it,
   "unknown account" returns in 1 ms and "wrong password" in 50 ms, and the login
   endpoint becomes an **account-enumeration oracle** you can time from the
   outside.
2. **Identical message for both failures.** `'That email and password do not match.'`
3. **Argon2id**, not bcrypt, not SHA-256:

```ts
const ARGON2_OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 };
```

19 MiB of memory per hash is the OWASP floor, and the *memory* cost is the point:
GPUs have thousands of cores but limited memory bandwidth, so a memory-hard
function collapses the attacker's parallelism advantage. A plain SHA-256 of a
password can be brute-forced at billions of guesses per second; this cannot.

And a database constraint backs it up:

```sql
ALTER TABLE users ADD CONSTRAINT only_admins_have_passwords
  CHECK ("passwordHash" IS NULL OR "isPlatformAdmin" = true);
```

**A dealer row can never grow a password.** That is not a policy in code; it is
physics as far as the application is concerned.

Rate limiting is doubled up (`auth.routes.ts:116`): 20/15min per IP *and*
5/15min per email. The first stops one host grinding through many accounts; the
second stops one account being ground through a password list from a botnet.

> **SPEC ≠ CODE:** `docs/ARCHITECTURE.md` §8.2 says admin sign-in has *mandatory
> TOTP*. `User.totpSecret` and `totpEnabledAt` exist in the schema and are
> **never read or written by any code**. Two-factor auth is **NOT IMPLEMENTED**.
> (ARCHITECTURE itself flags this in an r3 note.)

## 4.7 The `SessionResolver` seam

```ts
export interface SessionResolver {
  resolveDealer(req: Request): Promise<DealerPrincipal | null>;
  resolveAdmin(req: Request): Promise<AdminPrincipal | null>;
  resolveSignedIn(req: Request): Promise<DealerPrincipal | PendingPrincipal | null>;
}
```

> **Note what the signature does *not* offer: no way to pass an identity in. The
> request is available only so a cookie can be read from it.**

That property is what makes tenant-isolation testing possible *at all*. A test
cannot set a header to become another dealer, because no header exists. It has to
swap the whole resolver through `buildContainer({ sessions })` — which means the
test is exercising the same code path production uses, one seam lower.

Three implementations exist:

| Implementation | When | File |
|---|---|---|
| `CookieSessionResolver` | production and normal dev (`AUTH_MODE=cookie`) | `cookie-session.adapter.ts` |
| `DevSessionResolver` | **DEV-ONLY**, `AUTH_MODE=dev` | `dev-session.adapter.ts` |
| harness switchable resolver | tests | `tests/harness.ts` |

**`AUTH_MODE=dev` is DEV-ONLY and loud about it.** `container.ts:186` logs a
warning on every boot, and `env.ts` refuses it in production:

```ts
if (production && value.AUTH_MODE === 'dev') {
  require('AUTH_MODE', 'must be `cookie` in production — `dev` bypasses identity verification.');
}
```

The important thing about `DevSessionResolver` is what it *preserves*: the
identity is server-configured (`DEV_DEALER_SLUG`) and re-read from the database
every request. **Nothing about the request influences who you are.** So tenant
isolation stays intact even with sign-in bypassed, and suspending the dev dealer
from the admin console takes effect on the very next request.

---
---

# Part 5 — Cookies and sessions

## 5.1 What a cookie is

A cookie is a small named string a server asks a browser to store and send back
on subsequent requests to the same site. It is the only piece of state a browser
sends **automatically**, without any JavaScript.

```
Server → Browser:   Set-Cookie: dd_session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=…
Browser → Server:   Cookie: dd_session=abc123
```

The attributes are the security model:

| Attribute | Meaning | What it prevents |
|---|---|---|
| `HttpOnly` | JavaScript cannot read `document.cookie` for it | XSS stealing the session |
| `Secure` | only sent over HTTPS | passive network capture |
| `SameSite=Lax` | not sent on cross-site subrequests (e.g. a POST from another site), but **is** sent on top-level GET navigations | CSRF |
| `Path=/` | sent for every path on the host | — |
| `Expires` | browser deletes it after this time | stale cookies lingering |
| `Domain` | which hosts get it | over-sharing across subdomains |

## 5.2 Why the browser sends it automatically

Because HTTP is stateless. The server has no way to tell "this TCP connection is
the same person as five minutes ago." The cookie is the browser volunteering
"here is the token you gave me for this site." That automaticity is the whole
convenience — and it is also exactly why CSRF exists (§19).

## 5.3 What a session is

A **session** is a server-side record that a particular browser is currently
acting as a particular account. The cookie is the *pointer*; the session row is
the *data*.

## 5.4 What is inside `dd_session`

**Nothing.** That is the design.

```ts
// modules/auth/session.service.ts
const token = randomBytes(32).toString('base64url');   // 43 characters of noise
```

The value is 32 cryptographically random bytes. It is **opaque** — it encodes no
user id, no role, no expiry, no dealership. Decode it and you get random bytes.

**Is the user's identity in the cookie?** No. Compare:

```
JWT:      eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhYmMiLCJyb2xlIjoiT1dORVIifQ.sig
          └─ base64-decode this and you can read userId and role ────────┘

dd_session: 5jKq8vN2xR7pL0mW3bT9yF4hG6dZ1cA8sE5uI2oP7wQ
          └─ decodes to 32 random bytes. Means nothing without the database ─┘
```

## 5.5 What is stored in PostgreSQL

```prisma
model Session {
  id        String       @id @default(uuid()) @db.Uuid
  userId    String       @db.Uuid
  tokenHash String       @unique          // ← SHA-256 of the token, NOT the token
  scope     SessionScope @default(DEALER) // DEALER | ADMIN
  expiresAt DateTime
  revokedAt DateTime?
  ip        String?
  userAgent String?
  createdAt DateTime     @default(now())
  @@index([userId, revokedAt])
  @@index([expiresAt])
}
```

**Only the SHA-256 hash is stored.** Read that again — it is the same discipline
as password hashing, applied to session tokens:

```ts
await prisma.session.create({ data: { …, tokenHash: hashToken(token) } });
…
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

**Why?** Because a leaked database dump — a backup on an S3 bucket, a `pg_dump`
in a Slack thread, a compromised read replica — would otherwise hand the attacker
a live session for every signed-in user. With hashes it hands them nothing.

Plain SHA-256 (not Argon2) is correct here, unlike for passwords: the input is
already 256 bits of entropy, so there is nothing to brute-force.

**The token is returned exactly once**, from `issue()`, and is never stored,
logged or re-derived. The pino redact list covers `*.token` for good measure.

## 5.6 How the server knows who you are — the chain

```
   Cookie: dd_session=5jKq8vN2xR7pL0mW3bT9yF4hG6dZ1cA8sE5uI2oP7wQ
        │
        │  readSessionToken(req)                    session.cookie.ts
        ▼
   token: "5jKq8v…"
        │
        │  SHA-256                                   session.service.ts
        ▼
   tokenHash: "a3f8b2…"
        │
        │  SELECT * FROM sessions
        │  WHERE tokenHash = $1
        │    AND scope = 'DEALER'
        │    AND revokedAt IS NULL          ← revocation is part of the QUERY
        │    AND expiresAt > now()          ← so is expiry
        │  JOIN users
        ▼
   Session row + User row
        │
        │  user.status !== 'ACTIVE' → null
        ▼
   SELECT * FROM dealer_members
   WHERE userId = $1 AND status = 'ACTIVE'
   JOIN dealers
        │
        ├── no membership ──▶  PendingPrincipal { permissions: [] }
        │
        └── membership ────▶  DealerPrincipal {
                                userId, dealerId, dealerSlug,
                                role, dealerStatus,
                                permissions: permissionsForRole(role)
                              }
        │
        ▼
   req.principal   +   setContextValue('userId'/'dealerId')
        │
        ▼
   requireDealerActive → requirePermission → handler → service(dealerId, …)
```

## 5.7 What happens on *every* request

**The principal is rebuilt from the database. Every time. Nothing is cached.**

That is two extra queries per authenticated request, and it buys:

| Change | When it takes effect |
|---|---|
| session revoked (`revokedAt` set) | **next request** |
| session expired | **next request** |
| user suspended (`users.status`) | **next request** |
| dealership suspended (`dealers.status`) | **next request** |
| member role changed `OWNER → SALES` | **next request** |
| member removed from dealership | **next request** |

With a JWT carrying claims, every row of that table would read "up to 30 days"
or "next token refresh". `docs/ARCHITECTURE.md` §8.2 puts it in a table:

| Concern | JWT | Opaque session |
|---|---|---|
| Suspend a dealer *now* | needs a denylist — i.e. a database | `UPDATE sessions SET revoked_at = now()` |
| Permission changes take effect | up to 15 min stale | immediately |
| Implementation | access + refresh rotation, reuse detection | ~250 lines |

## 5.8 Session expiration

**Lifetimes** (`session.service.ts`):

```ts
export const DEALER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;   // 30 days
export const ADMIN_SESSION_TTL_SECONDS  = 12 * 60 * 60;        // 12 hours
```

Why different? An admin session is far more dangerous if it leaks — it can
suspend dealerships, grant credits and read every tenant's data. An admin also
sits at a desk and can sign in again without friction. A dealer is on a phone in
a yard and being logged out weekly is a support ticket.

**What the browser does at expiry:** the cookie was set with
`expires: expiresAt`, so the browser deletes it and simply stops sending it. The
next request arrives with no cookie → `readSessionToken` returns `undefined` →
`sessions.resolve(undefined, …)` returns `null` → 401.

**What the server does:** it does not trust the browser. Expiry is part of the
`WHERE` clause:

```ts
return prisma.session.findFirst({
  where: { tokenHash: hashToken(token), scope, revokedAt: null, expiresAt: { gt: new Date() } },
  include: { user: true },
});
```

**Why the server must check even though the browser deletes the cookie:** the
browser is not a security boundary. `curl -H 'Cookie: dd_session=…'` will happily
send a token forever. The client-side expiry is a UX nicety; the `WHERE` clause is
the actual rule.

**Why expiry is in the query, not a check afterwards:** the docblock says it —
*"so there is no window where a revoked row is read and then acted on."* Fetching
then checking is a TOCTOU shape (§8) even if the window is microseconds.

**Revocation:**

```ts
async revoke(token)         { updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }); }
async revokeAllForUser(id)  { updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }); }
```

`revoke` is idempotent — signing out twice must not be an error. And the logout
route takes the token from **the caller's own cookie**, never from a body:

```ts
await service.logout(readSessionToken(req), signedInPrincipal(req).userId);
```

The `userId` argument is *for the log line only*. The comment spells it out:
"the token decides which row is revoked, so a caller cannot sign anybody else out
by naming them."

`revokeAllForUser` exists for the compromise case — one call and every device is
signed out.

## 5.9 JWT expiration vs server-side session expiration

| | JWT | This system |
|---|---|---|
| Where expiry lives | inside the token, signed | `sessions.expiresAt` column |
| Who can change it | nobody without re-signing | one `UPDATE` |
| Early revocation | impossible without a denylist | `UPDATE … SET revokedAt = now()` |
| Cost per request | ~0 (signature verify) | 1–2 indexed queries |
| Cost of a leaked token | valid until `exp` | valid until you revoke it |
| Stale claims | yes | none — rebuilt every request |
| Horizontal scaling | trivially stateless | needs a shared DB (which we have anyway) |

**Why this project chose sessions:** the product requires *immediate* revocation.
An admin suspending a fraudulent dealer must stop them from publishing *now*, not
in 15 minutes. And since every request already touches Postgres for its actual
work, the marginal cost of two more indexed lookups is negligible.

## 5.10 The cookie attributes, and why `Lax` not `Strict`

```ts
// session.cookie.ts
function baseAttributes(): CookieAttributes {
  return {
    httpOnly: true,
    secure: env.isProduction,      // ← http://localhost has no TLS
    sameSite: 'lax',
    path: '/',
    ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {}),
  };
}
```

**`SameSite=Lax` is required, not sloppy.** The OAuth callback is a *top-level
cross-site GET navigation* from `accounts.google.com` back to your API.
`SameSite=Strict` withholds cookies on exactly that navigation, so the `dd_oauth`
transaction cookie would not arrive and every sign-in would fail with
`OAUTH_STATE_INVALID`.

`Lax` still does the CSRF work that matters: the browser will **not** attach the
cookie to a cross-site `POST`/`PUT`/`DELETE`. Combined with a CORS allow-list
naming exactly one origin, that is what protects state-changing routes today.

> **SPEC ≠ CODE:** `docs/ARCHITECTURE.md` §8.2 and API-SPEC §0.3 both specify a
> **double-submit `X-CSRF-Token`** on every state-changing request. It is
> **NOT IMPLEMENTED**. `SameSite=Lax` + the CORS allow-list is the entire
> defence today. `CONTEXT.md` §12.1 flags this as worth adding before any
> third-party origin is allowed to call the API with credentials.

> **SPEC ≠ CODE:** ARCHITECTURE §8.2 says `Max-Age 30 days (sliding)` and
> "session rotates on login and on any privilege change". The implementation
> issues a **fixed** `expiresAt` at `issue()` time and never extends it, and
> there is no rotation on privilege change. A dealer is signed out 30 days after
> sign-in regardless of activity.

---
---

# Part 6 — Authentication vs authorization

## 6.1 The distinction

```
Authentication:  "Who are you?"           → a principal, or 401
Authorization:   "What may you do?"       → allowed, or 403
```

A useful way to feel the difference: **401 means "come back with a valid
identity"; 403 means "your identity is fine, the answer is still no."** Retrying
a 401 after signing in can succeed. Retrying a 403 with the same credentials
never will.

## 6.2 Three guards, and why all three exist

```
requireDealer          →  do you have a valid dealer session?           401 if not
requireDealerActive    →  is your DEALERSHIP approved and not suspended? 403 DEALER_NOT_ACTIVE
requirePermission(p)   →  does your SEAT carry this capability?          403 FORBIDDEN
```

They are three different questions about three different subjects:

| Guard | Subject | Question |
|---|---|---|
| `requireDealer` | the **person + session** | are you signed in as a dealer at all? |
| `requireDealerActive` | the **tenant** | is this business allowed to trade? |
| `requirePermission` | the **seat** | does your role carry this capability? |

Collapsing them would be wrong in both directions. A suspended dealership's owner
must still be able to **read** their console — they need to see *why* they are
suspended, view the admin's reason, and fix their KYC. So `requireDealerActive`
is applied per-route, not on the whole `/v1/dealer` mount:

```ts
// vehicles.routes.ts
router.get('/vehicles', requirePermission('vehicle:read'), …);              // readable when suspended
router.post('/vehicles/:id/submit',
  requireDealerActive,                                                       // ← only publishing is blocked
  requirePermission('listing:submit'), …);
router.post('/listings/:id/renew', requireDealerActive, requirePermission('listing:renew'), …);
```

Only three dealer routes carry `requireDealerActive`: submit, renew, and (in the
dealers module) the profile-affecting ones. Everything else stays readable.

## 6.3 The permission table

`modules/auth/session.port.ts` — this is ARCHITECTURE §8.3 verbatim:

```ts
export const PERMISSIONS = {
  'vehicle:read':    ['OWNER', 'MANAGER', 'SALES'],
  'vehicle:write':   ['OWNER', 'MANAGER'],
  'vehicle:delete':  ['OWNER', 'MANAGER'],
  'listing:submit':  ['OWNER', 'MANAGER'],
  'listing:renew':   ['OWNER', 'MANAGER'],
  'enquiry:read':    ['OWNER', 'MANAGER', 'SALES'],
  'enquiry:update':  ['OWNER', 'MANAGER', 'SALES'],
  'photo:request':   ['OWNER', 'MANAGER'],
  'dealer:update':   ['OWNER'],
  'document:upload': ['OWNER'],
  'billing:read':    ['OWNER', 'MANAGER'],
  'billing:purchase':['OWNER'],          // ← spends money. OWNER only.
  'member:manage':   ['OWNER'],
} as const satisfies Record<string, readonly DealerRole[]>;

export const ADMIN_PERMISSIONS = {
  'admin:dealer:approve':   ['MODERATOR', 'SUPER_ADMIN'],
  'admin:document:review':  ['MODERATOR', 'SUPER_ADMIN'],
  'admin:listing:moderate': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:media:upload':     ['MODERATOR', 'SUPER_ADMIN'],
  'admin:credit:grant':     ['SUPER_ADMIN'],
  'admin:payment:read':     ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:payment:refund':   ['SUPER_ADMIN'],
  'admin:config:write':     ['SUPER_ADMIN'],
  'admin:audit:read':       ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:metrics:read':     ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly AdminRole[]>;
```

**This is per-operation, not per-role blanket.** The difference matters. A
blanket `if (role === 'OWNER' || role === 'MANAGER')` sprinkled through handlers
means adding a role requires auditing every `if`. Here you add a row to a table.

`satisfies Record<string, readonly DealerRole[]>` is doing real work: a typo in a
role name is a compile error.

Note `'billing:purchase': ['OWNER']` — a `MANAGER` can *see* the balance
(`billing:read`) but cannot spend the company's money.

**Admin permissions are checked in the service, not middleware:**

```ts
// admin.service.ts:70
function assertPermission(admin: AdminPrincipal, permission: string): void {
  if (!admin.permissions.includes(permission)) {
    throw new ForbiddenError(`This action needs the ${permission} permission.`);
  }
}
```

Why the asymmetry? The admin module has a generic `handle()` wrapper rather than
per-route middleware chains, so the check moved into each service method. Same
effect; the check is the first line of each mutating method.

## 6.4 The five nouns, disambiguated

This confuses everyone at first. Here they are as rows in tables:

```
┌───────────────────────┐
│  GOOGLE ACCOUNT       │  Not in our database at all. Google's record.
│  sub: 108…429         │  We only ever see the `sub`, email, name, picture.
└──────────┬────────────┘
           │ 1:1 (per provider)
┌──────────▼────────────┐
│  OAuthIdentity        │  OUR record that "Google sub 108…429 is user X".
│  provider  GOOGLE     │  UNIQUE (provider, providerSubject)
│  providerSubject 108… │  email refreshed each login, never looked up by
│  userId    →──────────┼──┐
└───────────────────────┘  │
                           │ N:1
┌──────────────────────────▼─┐
│  User (Account)            │  A PERSON on this platform.
│  id, email?, phone?,       │  Dealers: passwordHash IS NULL (constraint).
│  fullName, status,         │  Admins: isPlatformAdmin + adminRole + passwordHash.
│  isPlatformAdmin, adminRole│
└──────────┬─────────────────┘
           │ 1:N
┌──────────▼─────────────┐        ┌──────────────────────────┐
│  DealerMember          │  N:1   │  Dealer (THE TENANT)      │
│  dealerId  ────────────┼───────▶│  id, slug, brandName,     │
│  userId                │        │  status (DRAFT→ACTIVE…),  │
│  role  OWNER|MANAGER|  │        │  creditBalance (cache),   │
│        SALES           │        │  creditsHeld (cache)      │
│  status ACTIVE|INVITED │        └──────────────────────────┘
│  UNIQUE(dealerId,userId)│
└────────────────────────┘

┌────────────────────────┐
│  Session               │  A BROWSER currently acting as a User.
│  userId, tokenHash,    │  scope decides which console it can reach.
│  scope DEALER|ADMIN,   │  Many per user (phone + laptop = 2 rows).
│  expiresAt, revokedAt  │
└────────────────────────┘
```

- **User ≠ Dealer.** A user is a person; a dealer is a business.
- **A user with no `DealerMember` is a `PendingPrincipal`** — real session, zero
  permissions, one reachable endpoint.
- **`DealerMember` is where the role lives**, not on the `User`. The same person
  could in principle be `OWNER` at one dealership and `SALES` at another. In
  practice `resolveDealer` picks `findFirst(… orderBy: { id: 'asc' })` — the
  earliest membership — because there is no invite flow yet, so every dealership
  has exactly one member.
  > **NOT IMPLEMENTED:** team seats. `MANAGER`/`SALES` exist in the enum and in
  > the permission table; `member:manage` exists as a permission; there is **no
  > invite endpoint**. `CONTEXT.md` §12.1 records this.

## 6.5 Scope — the two consoles are separate worlds

```prisma
scope SessionScope @default(DEALER)   // DEALER | ADMIN
```

with the schema comment:

> A dealer session can never satisfy `requireAdmin`, and an admin session can
> never satisfy `requireDealer` — even when one human holds both seats.

The enforcement is in the resolver:

```ts
async resolveDealer(req) { const s = await sessions.resolve(readSessionToken(req), 'DEALER'); … }
async resolveAdmin(req)  { const s = await sessions.resolve(readSessionToken(req), 'ADMIN');  … }
```

`scope` is in the `WHERE` clause, so a dealer's cookie simply does not match an
admin session row. There is no path between them — an admin who also owns a
dealership signs in twice, holds two sessions, and gets whichever the cookie
currently is.

**The attack this prevents:** privilege escalation via session confusion. If
scope were checked in application code after the lookup, one missed check
anywhere would let a dealer's cookie reach `/v1/admin/**`.

---
---

# Part 7 — Multi-tenancy

## 7.1 What a tenant is

A **tenant** is a customer whose data must be invisible to every other customer,
while all of them share one database, one schema, and one running application.

Here, a tenant is a **dealership**:

```
Dealer A "Sri Lakshmi Motors"  →  23 vehicles, 40 enquiries, 12 credits, 3 KYC docs
Dealer B "Velavan Cars"        →  18 vehicles, 31 enquiries,  4 credits, 3 KYC docs
Dealer C "Anbu Auto Hub"       →  …
```

All in the same `vehicles` table, distinguished by a `dealerId` column.

**Why shared-schema and not a database per dealer?** ARCHITECTURE §7 gives the
one-line answer: *your core product is a cross-tenant search*. A buyer searching
"SUV under ₹8 Lakh in Katpadi" must scan every dealer's inventory at once.
Physical isolation would make the main feature architecturally impossible.

Every dealer-owned table therefore carries `dealerId` as a **first-class column**,
not as something you reach through a join — so tenant filtering is one indexed
predicate:

```prisma
model Vehicle { dealerId String @db.Uuid  …  @@index([dealerId, status, createdAt]) }
model Enquiry { dealerId String @db.Uuid  …  @@index([dealerId, status, createdAt]) }
model Media   { dealerId String? @db.Uuid  … }
model Listing { dealerId String @db.Uuid  …  @@index([dealerId, status]) }
model CreditTransaction { dealerId String @db.Uuid … @@index([dealerId, seq(sort: Desc)]) }
```

Note that `Listing.dealerId` is *denormalized* — you could reach it via
`listing.vehicle.dealerId`. It is duplicated deliberately so the tenant filter is
never a join.

## 7.2 Why `GET /vehicles?dealerId=123` is a catastrophe

Consider the "obvious" MERN implementation:

```js
app.get('/api/vehicles', auth, async (req, res) => {
  const vehicles = await Vehicle.find({ dealerId: req.query.dealerId });  // ❌❌❌
  res.json(vehicles);
});
```

The `auth` middleware ran. The user is signed in. And they can read **every
dealership's inventory** by changing one query parameter. You have authenticated
them and authorized nothing.

The subtler variants are worse because they look defended:

```js
// ❌ the check is in the wrong place — an attacker just omits dealerId
if (req.query.dealerId && req.query.dealerId !== req.user.dealerId) return res.status(403).end();

// ❌ works for GET, forgotten on the PATCH added three months later
const vehicles = await Vehicle.find({ dealerId: req.user.dealerId });

// ❌ body spread — the classic mass-assignment hole
await Vehicle.create({ ...req.body, dealerId: req.user.dealerId });
//                     ↑ if req.body has dealerId AFTER the spread order flips, you lose
```

The problem is structural: as long as `dealerId` is a value that *can* arrive
from a client, every single endpoint is one forgotten line away from a breach.

## 7.3 The rule: `dealerId` always comes from the session

`CONTEXT.md` rule 1, and it is enforced three ways at once.

**(a) No input schema accepts it.** `grep -rn "dealerId" packages/contracts/src`
finds it only in *response* DTOs, never in an input. And every input schema is
`.strict()`:

```ts
export const CreateVehicleInput = z.object({
  makeId: Uuid, modelId: Uuid, variantId: Uuid.nullish(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
  fuel: FuelType, transmission: Transmission, bodyType: BodyType,
}).strict();
```

So this request:

```json
POST /v1/dealer/vehicles
{ "makeId": "…", "modelId": "…", "year": 2021, "fuel": "PETROL",
  "transmission": "MANUAL", "bodyType": "SUV",
  "dealerId": "00000000-0000-0000-0000-000000000000" }
```

is a **400**, not a silent success, and the response *names the field*:

```json
{ "type": "https://dealers-drive.com/errors/validation-failed",
  "title": "Validation failed", "status": 400, "code": "VALIDATION_FAILED",
  "traceId": "V1StGXR8_Z",
  "errors": [ { "field": "body.dealerId", "code": "UNRECOGNIZED_KEY",
                "message": "`dealerId` is not a recognised field." } ] }
```

**(b) Every handler reads it from one place.**

```ts
const { dealerId } = dealerPrincipal(req);
```

That is the only expression in `apps/api/src/modules` that produces a `dealerId`
for a write. It is visible on every line rather than hidden in a base class,
which is deliberate — you can audit it with `grep`.

**(c) The repository signature makes omission a type error.**

```ts
async findForDealer(dealerId: string, vehicleId: string) { … }
async listForDealer(dealerId: string, filter: {…}) { … }
async update(dealerId: string, vehicleId: string, data, tx?) { … }
async softDelete(dealerId: string, vehicleId: string) { … }
```

There is **no `findById(id)` overload**. Public reads go through explicitly-named
methods:

```ts
// ─────────── public reads — deliberately not dealer-scoped ─────────────
async findPublicById(vehicleId: string) { … }
```

The comment is the design: crossing the tenant boundary is a *named, greppable
decision*, never an accident.

## 7.4 Session → principal → dealerId

```
    ┌────────────────┐
    │ dd_session     │  a random string. carries no dealerId.
    └───────┬────────┘
            ▼
    ┌────────────────┐
    │ sessions row   │  carries userId. still no dealerId.
    └───────┬────────┘
            ▼
    ┌────────────────┐
    │ dealer_members │  userId → dealerId + role.  ← THE tenant resolution
    └───────┬────────┘
            ▼
    ┌────────────────────────────────────┐
    │ DealerPrincipal { dealerId, role } │  in memory, for this request only
    └───────┬────────────────────────────┘
            ▼
    repo.listForDealer(dealerId, …)  →  WHERE "dealerId" = $1
```

versus the thing that never happens:

```
    ┌──────────────────────────┐
    │ request body / query     │ ─────╳──── no path exists
    │ { "dealerId": "…" }      │           (.strict() rejects it at the door)
    └──────────────────────────┘
```

## 7.5 Cross-tenant access → **404, not 403**

```
Dealer A owns Vehicle A, Vehicle B
Dealer B owns Vehicle C

Dealer A: GET /v1/dealer/vehicles/<id-of-Vehicle-C>
```

The service:

```ts
async get(dealerId: string, vehicleId: string): Promise<DealerVehicleDto> {
  const vehicle = await repo.findForDealer(dealerId, vehicleId);
  // 404, never 403 — existence is not leaked across tenants (§7 layer 4).
  if (!vehicle) throw new NotFoundError('That vehicle does not exist.');
  return toDto(vehicle);
}
```

The SQL is `WHERE id = $1 AND "dealerId" = $2 AND "deletedAt" IS NULL`. Vehicle C
does not match, the row is `null`, and the answer is **404**.

### Why 404 and not 403

Because **403 confirms the resource exists.**

Picture a competitor who has scraped your public site and holds 5,000 vehicle
UUIDs. They sign up as a dealer and script:

```
for id in ids:  GET /v1/dealer/vehicles/{id}
```

- If cross-tenant reads answer **403**, the response distinguishes "this id is
  real but not yours" (403) from "this id is not real" (404). They now have a
  **membership oracle**: a way to confirm which UUIDs are live inventory, how many
  cars exist, and — by re-running it weekly — when cars are added and sold. That
  is a competitive-intelligence feed you handed them for free.
- If it answers **404**, every id looks identical. They learn nothing.

This is called an **enumeration oracle**, and 404-not-403 is the standard defence.
GitHub does the same thing for private repositories, and for the same reason.

It is pinned by a test — `tests/tenant-isolation.test.ts`, 12 tests, and the
docblock states the principle:

```ts
/**
 * The shape of the proof matters as much as the result. A cross-tenant read
 * must answer 404, not 403: a 403 confirms the id is real, which is a slow
 * enumeration oracle for a competitor with a list of guessed uuids.
 */
```

```ts
it("404s reading another dealer's vehicle",    async () => { await h.agent().get(`/v1/dealer/vehicles/${vehicleOfB}`).expect(404); });
it("404s editing another dealer's vehicle",    async () => { await h.agent().patch(…).send({ kmDriven: 1 }).expect(404); });
it("404s submitting another dealer's vehicle", async () => { await h.agent().post(`…/submit`).send({}).expect(404); });
it("404s deleting another dealer's vehicle",   async () => { await h.agent().delete(…).expect(404); });
it("404s deleting another dealer's media",     async () => { … });
```

**Where 403 *is* correct:** when the caller's identity is not in question and the
refusal is not about existence. `DEALER_NOT_ACTIVE` is a 403 — the dealer knows
their own dealership exists; telling them it is suspended leaks nothing.
`requirePermission` failing is a 403 — a `SALES` seat knows the write endpoint
exists; the answer is "not with your role."

## 7.6 The four-layer model, and where we actually are

ARCHITECTURE §7 specifies four independent layers, on the premise that
*application bugs are inevitable, so design so a single missed `WHERE` cannot leak
data.*

| Layer | What | Status |
|---|---|---|
| **1. Session-derived context** | `dealerId` comes from `DealerMember`, never a client | ✅ implemented + tested |
| **2. Repository signatures** | `dealerId` is the first required parameter; unscoped query = type error | ✅ implemented |
| **3. PostgreSQL Row-Level Security** | `CREATE POLICY tenant_isolation … USING (dealer_id = current_setting('app.dealer_id')::uuid)` | ❌ **NOT IMPLEMENTED** |
| **4. Tests + audit** | one 404 test per tenant-owned resource; cross-tenant admin reads audit-logged | ✅ implemented |

### About layer 3

`platform/db/tenant-tx.ts` already issues the hook:

```ts
export async function withTenant<T>(prisma, dealerId, work) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.dealer_id = '${assertUuid(dealerId)}'`);
    return work(tx);
  });
}
```

The docblock references `prisma/rls.sql`. **That file does not exist.** No
policies are created and no `app_tenant`/`app_platform` roles exist. The `SET
LOCAL` is issued unconditionally so that switching RLS on later is a database
change rather than a code change — which is good design — but today it sets a
session variable nothing reads.

Note the care taken on the one line in the codebase that concatenates SQL:

```ts
function assertUuid(value: string): string {
  if (!UUID.test(value)) throw new Error(`Refusing to set a non-uuid tenant id: ${value}`);
  return value;
}
```

`SET LOCAL` cannot be parameterised, so the value is interpolated — and is
therefore checked against the UUID grammar first. The id always comes from the
session, but the guard costs one regex.

**What this means for you:** layers 1, 2 and 4 are real and tested. Layer 3 is a
prepared socket with nothing plugged into it. Do not describe this system as
"RLS-protected."

## 7.7 The admin exception

Admins legitimately read across tenants. That is their job. Two things keep it
honest:

1. Admin routes live behind `requireAdmin` on a separate mount with a separate
   session scope.
2. **Every admin write is audit-logged inside the transaction:**

```ts
await audit.record(tx, {
  actorType: 'ADMIN', actorId: admin.userId, dealerId: listing.dealerId,
  action: 'listing.approved', entityType: 'Listing', entityId: listingId,
  before: { status: listing.status },
  after:  { status: next, expiresAt: expiresAt.toISOString() },
});
```

`record(tx, …)` takes the transaction handle so **the audit row cannot outlive a
rolled-back write**. `recordDetached()` exists for reads, where there is nothing
to roll back with, and it swallows its own failures — "never fail a request
because the audit write failed; alert instead."

The `AuditLog` row also carries `ip` and `traceId`, pulled from the request
context automatically.

## 7.8 Sabotage check

ARCHITECTURE offers a test for whether your isolation testing is real:

> Deleting `resolveDealer` from a router must turn at least three tests red. If
> it doesn't, your suite isn't testing isolation.

Try it. Comment out `dealer.use(container.guards.requireDealer)` in `routes.ts`
and run `pnpm vitest run tenant-isolation`. If that does not go red, something is
wrong with the suite, not with your understanding.

---
---

# Part 8 — TOCTOU and double authorization

## 8.1 What TOCTOU is

**Time Of Check To Time Of Use.** A bug where you verify a condition, and then
act on it — and between those two moments, the condition stops being true.

The classic non-web example is a setuid program:

```c
if (access("/tmp/file", W_OK) == 0) {   // CHECK: may I write this?
    /* ← attacker replaces /tmp/file with a symlink to /etc/passwd */
    fd = open("/tmp/file", O_WRONLY);   // USE: writes to /etc/passwd
}
```

The check was correct. The use was correct. The *gap between them* was the bug.

## 8.2 The web version

```
t=0ms   Request A:  GET the vehicle, confirm vehicle.dealerId === principal.dealerId  ✅
t=5ms   Request B:  (admin tool / support script / bulk transfer) reassigns the vehicle
t=9ms   Request A:  UPDATE vehicles SET price = … WHERE id = <vehicleId>
                    ↑ no dealerId in the WHERE clause — it "already checked"
```

Dealer A just edited Dealer B's car. The authorization check passed honestly, and
the write still crossed a tenant boundary.

More realistic variants in this product:

- a vehicle is soft-deleted between check and write
- a listing is approved by a moderator between a dealer's check and their update
- a dealership is suspended between the guard and the publish
- **two concurrent submits** from the same dealer both see balance = 1

## 8.3 How Dealers-Drive closes the gap

**The rule (ARCHITECTURE §8.3, restated in `middleware/auth.ts`):**

> the middleware checks *capability*; the service re-checks *ownership* **inside
> the transaction** that performs the write. Both, always — the guard is never the
> only check, and there is no TOCTOU gap.

### Mechanism 1 — the tenant predicate is in the write itself

```ts
// vehicles.repository.ts
async update(dealerId: string, vehicleId: string, data, tx?: Tx) {
  const client = tx ?? prisma;
  const result = await client.vehicle.updateMany({
    where: { id: vehicleId, dealerId, deletedAt: null },   // ← ownership IS the WHERE
    data,
  });
  if (result.count === 0) return null;                     // ← 0 rows → 404
  return client.vehicle.findUnique({ where: { id: vehicleId }, include: vehicleInclude });
}
```

The comment on the method:

> The `dealerId` in the WHERE clause is not redundant with the guard: the service
> re-checks ownership inside the transaction that performs the write, so there is
> no gap between "you may" and "this row is yours."

`updateMany` rather than `update` is deliberate — `update` on a non-matching id
throws a Prisma error; `updateMany` returns `count: 0`, which the service turns
into a clean 404. **The check and the use are the same SQL statement.** There is
no window.

### Mechanism 2 — row locking for the balance

```ts
// billing/credits.service.ts
export async function moveCredits(tx: Tx, movement: CreditMovement) {
  // 1. Lock the dealer row. Everything below is serialised per dealer.
  const locked = await tx.$queryRaw<{ credit_balance: number }[]>`
    SELECT "creditBalance" AS credit_balance FROM dealers
    WHERE id = ${movement.dealerId}::uuid FOR UPDATE`;
  …
}
```

`SELECT … FOR UPDATE` takes an exclusive row lock held until the transaction
commits. A second transaction reaching the same line **blocks** until the first
finishes. Serialisation replaces the race. Full walkthrough in §10.

### Mechanism 3 — the state machine validates the source state inside the transaction

```ts
// admin.service.ts — approveListing
const result = await withTransaction(prisma, async (tx) => {
  const listing = await tx.listing.findUnique({ where: { id: listingId }, include: {…} });
  if (!listing) throw new NotFoundError('That listing does not exist.');
  const next = transition(listing, 'APPROVE', 'ADMIN');   // ← throws if not PENDING_REVIEW
  …
  await tx.listing.update({ where: { id: listingId }, data: { status: next, … } });
});
```

Both the read and the `transition()` check happen **inside** the transaction. Two
moderators clicking Approve on the same card: the second one's `findUnique` (in
its own transaction) still sees `PENDING_REVIEW` until the first commits, but the
`UPDATE` serialises — and the loser's next read shows `APPROVED`, so `transition`
throws `409 INVALID_TRANSITION`.

### Mechanism 4 — the database has the final word

Even if all of the above failed, the partial unique index refuses:

```sql
CREATE UNIQUE INDEX listings_one_approved_per_vehicle
  ON listings ("vehicleId") WHERE status = 'APPROVED';
```

Two approvals of two different listings for the same vehicle: the second `INSERT`
or `UPDATE` violates the index and the transaction aborts. Not gracefully — the
dealer sees a 500 — but the **data is not corrupted**, which is the point of a
last-resort constraint.

### Mechanism 5 — the principal is rebuilt every request

The permission check itself cannot be stale, because there is no cached claim to
be stale. §5.7.

## 8.4 Why "check twice" is not redundant

You will be tempted to remove the second check. Don't. They answer different
questions:

| Check | Where | Question | If it fails |
|---|---|---|---|
| 1st | middleware | "does this seat *ever* get to do this?" | 401 / 403 — fast, cheap, before any DB work |
| 2nd | inside the transaction | "is *this row*, right now, still yours?" | 404 — atomic with the write |

The first is about the **actor**. The second is about the **row**. The first can
be evaluated with no database round-trip and rejects the overwhelming majority of
abuse cheaply. The second is the one that is actually atomic.

## 8.5 What to remember

> **Never authorize on data you fetched in an earlier statement and then write in
> a later one.** Either put the ownership predicate in the write's `WHERE` clause,
> or hold a lock across both.

---
---

# Part 9 — PostgreSQL, from a MongoDB brain

## 9.1 The mindset shift

**MongoDB mindset**

```js
// The application is the guardian of correctness.
if (dealer.creditBalance < 1) throw new Error('no credits');
await Dealer.updateOne({ _id }, { $inc: { creditBalance: -1 } });
```

Correctness holds as long as: every code path remembers the check, no two
processes run concurrently, and nobody ever writes to the collection from a
migration script, a REPL, or an admin tool.

**Production PostgreSQL mindset**

```
application validation   ← ergonomics: a friendly message naming the field
+ database constraints   ← correctness: holds against code you have not written
+ transactions           ← atomicity: all-or-nothing
+ row locking            ← concurrency: serialise what must not interleave
+ indexes                ← performance, AND uniqueness enforcement
+ read models            ← query shape that matches how you read
```

Both layers exist. They are not duplicates — they have different jobs.

## 9.2 Why invariants belong in the database

Because the database is the **only** thing every writer must go through.

- Your API validates. ✅
- A background job writes directly. ❓
- A data-fix script written under pressure at 2 a.m. ❓
- A future service you have not written. ❓
- A Prisma Studio session. ❓
- A `psql` shell. ❓

A `CHECK` constraint applies to all six. Application code applies to one.

**Concretely, from this repo:**

```sql
ALTER TABLE dealers ADD CONSTRAINT credit_balance_non_negative CHECK ("creditBalance" >= 0);
```

Even if a future developer writes `prisma.dealer.update({ data: { creditBalance: -5 } })`
in a script, Postgres refuses. The bad state is not reachable.

## 9.3 The concepts, with real examples

### Primary keys

```prisma
model Vehicle { id String @id @default(uuid()) @db.Uuid  … }
```

UUIDs, not auto-increment integers. Why: sequential ids leak business volume
(`/vehicles/1847` tells a competitor you have ~1,847 vehicles) and make
enumeration trivial. UUID v4 is unguessable.

`CreditTransaction` and `AuditLog` use `BigInt @default(autoincrement())` for
`seq`/`id` because there **order** matters and they are never exposed in a URL.

### Foreign keys

```prisma
model Vehicle {
  dealer Dealer @relation(fields: [dealerId], references: [id], onDelete: Cascade)
  make   Make   @relation(fields: [makeId],   references: [id])   // no cascade — restrict
}
```

**MongoDB has no equivalent.** If you delete a dealer document, the vehicles just
sit there pointing at nothing, forever, and every read has to cope with it.

Note the two `onDelete` policies:
- `Cascade` on `dealerId` — delete a dealership, its vehicles go too.
- default (`Restrict`) on `makeId` — you **cannot** delete "Maruti Suzuki" while
  vehicles reference it. That is correct: the catalogue is shared reference data.
- `SetNull` on `Enquiry.vehicleId` — delete a vehicle, its leads survive with a
  null reference. Leads are money; they must not vanish.

### Unique constraints

```prisma
model User          { email String? @unique   phone String? @unique }
model Dealer        { slug  String  @unique }
model Session       { tokenHash String @unique }
model OAuthIdentity { @@unique([provider, providerSubject]) }
model DealerMember  { @@unique([dealerId, userId]) }
model DealerDocument{ @@unique([dealerId, type]) }
model CreditTransaction { idempotencyKey String? @unique }
```

`@@unique([provider, providerSubject])` **is the account-identity rule from §4.3
expressed as a constraint.** Two accounts cannot claim the same Google `sub`.

`idempotencyKey @unique` is how a duplicate payment settlement becomes an
INSERT conflict instead of double credits (§15).

### Partial unique indexes

This one has no MongoDB analogue at all and is worth internalising:

```sql
CREATE UNIQUE INDEX listings_one_approved_per_vehicle
  ON listings ("vehicleId") WHERE status = 'APPROVED';
```

*"`vehicleId` must be unique — but only among rows where status = 'APPROVED'."*

A vehicle may have many listings over its life: one rejected, one expired, one
approved, one sold. What must never happen is **two live listings for one car**
— buyers would see the same Swift twice with different prices.

A plain unique index on `vehicleId` would forbid the history. The `WHERE` clause
makes the constraint exactly as narrow as the rule.

### CHECK constraints

```sql
ALTER TABLE listings ADD CONSTRAINT approved_has_expiry
  CHECK (status <> 'APPROVED' OR "expiresAt" IS NOT NULL);

ALTER TABLE credit_transactions ADD CONSTRAINT ledger_delta_meaningful
  CHECK (delta <> 0 OR reason = 'CONSUME_APPROVE');

ALTER TABLE users ADD CONSTRAINT only_admins_have_passwords
  CHECK ("passwordHash" IS NULL OR "isPlatformAdmin" = true);
```

The middle one is subtle and beautiful: a zero-delta ledger row is normally
nonsense, **except** for `CONSUME_APPROVE`, where the money moved at hold time but
the dealer still needs to see "Listing published — 2021 Swift VXi" in their
history on the day it happened. The constraint permits exactly that one exception
and forbids all the accidental ones.

### Transactions

```ts
await prisma.$transaction(async (tx) => {
  const movement = await moveCredits(tx, { … });     // debit the ledger
  const listing  = await tx.listing.create({ … });   // create the listing
  await tx.creditTransaction.update({ where: { id: movement.transactionId },
                                      data: { listingId: listing.id } });
  await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'READY', slug } });
  await refreshHeldCount(tx, dealerId);
  await enqueueOutbox(tx, { type: 'ListingSubmitted', … });
});
```

Six writes. **All of them, or none of them.** If the outbox insert fails, the
credit is not debited and the listing does not exist.

Without transactions the failure modes are: a credit charged for a listing that
was never created; a listing with no credit hold; a notification for something
that rolled back.

Two helpers, and the distinction matters:

```ts
withTenant(prisma, dealerId, work)   // stamps SET LOCAL app.dealer_id — dealer-scoped work
withTransaction(prisma, work)        // plain — for platform work that legitimately spans tenants
```

Admin operations use `withTransaction` because they act on a dealership that is
not "theirs."

### Row locking — `SELECT … FOR UPDATE`

```sql
SELECT "creditBalance" FROM dealers WHERE id = $1 FOR UPDATE
```

Takes an exclusive lock on that one row until the transaction ends. Another
transaction reaching the same statement **waits**.

It is a *row* lock, not a table lock: Dealer A's submit and Dealer B's submit do
not block each other at all. Only same-dealer operations serialise, which is
exactly the granularity the invariant needs.

Full walkthrough in §10.5.

### Sequences

```sql
CREATE SEQUENCE enquiry_reference_seq START WITH 10000;   -- buyer-facing reference
CREATE SEQUENCE invoice_number_seq    START WITH 1;       -- GST invoice numbers
```

Plus `CreditTransaction.seq BIGSERIAL`, which gets its own section (§10.7)
because *why* it exists is the most interesting thing in the schema.

The enquiry reference is **platform-wide**, not per-dealer — the migration
comment says why: a per-dealer counter would leak each dealer's volume to anyone
who received two references.

### Nullable columns

`users.phone` became nullable in the Google migration, and the migration explains
itself:

> A dealer now arrives from Google holding a verified email and nothing else, and
> the alternative — writing a placeholder phone at callback time — would let a
> stranger's first sign-in squat on the unique index that protects a real
> dealership's number.

`Vehicle.pricePaise`, `kmDriven`, `colorId` etc. are nullable because a **draft**
vehicle is created with make/model/year and nothing else. This is the one
documented conflict between the specs (`CONTEXT.md` §11): ARCHITECTURE implies
non-null, API-SPEC's draft flow requires nullable. **Resolved in favour of
API-SPEC** — drafting is otherwise unimplementable.

### Indexes

```prisma
@@index([dealerId, status, createdAt])          // Vehicle — the inventory list query
@@index([status, submittedAt])                  // Listing — the moderation queue
@@index([dealerId, seq(sort: Desc)])            // CreditTransaction — "newest row"
@@index([phone, vehicleId, createdAt])          // Enquiry — duplicate-lead detection
```

Composite index column order matters: `[dealerId, status, createdAt]` serves
`WHERE dealerId = ? AND status = ?  ORDER BY createdAt` and also
`WHERE dealerId = ?`, but **not** `WHERE status = ?` alone. Leftmost-prefix rule.

The read model adds specialist index types:

```sql
CREATE INDEX listing_search_doc_idx      ON listing_search USING GIN (search_doc);   -- full text
CREATE INDEX listing_search_features_idx ON listing_search USING GIN (features);     -- text[] containment
CREATE INDEX listing_search_trgm         ON listing_search USING GIN (
  (coalesce(make_name,'') || ' ' || coalesce(model_name,'')) gin_trgm_ops);          -- fuzzy/typo
```

`pg_trgm` is what makes "swfit" find "Swift".

### Denormalized read models

```sql
CREATE TABLE listing_search (
  listing_id uuid PRIMARY KEY, vehicle_id uuid, dealer_id uuid,
  dealer_name text, dealer_slug text, make_name text, model_name text,
  price_paise bigint, km int, fuel text, city_slug text, features text[],
  photo_count int, primary_blurhash text, approved_at timestamptz,
  search_doc tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(make_name,'')),  'A') ||
    setweight(to_tsvector('simple', coalesce(model_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(variant_name,'')),'B') ||
    setweight(to_tsvector('simple', coalesce(city_name,'')),  'C') ||
    setweight(to_tsvector('simple', coalesce(dealer_name,'')),'D')
  ) STORED
);
```

One flat row per publicly-visible car. The normalized query would be a six-table
join executed on every search across every filter combination. This is one table
scan with GIN indexes. §12 covers when and how it is written.

`GENERATED ALWAYS AS … STORED` means Postgres maintains `search_doc` itself — you
cannot forget to update it, because you cannot write it.

## 9.4 The comparison table

| Concept | MongoDB | PostgreSQL here |
|---|---|---|
| Schema | implicit, per-document | `schema.prisma` + migrations |
| Relations | manual refs / `$lookup` | foreign keys with `onDelete` policies |
| Uniqueness | unique index (whole collection) | unique + **partial** unique + composite |
| Validation | app code / JSON Schema | app **and** `CHECK` constraints |
| Multi-doc atomicity | transactions (replica set required, discouraged) | `BEGIN…COMMIT`, everywhere, cheap |
| Concurrency | `findOneAndUpdate` atomics | `SELECT … FOR UPDATE` |
| Ordering guarantee | `_id` is roughly time-ordered | `BIGSERIAL` is strictly monotonic |
| Full text | `$text` or Atlas Search | `tsvector` + GIN + `pg_trgm` |
| Money | `Decimal128` or (dangerously) `Number` | `BigInt` paise |

## 9.5 Money is `BigInt` paise. Always.

`CONTEXT.md` rule 3. `pricePaise: 645000` means ₹6,450.00.

**Why not floats:** `0.1 + 0.2 === 0.30000000000000004`. Aggregate a few thousand
of those into a GST invoice and you have a number that does not reconcile.

**Why not `Number`:** `Number.MAX_SAFE_INTEGER` is ~9×10¹⁵. A ₹500 crore
transaction in paise is 5×10¹², which is fine — but the discipline is what
prevents someone later storing rupees-with-decimals "just for this one field."

**Where the conversion happens:** exactly at the UI boundary.
`formatLakh(645000)` → `"₹6.45 Lakh"`, in `packages/contracts/src/common.ts`, so
all four surfaces that render a price agree about rounding.

`installBigIntJson()` patches `BigInt.prototype.toJSON` as a safety net, but the
mappers call `Number()` explicitly — the comment insists the conversion "must be
deliberate."

---
---

# Part 10 — Credits and the ledger

This is the heart of the system. A dealer buys **listing credits**; publishing one
vehicle costs one credit. It is real money, so it gets real accounting.

## 10.1 The naive approach, and exactly how it fails

```js
// ❌ Everything wrong with this fits in three lines
if (dealer.creditBalance < 1) throw new Error('Not enough credits');
await Dealer.updateOne({ _id: dealerId }, { $inc: { creditBalance: -1 } });
await Listing.create({ vehicleId, status: 'PENDING' });
```

**Failure 1 — the race.** Two submits arrive simultaneously with balance = 1.
Both read 1, both pass the check, both decrement. Balance is now −1 (or 0 with two
listings published for one credit).

**Failure 2 — no history.** A dealer emails: *"I bought 20 credits, I've listed 12
cars, why do I have 5 left?"* You have one integer. You cannot answer. You cannot
even tell whether the bug is yours.

**Failure 3 — no atomicity.** The decrement succeeds, the listing insert fails.
The dealer paid for nothing.

**Failure 4 — unauditable.** Support grants 10 goodwill credits. Six months later
finance asks why revenue and credits disagree. No record exists.

**Failure 5 — un-reversible.** A bug over-charges 40 dealers. There is no
"before" value to restore.

## 10.2 What a ledger is

An **append-only** record of every movement. Rows are never `UPDATE`d and never
`DELETE`d. A mistake is corrected by appending a **reversal** row that references
the original — which is how double-entry bookkeeping has worked since the 15th
century, for the same reason.

```prisma
/// The ledger. Append-only. The truth. Never UPDATEd, never DELETEd —
/// a mistake is corrected with a REVERSAL row that references the original.
model CreditTransaction {
  id             String       @id @default(uuid()) @db.Uuid
  seq            BigInt       @unique @default(autoincrement())   // ← append ORDER
  dealerId       String       @db.Uuid
  delta          Int                                              // signed: -1, +1, +20, 0
  balanceAfter   Int                                              // materialised running balance
  reason         CreditReason
  label          String                                           // shown verbatim to the dealer
  listingId      String?      @db.Uuid
  orderId        String?      @db.Uuid
  reversalOfId   String?      @db.Uuid
  actorType      String                                           // DEALER | ADMIN | SYSTEM
  actorId        String?      @db.Uuid
  idempotencyKey String?      @unique
  createdAt      DateTime     @default(now())
  @@index([dealerId, seq(sort: Desc)])
}

enum CreditReason {
  PURCHASE  ADMIN_GRANT  HOLD_SUBMIT  RELEASE_REJECT
  RELEASE_EXPIRED_UNREVIEWED  CONSUME_APPROVE  ADMIN_ADJUSTMENT  REVERSAL
}
```

Every field earns its place:

| Field | Why |
|---|---|
| `delta` | the movement, signed. `-1` hold, `+1` release, `+20` purchase, `0` consume |
| `balanceAfter` | **materialised**, so "what is the balance?" is one indexed row read, not `SUM(delta)` over the dealer's whole history |
| `reason` | an enum, so you can query "all holds this month" without parsing strings |
| `label` | human text shown verbatim in the dealer's credit history. The interface comment says: *"Write it for them, not for you."* |
| `listingId` / `orderId` | what this movement was for |
| `reversalOfId` | correction chain |
| `actorType` / `actorId` | who caused it — dealer, admin, or the system |
| `idempotencyKey` | `@unique` — webhook and retry safety |
| `seq` | append order (§10.7) |

## 10.3 `Dealer.creditBalance` is a **cache**, not the truth

```prisma
model Dealer {
  /// MIRROR of the newest CreditTransaction.balanceAfter. Never authoritative
  /// on its own — every write path re-reads the ledger under FOR UPDATE.
  creditBalance Int @default(0)
  creditsHeld   Int @default(0)
}
```

It exists because the dealer console shows the balance on every page and a
dashboard read should not touch the ledger. **Every write path ignores it** and
reads from the newest ledger row instead.

There is a nightly job that alerts if they ever disagree (§10.8).

## 10.4 `moveCredits` — the only function allowed to move a balance

`CONTEXT.md` rule 4: *"There is no `addCredits` and no `spendCredits` — there is
`moveCredits(tx, {delta, reason})`, exported through `billing.facade.ts`, and
nothing else may write a balance."*

```ts
export async function moveCredits(tx: Tx, movement: CreditMovement): Promise<CreditMovementResult> {
  // 1. Lock the dealer row. Everything below is serialised per dealer.
  const locked = await tx.$queryRaw<{ credit_balance: number }[]>`
    SELECT "creditBalance" AS credit_balance FROM dealers
    WHERE id = ${movement.dealerId}::uuid FOR UPDATE`;
  if (locked.length === 0) throw new DomainError('DEALER_NOT_FOUND', 'That dealership no longer exists.');

  // 2. The ledger is the truth; the column is only its cache.
  const newest = await tx.creditTransaction.findFirst({
    where: { dealerId: movement.dealerId },
    orderBy: { seq: 'desc' },                       // ← seq, NOT createdAt
    select: { balanceAfter: true },
  });

  const balanceBefore = newest?.balanceAfter ?? 0;
  const balanceAfter  = balanceBefore + movement.delta;

  if (balanceAfter < 0) throw new InsufficientCreditsError(Math.abs(movement.delta), balanceBefore);

  // 3. Append, then refresh the cache — both inside the caller's transaction.
  const row = await tx.creditTransaction.create({ data: { …, balanceAfter, … } });
  await tx.dealer.update({ where: { id: movement.dealerId }, data: { creditBalance: balanceAfter } });

  return { transactionId: row.id, balanceBefore, balanceAfter };
}
```

Four properties, each load-bearing:

1. **It takes `tx`, never a `PrismaClient`.** You *cannot* call it outside a
   transaction. The comment: *"so the movement and the state change it pays for
   cannot be committed separately."* This is enforced by the type system.
2. **It locks first.** Before reading anything.
3. **It reads the ledger, not the cache.**
4. **It appends and refreshes the cache in the same transaction.** The cache can
   never be stale by more than the duration of one transaction.

## 10.5 The hold → consume / release lifecycle

A credit is not spent when the dealer submits. It is **held** — like a hotel
pre-authorisation on a card.

```
Dealer has 10 credits.

  ┌──────────────────────────────────────────────────────────────────────┐
  │  POST /v1/dealer/vehicles/{id}/submit                                │
  │                                                                      │
  │  moveCredits(tx, { delta: -1, reason: 'HOLD_SUBMIT',                 │
  │                    label: 'Submitted for review — 2021 Swift VXi' }) │
  │  listing.creditHeld = true;  listing.creditTxnId = <row id>          │
  │                                                                      │
  │  ledger:  seq=41  delta=-1  balanceAfter=9  HOLD_SUBMIT              │
  │  dealer:  creditBalance=9   creditsHeld=1                            │
  └───────────────────────────┬──────────────────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┬───────────────────┐
        ▼                     ▼                      ▼                   ▼
  ┌───────────┐        ┌────────────┐        ┌──────────────┐    ┌─────────────┐
  │ APPROVED  │        │ REJECTED   │        │ CHANGES_     │    │ expired     │
  │           │        │            │        │ REQUESTED    │    │ unreviewed  │
  │ delta:  0 │        │ delta: +1  │        │ NO movement  │    │ delta: +1   │
  │ CONSUME_  │        │ RELEASE_   │        │ hold SURVIVES│    │ RELEASE_    │
  │ APPROVE   │        │ REJECT     │        │              │    │ EXPIRED_…   │
  │           │        │            │        │              │    │             │
  │ bal    9  │        │ bal    10  │        │ bal       9  │    │ bal     10  │
  │ held   0  │        │ held    0  │        │ held      1  │    │ held     0  │
  └───────────┘        └────────────┘        └──────┬───────┘    └─────────────┘
   the credit is        money back —                │
   genuinely spent      review cost                 │ dealer fixes it, resubmits
                        the dealer nothing          ▼
                                            ┌──────────────────────┐
                                            │ RESUBMIT             │
                                            │ reusesHold = true    │
                                            │ NO second HOLD_SUBMIT│
                                            │ bal 9, held 1        │
                                            └──────────────────────┘
```

### Why `CONSUME_APPROVE` has `delta: 0`

The money already moved at hold time. So why write a row at all?

Because the **dealer's credit history is a product surface**. They open Billing &
Credits and expect to see:

```
02 Aug 2026   Listing published — 2021 Maruti Swift VXi        0    balance 9
01 Aug 2026   Submitted for review — 2021 Maruti Swift VXi    −1    balance 9
28 Jul 2026   Purchased — 20 credit pack                     +20    balance 10
```

Without the zero-delta row, "Listing published" never appears and the dealer
cannot tell whether the credit was consumed or is still held.

And the constraint permits exactly this one exception:

```sql
ALTER TABLE credit_transactions ADD CONSTRAINT ledger_delta_meaningful
  CHECK (delta <> 0 OR reason = 'CONSUME_APPROVE');
```

### Why `CHANGES_REQUESTED` keeps the hold

`admin.service.ts:929` — *"D11. The credit stays held. That is the difference from
rejection."*

- **Reject** = "this car does not belong on our marketplace." Money back.
- **Request changes** = "fix the photos and resubmit." The dealer already paid for
  this listing slot; charging again for a fix would be punitive.

That surviving hold is the **only** thing distinguishing the two outcomes in the
ledger.

### The bug this caused, and how it was fixed

`CONTEXT.md` §10.1 — a real bug, kept because it is a class of mistake:

> **Credit double-hold on resubmit.** A resubmission after `CHANGES_REQUESTED`
> took a *second* `HOLD_SUBMIT`, so a dealer paid twice for one listing and
> `Dealer.creditsHeld` disagreed with the ledger.

The fix, in `vehicles.service.ts`:

```ts
const reusesHold = previous?.creditHeld === true && previous.creditTxnId !== null;

const result = await withTenant(prisma, dealerId, async (tx) => {
  if (reusesHold && previous?.creditTxnId) {
    heldTxnId = previous.creditTxnId;
    // No movement: the balance is unchanged because the credit taken by
    // the first submit was never released.
    balanceBefore = await currentBalance(tx, dealerId);
    balanceAfter  = balanceBefore;
  } else {
    const balance = await currentBalance(tx, dealerId);
    if (balance < 1) throw new InsufficientCreditsError(1, balance);
    const movement = await moveCredits(tx, { dealerId, delta: -1, reason: 'HOLD_SUBMIT', … });
    …
  }
  …
});
```

Rejection *releases* the hold, so `previous.creditHeld` is false and a resubmit
after rejection correctly takes a fresh one. The asymmetry falls out of the data.

## 10.6 The concurrency walkthrough

**Setup:** Dealer A has **1 credit**. Two browser tabs. Both click "Submit for
review" on different vehicles at the same instant.

### Without row locking

```
    Request A                              Request B
    ─────────                              ─────────
t0  BEGIN
t1  SELECT balanceAfter … ORDER BY seq DESC
    → 1
t2                                         BEGIN
t3                                         SELECT balanceAfter … ORDER BY seq DESC
                                           → 1                    ← reads the SAME value
t4  1 >= 1 ✓
t5                                         1 >= 1 ✓                ← both pass
t6  INSERT ledger (delta -1, balanceAfter 0)
t7                                         INSERT ledger (delta -1, balanceAfter 0)  ← WRONG
t8  UPDATE dealers SET creditBalance = 0
t9                                         UPDATE dealers SET creditBalance = 0
t10 COMMIT                                 COMMIT

RESULT: two listings published. One credit paid. The ledger says
        balanceAfter = 0 on BOTH rows, so the running balance is corrupt
        and cannot be reconstructed. Revenue lost, books wrong.
```

### With `SELECT … FOR UPDATE`

```
    Request A                              Request B
    ─────────                              ─────────
t0  BEGIN
t1  SELECT "creditBalance" FROM dealers
      WHERE id=$1 FOR UPDATE               ← acquires the exclusive row lock
    → lock ACQUIRED
t2                                         BEGIN
t3                                         SELECT … FOR UPDATE
                                           ░░░ BLOCKED ░░░ waits on A's lock
t4  SELECT balanceAfter … → 1
t5  1 - 1 = 0, not negative ✓
t6  INSERT ledger (seq=42, delta -1, balanceAfter 0)
t7  UPDATE dealers SET creditBalance = 0
t8  INSERT listing …
t9  COMMIT  ────────────────────────────▶  lock RELEASED
t10                                        → lock ACQUIRED, sees creditBalance = 0
t11                                        SELECT balanceAfter … ORDER BY seq DESC
                                           → 0                    ← the FRESH value
t12                                        0 - 1 = -1  → NEGATIVE
t13                                        throw InsufficientCreditsError(1, 0)
t14                                        ROLLBACK

RESULT: one listing published, one credit spent, and Request B gets:
        422 INSUFFICIENT_CREDITS
        { "code": "INSUFFICIENT_CREDITS",
          "detail": "Publishing this vehicle needs 1 credit. Your balance is 0.",
          "creditBalance": 0,
          "actionLabel": "Buy credits", "actionHref": "/dealer/billing" }
```

Note that the error carries the extras the UI needs to render a "Buy credits"
button — that comes from `AppErrorOptions.extra`:

```ts
export class InsufficientCreditsError extends DomainError {
  constructor(required: number, balance: number, actionHref = '/dealer/billing') {
    super('INSUFFICIENT_CREDITS',
      `Publishing this vehicle needs ${required} credit${required === 1 ? '' : 's'}. Your balance is ${balance}.`,
      { title: 'Not enough listing credits',
        extra: { creditBalance: balance, actionLabel: 'Buy credits', actionHref } });
  }
}
```

**And the last line of defence**, if every one of the above were somehow bypassed:

```sql
ALTER TABLE dealers ADD CONSTRAINT credit_balance_non_negative CHECK ("creditBalance" >= 0);
```

## 10.7 Why `createdAt` cannot order the ledger — the `seq` column

This is the most subtle thing in the schema, and the migration file explains
itself:

```sql
-- The ledger needs an append order that is monotonic *within* a transaction.
--
-- `createdAt` is not: Postgres gives every statement in one transaction the
-- same `now()`, so two movements committed together tie, and "the newest row"
-- — which is where the running balance is read from — becomes ambiguous. A
-- bigserial cannot tie.
ALTER TABLE credit_transactions ADD COLUMN seq BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX credit_transactions_seq_key ON credit_transactions (seq);
CREATE INDEX credit_transactions_dealer_seq_idx ON credit_transactions ("dealerId", seq DESC);
```

### The failure, concretely

In PostgreSQL, `now()` / `CURRENT_TIMESTAMP` returns **the time the transaction
started**, and is *identical for every statement inside it*. (`clock_timestamp()`
is the one that advances — `now()` deliberately does not.)

So a transaction that writes two ledger rows produces:

```
  seq | delta | balanceAfter | reason          | createdAt
  ----+-------+--------------+-----------------+-------------------------
   88 |    +1 |           10 | RELEASE_REJECT  | 2026-08-19 10:15:32.881
   89 |    -1 |            9 | HOLD_SUBMIT     | 2026-08-19 10:15:32.881
                                                 ↑ IDENTICAL
```

Now run the query that determines the balance:

```sql
SELECT "balanceAfter" FROM credit_transactions
WHERE "dealerId" = $1 ORDER BY "createdAt" DESC LIMIT 1;
```

The tie is broken **arbitrarily** by the planner — and it can break differently
between two executions of the same query. Half the time you read `10`, half the
time `9`. Your dealer's balance flickers, and the next `moveCredits` computes
`balanceAfter` from whichever it happened to get. The ledger silently diverges
from itself.

With `ORDER BY seq DESC` there is no tie, ever, because `BIGSERIAL` draws from a
sequence that increments per row.

```ts
const newest = await tx.creditTransaction.findFirst({
  where: { dealerId },
  orderBy: { seq: 'desc' },      // ← never createdAt
  select: { balanceAfter: true },
});
```

The same ordering is used for the paginated ledger endpoint (`billing.service.ts`
uses a `seq`-based cursor), so the dealer's history is stable under concurrent
writes too.

**Caveat worth knowing:** `BIGSERIAL` guarantees *monotonic assignment*, not
gap-free-ness — a rolled-back transaction burns its sequence value. That is fine
here; the ledger cares about order, not density.

## 10.8 Reconciliation — the nightly proof

`platform/jobs/handlers.ts`, `counters.reconcile`, cron `30 3 * * *` IST:

```ts
for (const dealer of dealers) {
  const newest = await prisma.creditTransaction.findFirst({
    where: { dealerId: dealer.id }, orderBy: { seq: 'desc' }, select: { balanceAfter: true } });
  const ledgerBalance = newest?.balanceAfter ?? 0;
  if (ledgerBalance !== dealer.creditBalance) {
    logger.error({ dealerId: dealer.id, ledgerBalance, cached: dealer.creditBalance },
      'LEDGER DRIFT — cached balance disagrees with the newest ledger row');
  }

  const held = await prisma.listing.count({ where: { dealerId: dealer.id, creditHeld: true,
                                                     status: { in: ['PENDING_REVIEW','CHANGES_REQUESTED'] } } });
  if (held !== dealer.creditsHeld) {
    logger.error({ dealerId: dealer.id, held, cached: dealer.creditsHeld },
      'HELD-CREDIT DRIFT — cached held count disagrees with live listings');
  }
}

// And the invariant that catches a whole class of future bug:
const approvedWithoutConsume = await prisma.$queryRaw`
  SELECT count(*)::bigint AS count FROM listings l
  WHERE l.status = 'APPROVED'
    AND NOT EXISTS (SELECT 1 FROM credit_transactions t
                    WHERE t."listingId" = l.id AND t.reason = 'CONSUME_APPROVE')`;
```

The third check is the clever one: **an approved listing with no
`CONSUME_APPROVE` row is a car published for free.** If anyone ever adds a write
path that bypasses `moveCredits`, this catches it the next morning.

The comment on the job: *"These are not 'log a warning' conditions — each one is
either money lost or a dealer's trust lost."*

> **NOT IMPLEMENTED:** these are `logger.error` lines with nothing watching them.
> `CONTEXT.md` §12.4 names credit-ledger drift as one of the four metrics that
> should alert. There is no alerting.

## 10.9 What the tests pin

`tests/credits.test.ts`, and the docblock is the philosophy:

> These tests assert the ledger's *shape*, not just the arithmetic. A suite that
> only checked the final number would pass for an implementation that did
> `creditBalance += n`, which is the exact thing the rule forbids.

```ts
const row = await newestLedgerRow(h);
expect(row.reason).toBe('HOLD_SUBMIT');
expect(row.delta).toBe(-1);
expect(row.balanceAfter).toBe(submit.body.credit.balanceAfter);
expect(row.listingId).toBe(submit.body.listingId);
```

## 10.10 What to remember

> **Never store a balance. Store the movements and derive the balance.** The
> current value is a *cache of the newest row*, the ordering is a *sequence*, the
> concurrency control is a *row lock*, and the whole thing lives in *one
> function*.

---
---

# Part 11 — The listing state machine

## 11.1 First, a correction to the vocabulary

> **The states are not `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED`.** If you
> came here with those names, they are from a generic mental model, not this
> system. There is no `SUBMITTED`, no `UNDER_REVIEW`, and no `TAKEN_DOWN` in this
> codebase.

Two separate models carry status, and conflating them is the number one source of
confusion:

```prisma
enum VehicleStatus { DRAFT  READY  SOLD  ARCHIVED }
enum ListingStatus { PENDING_REVIEW  CHANGES_REQUESTED  APPROVED
                     REJECTED  EXPIRED  SOLD  REMOVED }
```

- **`Vehicle`** is the *physical car* in a dealer's inventory. It starts `DRAFT`.
- **`Listing`** is a *publication attempt* for that car. It does not exist until
  the dealer submits, and it is **born `PENDING_REVIEW`** — there is no draft
  listing.

So "DRAFT" is a state of the vehicle, before any listing exists. The UI reconciles
the two into one `displayStatus` (§11.6).

## 11.2 The actual state machine

`modules/listings/listing.state.ts`:

```
                        (no listing yet — Vehicle is DRAFT)
                                     │
                          SUBMIT  ◄──┤  actor: DEALER
                                     │  requires: requireDealerActive,
                                     ▼            listing:submit permission,
                          ┌──────────────────┐    completeness, ≥1 credit
              ┌──────────▶│  PENDING_REVIEW  │◄──────────────┐
              │           └────────┬─────────┘               │
              │      ┌─────────────┼─────────────┐           │
     RESUBMIT │      │             │             │           │ RENEW
     (DEALER) │      │ APPROVE     │ REJECT      │ REQUEST_  │ (DEALER)
              │      │ (ADMIN)     │ (ADMIN)     │ CHANGES   │
              │      ▼             ▼             │ (ADMIN)   │
              │  ┌────────┐   ┌──────────┐       ▼           │
              │  │APPROVED│   │ REJECTED │  ┌─────────────┐  │
              │  └───┬────┘   └────┬─────┘  │  CHANGES_   │  │
              │      │             │        │  REQUESTED  │  │
              │      │             └────────┴──────┬──────┘  │
              │      │                RESUBMIT     │         │
              │      └─────────────────────────────┘         │
              │      │                                       │
              │      │ EXPIRE (SYSTEM, nightly cron)         │
              │      ▼                                       │
              │  ┌─────────┐──────────────────────────────────┘
              │  │ EXPIRED │
              │  └────┬────┘
              │       │ MARK_SOLD (DEALER | ADMIN)
              │       ▼
              │  ┌────────┐        ┌──────────┐
              └─▶│  SOLD  │        │ REMOVED  │◄── TAKEDOWN (ADMIN)
                 └────────┘        └──────────┘    from APPROVED,
                  (also from                       PENDING_REVIEW,
                   APPROVED)                       CHANGES_REQUESTED
```

And here is the table, verbatim from the code:

```ts
const RULES: Record<ListingEvent, Rule> = {
  SUBMIT:          { from: [],                                              to: 'PENDING_REVIEW',    actors: ['DEALER'] },
  RESUBMIT:        { from: ['REJECTED', 'CHANGES_REQUESTED'],               to: 'PENDING_REVIEW',    actors: ['DEALER'] },
  APPROVE:         { from: ['PENDING_REVIEW'],                              to: 'APPROVED',          actors: ['ADMIN'] },
  REJECT:          { from: ['PENDING_REVIEW'],                              to: 'REJECTED',          actors: ['ADMIN'] },
  REQUEST_CHANGES: { from: ['PENDING_REVIEW'],                              to: 'CHANGES_REQUESTED', actors: ['ADMIN'] },
  EXPIRE:          { from: ['APPROVED'],                                    to: 'EXPIRED',           actors: ['SYSTEM'] },
  MARK_SOLD:       { from: ['APPROVED', 'EXPIRED'],                         to: 'SOLD',              actors: ['DEALER', 'ADMIN'] },
  TAKEDOWN:        { from: ['APPROVED','PENDING_REVIEW','CHANGES_REQUESTED'], to: 'REMOVED',         actors: ['ADMIN'] },
  RENEW:           { from: ['EXPIRED'],                                     to: 'PENDING_REVIEW',    actors: ['DEALER'] },
};
```

**Read the `actors` column as an authorization table.** It is not decoration:

- A dealer **cannot** `APPROVE` their own listing. Not "the UI doesn't show the
  button" — the function throws.
- An admin **cannot** `RESUBMIT` on a dealer's behalf.
- Only the **SYSTEM** may `EXPIRE`.
- `MARK_SOLD` is the one event two actors share.

**Read the `from` column as a set of forbidden transitions.** Everything not
listed is impossible:

| Attempted | Why it is refused |
|---|---|
| `APPROVED → APPROVED` | double approval — two moderators on one card |
| `REJECTED → APPROVED` | must go through `RESUBMIT` first, so the queue sees it again |
| `SOLD → anything` | terminal |
| `REMOVED → anything` | terminal — only an admin put it there |
| `EXPIRED → APPROVED` | must `RENEW` (which costs a credit and re-enters review) |
| `PENDING_REVIEW → SOLD` | you cannot sell a car that was never published |

## 11.3 Why `listing.status = 'APPROVED'` is dangerous

```ts
listing.status = 'APPROVED';        // ❌
await listing.save();
```

Every one of these questions is unanswered:

1. **Was it in a state that can be approved?** If it was `REJECTED`, you have
   just published something a moderator refused.
2. **Is this actor allowed?** If this line is in a dealer-facing service, a
   dealer just approved their own car.
3. **Was the credit consumed?** Approval must settle the hold. Nothing here does.
4. **Was `expiresAt` set?** The `approved_has_expiry` CHECK constraint will reject
   the write — so you get a 500 instead of a listing.
5. **Was it audit-logged?** No.
6. **Was the search index updated?** No — so it is "approved" and invisible.

And the sixth is the killer: it works fine in the happy path you tested, and
silently produces a half-published listing in the case you did not.

```ts
const next = transition(listing, 'APPROVE', 'ADMIN');   // ✅
```

answers questions 1 and 2 before anything is written, and *forces* you to write
the rest of the update, because `next` is a value you have to use.

```ts
export function transition(listing: Pick<Listing,'status'>, event: ListingEvent, actor: Actor): ListingStatus {
  const rule = RULES[event];
  if (!rule.actors.includes(actor)) {
    throw new ConflictError('INVALID_TRANSITION',
      `A ${actor.toLowerCase()} may not ${event.toLowerCase().replace('_',' ')} a listing.`);
  }
  if (!rule.from.includes(listing.status)) {
    // Two moderators opening the same card is expected; the second one gets a
    // clear error rather than a double approval (API-SPEC D9).
    throw new ConflictError('INVALID_TRANSITION',
      `This listing is ${listing.status.toLowerCase().replace(/_/g,' ')} and cannot be ${rule.to.toLowerCase().replace(/_/g,' ')}.`);
  }
  return rule.to;
}
```

Note the error messages are written **for the moderator**, not for a developer:
*"This listing is approved and cannot be approved."*

## 11.4 The two-part defence

`CONTEXT.md` rule 5: *"`listing.status = …` outside `listings/listing.state.ts`
is a bug. `status` is in no dealer-writable schema either, so the two facts
together are the defence."*

**Part 1 — the state machine** stops *internal* misuse.
**Part 2 — `.strict()` contracts** stop *external* forgery:

```ts
export const UpdateVehicleInput = z.object({
  makeId: Uuid.optional(), year: …, pricePaise: …, description: …,
  // ↑ no `status`. no `dealerId`. no `creditHeld`. no `approvedAt`.
}).strict();
```

So a dealer sending `PATCH /v1/dealer/vehicles/{id} { "status": "APPROVED" }`
gets a **400 naming the field**, not a silently ignored key and certainly not a
published car. There is a test for it (`tests/listing-lifecycle.test.ts`, "forged
`status`").

Neither half is sufficient alone. Contracts stop clients; the state machine stops
your own future code.

## 11.5 Where `transition()` is actually called

```
admin.service.ts:756   transition(listing, 'APPROVE',         'ADMIN')
admin.service.ts:854   transition(listing, 'REJECT',          'ADMIN')
admin.service.ts:941   transition(listing, 'REQUEST_CHANGES', 'ADMIN')
admin.service.ts:1002  transition(listing, 'TAKEDOWN',        'ADMIN')
vehicles.service.ts:468 transition(previous, 'RESUBMIT',      'DEALER')
vehicles.service.ts:552 transition(listing,  'MARK_SOLD',     'DEALER')
vehicles.service.ts:625 transition(listing,  'RENEW',         'DEALER')
```

Seven call sites, every one of them inside a transaction.

> **Honest gap worth knowing.** The **first** submit of a vehicle does *not* call
> `transition`. It creates the listing directly:
>
> ```ts
> const listing = previous
>   ? await tx.listing.update({ where: { id: previous.id },
>                               data: { status: transition(previous, 'RESUBMIT', 'DEALER'), … } })
>   : await tx.listing.create({ data: { vehicleId, dealerId, status: 'PENDING_REVIEW', … } });
> ```
>
> `RULES.SUBMIT` has `from: []` and exists, as its comment says, "so the guard
> list has a single home" — but nothing consults it on the create path. The
> DEALER-only restriction for a first submit is enforced by the *route* instead
> (`requireDealerActive` + `requirePermission('listing:submit')` on a
> `/v1/dealer` mount, which an admin session cannot reach). The effect is the
> same today; the layering is inconsistent, and it is worth knowing before you
> assume `transition` sees every state change.

`EXPIRE` is the other one: `listings.expire-sweep` writes `status: 'EXPIRED'`
directly rather than through `transition(…, 'EXPIRE', 'SYSTEM')`.

## 11.6 `displayStatus` — the derived field

Two models carry status; the UI shows one badge. That reconciliation is computed
**once, in the API**:

```ts
export function displayStatus(vehicle: Pick<Vehicle,'status'>, listing: Pick<Listing,'status'> | null): DisplayStatus {
  if (!listing) return 'DRAFT';
  if (vehicle.status === 'SOLD') return 'SOLD';
  switch (listing.status) {
    case 'PENDING_REVIEW':     return 'PENDING';
    case 'CHANGES_REQUESTED':  return 'CHANGES_REQUESTED';
    case 'REJECTED':           return 'REJECTED';
    case 'EXPIRED':            return 'EXPIRED';
    case 'REMOVED':            return 'REMOVED';
    case 'SOLD':               return 'SOLD';
    case 'APPROVED':           return 'ACTIVE';
    default:                   return 'DRAFT';
  }
}
```

The docblock states why it is not computed in the client:

> Computed once, here, in the API. If two clients ever derived it independently
> they would disagree, and the disagreement would be about whether a dealer's car
> is live.

The label and colour come along too, from `packages/contracts`
(`DISPLAY_STATUS_LABELS`, `DISPLAY_STATUS_TONES`), so the console and any future
client render the same words.

---
---

# Part 12 — Public visibility

## 12.1 The one rule

```
A car is publicly visible  ⟺  listing.status === 'APPROVED'
                            AND dealer.status === 'ACTIVE'
```

`CONTEXT.md` rule 6. And it is evaluated in exactly **one place**.

## 12.2 The truth table

| Dealer status | Listing status | Public? | Why |
|---|---|---|---|
| `ACTIVE` | `APPROVED` | ✅ **yes** | both conditions hold |
| `SUSPENDED` | `APPROVED` | ❌ no | the business is not allowed to trade |
| `PENDING_APPROVAL` | `APPROVED` | ❌ no | not yet vetted (and this state cannot really arise — a non-ACTIVE dealer cannot submit) |
| `DRAFT` | `APPROVED` | ❌ no | onboarding incomplete |
| `REJECTED` | `APPROVED` | ❌ no | application refused |
| `ACTIVE` | `PENDING_REVIEW` | ❌ no | not moderated yet |
| `ACTIVE` | `CHANGES_REQUESTED` | ❌ no | sent back |
| `ACTIVE` | `REJECTED` | ❌ no | refused |
| `ACTIVE` | `EXPIRED` | ❌ no | ran out of time |
| `ACTIVE` | `SOLD` | ❌ no | gone |
| `ACTIVE` | `REMOVED` | ❌ no | taken down by an admin |
| `ACTIVE` | *(no listing)* | ❌ no | still a draft vehicle |

## 12.3 Why this must be central

Imagine it evaluated per-endpoint. Then the rule appears in:

`GET /v1/vehicles` (search) · `/v1/vehicles/facets` · `/v1/vehicles/{idOrSlug}` ·
`/v1/vehicles/{id}/similar` · `/v1/home` · `/v1/dealers` · `/v1/dealers/{slug}` ·
`POST /v1/vehicles/batch` · `POST /v1/vehicles/{id}/reveal-contact` ·
`sitemap.ts` · every count label the UI renders.

Eleven places. **Miss one and a suspended dealer's inventory is still selling
cars.** Get the count wrong on one and the page says "24 cars" above a grid of 18.

## 12.4 How the code actually does it

The rule is evaluated once, in `search.repository.ts`'s `index()` function, and
its *result* is membership in the `listing_search` table:

```ts
async index(listingId: string, client = prisma): Promise<boolean> {
  const listing = await client.listing.findUnique({ where: { id: listingId }, include: {…} });

  const publishable =
    listing &&
    listing.status === 'APPROVED' &&          // ← rule 6, half one
    listing.dealer.status === 'ACTIVE' &&     // ← rule 6, half two
    listing.vehicle.deletedAt === null &&
    listing.vehicle.status !== 'SOLD' &&
    listing.vehicle.slug !== null &&
    listing.vehicle.pricePaise !== null &&
    listing.vehicle.kmDriven !== null;

  if (!publishable) {
    await this.remove(listingId, client);     // ← DELETE FROM listing_search
    return false;
  }
  …
  await client.$executeRaw`INSERT INTO listing_search (…) VALUES (…)
                           ON CONFLICT (listing_id) DO UPDATE SET …`;
  return true;
}
```

Three properties fall out of this shape:

1. **`index()` re-derives publishability from scratch every time.** It never
   trusts the current state of `listing_search`.
2. **It is idempotent.** `ON CONFLICT … DO UPDATE` means running it twice is
   harmless — which matters because the job queue *will* run it twice.
3. **Failing the rule is a `DELETE`, not a no-op.** So the same function both
   publishes and unpublishes. There is no separate "hide this" path that could
   diverge.

The extra conditions beyond rule 6 are integrity guards: a listing whose vehicle
has no price or no mileage would render as `₹— / — km` on a card, so it is simply
not published.

Every public read then queries the read model:

```sql
SELECT … FROM listing_search WHERE …          -- search
SELECT … FROM listing_search WHERE vehicle_slug = $1 LIMIT 1   -- detail page
SELECT … FROM listing_search WHERE vehicle_id  = $1 LIMIT 1    -- reveal-contact
SELECT city_slug, count(*) FROM listing_search GROUP BY 1      -- city counts
```

**Membership in that table *is* public visibility.** A public endpoint cannot get
the rule wrong because it never evaluates the rule.

And `CONTEXT.md` rule 6's second sentence — *"Every public count is derived from
those same rows — no count is stored"* — means the "18 cars in Katpadi" label and
the grid below it are literally the same query.

## 12.5 Write model vs read model

```
   WRITE MODEL (normalized)                      READ MODEL (denormalized)
   ────────────────────────                      ─────────────────────────
   dealers                                       listing_search
     └─ listings                                   ├─ listing_id (PK)
          ├─ vehicles                              ├─ dealer_name, dealer_slug,
          │    ├─ makes                            │  dealer_initials
          │    ├─ models                           ├─ make_name, model_name,
          │    ├─ variants                         │  variant_name (+ slugs)
          │    ├─ colors                           ├─ price_paise, km, year,
          │    ├─ cities                           │  fuel, transmission, body_type
          │    └─ vehicle_media ─ media            ├─ city_slug, city_name, lat, lng
          └─ credit_transactions                   ├─ features text[]
                                                   ├─ photo_count, primary_media_id,
   correctness first:                              │  primary_blurhash
    · foreign keys                                 └─ search_doc tsvector (GENERATED)
    · CHECK constraints
    · transactions                                query shape first:
    · one fact in one place                        · one flat row per visible car
                                                   · GIN on search_doc + features
   6-table join per search ✗                       · btree on (city_slug, price_paise)
                                                   · trigram on make+model (typos)
```

**The trade-off, stated honestly:** the read model is **eventually consistent**.
A moderator clicks Approve; the listing row is `APPROVED` immediately; the
`listing_search` row appears when the outbox drains — up to ~2 seconds later
(the publisher polls every 2 s). For a used-car marketplace, two seconds between
"approved" and "live" is invisible. For a bank balance it would not be, which is
why the *credit ledger* is not eventually consistent — it is transactional.

**Knowing which parts of your system tolerate eventual consistency, and which do
not, is most of what "designing for scale" actually means.**

## 12.6 Suspend a dealer → every car disappears. One job.

This is the payoff of centralising the rule.

```
Admin clicks "Suspend" on Velavan Cars (18 approved listings)
        │
        ▼
admin.service.setDealerStatus(admin, dealerId, 'SUSPENDED', reason, 'dealer.suspended')
        │
        ├── withTransaction:
        │     UPDATE dealers SET status='SUSPENDED', suspendedAt=now(), statusReason=…
        │     audit.record(tx, { action: 'dealer.suspended', before, after })
        │     enqueueOutbox(tx, { type: 'DealerSuspended', aggregateId: dealerId })
        │   COMMIT
        ▼
OutboxPublisher (2s poll) → EventBus.publish('DealerSuspended')
        │
        ├── bus.on('DealerSuspended') → queue.send('search.reindex-dealer', { dealerId })
        └── bus.on('DealerSuspended') → queue.send('notification.dealer-reviewed', { dealerId })
        ▼
job 'search.reindex-dealer':
    const listingIds = await search.listListingIdsForDealer(dealerId);
    for (const id of listingIds) await search.index(id);
        │
        ▼
    index() re-derives:  dealer.status === 'ACTIVE'?  → NO
        │
        ▼
    DELETE FROM listing_search WHERE listing_id = $1     ×18
        │
        ▼
    18 cars vanish from search, facets, city counts, the dealer directory,
    the homepage, the sitemap, and every "N cars" label — simultaneously.
```

**And the listings themselves are untouched.** They are still `APPROVED` rows in
the `listings` table with their `expiresAt`, their credit consumption, their
history.

So reinstating is symmetric:

```
Admin clicks "Reinstate" → status='ACTIVE'
        → DealerReinstated → search.reindex-dealer
        → index() re-derives: APPROVED ✓ ACTIVE ✓  → INSERT … ON CONFLICT DO UPDATE
        → all 18 cars return
```

**No listing is re-approved. No moderator re-reviews anything. No credit is
re-charged.** That is what "evaluated once, in one place" buys you, and it is why
`CONTEXT.md` §5 calls it out specifically:

> `search.index(listingId)` re-derives publishability from scratch and deletes
> the row when it fails, which is why suspending a dealer removes their cars and
> reinstating brings them back without re-approving anything.

Pinned by `tests/public-visibility.test.ts` — "rule 6 both ways incl.
suspend/reinstate".

## 12.7 Rule 7 — the dealer's phone number

Adjacent, and worth stating here: a dealer's phone number **never appears in an
ordinary public response**. Only `POST /v1/vehicles/:id/reveal-contact` returns
one, and it is rate-limited twice over (per-IP hourly window in memory, per-IP
daily count from the database) and recorded as a `PhoneReveal` **and** as a
`CALL_BUTTON` enquiry in the dealer's inbox.

The test for this is delightfully brutal: it scans **whole public responses for
every phone number in the database**.

---
---

# Part 13 — Background jobs, the outbox, and pg-boss

## 13.1 Why `await sendEmail()` is not enough

```js
// ❌
app.post('/listings/:id/approve', async (req, res) => {
  await Listing.updateOne({ _id }, { status: 'APPROVED' });
  await sendEmail(dealer.email, 'Your listing is live');   // 2–8 seconds
  await searchIndex.upsert(listing);                       // may throw
  res.json({ ok: true });
});
```

Five distinct problems:

1. **Latency.** The moderator waits for an SMTP handshake. Approving 40 listings
   in a shift becomes 5 minutes of staring at spinners.
2. **Coupling to third-party uptime.** SendGrid is down → *approval fails*. The
   business action is blocked by a notification.
3. **No retry.** Transient SMTP failure → the dealer is never told, and there is
   no record that it was supposed to happen.
4. **Partial failure.** Email sends, search index throws. Now: is the listing
   approved? Yes. Is it findable? No. Was the dealer told it is live? Yes.
5. **The rollback problem.** If any of it is inside a transaction and the
   transaction rolls back, you have already sent an email about something that
   did not happen. You cannot un-send an email.

## 13.2 The shape that fixes it

```
   HTTP request
        │
        ├──── BEGIN TRANSACTION ──────────────────────────────┐
        │      · UPDATE listings SET status='APPROVED'        │
        │      · INSERT credit_transactions (CONSUME_APPROVE) │ ALL
        │      · UPDATE dealers SET creditBalance, creditsHeld│ OR
        │      · INSERT audit_logs                            │ NONE
        │      · INSERT outbox_events  ← the side effect      │
        ├──── COMMIT ─────────────────────────────────────────┘
        │
        ▼
   200 OK to the moderator            ← ~40ms, no third party involved
        │
        │  ┄┄┄┄ asynchronously, ≤2s later ┄┄┄┄
        ▼
   OutboxPublisher polls outbox_events
        │
        ▼
   EventBus.publish(ListingApproved)
        │
        ├──▶ queue.send('search.index-listing')
        └──▶ queue.send('notification.listing-reviewed')
                 │
                 ▼
             pg-boss worker: retries 3×, exponential backoff
                 │
                 ├── search.index(listingId)   → listing_search row
                 └── mailer.send(…)            → console (DEV) / Resend (later)
```

## 13.3 The transactional outbox — the key idea

The problem the outbox solves is called **dual write**: you need to change your
database *and* notify something outside it, atomically. You cannot — they are
different systems with no shared transaction.

**The trick:** don't write to the outside system. Write a row to *your own
database, in the same transaction*, saying that you intend to.

```ts
// platform/events/bus.ts
/**
 * Writes the event into the outbox **inside the caller's transaction**.
 *
 * Without this, "save the listing, then send the email" has two failure modes:
 * an email for a listing that rolled back, or a listing saved with no email.
 * One table, and it makes the side effect exactly as durable as the state
 * change that caused it.
 *
 * Payloads carry ids, never PII — the handler re-fetches.
 */
export async function enqueueOutbox(tx: Tx, write: OutboxWrite): Promise<void> {
  const event: DomainEvent = { id: randomUUID(), type: write.type, version: 1,
    occurredAt: new Date().toISOString(), aggregateType, aggregateId, dealerId,
    actor: write.actor, traceId: write.traceId, payload: write.payload };
  await tx.outboxEvent.create({ data: { …, payload: event as Prisma.InputJsonObject } });
}
```

Note the two design choices in the docblock:

- **It takes `tx`.** You cannot enqueue outside a transaction. Same discipline as
  `moveCredits`.
- **Payloads carry ids, never PII.** `{ listingId, vehicleId }`, not the dealer's
  phone number. Because (a) the row sits in a table and might be dumped in a
  backup, and (b) by the time the handler runs, the data may have changed — so
  the handler re-fetches and works with what is true *now*.

The `traceId` travels in the envelope, so a log line from a job three seconds
later can be correlated with the HTTP request that caused it.

### The publisher

```ts
// platform/events/outbox-publisher.ts
async function drain(): Promise<number> {
  const rows = await prisma.$queryRaw`
    SELECT id, payload FROM outbox_events
     WHERE "publishedAt" IS NULL AND attempts < 10
     ORDER BY id
     LIMIT 50
     FOR UPDATE SKIP LOCKED`;                       // ← the important clause

  for (const row of rows) {
    try {
      await bus.publish(row.payload as DomainEvent);
      await prisma.outboxEvent.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
    } catch (error) {
      logger.error({ err: error, outboxId: String(row.id) }, 'outbox publish failed');
      await prisma.outboxEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    }
  }
  return rows.length;
}
```

**`FOR UPDATE SKIP LOCKED`** is what makes this safe to run on N instances: each
poller locks the rows it takes, and every other poller *skips* those rows instead
of blocking. No coordination, no leader election, no duplicate delivery from the
publisher itself.

`attempts < 10` is the poison-message guard — a row that keeps throwing stops
being retried rather than jamming the queue forever.

`ORDER BY id` preserves causal order within a batch.

### Delivery semantics — **at-least-once**

If `bus.publish()` succeeds but the `publishedAt` update fails (process killed
mid-drain), the row is re-delivered on the next poll. **Every handler must be
idempotent**, and the file that registers them says so:

> Every handler here is idempotent and assumes it will run twice; payloads carry
> ids, never PII, and each handler re-fetches what it needs.

Look at how that is achieved:
- `search.index()` → `INSERT … ON CONFLICT DO UPDATE` — running twice is a no-op
- `settleCapturedPayment` → checks `idempotencyKey` first — running twice adds
  zero credits
- `notification.*` → sends a second email. **Not idempotent**, but the failure
  mode is a duplicate email, which is annoying rather than dangerous.

## 13.4 The event bus

```ts
export function createEventBus(): EventBus {
  const handlers = new Map<DomainEventType, EventHandler[]>();
  return {
    on(type, handler) { … },
    async publish(event) {
      for (const handler of handlers.get(event.type) ?? []) {
        try { await handler(event); }
        catch (error) {
          // Rule: a subscriber never throws into the publisher.
          logger.error({ err: error, eventType: event.type, eventId: event.id }, 'event subscriber failed');
        }
      }
    },
  };
}
```

In-process, synchronous within one `publish`. The rule in the catch block matters:
one failing subscriber must not prevent the others from running, and must not
make the publisher think the event failed.

**Why an event bus at all rather than the outbox calling jobs directly?** Because
of ARCHITECTURE §5.5 rule 5: *`listings` never calls `search.index()` — it
publishes `ListingApproved` and search subscribes.* The listings module does not
know that a search index exists. Add a "notify the buyer who saved this car"
feature later and you subscribe to the same event; you do not edit
`admin.service.ts`.

The 22 event types are enumerated in `DomainEventType` — fixing that vocabulary
early is cheap; changing it after forty side-effecting flows is not.

## 13.5 pg-boss

```ts
const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
```

A job queue that lives in **your Postgres**, in its own schema. You get: retries
with exponential backoff, priorities, cron scheduling, dead-lettering, and
`FOR UPDATE SKIP LOCKED` job claiming across workers.

```ts
export const JOB_NAMES = [
  'media.process', 'media.gc-orphans',
  'search.index-listing', 'search.remove-listing', 'search.reindex-dealer',
  'notification.enquiry-to-dealer', 'notification.listing-reviewed',
  'notification.dealer-reviewed', 'notification.invoice',
  'listings.expire-sweep', 'counters.reconcile',
] as const;

/** Highest priority is the lead notification. It is the product (§14.5). */
const PRIORITIES: Partial<Record<JobName, number>> = {
  'notification.enquiry-to-dealer': 100,
  'media.process': 50,
  'search.index-listing': 50,
  'search.remove-listing': 50,
};

await boss.send(name, data, { priority: …, retryLimit: 3, retryBackoff: true });
```

**Why priority 100 on the lead notification:** a buyer enquiring about a car is
*the entire value proposition* of the marketplace to a dealer. If a media
re-encode queue is 400 jobs deep, the lead must not wait behind it. The target is
p95 under 30 seconds (ARCHITECTURE §14.5).

### Cron schedules — IST, because the dealers are in Tamil Nadu

```ts
export async function registerSchedules(queue: Queue): Promise<void> {
  await queue.schedule('listings.expire-sweep', '15 2 * * *');   // 02:15 IST
  await queue.schedule('counters.reconcile',    '30 3 * * *');   // 03:30 IST
  await queue.schedule('media.gc-orphans',      '0 3 * * *');    // 03:00 IST
}
```

with `{ tz: 'Asia/Kolkata' }` passed to `boss.schedule`.

### Why pg-boss and not Redis/BullMQ

| | BullMQ + Redis | pg-boss |
|---|---|---|
| New infrastructure | a Redis instance to run, secure, monitor, back up | **none** |
| Transactional enqueue | ✗ — Redis is a different system, so you need an outbox anyway | ✓ (still uses the outbox, but the queue itself is in the same DB) |
| Durability | depends on AOF/RDB configuration | Postgres WAL |
| Throughput | far higher | more than enough here |
| Ops burden | a second stateful thing to page about | none |

At this volume — a few thousand jobs a day — Postgres is not remotely stressed.
The day it is, the `Queue` interface is four methods and swapping the
implementation is contained.

## 13.6 The inline queue — how tests stay fast and deterministic

```ts
export function createInlineQueue(): Queue {
  const handlers = new Map<JobName, (data) => Promise<void>>();
  return {
    async send(name, data) {
      const handler = handlers.get(name);
      if (!handler) return;
      try { await handler(data); } catch (e) { logger.error({ err: e, job: name }, 'inline job failed'); }
    },
    …
  };
}
```

Chosen by `JOBS_ENABLED=false`, which is what `vitest.config.ts` sets. The
comment says why it is *not* fire-and-forget:

> a test that submits a listing must be able to assert on what the subscriber
> wrote, on the next line, without a sleep.

Combined with `h.drain()` in the harness:

```ts
async drain() {
  // A handler can enqueue further work, so drain until the table is quiet.
  for (let pass = 0; pass < 10; pass += 1) {
    if ((await container.outbox.drain()) === 0) return;
  }
}
```

one `drain()` runs the **whole chain**: outbox → bus → job handler →
`listing_search`. No `setTimeout`, no flake.

## 13.7 `WORKER_INLINE=true` — the current model, and what changes

```ts
// container.ts
export async function startBackground(container: Container): Promise<void> {
  if (env.STORAGE_DRIVER !== 'local') await ensureBucket();
  if (!env.JOBS_ENABLED) return;
  await container.queue.start();
  if (env.WORKER_INLINE || env.WORKER) await registerSchedules(container.queue);
  container.outbox.start();
}
```

**Today:** the same Node process serves HTTP *and* runs job handlers *and* polls
the outbox. `pnpm dev` is one command, which is the point.

**The cost, stated plainly in `CONTEXT.md` §12.5:**

> There is no separate worker process yet. […] `env.WORKER` exists but only
> decides whether cron schedules are registered. […] **Until then, scaling the API
> horizontally would run the job handlers N times over.**

Concretely, if you run 3 API instances today:

- 3 outbox pollers — **safe**, because of `FOR UPDATE SKIP LOCKED`
- 3 sets of pg-boss workers — **safe**, pg-boss claims jobs exclusively
- 3 cron registrations — pg-boss dedupes schedules by name, so probably fine
- but a slow `media.process` job now competes with HTTP request handling for the
  same event loop, and a memory spike from `sharp` can degrade API latency

**What production needs** (ARCHITECTURE §19.1, and it is a small piece of work):

```
one image, two process types:
  CMD ["node", "apps/api/dist/index.js"]   ← WORKER_INLINE=false, JOBS_ENABLED=true (send only)
  CMD ["node", "apps/api/dist/worker.ts"]  ← builds the container, calls startBackground(), never listens
```

`worker.ts` **does not exist**. That is the remaining work.

## 13.8 The eleven jobs

| Job | Trigger | What it does | Idempotent? |
|---|---|---|---|
| `media.process` | commit | sharp re-encode, EXIF strip, derivatives (320/640/1024/1600), blurhash | yes — re-derives from the original |
| `media.gc-orphans` | cron 03:00 | delete `PENDING` media nobody committed | yes |
| `search.index-listing` | `ListingApproved` | re-derive publishability, upsert | yes — `ON CONFLICT DO UPDATE` |
| `search.remove-listing` | `ListingRejected`/`Removed`/`Expired`/`VehicleSold`/`ListingSubmitted` | `DELETE FROM listing_search` | yes |
| `search.reindex-dealer` | `DealerSuspended`/`Rejected`/`Reinstated`/`Approved` | re-index every listing of that dealer | yes |
| `notification.enquiry-to-dealer` | `EnquiryCreated`, `PhoneRevealed` | **priority 100** — email + SMS to the owner | no (duplicate email) |
| `notification.listing-reviewed` | `ListingApproved`/`Rejected`/`ChangesRequested` | email the dealer with the reason verbatim | no |
| `notification.dealer-reviewed` | `DealerApproved`/`Suspended` | email the owner | no |
| `notification.invoice` | `CreditsPurchased` | email the invoice number | no |
| `listings.expire-sweep` | cron 02:15 | `APPROVED` past `expiresAt` → `EXPIRED`, unindex, refresh `activeListings` | yes |
| `counters.reconcile` | cron 03:30 | ledger-drift / held-drift / orphan-approval checks (§10.8) | yes |

Notice `bus.on('ListingSubmitted', unindex)`: submitting a *resubmission* of a
previously-approved listing pulls it out of the catalogue immediately. Correct —
it is under review again, so it is not live.

---
---

# Part 14 — File uploads and object storage

## 14.1 The naive approach

```js
// ❌
app.post('/vehicles/:id/photos', upload.single('photo'), async (req, res) => {
  const path = `/uploads/${req.file.filename}`;   // req.file is on THIS server's disk
  await Vehicle.updateOne({ _id }, { $push: { photos: path } });
  res.json({ path });
});
```

Why it does not survive contact with production:

1. **Every byte goes through your API process.** A dealer uploading twelve 8 MB
   phone photos pushes 96 MB through a process whose job is to answer JSON in
   40 ms. Ten dealers doing that at once saturates the box.
2. **Container filesystems are ephemeral.** Deploy → new container → **the photos
   are gone**. `env.ts` refuses to start in production with
   `STORAGE_DRIVER=local` for exactly this reason:
   `'must be `r2` in production — container filesystems are not durable.'`
3. **It does not scale horizontally.** Instance 1 has the photo; instance 2
   serves the request; 404.
4. **Blocked event loop.** Parsing multipart bodies and buffering 8 MB is real
   CPU and real memory pressure.
5. **You cannot serve them well.** No CDN, no cache headers, no image variants.

## 14.2 The presigned-URL pattern

The insight: **your server does not need to touch the bytes to control the
upload.** It only needs to grant *permission* to upload a specific object, of a
specific type, of a specific size, for a short time.

```
  ┌─────────┐         ┌────────────┐        ┌──────────┐        ┌───────────┐
  │ Browser │         │  Next BFF  │        │   API    │        │  Storage  │
  └────┬────┘         └─────┬──────┘        └────┬─────┘        └─────┬─────┘
       │  1. compress to 2400px, q0.85           │                    │
       │     (client-side, before anything)      │                    │
       │                                         │                    │
       │  2. POST /api/dealer/media/presign      │                    │
       │     { ownerType, ownerId, mimeType,     │                    │
       │       bytes, width, height, fileName }  │                    │
       │────────────▶│                           │                    │
       │             │ 3. POST /v1/dealer/media/presign               │
       │             │    (forwards dd_session)  │                    │
       │             │──────────────────────────▶│                    │
       │             │                           │ 4. verify vehicle  │
       │             │                           │    belongs to the  │
       │             │                           │    SESSION's dealer│
       │             │                           │ 5. check ≤20 photos│
       │             │                           │ 6. INSERT media    │
       │             │                           │    status=PENDING  │
       │             │                           │    dealerId FROM   │
       │             │                           │    THE SESSION     │
       │             │                           │ 7. presignPut ────▶│
       │             │                           │    key, contentType│
       │             │                           │    contentLength   │
       │             │                           │◀── signed URL      │
       │             │◀── { mediaId, uploadUrl,  │                    │
       │             │      headers, expiresIn } │                    │
       │◀────────────│                           │                    │
       │                                                              │
       │  8. PUT <uploadUrl>  ── the bytes go HERE, direct ───────────▶│
       │     Content-Type / Content-Length exactly as signed          │
       │◀───────────────────────────── 200 ───────────────────────────│
       │                                                              │
       │  9. POST /v1/dealer/media/{id}/commit    │                   │
       │─────────────────────────────────────────▶│                   │
       │                                          │ 10. HEAD key ────▶│
       │                                          │◀── { bytes, type }│
       │                                          │ 11. bytes match?  │
       │                                          │     no → FAILED + │
       │                                          │     422 MISMATCH  │
       │                                          │ 12. upsert        │
       │                                          │     vehicle_media │
       │                                          │ 13. queue.send(   │
       │                                          │     'media.process')│
       │◀── { status: 'PROCESSING', poll, ~6s } ──│                   │
       │                                                              │
       │  14. poll GET /v1/dealer/media/{id} until status READY        │
```

## 14.3 Why the presign step exists at all

Because a signed URL is the server saying: *"whoever holds this may PUT exactly
this object, of exactly this content-type, of exactly this length, for the next
5 minutes."*

```ts
export interface StoragePort {
  /**
   * A URL the browser PUTs the bytes to directly. The API never touches image
   * bytes on the upload path. Content-type **and** content-length are baked
   * into the signature, so a client cannot upload something other than what it
   * declared (§12.1).
   */
  presignPut(input: { key: string; contentType: string; contentLength: number;
                      expiresInSeconds?: number }): Promise<PresignedUpload>;
  head(key: string): Promise<StoredObject | null>;
  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
  /** Short-lived signed read. The only way a KYC document is ever served. */
  signedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}
```

Read the emphasis: **content-type AND content-length are baked into the
signature.** That is not decoration.

- Without `contentType` in the signature, a client could presign for
  `image/jpeg` and upload `text/html` — and if your media route serves it back
  with the declared type, you have **stored XSS on your own domain**.
- Without `contentLength`, a client declares 200 KB and uploads 4 GB. You pay the
  storage bill and the quota check was meaningless.

## 14.4 Why `commit` exists

Because the presign response is the **last thing the API hears** until the client
comes back. Between step 7 and step 9, the API knows nothing. The client might:

- never upload at all
- upload something and then crash before committing
- lie about having uploaded
- upload a 0-byte file

So commit **verifies**:

```ts
async commit(dealerId: string, mediaId: string, position?: number) {
  const media = await prisma.media.findFirst({ where: { id: mediaId, dealerId } });  // ← tenant check
  if (!media) throw new NotFoundError('That upload does not exist.');

  const object = await storage.head(media.storageKey);            // ← ask STORAGE, not the client
  if (!object) throw new DomainError('UPLOAD_MISSING', 'The upload did not complete. Try again.');

  if (object.bytes !== media.bytes) {
    await prisma.media.update({ where: { id: mediaId }, data: { status: 'FAILED' } });
    throw new DomainError('UPLOAD_MISMATCH', 'The uploaded file does not match what was declared.');
  }
  …
  await queue.send('media.process', { mediaId });
}
```

**Nothing here trusts the client.** The size comes from a `HEAD` against storage.
The `dealerId` comes from the session. The media row was created at presign time
with the tenant already stamped on it.

And even after that, the docblock is explicit:

> Never trust `Content-Type` — the worker checks magic bytes and fully re-encodes.

`media.process` runs the bytes through `sharp`, which will fail on anything that
is not really an image, strips EXIF (which contains **GPS coordinates** — a
dealer's home address, if they photographed the car at home), and produces
derivatives at 320/640/1024/1600 plus a blurhash. A re-encoded JPEG cannot carry
a polyglot payload.

## 14.5 The three deployments, one contract

```ts
export function createStorage(): StoragePort {
  return env.STORAGE_DRIVER === 'local' ? createLocalStorage() : createS3Storage();
}
```

| Driver | Implementation | Where PUT terminates | Used for |
|---|---|---|---|
| `local` | `local.adapter.ts` | `PUT /uploads?…&signature=…` on the API itself | the test suite (`vitest.config.ts` sets it) |
| `minio` | `s3.adapter.ts` | `localhost:9000` | local development (`docker-compose.yml`) |
| `r2` | **the same** `s3.adapter.ts` | Cloudflare R2 | production |

`minio` and `r2` are the *same adapter*. Only `S3_ENDPOINT` and the keys differ —
which is the whole claim this seam has to keep true.

**The local adapter is a stand-in, not a shortcut.** Look at what it does:

```ts
presignPut({ key, contentType, contentLength, expiresInSeconds = 300 }) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const signature = sign({ key, contentType, contentLength, expiresAt });   // HMAC
  const params = new URLSearchParams({ key, contentType, contentLength: String(contentLength),
                                       expiresAt: String(expiresAt), signature });
  return Promise.resolve({
    uploadUrl: `${env.API_BASE_URL}/uploads?${params.toString()}`,
    method: 'PUT', headers: { 'Content-Type': contentType, 'Content-Length': String(contentLength) },
    expiresInSeconds,
  });
}
```

It signs, it expires, it constrains type and length, and it verifies with
`timingSafeEqual` on the receiving route. **The contract is identical in all
three deployments**, so a bug in the presign→PUT→commit flow shows up in the test
suite rather than in production.

> **Note on `CONTEXT.md`:** its §11 "Known gaps" table says *"R2 storage adapter
> — not written."* That row is **stale**. §6 of the same file, `env.ts`,
> `factory.ts` and `s3.adapter.ts` all show `STORAGE_DRIVER=r2` is supported by
> the shared S3 adapter. Trust the code.

## 14.6 The client side

`features/vehicle/photo-uploader.tsx` — a `'use client'` component, because it
needs `File`, `FileReader`, `canvas` and `XMLHttpRequest` progress events.

```ts
const MAX_EDGE = 2400;
const QUALITY = 0.85;
const POLL_INTERVAL_MS = 1200;
const POLL_LIMIT = 25;
```

> Photos are pre-compressed to a 2400px longest edge at q0.85 before presign,
> which is what makes a 12MB phone photo an acceptable upload on a yard's 4G.

That is a product decision encoded in a constant: the dealer is standing in a car
yard on a mobile connection, and a 12 MB upload will fail.

The presign call goes through a **BFF handler**, not directly to the API:

```ts
// app/api/dealer/media/presign/route.ts
/**
 * The upload itself goes **direct from the browser to object storage** — that
 * is the whole point of the presigned PUT, and it is why 10MB photos never
 * touch this server. Only the signing call is proxied, because it needs the
 * API base URL and the session.
 */
```

That is rule 9 (`no unnecessary NEXT_PUBLIC_*`) in action: the browser never
learns `API_BASE_URL`, so the signing call must be proxied. The *upload* is not
proxied — it goes to whatever `uploadUrl` the API returned.

## 14.7 KYC documents are different

`MediaOwner` includes `DEALER_DOCUMENT`. Those objects are stored under a separate
prefix and — per the schema comment — **have no public delivery route at all**.
The only way one is served is `signedReadUrl(key, expiresInSeconds)`, a
short-lived signed read, and every issue of one is audit-logged.

That is the correct treatment for a GST certificate or a PAN card.

## 14.8 One CSP trap worth knowing

`CONTEXT.md` §9:

> **helmet's `Cross-Origin-Resource-Policy: same-origin`** blocks cross-origin
> image embedding. The media delivery route sends `cross-origin` — what a real
> R2/Cloudflare origin sends — on that route only. The JSON API keeps the strict
> default.

A one-line header, and without it every image on the site is broken the moment
media moves to its own hostname.

---
---

# Part 15 — Payments

## 15.1 What is real and what is not — say this out loud

> **`PAYMENT_PROVIDER=development` is the only implemented provider. There is no
> Razorpay adapter, no gateway page, no webhook endpoint, and no real money has
> ever moved through this system.**

What *is* production-grade is the **accounting**: append-only ledger, row
locking, materialised `balanceAfter`, GST invoice with a sequence-backed number,
idempotency key. `CONTEXT.md` §6 is careful about this distinction, and so should
you be:

> One thing is still deliberately not real — the payment gateway. **It does not
> weaken the security model**, and that distinction matters if you are about to
> "finish" it.

## 15.2 The port, shaped for the gateway that does not exist yet

```ts
/**
 * PaymentProvider
 *   ├── DevelopmentPaymentProvider   ← active now
 *   └── RazorpayProvider             ← drops in behind the same interface
 *
 * The shape of this port is dictated by what Razorpay will need, not by what
 * the development provider needs, so adding the real gateway later is wiring
 * rather than a redesign.
 */
export interface GatewayOrder {
  gatewayOrderId: string;
  /** `immediate` settles inline; `webhook` waits for the gateway to call back. */
  settlement: 'immediate' | 'webhook';
  capture?: GatewayCapture;      // present only when settlement is 'immediate'
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(request: CreateOrderRequest): Promise<GatewayOrder>;
  /**
   * Confirms what the browser reports. It never credits — it reads and
   * reports, because the browser can be closed, throttled, or lying.
   */
  verifyClientHandshake(input: { gatewayOrderId: string; paymentId?: string; signature?: string }): boolean;
}
```

The `settlement` discriminator is the whole design. It lets **one caller** handle
both worlds:

```ts
if (gateway.settlement === 'immediate' && gateway.capture) {
  await settleCapturedPayment(order.id, gateway.capture);
}
```

The development provider says `immediate` and supplies a synthetic capture.
Razorpay will say `webhook` and supply nothing — and the same `if` simply does
not fire.

## 15.3 The flow as implemented today

```
Dealer clicks "Buy 20 credits"
        │
        ▼
POST /v1/dealer/billing/orders  { packId }      ← packId ONLY. no amount.
        │
        │  billing.service.createOrder()
        │  ┌──────────────────────────────────────────────────────────┐
        │  │ pack   = creditPack.findFirst({ id: packId, isActive })  │  ← server prices it
        │  │ gst    = config.number('billing.gstPercent')             │  ← from platform_config
        │  │ amount = pack.pricePaise                                 │
        │  │ tax    = amount * gst / 100                              │  ← BigInt arithmetic
        │  │ total  = amount + tax                                    │
        │  └──────────────────────────────────────────────────────────┘
        │
        ▼
   INSERT orders (status=PENDING, credits, amountPaise, taxPaise, totalPaise,
                  gateway='development')
        │
        ▼
   payments.createOrder({ orderId, dealerId, credits, totalPaise, currency:'INR', notes })
        │
        │  DevelopmentPaymentProvider:
        │    gatewayOrderId = 'dev_order_<14 hex>'
        │    settlement     = 'immediate'
        │    capture        = { gatewayPaymentId: 'dev_pay_<14 hex>', method: 'development',
        │                       amountPaise, rawPayload: { note: 'Settled locally —
        │                       no payment gateway was contacted.' , … } }
        ▼
   UPDATE orders SET gatewayOrderId = …
        │
        ▼
   settlement === 'immediate'  →  settleCapturedPayment(order.id, capture)
        │
        ▼  ┌───────────── withTenant(prisma, dealerId, tx) ──────────────────┐
           │ idempotencyKey = `order:${order.id}:capture`                    │
           │ already = creditTransaction.findUnique({ idempotencyKey })      │
           │ if (already) return { creditsAdded: 0, replay: true }  ◀────────┼── replay guard
           │                                                                 │
           │ payment.upsert({ where: { gatewayPaymentId }, … CAPTURED })     │
           │ order.update({ status: 'PAID', paidAt: now })                   │
           │ moveCredits(tx, { delta: +credits, reason: 'PURCHASE',          │
           │                   orderId, idempotencyKey })   ← FOR UPDATE     │
           │ invoice.create({ number: nextInvoiceNumber(tx), gstin,          │
           │                  placeOfSupply: '33', … })                      │
           │ enqueueOutbox(tx, { type: 'CreditsPurchased', … })              │
           └─────────────────────────────────────────────────────────────────┘
        │
        ▼
   201 { orderId, gatewayOrderId, credits, totalLabel: '₹2,360', autoCaptured: true }
        │
        ▼
POST /v1/dealer/billing/orders/{id}/verify   ← reads only, NEVER credits
        │
        ▼
   { verified: true, orderStatus: 'PAID', creditsAdded: 20, creditBalance: 24,
     invoice: { id, number }, message: '20 credits added — payment captured.' }
```

## 15.4 Why the client saying "payment succeeded" must never add credits

Because the client is not a trusted participant. It is:

- **a browser you do not control** — DevTools, `curl`, a modified extension
- **unreliable** — closed tabs, dead batteries, lost signal on a yard's 4G,
  aggressive mobile-browser tab suspension

Both matter, and they push in opposite directions:

| If you credit on the client's word | If you *only* credit on the gateway's word |
|---|---|
| `POST /orders/{id}/verify` with a forged `paymentId` = free credits | forged calls do nothing |
| a genuine payment where the tab died = **paid, no credits, angry dealer** | the webhook arrives regardless of what the browser did |

So the design rule:

```ts
/**
 * C19 verify. This endpoint **never credits** — it confirms the handshake
 * and reports the current state. With a real gateway the webhook is the
 * only writer; with the development provider the write already happened
 * during `createOrder`, and this still only reads (§26.4).
 */
async verifyOrder(dealerId, orderId, input): Promise<VerifyOrderResponse> {
  const order = await prisma.order.findFirst({ where: { id: orderId, dealerId }, … });  // ← tenant-scoped
  if (!order) throw new NotFoundError('That order does not exist.');

  const verified = payments.verifyClientHandshake({ gatewayOrderId: order.gatewayOrderId ?? '', … });
  if (!verified) throw new DomainError('SIGNATURE_MISMATCH', 'That payment could not be verified.');

  if (order.status !== 'PAID') {
    return { verified: true, orderStatus: order.status, creditsAdded: 0,
             creditBalance: order.dealer.creditBalance, invoice: null,
             pollAfterSeconds: 2,
             message: 'Payment received. Your credits will appear in a few seconds.' };
  }
  return { verified: true, orderStatus: 'PAID', creditsAdded: order.credits, … };
}
```

**That `pollAfterSeconds` branch is already written and already documented** — it
is the branch a real Razorpay integration takes while waiting for the webhook.
`CONTEXT.md` §12.2 point 4:

> `settlement: 'deferred'` on the gateway response makes `verifyOrder` return
> **202** with `pollAfterSeconds`. That branch is already written and documented.
> Credits appear when the webhook lands, never because a client said so.

Also note: **the amount is never accepted from the client.** `CreateOrderInput`
is `z.object({ packId: Uuid }).strict()`. The comment in `billing.service.ts`:
*"the server prices the pack and computes GST, because a client-supplied amount
is how marketplaces give inventory away."*

## 15.5 Webhooks — what they are, and why they are the only trustworthy signal

A **webhook** is the gateway calling *you*, server to server, when something
happens. It bypasses the browser entirely, which is why it is the source of
truth:

```
   Browser        Razorpay        Your API
      │  pay         │               │
      │─────────────▶│               │
      │              │               │
      │  ◀───────────│ "success!"    │   ← the browser may never deliver this
      │  (tab closes here)           │
      │              │               │
      │              │  POST /v1/webhooks/razorpay
      │              │  X-Razorpay-Signature: <HMAC-SHA256 of raw body>
      │              │──────────────▶│   ← THIS always arrives, and is signed
```

**Verification** (for when it is written): compute
`HMAC-SHA256(rawBody, WEBHOOK_SECRET)` and compare with `timingSafeEqual`. Note
`rawBody` — you must verify the **exact bytes** received, before JSON parsing,
because `JSON.parse` + `JSON.stringify` is not byte-identical. That means a
`express.raw()` body parser on that route only.

Without signature verification your webhook endpoint is a public "add credits"
API.

## 15.6 Idempotency

Gateways retry. Razorpay will deliver the same `payment.captured` event several
times if it does not get a `200` quickly enough. Networks duplicate. Your own
job queue is at-least-once.

**So the same event must be safe to process twice.** Two layers exist:

**(a) The `WebhookEvent` table — insert first, ask questions later**

```prisma
/// Gateway idempotency. Every webhook is INSERTed first; a duplicate delivery
/// collides on gatewayEventId and is acknowledged without re-running anything.
model WebhookEvent {
  gatewayEventId String @unique
  eventType String
  payload   Json
  processedAt DateTime?
  attempts  Int @default(0)
  error     String?
}
```

The pattern: `INSERT` the event row **before** doing anything. A duplicate hits
the unique constraint, you catch it, and you return `200` without re-running the
settlement. Cheap, and it works because uniqueness is the database's job.

> **NOT IMPLEMENTED:** the model exists; no code writes to it. There is no
> webhook route.

**(b) The ledger idempotency key — the belt to the webhook's braces**

```ts
const idempotencyKey = `order:${order.id}:capture`;
const already = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
if (already) {
  return { creditsAdded: 0, balanceAfter: already.balanceAfter, replay: true, order };
}
```

backed by `idempotencyKey String? @unique` on `CreditTransaction`. Even if the
webhook layer failed *and* `settleCapturedPayment` ran twice concurrently, the
second `INSERT` would violate the unique index and abort its transaction.

`replay: true` is returned rather than an error — a replay is a **success**, just
one that changed nothing.

## 15.7 Where Razorpay plugs in — the whole checklist

From `CONTEXT.md` §12.2, and every seam already exists:

1. `platform/payments/razorpay.provider.ts` implementing `PaymentProvider`:
   `createOrder`, `verifyClientHandshake`, and a webhook verifier.
2. `POST /v1/webhooks/razorpay`, **raw-body** signature check. **INSERT the
   `WebhookEvent` first** — a duplicate collides on `gatewayEventId` and is
   acknowledged without re-running anything.
3. Route the capture into the existing `settleCapturedPayment`. *"That function
   is already the only path that adds purchased credits… Do not add a second
   one."*
4. `settlement: 'deferred'` makes `verifyOrder` return **202** with
   `pollAfterSeconds` — already written.
5. Refunds: `admin:payment:refund` exists in the permission table with **no
   endpoint behind it**.

Then `PAYMENT_PROVIDER=razorpay` in the environment. `env.ts` already accepts the
value; `container.ts` line 105 is the one line that changes.

## 15.8 Invoicing

```ts
const number = await nextInvoiceNumber(tx);          // from invoice_number_seq
await tx.invoice.create({ data: {
  number, dealerId, orderId, paymentId,
  credits, amountPaise, taxPaise, totalPaise,
  status: 'CAPTURED',
  gstin: order.dealer.gstin,
  placeOfSupply: '33',                                // Tamil Nadu's GST state code
  pdfMediaKey: `invoices/${number}.pdf`,
} });
```

Invoice numbers come from a **database sequence**, not a `COUNT(*) + 1`. Indian
GST rules require a unique, sequential, unbroken series per financial year — a
count-based scheme produces duplicates the moment two invoices are created
concurrently.

> **Note:** `pdfMediaKey` is written but **no PDF is generated**. The path is
> reserved.

---
---

# Part 16 — Zod contracts

## 16.1 Why TypeScript alone is not enough

```ts
interface CreateVehicleInput { makeId: string; year: number; }

app.post('/vehicles', (req, res) => {
  const body = req.body as CreateVehicleInput;   // ❌ a LIE
  createVehicle(body.makeId, body.year);
});
```

**TypeScript types are erased at compile time.** They do not exist at runtime.
`as CreateVehicleInput` is not a check — it is you telling the compiler to stop
asking questions. The actual value could be `null`, a string, an array, or an
object with a `year` of `"; DROP TABLE"`.

```
   TypeScript ──▶ compile-time safety
                  · catches YOUR mistakes, in YOUR code
                  · gone by the time the server runs
                  · says nothing about data arriving over a socket

   Zod ────────▶ runtime safety
                  · catches THEIR data
                  · runs on every request
                  · AND infers the TypeScript type, so there is one definition
```

The last point is the reason Zod specifically:

```ts
export const CreateVehicleInput = z.object({ … }).strict();
export type  CreateVehicleInput = z.infer<typeof CreateVehicleInput>;
//     ↑ same name, one is the runtime validator, one is the static type
```

You cannot let them drift, because the type is *derived from* the validator.

## 16.2 `packages/contracts` as the single source of truth

One schema, four consumers:

```
                       packages/contracts/src/*.ts
                                   │
        ┌──────────────┬───────────┴───────────┬──────────────────┐
        ▼              ▼                       ▼                  ▼
  API validates   API/web types          OpenAPI document    tests parse
  validate({      import type            docs/schemas.ts     responses
    body: X })    { X } from …           z.toJSONSchema()    X.parse(res.body)
```

Seven files, ~2,200 lines: `common.ts` (ids, pagination, `ProblemDetails`, all
the Indian formatting), `enums.ts`, `public.ts`, `dealer.ts`, `admin.ts`,
`auth.ts`, `index.ts`.

The formatting helpers live here too, and for the same reason:

```ts
/** `64500000` paise -> `₹6.45 Lakh`. Two decimals, always (DESIGN-SPEC §4.14). */
export function formatLakh(paise: bigint | number): string { … }
```

> All of it lives here rather than in either app, because DESIGN-SPEC §4.14 fixes
> the exact forms and a second implementation is a second set of rounding rules.

There is even a note about `formatDate` using a literal month table rather than
`toLocaleString`, because current ICU renders September as "Sept" and would put a
four-letter month in a column the design sized for three. That level of care is
what "one source of truth" means in practice.

## 16.3 The request path

```
POST /v1/dealer/vehicles
        │
        ▼
validate({ body: CreateVehicleInput })
        │
        ├── CreateVehicleInput.safeParse(req.body)
        │      ├── success → req.valid.body = result.data   (parsed, coerced, defaulted)
        │      └── failure → issues.push(...withSource(result.error.issues, 'body'))
        │
        ▼
next(new ZodError(issues))     ← ALL issues from ALL sources at once
        │
        ▼
errorHandler → 400 VALIDATION_FAILED with a populated errors[]
```

`withSource` prefixes each issue path so `errors[].field` reads `body.pricePaise`
rather than `pricePaise` — which matters when a request has both a bad body field
and a bad query parameter.

And the caller sees **all** their mistakes at once, not one per round trip.

## 16.4 The response path

Responses are **typed** by the contracts (`Promise<InventoryResponse>`), and
**parsed** by them in the test suite:

```ts
// tests/contracts.test.ts — 24 tests
// "every response parsed through packages/contracts"
```

That is the real enforcement. If a service returns a field the contract does not
declare, or omits one it does, the contract test fails — which means the OpenAPI
document (generated from the same schema) is also correct.

The API does **not** run responses through Zod at runtime in production. That is
a deliberate cost decision: validate untrusted input always; validate your own
output in CI.

## 16.5 `.strict()` — the most important four characters

```ts
z.object({ … })          // unknown keys are SILENTLY STRIPPED
z.object({ … }).strict() // unknown keys are an ERROR
```

`CONTEXT.md` rule 2: *"An unknown field or query parameter is a 400 that names
the field. Silent ignoring hides client bugs for months."*

### Failure mode A — the security one

```json
POST /v1/dealer/vehicles
{ "makeId": "…", "modelId": "…", "year": 2021, "fuel": "PETROL",
  "transmission": "MANUAL", "bodyType": "SUV",
  "dealerId": "<another dealership's uuid>" }
```

**Without `.strict()`:** Zod strips `dealerId` and the request succeeds. Fine —
*today*. But the protection now depends on nobody ever writing
`repo.create({ ...input })` with a spread. The day someone does, tenant isolation
is gone and nothing failed loudly.

**With `.strict()`:**

```json
{ "status": 400, "code": "VALIDATION_FAILED", "traceId": "V1StGXR8_Z",
  "errors": [ { "field": "body.dealerId", "code": "UNRECOGNIZED_KEY",
                "message": "`dealerId` is not a recognised field." } ] }
```

The attempt is **loud**. It shows up in logs. It is greppable. An attacker
probing for mass-assignment gets a wall.

Same for `{"status": "APPROVED"}` (§11.4) and `{"creditBalance": 9999}`.

### Failure mode B — the client-bug one

```
GET /v1/vehicles?colour=white
                  ↑ British spelling; the schema says `color`
```

**Without `.strict()`:** 200 OK, and a page of cars in every colour. The frontend
developer is convinced the filter is broken server-side. Two days of debugging.

**With `.strict()`:** 400 naming `query.colour`. Thirty seconds of debugging.

### The bug in the error messages, and its fix

`CONTEXT.md` §10.2 — a real bug worth knowing because it shows what "naming the
field" costs:

> `.strict()` rejections did not name the field. An unknown query parameter 400'd
> with `field: "query"`. The whole point of `.strict()` is that the caller can
> find their typo.

Zod puts an unrecognised key's name in `issue.keys`, not in `issue.path` — the
path points at the *object* that had the surplus field. So the error handler has
a special case:

```ts
if (issue.code === 'unrecognized_keys') {
  return issue.keys.map((key) => ({
    field: [...base, key].join('.') || key,
    code: 'UNRECOGNIZED_KEY',
    message: `\`${key}\` is not a recognised field.`,
  }));
}
```

One error per stray key, each naming the key.

### The `.strict()` gotchas — both recorded

`CONTEXT.md` §9:

> **`.strict()` rejects `undefined`.** An action with no input must send `{}`,
> not nothing: several endpoints declare an all-optional body. `lib/api.ts`
> defaults non-DELETE bodies to `{}` for exactly this reason.
>
> **`apiSend` with no body silently 400s** if you bypass that default. This was a
> real bug: admin Approve did nothing at all.

```ts
// apps/web/src/lib/api.ts
const payload = method === 'DELETE' ? body : (body ?? {});
```

And for the Postman collection: optional query parameters are emitted
`disabled: true`, because *"the API is `.strict()`, so an empty `?q=` is a filter
for the empty string, not the absence of a filter."*

## 16.6 Coercion — where the boundary actually is

```ts
export const CursorQuery = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
```

A query string carries `?limit=20` — **the string `"20"`**. `z.coerce.number()`
converts it. `.default(20)` supplies a value when the parameter is absent.

So `InventoryQuery` has two distinct shapes:

| | shape |
|---|---|
| **input** (pre-parse) | `{ cursor?: string; limit?: string \| number }` |
| **output** (post-parse) | `{ cursor?: string; limit: number }` |

That distinction is exactly why the OpenAPI generator does two conversions
(§17.2), and getting it backwards documents `?limit=` as required and
`page.limit` as optional — precisely inverted.

## 16.7 Domain rules in the schema

```ts
pricePaise: z.number().int().min(1000).max(500_000_000_00).optional(),
//                     ↑ paise. min ₹10, max ₹5,00,00,000. `.int()` rejects
//                       fractional paise — there is a test for it.
year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
kmDriven: z.number().int().min(0).max(1_000_000).optional(),
ownerNumber: z.number().int().min(1).max(9).optional(),
description: z.string().trim().max(4000).nullish(),
features: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
```

Every bound is a decision. `max(40)` features stops a dealer pasting a novel into
an array that ends up in a GIN index. `.trim()` normalises before storage so
`"Sunroof "` and `"Sunroof"` are one facet value, not two.

---
---

# Part 17 — OpenAPI

## 17.1 What OpenAPI is

A machine-readable description of an HTTP API: every path, method, parameter,
request body, response shape and error code, as one JSON/YAML document. From it
you can generate interactive documentation (Swagger UI), client SDKs, Postman
collections, and contract tests.

Served here at:

```
http://localhost:4000/api/docs               Swagger UI
http://localhost:4000/api/docs/openapi.json
http://localhost:4000/api/docs/openapi.yaml
```

73 operations, 68 paths, 143 component schemas. **`DOCS_ENABLED` defaults off in
production** — the document is a useful map for a developer and an equally useful
one for anyone probing your live API.

## 17.2 The chain

```
   packages/contracts/src/*.ts     (Zod schemas)
              │
              │  docs/schemas.ts — z.toJSONSchema()
              │    io: 'input'   for bodies / queries / params
              │    io: 'output'  for responses
              ▼
   components.schemas  (143 entries)
              │
              │  docs/openapi.ts — assembles module *.docs.ts contributions
              │    parameters ← expanded from the same Zod schema
              │    security   ← derived from the MOUNT POINT
              │    errors     ← from docs/errors.ts
              ▼
   openapi.json / openapi.yaml
              │
              ├──▶ Swagger UI at /api/docs
              │
              └──▶ docs/postman.ts  →  73 requests, 10 folders, 21 variables
                                        committed, byte-compared in CI
```

**The schemas are converted, not transcribed.** That sentence is the whole point:

> The contracts package is already the single source of truth… Converting those
> same Zod schemas is therefore the only way the reference can be *wrong the same
> way the code is wrong*, which is the only kind of documentation worth having.
> Nothing here is transcribed by hand, so a renamed field cannot drift out of the
> docs.

## 17.3 The two conversions

```ts
const INPUT_SCHEMA_NAMES = [
  'IdParam','SlugParam','IdOrSlugParam','DocTypeParam','ConfigKeyParam',
  'CursorQuery','HomeQuery','VehicleQuery', … ,
  'CreateVehicleInput','UpdateVehicleInput','MarkSoldInput', … ,
] as const;
```

| | `io: 'input'` | `io: 'output'` |
|---|---|---|
| Used for | request bodies, query strings, path params | responses |
| Timing | **pre**-parse | **post**-parse |
| `.default(20)` | field is **optional** | field is **required** |
| `z.coerce.number()` | accepts `string` (what a query string carries) | is `number` |

The partition is kept **explicit** rather than inferred from a name pattern,
because a silent misclassification is worse than a list you have to extend. And
the builder **throws** if `INPUT_SCHEMA_NAMES` names a schema contracts no longer
exports — so the list cannot go stale unnoticed.

## 17.4 Everything derivable is derived

Per-operation prose lives in `modules/<name>/<name>.docs.ts`, **beside the
routes** — so when you change a route you are looking at its documentation.

Everything else is computed:

- **parameters** expand from the same Zod schema `validate()` parses with
- **security** comes from the mount point (`/v1/dealer/**` → `dealerSession`,
  `/v1/admin/**` → `adminSession`)
- **error bodies** come from `docs/errors.ts`

## 17.5 The test that makes this real

`tests/openapi.test.ts` — 12 tests, and it guards **both** failure modes:

1. **Nothing invented.** Every documented operation is *called against the running
   app* and must not reach the not-found middleware. If you document
   `GET /v1/dealer/widgets` and no such route exists, the test fails.
2. **Nothing missed.** The Express router tree is *walked* to prove no route is
   undocumented.

> **If you add a route, that test fails until you document it. That is the
> intended cost.**

(Express 5 compiles mount paths into matcher functions and does not keep the
string, so the coverage test works around it — there is a comment there.)

## 17.6 The Postman collection

`docs/postman/dealers-drive.postman_collection.json` + `…_environment.json`.
73 requests, 10 folders, 21 variables, generated by `pnpm docs:postman` **from the
OpenAPI document**, so there is still only one description of the API.

It is **committed** so a tester can import it without running a build — and that
is exactly why `tests/postman.test.ts` regenerates it and compares it
**byte-for-byte**. A route change without `pnpm docs:postman` fails there.

Three things the generator does that a plain OpenAPI import does not:

1. **`{id}` is not one variable.** `PATH_VARIABLES` maps each path pattern to a
   semantically named variable — `vehicleId`, `listingId`, `orderId`,
   `documentType`, `publicVehicleId`, `vehicleSlug`, `dealerSlug` — because a
   shared `{{id}}` sends a listing id to a vehicle endpoint. `CAPTURES` then fills
   them from real responses, so `Run all` works from a clean seed.
2. **Destructive requests run last**, and `DELETE /v1/dealer/vehicles/{id}` points
   at `disposableVehicleId`, which nothing sets. Both were learned the hard way: a
   full run deleted the draft the media and listing folders still needed.
3. **Every response is asserted against the error contract** — any status ≥ 400
   must be `application/problem+json` with `code`, `traceId`, a matching `status`,
   and no `stack`.

That third assertion is what found the bug in `CONTEXT.md` §10.6 (a client
mistake reported as a 500 with the failing SQL attached) — *"found by the Postman
run's error-contract assertion, not by a human reading responses, which is the
argument for that assertion."*

**Thirteen requests are non-2xx on a clean run and all thirteen are correct** —
`CLEAN_RUN_NOTES` appends the reason to each description, because a tester who
reads a 409 as a broken collection debugs the wrong thing. (A collection cannot
PUT the file a presign was issued for, so both `commit` steps 422
`UPLOAD_MISSING`, and the draft therefore has no photos.)

**A Postman run mutates the database** — it buys credits, changes
`listing.minPhotos`, suspends and reinstates the dev dealer, deletes a KYC
document. Re-seed afterwards.

## 17.7 Why this prevents drift

The classic failure: `docs/api.md` written by hand, drifting one field at a time
until nobody trusts it and everyone reads the code instead. Then the docs are
worse than useless — they are actively misleading.

Here there is **no second copy**:

| Question | Answered by |
|---|---|
| what fields does this accept? | the Zod schema |
| what does the API validate? | the same Zod schema |
| what does the doc say? | generated from the same Zod schema |
| what does Postman send? | generated from the doc |
| does the doc match reality? | `tests/openapi.test.ts`, both directions |
| does Postman match the doc? | `tests/postman.test.ts`, byte-for-byte |

---
---

# Part 18 — Next.js architecture

## 18.1 What changes when React runs on a server

**The MERN mental model:**

```
Browser downloads an empty <div id="root"> + 400 KB of JavaScript
  → React mounts
  → useEffect fires
  → fetch('/api/vehicles')
  → setState
  → render
```

Three consequences you may not have had to care about before:

1. **Google's crawler sees an empty div** (or waits, unpredictably, for JS). For
   a marketplace whose customers arrive from a search for "used Swift Vellore",
   that is fatal.
2. **The user sees a spinner** for the round trip, then a layout shift.
3. **Your API base URL, and every key baked into the bundle, is public.**

**The App Router model:** components are **Server Components by default**. They
run on the server, `await` data directly, and stream HTML. Only components that
opt in with `'use client'` ship JavaScript.

## 18.2 Server Components vs Client Components

| | Server Component (default) | Client Component (`'use client'`) |
|---|---|---|
| Runs | on the server, at request/build time | on the server once (SSR) **and** in the browser |
| Can `await` a database/API directly | ✅ | ❌ |
| Ships JS to the browser | ❌ none | ✅ its bundle |
| `useState` / `useEffect` / `onClick` | ❌ | ✅ |
| `window`, `localStorage`, `File` | ❌ | ✅ |
| Can read secrets / cookies server-side | ✅ | ❌ |
| Good for | pages, data fetching, layout, SEO | interactivity |

The rule in `CONTEXT.md` rule 8:

> **Server components by default.** `'use client'` needs a reason: an event
> handler, a browser API, or `localStorage`.

## 18.3 A public page, in full

```tsx
// apps/web/src/app/(public)/cars/page.tsx

/** RSC + ISR 60s + SWR. Filters live in the URL, so every state renders (§15.1). */
export const revalidate = 60;

export async function generateMetadata({ searchParams }): Promise<Metadata> {
  const params = await searchParams;
  const cities = await apiGet<CitiesResponse>('/v1/cities', { revalidate: 60 });
  const cityName = cities.data.find(e => e.slug === params.city)?.name ?? 'Tamil Nadu';
  return {
    title: `Used cars in ${cityName}`,
    description: `Browse verified used cars in ${cityName} …`,
    ...seoMetadata({ kind: 'cars', city, hasFilters: hasFilterParams(toApiQuery(params)) }),
  };
}

export default async function CarsPage({ searchParams }) {
  const raw    = await searchParams;
  const params = toApiQuery(raw);
  const query  = new URLSearchParams(params).toString();

  const [results, facets, cities] = await Promise.all([          // ← parallel, server-side
    apiGet<VehicleListResponse>(`/v1/vehicles?${query}`,        { revalidate: 60 }),
    apiGet<FacetsResponse>(`/v1/vehicles/facets?${query}`,      { revalidate: 60 }),
    apiGet<CitiesResponse>('/v1/cities',                        { revalidate: 60 }),
  ]);

  return ( … <VehicleCard … /> … );
}
```

Everything to notice:

- **`async` component.** No `useEffect`, no loading state, no `useQuery`.
- **`Promise.all`** — three API calls in parallel, on the server, on a fast
  network next to the API.
- **`revalidate = 60`** — ISR. The rendered HTML is cached for 60 seconds and
  served instantly to everyone; after 60s the next request triggers a
  regeneration in the background (stale-while-revalidate).
- **`generateMetadata`** — the `<title>` and `<meta description>` are computed
  from the same data, server-side, so the crawler gets a filled-in page.
- **Filters live in the URL**, not in state. `?city=katpadi&fuel=PETROL` is a
  linkable, shareable, indexable, back-button-correct URL. This is the single
  biggest architectural difference from a client-side filter UI.

## 18.4 Why public pages must be server-rendered

For this product it is existential. The buyer's journey starts at Google:

```
   Google: "used swift vellore"
        ↓
   /car/2021-maruti-swift-vxi-vellore-a3f8
        ↓
   The crawler must receive:
     <title>2021 Maruti Suzuki Swift VXi — ₹6.45 Lakh — Vellore</title>
     <meta name="description" content="…">
     <link rel="canonical" href="…">
     <script type="application/ld+json">{ "@type": "Car", … }</script>
     …the actual price, mileage, photos in the HTML
```

A client-rendered page delivers `<div id="root"></div>` and a hope. B2C
marketplaces live and die on organic search.

The VDP page shows the full pattern:

```tsx
export const revalidate = 60;

async function loadVehicle(slug: string): Promise<VehicleDetail | null> {
  try {
    return await apiGet<VehicleDetail>(`/v1/vehicles/${encodeURIComponent(slug)}`, { revalidate: 60 });
  } catch (error) {
    // A5 404s when the listing is not APPROVED, the dealer is not ACTIVE, or the
    // vehicle is soft-deleted. All three are "this car is not for sale here".
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }) {
  const vehicle = await loadVehicle((await params).slug);
  if (!vehicle) return { title: 'Car not found' };
  return {
    title: { absolute: vehicle.seo.title },     // the API composed the whole title
    description: vehicle.seo.description,
    ...seoMetadata({ kind: 'resolved', canonical: vehicle.seo.canonical,
                     isIndexable: vehicle.seo.isIndexable }),
    openGraph: { … },
  };
}
```

**The indexability decision comes from the API**, because the API knows things the
page does not — such as whether the car sold more than 30 days ago. One policy
resolver (`lib/seo.ts`), used everywhere.

## 18.5 The dealer console — dynamic, and its own guard

```tsx
// apps/web/src/app/(dealer)/dealer/layout.tsx
export const dynamic = 'force-dynamic';

export default async function DealerLayout({ children }) {
  const dealer = await requireDealer();
  return ( … sidebar with dealer.creditBalance … {children} … );
}

async function requireDealer(): Promise<DealerProfile> {
  try {
    return await apiGet<DealerProfile>('/v1/dealer', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect((await hasSession()) ? '/dealer/onboarding' : '/dealer/login?error=session_expired');
    }
    throw error;
  }
}
```

Three things:

1. **`force-dynamic`** — never cached. This is per-session data.
2. **The layout is the guard.** Every page beneath it is unreachable without a
   session, and the check is not repeated per page, *so it cannot be forgotten on
   a new page*.
3. **It is a UX guard, not a security guard.** The docblock is explicit:
   *"Authorization itself still happens at the API on every request; this only
   decides which screen a signed-out person sees."*

The 401 branch is worth reading twice:

> The API answers 401 for both "no session" and "signed in, but no dealership
> yet", and deliberately does not distinguish them — that would tell an
> unauthenticated caller which of the two it was. Here the caller's own cookie
> settles it: someone carrying one is finishing sign-up, not signed out.

`hasSession()` is deliberately *not* an authorization check — it says a cookie is
present, not that it is valid, and nothing is shown or hidden on the strength of
it.

## 18.6 The API client — and the caching trap it avoids

`apps/web/src/lib/api.ts`. Read this comment carefully; it describes a real
vulnerability class:

> Because the fetch happens on the Next server rather than in the browser, the
> dealer's `dd_session` cookie is not attached automatically — this file forwards
> it. It does so **only for uncached requests**, which is not a convenience:
> reading a cookie makes a route dynamic, and **attaching a session to a cached
> fetch is how one dealer's console ends up in another's browser.**

```ts
const uncached = options.revalidate === false || method !== 'GET';

if (uncached) {
  init.cache = 'no-store';
  const session = await sessionCookie();
  if (session) init.headers = { ...init.headers, Cookie: `${SESSION_COOKIE}=${session}` };
} else if (typeof options.revalidate === 'number') {
  init.next = { revalidate: options.revalidate, ...(options.tags ? { tags: options.tags } : {}) };
}
```

Session forwarding and caching are **mutually exclusive by construction**. There
is no code path that caches an authenticated response.

`sessionCookie()` swallows the throw from `cookies()`, because during static
generation (the sitemap, cached public pages) there is no request at all — and
that is a legitimate state, not an error.

## 18.7 Server Actions

A **Server Action** is a function marked `'use server'` that a form or a client
component can call, and which **executes on the server**. Next.js handles the RPC.

```tsx
// features/enquiry/actions.ts
'use server';

export async function submitEnquiryAction(_previous: EnquiryFormState, formData: FormData) {
  const parsed = CreateEnquiryInput.safeParse({ … });     // validated HERE too
  if (!parsed.success) return { status: 'error', fieldErrors: … };

  const created = await apiSend<EnquiryCreatedResponse>('POST', '/v1/enquiries', parsed.data, {
    headers: await clientIpHeaders(),                      // ← forward the buyer's IP
  });

  const store = await cookies();
  store.set(ENQUIRY_RESULT_COOKIE, JSON.stringify(created), { httpOnly: true, sameSite: 'lax', maxAge: 600 });
  redirect('/enquiry-sent');
}
```

Why this matters:

> The enquiry form is a real `<form>` posting to this action, so **it works with
> JavaScript disabled** — and because the action runs on the server, the API base
> URL, the buyer's IP and the response never have to be exposed to the browser.

**The IP forwarding is not incidental.** Without `clientIpHeaders()`, every
enquiry and every phone reveal would arrive at the API from the Next server's
single address, and the per-IP limits protecting dealer phone numbers would count
one bucket for the entire internet.

And for auth specifically:

> All three are Server Actions rather than browser fetches, for one reason: the
> session cookie has to be set and cleared server-side. **No token is ever handed
> to client JavaScript** — there is nothing in `localStorage`, nothing in a React
> state atom, and nothing a script on the page could read.

`apiSignIn()` is the one function that reads the API's *response headers*, because
the cookie must be re-issued by the Next origin — the fetch happened server-side,
so nothing reached the browser on its own. It returns the cookie rather than
setting it, keeping `lib/api.ts` free of `next/headers` side effects.

## 18.8 BFF handlers — only where the browser genuinely must fetch

**BFF = Backend For Frontend.** A thin server-side endpoint that exists to serve
one client.

There are seven, and each has a stated reason:

| Handler | Why the browser must call it |
|---|---|
| `/api/dealer/media/presign` | the uploader needs a signed URL mid-flow, in JS |
| `/api/dealer/media/[id]` | delete a photo without a full page navigation |
| `/api/dealer/documents/presign`, `…/[type]/commit` | same, for KYC |
| `/api/dealer/enquiries` | inbox tab switching without a reload |
| `/api/dealer/invoices/[id]` | streams a file download |
| `/api/vehicles/batch` | hydrates saved-car ids from `localStorage` — only the browser knows them |

Each one forwards the session (via `apiSend`, which reads the cookie server-side)
and translates `ApiError` back into `application/problem+json`.

**Why not call the API directly from the browser?** Rule 9 — no unnecessary
`NEXT_PUBLIC_*`. If `NEXT_PUBLIC_API_URL` existed, it would be baked into the
JavaScript bundle at build time, which breaks build-once-promote-many (the same
artifact must be deployable to dev and production).

## 18.9 When to use which — real examples from this repo

**Server Components:**

| File | Why |
|---|---|
| `(public)/cars/page.tsx` | SEO, ISR, three parallel fetches |
| `(public)/car/[slug]/page.tsx` | SEO-critical, JSON-LD, `generateMetadata` |
| `(dealer)/dealer/layout.tsx` | reads a cookie, guards the subtree |
| `(admin)/admin/**` | server-only data, `no-store` |
| `app/sitemap.ts`, `app/robots.ts` | built at request time from live data |

**Client Components:**

| File | The specific reason |
|---|---|
| `features/vehicle/photo-uploader.tsx` | `File`, `canvas`, `XMLHttpRequest` progress |
| `features/saved/saved-store.tsx` | `localStorage` |
| `components/search/search-toolbar.tsx` | `useSearchParams`, `onChange` |
| `features/enquiry/enquiry-form.tsx` | `useActionState` for pending/error UI |
| `components/vehicle/gallery.tsx` | click-to-change-image state |
| `features/admin/review-actions.tsx` | confirm dialogs, optimistic UI |

## 18.10 Two Next.js traps recorded in `CONTEXT.md`

**`useSearchParams` needs a Suspense boundary.** §10.5:

> `/cars` could not prerender — `useSearchParams` in the header with no Suspense
> boundary. The boundary now wraps the city chip alone.

Any client component reading `useSearchParams` forces the whole subtree to be
dynamic. Wrapping *just that component* in `<Suspense>` lets the rest prerender.

**`'use server'` modules may only export async functions.** §9:

> Constants shared with a server-action module go in a sibling file (see
> `features/enquiry/shared.ts`).

Because every export becomes an RPC endpoint. A constant cannot be one.

---
---

# Part 19 — Security architecture

For every mechanism: **what attack does this prevent?**

## 19.1 Authentication

| Mechanism | File | Attack prevented |
|---|---|---|
| Opaque random session token | `session.service.ts` | token forgery — 32 bytes of CSPRNG is unguessable |
| Only the SHA-256 is stored | `hashToken()` | a leaked DB dump handing over live sessions |
| Token returned exactly once | `issue()` | accidental logging / re-derivation |
| Expiry + revocation in the `WHERE` clause | `resolve()` | acting on a revoked session read a moment ago |
| Principal rebuilt every request | `cookie-session.adapter.ts` | stale privileges after suspension or demotion |
| Separate `DEALER`/`ADMIN` scopes | `sessions.scope` | privilege escalation via session confusion |
| Argon2id, 19 MiB, 2 passes | `password.ts` | GPU brute force of a stolen hash |
| `verifyDecoy()` on unknown email | `password.ts` | timing-based account enumeration |
| Identical message for both login failures | `adminLogin()` | account enumeration via response text |
| `only_admins_have_passwords` CHECK | migration | a dealer row ever growing a password |
| `email_verified !== true` → refuse | `google.provider.ts` | an unverified Workspace address impersonating someone |
| `@@unique(provider, providerSubject)` | schema | two accounts claiming one Google identity |
| `ACCOUNT_LINK_REQUIRED` on email collision | `createIdentity()` | expired-domain account takeover |

## 19.2 OAuth-specific

| Mechanism | Attack prevented |
|---|---|
| `state`, compared to the sealed cookie | **login CSRF** — being signed in as the attacker |
| HMAC-sealed `dd_oauth` cookie | tampering with `returnTo`, `nonce` or `state` |
| `timingSafeEqual` on the HMAC | timing oracle on the signature |
| 10-minute transaction TTL | replay of a captured cookie |
| Cookie cleared on callback, whatever happens | replay of a spent transaction |
| PKCE `S256` | authorization-code interception |
| `nonce` echoed in the `id_token` | ID-token replay from another session |
| `iss` / `aud` / `exp` checks | tokens from another issuer or another app |
| `safeReturnTo()` — path only, no `//`, no `\`, no `\n` | **open redirect** → phishing / token leak |
| `access_type=online` | storing a long-lived refresh token with no use for it |

## 19.3 Authorization

| Mechanism | Attack prevented |
|---|---|
| `requireDealer` / `requireAdmin` on the mount | unauthenticated access to a console |
| `requireDealerActive` per-route | a suspended business continuing to publish |
| `requirePermission` per-operation | a `SALES` seat deleting inventory or buying credits |
| Ownership re-checked inside the write | **TOCTOU** (§8) |
| `dealerId` only from `dealerPrincipal(req)` | cross-tenant access via a parameter |
| 404, never 403, across tenants | **enumeration oracle** |
| `transition(listing, event, actor)` | a dealer approving their own listing |
| `status` absent from every dealer-writable schema | forged state transitions |
| Admin `assertPermission` in the service | a `SUPPORT` admin granting credits |

## 19.4 Sessions and cookies

| Attribute | Attack prevented |
|---|---|
| `HttpOnly` | XSS reading `document.cookie` |
| `Secure` (production) | passive network capture |
| `SameSite=Lax` | **CSRF** — the browser will not attach it to a cross-site POST |
| fixed `Expires` | indefinitely-lived cookies |
| `Domain` only when configured | over-sharing across unrelated subdomains |
| Admin TTL 12h vs dealer 30d | blast radius of a leaked admin session |

## 19.5 CORS

```ts
app.use(cors({ origin: env.webOrigins, credentials: true, maxAge: 86_400 }));
```

**What CORS is:** a *browser-enforced* rule about which origins may read a
cross-origin response. It is not a server-side access control — `curl` ignores it
entirely.

**What it prevents here:** `https://evil.com` running `fetch('https://api.dealers-drive.com/v1/dealer/vehicles', { credentials: 'include' })`
and *reading* the response. The browser blocks it because the origin is not in
the allow-list.

**The critical detail:** `credentials: true` with `origin: '*'` is forbidden by
the spec and would be catastrophic. Here `origin` is an explicit list built from
`WEB_ORIGIN` — one origin in production.

## 19.6 CSRF

**The attack.** You are signed in to `dealers-drive.com`. You visit
`evil.com`, which contains:

```html
<form action="https://api.dealers-drive.com/v1/dealer/vehicles/123" method="POST">
  <input name="…" value="…">
</form>
<script>document.forms[0].submit()</script>
```

The browser attaches your `dd_session` cookie *automatically*, because that is
what cookies do. The request is authenticated. Without a defence, the action
happens.

**The defence here, today:**

1. **`SameSite=Lax`** — the browser will not attach `dd_session` to a cross-site
   POST. This is the primary defence and it is effective in every browser
   released since ~2020.
2. **CORS allow-list** — even for methods `Lax` permits, `evil.com` cannot read
   the response.
3. **`.strict()` JSON contracts** — a form-encoded POST would fail validation
   anyway (a classic CSRF form cannot send `Content-Type: application/json`
   without a preflight, which CORS then blocks).

> **SPEC ≠ CODE / NOT IMPLEMENTED.** ARCHITECTURE §8.2 and API-SPEC §0.3 both
> specify a **double-submit `X-CSRF-Token`**. It does not exist. `CONTEXT.md`
> §12.1: *"Worth adding before any third-party origin is allowed to call the API
> with credentials."* Treat that as a hard prerequisite for widening the CORS
> list.

## 19.7 Rate limiting

```ts
rateLimit('admin-login-ip',    { limit: 20,  windowSeconds: 900 })
rateLimit('admin-login-email', { limit: 5,   windowSeconds: 900, keyBy: email })
rateLimit('enquiries',         { limit: 5,   windowSeconds: 3600 })
rateLimit('public-read',       { limit: 120, windowSeconds: 60 })
rateLimit('vehicles-batch',    { limit: 60,  windowSeconds: 60 })
rateLimit('billing-orders',    { … })
// plus, inside enquiries.service.revealContact:
consumeRateLimit(`reveal-hour:${ip}`, hourlyCap, 3600)   // in-memory hourly
repo.revealsToday(ip) >= dailyCap                        // database-backed daily
```

| Limit | Attack prevented |
|---|---|
| admin-login per email | credential stuffing against one account |
| admin-login per IP | one host grinding many accounts |
| enquiries 5/hour/IP | spam flooding a dealer's inbox |
| public-read 120/min | scraping the catalogue |
| **reveal-contact, twice over** | harvesting every dealer's phone number |

The reveal limit is the one that matters commercially, and the rate-limit file
says so:

> These are a spend control as much as a security control: a phone reveal is the
> thing competitors want, and **every SMS costs real money**.

Note the double defence there: an in-memory hourly window *and* a
database-counted daily cap. The in-memory one survives nothing; the database one
survives a restart and works across instances.

> **Known limitation:** the fixed-window counters live in a process-local `Map`.
> With N instances, a client effectively gets N× the limit, and a restart resets
> every window. The file names the fix (a `CachePort`).

## 19.8 Input and output validation

| Mechanism | Attack prevented |
|---|---|
| `.strict()` on every input schema | mass assignment (`dealerId`, `status`, `creditBalance`) |
| `validate()` before the handler | malformed input reaching business logic |
| `z.string().uuid()` on ids | injection attempts in path params |
| bounded `max()` on strings and arrays | memory exhaustion, index bloat |
| `express.json({ limit: '1mb' })` | body-size DoS |
| responses parsed in `tests/contracts.test.ts` | accidentally leaking an internal field |
| `assertUuid()` before `SET LOCAL` | SQL injection on the one interpolated line |

## 19.9 SQL injection

Prisma parameterises everything by default. The raw SQL uses **tagged templates**:

```ts
await client.$executeRaw`INSERT INTO listing_search (…) VALUES (${listing.id}::uuid, …)`;
```

A tagged template with `$executeRaw` sends the interpolations as **bind
parameters**, not string concatenation. `${userInput}` cannot become SQL.

The one exception is `$executeRawUnsafe` in `withTenant`, because `SET LOCAL`
cannot be parameterised — and it is guarded by a UUID regex with an explanatory
comment. That is the correct handling of a genuine exception.

## 19.10 Secrets and configuration

| Mechanism | Attack prevented |
|---|---|
| `env.ts` validates and freezes at boot | a missing secret discovered at 3 a.m. |
| production refuses `AUTH_MODE=dev` | shipping the auth bypass |
| production refuses `STORAGE_DRIVER=local` | data loss on redeploy |
| production refuses the default `SESSION_SECRET` / `UPLOAD_SIGNING_SECRET` | forgeable OAuth cookies and upload URLs |
| production requires `GOOGLE_CLIENT_ID`/`SECRET` | a sign-in button that 503s |
| no unnecessary `NEXT_PUBLIC_*` | secrets baked into the browser bundle |
| `DOCS_ENABLED` off in production | handing an attacker the full API map |

## 19.11 Logging

```ts
redact: {
  paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
          '*.password', '*.passwordHash', '*.token', '*.otp',
          'password', 'passwordHash', 'token', 'otp'],
  censor: '[redacted]',
}
```

**Attack prevented:** an engineer with log access harvesting live sessions or
password hashes. Logs go to more places than you think — aggregators, backups,
screenshots in tickets.

Also: the OAuth `code` is **never logged**. `google.provider.ts` logs Google's
`error_description` (which "describes the request, not the code") and nothing
else.

## 19.12 Security headers

`helmet()` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
(clickjacking), `Strict-Transport-Security`, a default CSP, and
`Cross-Origin-Resource-Policy: same-origin`.

`app.disable('x-powered-by')` removes the `X-Powered-By: Express` fingerprint.

`app.set('trust proxy', 1)` — **exactly one hop.** Trusting *all* proxies lets a
client spoof `X-Forwarded-For` and defeat every per-IP rate limit; trusting none
makes `req.ip` the load balancer's address and does the same thing.

Two documented CSP exceptions, each scoped to one route: Swagger UI needs a
looser policy; the media delivery route sends `Cross-Origin-Resource-Policy:
cross-origin` so images embed.

## 19.13 Enumeration attacks — the recurring theme

Five separate places in this codebase defend against enumeration:

1. **404 not 403** across tenants — cannot confirm a vehicle id exists
2. **Identical login failures** + `verifyDecoy` timing — cannot confirm an admin
   email exists
3. **The dealer console's 401** does not distinguish "no session" from "no
   dealership"
4. **UUID primary keys** — cannot walk `/vehicles/1`, `/vehicles/2`
5. **Platform-wide enquiry reference sequence** — a per-dealer counter would leak
   each dealer's lead volume to anyone holding two references

## 19.14 Audit logging

Every admin write, inside the transaction, with `actorType`, `actorId`,
`dealerId`, `action`, `entityType`, `entityId`, `before`, `after`, `ip`,
`traceId`.

**What it prevents:** not an attack — *deniability*. When a dealership claims
their listing was wrongly taken down, you can say who, when, from where, with
what reason, and correlate it to the request via `traceId`.

> `GET /v1/admin/audit-logs` and `admin:audit:read` exist and are documented.
> **There is no admin UI for it yet.**

---
---

# Part 20 — Error handling

## 20.1 RFC 9457 — Problem Details

One error shape for the whole API:

```json
{
  "type":    "https://dealers-drive.com/errors/insufficient-credits",
  "title":   "Not enough listing credits",
  "status":  422,
  "code":    "INSUFFICIENT_CREDITS",
  "traceId": "V1StGXR8_Z",
  "detail":  "Publishing this vehicle needs 1 credit. Your balance is 0.",
  "creditBalance": 0,
  "actionLabel":   "Buy credits",
  "actionHref":    "/dealer/billing"
}
```

served as `Content-Type: application/problem+json`.

| Field | Contract? | Purpose |
|---|---|---|
| `type` | stable URI | a documentable link per error class |
| `title` | human | short, stable across occurrences |
| `status` | yes | mirrors the HTTP status |
| **`code`** | **yes — this is the machine contract** | the frontend switches on this, **never** on `detail` |
| `traceId` | yes | the thread back to the logs |
| `detail` | **no** | human prose; may change without notice |
| `errors[]` | yes | per-field `{ field, code, message }` |
| extras | per-code | e.g. `creditBalance` |

**Why a shared envelope at all:** without one, every endpoint invents its own
error shape (`{error: "..."}`, `{message: "..."}`, `{errors: [...]}`), and the
frontend grows a bespoke handler per call site. With one, `ApiError.fieldErrors()`
in `lib/api.ts` maps `errors[]` onto form fields for *every* form in the app:

```ts
fieldErrors(): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const entry of this.problem.errors ?? []) {
    const field = entry.field.replace(/^(body|query|params)\./, '');  // "body.pricePaise" → "pricePaise"
    errors[field] ??= entry.message;
  }
  return errors;
}
```

## 20.2 The status codes, with real examples

| Status | Class | When | Dealers-Drive examples |
|---|---|---|---|
| **400** | `ZodError` | the request does not match the schema | `dealerId` sent → `UNRECOGNIZED_KEY`; `?colour=white`; `pricePaise: 12.5` (fractional paise); malformed JSON → `MALFORMED_BODY` |
| **401** | `UnauthorizedError` | no valid session | missing/expired/revoked cookie → `NOT_AUTHENTICATED`; bad admin password → `INVALID_CREDENTIALS`; OAuth state mismatch → `OAUTH_STATE_INVALID` |
| **403** | `ForbiddenError` | authenticated, not allowed | suspended dealership publishing → `DEALER_NOT_ACTIVE`; `SALES` seat creating a vehicle → `FORBIDDEN`; `SUPPORT` admin granting credits; suspended Google account → `ACCOUNT_SUSPENDED` |
| **404** | `NotFoundError` | does not exist, **or you may not know that it does** | another dealer's vehicle; unpublished listing on a public URL; a `makeId` not in the catalogue → `NOT_IN_CATALOGUE`; any unmatched route |
| **409** | `ConflictError` | collides with current state | `INVALID_TRANSITION` (double approve); `ALREADY_SUBMITTED`; `LOCKED_FOR_REVIEW`; `CANNOT_DELETE_LIVE`; `DEALER_ALREADY_EXISTS`; `PHONE_ALREADY_REGISTERED`; `ACCOUNT_LINK_REQUIRED` |
| **413** | body parser | over 1 MB | `PAYLOAD_TOO_LARGE` |
| **415** | body parser | bad content encoding | `UNSUPPORTED_MEDIA_TYPE` |
| **422** | `DomainError` | well-formed, allowed, but a business rule says no | `INSUFFICIENT_CREDITS`; `TOO_FEW_PHOTOS`; `VEHICLE_INCOMPLETE`; `PROFILE_INCOMPLETE`; `UPLOAD_MISSING`; `UPLOAD_MISMATCH`; `TOO_MANY_PHOTOS`; `UNKNOWN_CITY`; `SIGNATURE_MISMATCH` |
| **429** | `RateLimitError` | over a limit — always with `Retry-After` | 6th enquiry in an hour; 6th admin login attempt; reveal-contact caps |
| **500** | anything else | a bug | unhandled exception. **`detail` omitted in production** |
| **503** | `ConfigurationError` | the API cannot do this because it is not configured | Google sign-in with no client id → `OAUTH_NOT_CONFIGURED` |

### 400 vs 422 — the distinction people get wrong

- **400** = *"I cannot understand this request."* The shape is wrong.
- **422** = *"I understand it perfectly, and the answer is no."* The shape is
  right, the caller is authorized, a business rule refuses.

`{ "packId": "not-a-uuid" }` → **400**.
`{ "packId": "<valid uuid>" }` for a listing you cannot afford → **422**.

The client treats them completely differently: a 400 is a bug in the client; a
422 is a message for the user, often with an action attached.

### 404 vs 403 — see §7.5

## 20.3 The error handler

```ts
export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  // Streaming already started — the only correct move is to destroy the socket.
  if (res.headersSent) { next(error); return; }

  const traceId = getTraceId() ?? nanoid(10);
  const problem = toProblem(error, traceId);

  const logBindings = { traceId, status: problem.status, code: problem.code,
                        method: req.method, url: req.originalUrl };

  if (problem.status >= 500) {
    // TODO(Day 2): Sentry.captureException(error, { tags: { traceId } });
    logger.error({ ...logBindings, err: error }, 'request failed');
  } else {
    logger.warn(logBindings, 'request rejected');
  }

  if (error instanceof RateLimitError) res.setHeader('Retry-After', String(error.retryAfterSeconds));

  res.status(problem.status).type('application/problem+json').json(problem);
}
```

Points worth internalising:

- **5xx logs at `error` with the full `err` object; 4xx logs at `warn` without
  it.** A 422 `INSUFFICIENT_CREDITS` is not an exception — it is the system
  working. Logging it as an error trains everyone to ignore errors.
- **Express 5 forwards rejected promises here automatically**, so `async`
  handlers need no try/catch wrapper. (The handlers still have one, because they
  use the `void (async () => {…})()` pattern.)
- **`Retry-After`** is set from the error, so a client can back off correctly.

## 20.4 Never leak internals

```ts
// Anything else is a bug. Never leak its message in production.
return build(500, 'INTERNAL', traceId,
  env.isProduction
    ? undefined                                       // ← no detail at all
    : error instanceof Error ? error.message : `Non-error thrown: ${String(error)}`,
  undefined, 'Internal server error');
```

**Why.** A raw Prisma error includes the failing SQL, the table names, the column
names, and sometimes the parameter values. That is:

- a **schema map** for an attacker
- a possible **data leak** (parameters may contain another user's data)
- **useless** to the person reading it

The client gets a `traceId`; the engineer greps for it and finds the full stack.

This was a real bug — `CONTEXT.md` §10.6:

> `POST /v1/dealer/vehicles` with a `makeId` that does not exist reached Prisma
> and came back as an unhandled foreign-key error — a 500 with the failing query
> text attached, which is precisely the internal detail rule 9 forbids leaking.

The fix, `findBrokenCatalogueRef`, checks the references *before* Prisma and
404s naming the field:

```ts
throw new NotFoundError(
  `That ${FIELD_LABELS[broken] ?? broken} is not in the catalogue. Pick one from GET /v1/catalog/bundle.`,
  { errors: [{ field: broken, code: 'NOT_IN_CATALOGUE', message: 'Not a known catalogue entry.' }] });
```

And it checks **coherence**, not just existence — a real model id filed under the
wrong make fails too, *because a Kia Seltos under Maruti Suzuki takes search,
filters and SEO down with it.*

## 20.5 `traceId`

```
nanoid(10) at request start
    │
    ├──▶ res.setHeader('x-trace-id', traceId)      ← a dealer can quote it in a support ticket
    ├──▶ AsyncLocalStorage                          ← pino mixin stamps EVERY log line
    ├──▶ every ProblemDetails body
    ├──▶ AuditLog.traceId
    └──▶ DomainEvent.traceId                        ← survives into background jobs
```

A dealer says *"it failed, the id was `V1StGXR8_Z`."* You run
`grep V1StGXR8_Z` (or the equivalent in your log tool) and get **every line** from
that request across every layer, including lines emitted by a job three seconds
later. No correlation id is ever passed by hand.

## 20.6 The error vocabulary

```ts
abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;    // the machine contract
  abstract readonly title: string;
  readonly errors?: FieldError[];
  readonly extra?: Record<string, unknown>;
  get detail(): string { return this.message; }   // RFC 9457 calls it detail; Error calls it message
}
```

with `NotFoundError` (404), `UnauthorizedError` (401), `ForbiddenError` (403),
`ConflictError` (409), `DomainError` (422), `ConfigurationError` (503),
`RateLimitError` (429).

**Services throw these; the error handler is the only thing that turns them into
HTTP.** A service that builds a response, sets a status code, or touches `res` is
doing the error handler's job.

`ConfigurationError` deserves a note — it is written *for the developer*:

```ts
throw new ConfigurationError(
  'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in ' +
  `.env, and register ${env.GOOGLE_CALLBACK_URL} as an authorized redirect URI on the ` +
  'OAuth 2.0 client in the Google Cloud console.',
  { code: 'OAUTH_NOT_CONFIGURED' });
```

> The one error in this module written for a developer rather than a dealer: it
> names the variables and the redirect URI to register.

Because the alternative — a generic 500 — sends them to the logs to learn
something the response could have told them.

---
---

# Part 21 — Observability

**Observability** is the ability to answer questions about a running system that
you did not anticipate when you built it. It has three classic pillars — logs,
metrics, traces — plus health checks and alerting.

**Honest summary for this repo:** *logging is genuinely good; almost everything
that consumes logs is missing.*

## 21.1 Logs

```ts
export const LOGGER_OPTIONS: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: 'dealers-drive-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  redact: { paths: [ … ], censor: '[redacted]' },
  mixin() {
    const context = getContext();
    if (!context) return {};
    return { traceId: context.traceId,
             ...(context.userId ? { userId: context.userId } : {}),
             ...(context.dealerId ? { dealerId: context.dealerId } : {}) };
  },
};
```

**Why structured JSON and not `console.log('user ' + id + ' did thing')`:**

```
# unstructured — you can only grep
2026-08-19 10:15:32 User abc-123 approved listing def-456 in 42ms

# structured — you can QUERY
{"level":"info","time":"2026-08-19T10:15:32.881Z","service":"dealers-drive-api",
 "env":"production","traceId":"V1StGXR8_Z","userId":"abc-123","dealerId":"xyz-789",
 "event":"listing.approved","listingId":"def-456","durationMs":42,"msg":"request completed"}
```

With the second you can ask: *"p95 latency for `POST /v1/dealer/vehicles/:id/submit`
for dealer `xyz-789` over the last hour"* or *"every 5xx with `code:
INVALID_TRANSITION`"*. With the first you can only grep and hope.

**The `mixin` is the best part of this file.** Every log line emitted *anywhere*
inside a request — controller, service, repository, error handler — carries
`traceId`, and `userId`/`dealerId` once auth has run. **No call site ever has to
remember to pass it.**

The `LOGGER_OPTIONS` are exported for a subtle reason stated in the docblock:
pino fixes its destination at construction, so a test builds a *second* logger
from these same options plus a capturing stream — meaning the test asserts on the
real redaction list and the real mixin, not a copy that can drift.

**Named events.** Look for `event:` keys — they are the queryable business
signals:

```
auth.oauth.started · auth.oauth.verified · auth.oauth.failed
auth.session.created · auth.session.revoked
admin.login.success · admin.login.failure
dealer.onboarding.created
```

**The request log line**, from `request-logger.ts`, with one detail worth knowing:

```ts
// Captured now: Express rewrites req.url while routing into a mounted
// router, and 'finish' can fire before it is restored.
const path = req.path;
```

and health probes log at `debug` so `pnpm dev` output stays readable.

## 21.2 Metrics — **NOT IMPLEMENTED**

There is no `/metrics` endpoint, no Prometheus, no StatsD.

`CONTEXT.md` §12.4 names the four that matter for *this* product, and the list is
worth memorising because it is a good example of choosing metrics from the
domain rather than from a dashboard template:

1. **Enquiry-notification latency** — the p95 target is 30 s. *This is the
   product.* A dealer who gets leads late churns.
2. **Moderation queue depth and age** — a listing sitting in `PENDING_REVIEW` is
   a dealer's credit held hostage and a car not earning.
3. **Credit-ledger drift** — `Dealer.creditBalance` vs the newest `balanceAfter`.
   Should always be zero. **Non-zero means a write path bypassed `moveCredits`.**
4. **pg-boss failed-job count** — silent job failure is the worst failure mode,
   because everything looks fine.

Note that 1 and 3 are already *computed* (the reconcile job logs drift; the
notification path is instrumented enough to time). What is missing is somewhere
to put the numbers.

## 21.3 Error tracking — **NOT IMPLEMENTED**

```ts
if (problem.status >= 500) {
  // TODO(Day 2): Sentry.captureException(error, { tags: { traceId } });
  logger.error({ ...logBindings, err: error }, 'request failed');
}
```

`SENTRY_DSN` is accepted and validated by `env.ts`. **No SDK is installed.**
Setting it today does nothing.

Why Sentry (or equivalent) matters beyond logs: it **groups** occurrences of the
same exception, tracks first-seen/last-seen and frequency, captures a stack with
local variables, and alerts on a new error type. Logs tell you *what happened*;
error tracking tells you *what is newly broken and how often*.

The plan, from `CONTEXT.md` §12.4, and the last line is the important one:

> Install `@sentry/node`, initialise it in `index.ts`, and report from the marked
> TODO in `error-handler.ts`. Tag with `traceId` so a report links to the log
> line. **Only 5xx — a 422 `INSUFFICIENT_CREDITS` is not an exception.**

## 21.4 Tracing — **NOT IMPLEMENTED**

**Distributed tracing** follows one logical operation across process boundaries,
producing a waterfall: *request → API 42 ms → DB query 8 ms → job 1.2 s → SMTP
340 ms*.

With one service, the `traceId` in `request-context.ts` plus structured logs gets
you most of the value. OpenTelemetry earns its keep when a second service
appears — and `traceId` is the natural span id when that day comes.

## 21.5 Health checks

```ts
router.get('/live', (_req, res) => { res.json({ status: 'ok' }); });

router.get('/ready', (_req, res, next) => { void (async () => {
  const checks: Record<string, string> = { queue: 'ok', storage: 'ok', gateway: 'ok' };
  try { await container.prisma.$queryRaw`SELECT 1`; checks.database = 'ok'; }
  catch { checks.database = 'down'; }
  const healthy = Object.values(checks).every(v => v === 'ok');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded',
    contracts: CONTRACTS_VERSION, appEnv: env.APP_ENV, checks,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
})(); });
```

| | `/health/live` | `/health/ready` |
|---|---|---|
| Question | is the process alive? | can it serve traffic? |
| Touches dependencies | **never** | yes — `SELECT 1` |
| Failure means | **restart me** | **stop sending me traffic** |
| Used by | container orchestrator / Docker `HEALTHCHECK` | load balancer, deploy gate, uptime monitor |

**Why liveness must not touch the database.** If it did, a 30-second database
blip would fail liveness on *every* instance, the orchestrator would kill them
all, and you would turn a recoverable database hiccup into a full outage — with
a cold-start stampede on top. The comment says exactly this: *"so a database blip
cannot get the container killed and restarted."*

`CONTEXT.md` §12.4: **poll `/health/ready`, not `/health/live`** — readiness names
the failing dependency; liveness deliberately touches nothing.

> **Honest note:** `queue`, `storage` and `gateway` are hardcoded `'ok'`. Only
> the database is actually probed.

The `Dockerfile` already wires liveness correctly:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/ready')…"
```

## 21.6 What should wake an engineer at 3 a.m.

Alerting on the wrong things is worse than not alerting: people learn to ignore
pages.

| Wake someone | Why |
|---|---|
| `/health/ready` failing across all instances | the site is down |
| 5xx rate > 1% sustained | something is broken for real users |
| **Credit-ledger drift non-zero** | money is wrong; every minute makes reconciliation harder |
| Enquiry-notification p95 > 30 s | the product is failing at its one job |
| pg-boss failed-job count climbing | side effects are silently not happening |
| Database connections near the pool limit | about to fall over |
| Payment webhook signature failures | either an attack or a rotated secret |

| Do **not** wake someone | Why |
|---|---|
| a 422 `INSUFFICIENT_CREDITS` | the system worked |
| a 404 on `/v1/dealer/vehicles/<random>` | isolation worked |
| a 429 | the rate limiter worked |
| a single 500 | look at it in the morning |
| a 401 | someone's session expired |

## 21.7 Job and audit visibility — both **NOT IMPLEMENTED**

- pg-boss keeps its state in the `pgboss` schema. Failed and retrying jobs should
  be surfaced in the admin console. **There is no visibility today.**
- `GET /v1/admin/audit-logs` and `admin:audit:read` exist and are documented; the
  console has no screen for them.

## 21.8 Log shipping — **NOT IMPLEMENTED**

`CONTEXT.md` §12.4, and the second sentence is the design rule:

> Ship stdout to a hosted sink (Better Stack, Axiom, Datadog). **Do not add a
> transport inside the process; the container's stdout is the interface.**

That is correct twelve-factor practice: a process that ships its own logs blocks
on the network, buffers in memory, and loses everything when it crashes.

---
---

# Part 22 — Testing strategy

## 22.1 The shape of the suite

```
pnpm test  →  turbo run test  →  vitest run --coverage  in each package

apps/api/tests/
├── unit/            mirrors src/ file-for-file. No database. Parallel. ~1 second.
│   ├── middleware/  auth · validate · rate-limit · error-handler · request-context …
│   ├── modules/     every service, repository, route module, facade
│   ├── platform/    storage · jobs · events · payments · audit · telemetry …
│   └── docs/        openapi · postman · schemas · errors
│
└── *.test.ts        INTEGRATION — real PostgreSQL. Serial. One fork.
    ├── tenant-isolation.test.ts    Dealer A cannot reach B — all 404, not 403
    ├── credits.test.ts             hold → consume/release; resubmit reuses the hold;
    │                               refusal at zero; no negative balance; purchase → one
    │                               row + invoice; cache equals newest row
    ├── listing-lifecycle.test.ts   the transition table, double-approve/double-submit
    │                               conflicts, forged `status`, takedown, mark-sold,
    │                               catalogue-reference 404s
    ├── public-visibility.test.ts   rule 6 both ways incl. suspend/reinstate; rule 7 by
    │                               scanning whole responses for every phone in the DB
    ├── auth.test.ts                the whole sign-in flow with a fake OAuthProvider
    ├── errors.test.ts              RFC 9457 shape, .strict() rejections, fractional
    │                               paise, 401/403 per seat, documented errors
    ├── rate-limit.test.ts          limits turned back ON, in its own module registry
    ├── contracts.test.ts           every response parsed through packages/contracts
    ├── openapi.test.ts             the document describes THIS API, in both directions
    └── postman.test.ts             the committed collection regenerated, byte-compared

packages/contracts/tests/  formatting: ₹6.45 Lakh · 02 Aug 2026 · +91 98400 12345
apps/web/tests/unit/       lib + server actions + a component
```

Coverage threshold: **90% lines/statements/functions/branches**, measured across
both projects, with `include: ['src/**/*.ts']` — so a file with no test at all
counts as 0% rather than being left out of the denominator. Without that,
deleting a test file would *raise* the percentage.

## 22.2 The philosophy — why integration tests use a real database

> **If the invariant lives in PostgreSQL, mocking PostgreSQL doesn't test the
> invariant.**

`vitest.config.ts` says it directly:

> Every invariant worth testing there lives in the database: the `FOR UPDATE`
> that serialises credit movements, the partial unique index that permits one
> approved listing per vehicle, the `listing_search` visibility rule. **A mocked
> Prisma would test the mock.**

Make it concrete. Suppose you mock Prisma to test the credit hold:

```ts
prisma.creditTransaction.findFirst = vi.fn().mockResolvedValue({ balanceAfter: 1 });
prisma.creditTransaction.create    = vi.fn();
```

What have you verified? That your code calls `findFirst` and then `create`. You
have **not** verified:

- that `SELECT … FOR UPDATE` actually serialises two concurrent transactions
- that `credit_balance_non_negative` refuses a negative
- that `ORDER BY seq DESC` breaks the `createdAt` tie correctly
- that the partial unique index prevents a second approved listing
- that `ledger_delta_meaningful` permits exactly the `CONSUME_APPROVE` exception

Every one of those is where the real bugs live. Your mock would happily let all
five through.

## 22.3 How the real database is managed

```ts
// tests/global-setup.ts
const TEST_URL  = 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_test';

export async function setup(): Promise<void> {
  await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS dealersdrive_test');
  await admin.$executeRawUnsafe('CREATE DATABASE dealersdrive_test');
  run('pnpm', ['exec', 'prisma', 'migrate', 'deploy']);
  run('pnpm', ['exec', 'tsx', 'prisma/seed/index.ts']);
}

export async function teardown(): Promise<void> {
  // Left in place on purpose: after a failure the database is the evidence.
}
```

Three decisions, each explained in the file:

1. **Dropped and recreated each run** — *"a suite that starts from whatever the
   last one left behind is a suite that passes for the wrong reasons."*
2. **Migrations *and* the seed** — *"the seed is where the second dealer comes
   from, and 'Dealer A cannot reach Dealer B's rows' is not a test you can write
   with one dealer in the database."*
3. **DDL through Prisma, not `psql`** — `psql` may not be on the host; the
   database may be in a container.
4. **Not torn down** — after a failure, the database is the evidence.

## 22.4 Serial execution, and why

```ts
{
  name: 'integration',
  fileParallelism: false,
  pool: 'forks',
  maxWorkers: 1,        // One worker, one connection pool, one sequence of credit movements.
  testTimeout: 30_000,
}
```

The files share one database. Run `credits.test.ts` and `listing-lifecycle.test.ts`
in parallel and both move the same dealer's credits — the assertions become
non-deterministic. Slow, but correct.

The **unit** project has the opposite requirements — no database, no
serialisation, parallel, ~1 second — which is what makes it usable in a watch
loop while the integration suite is what you run before pushing.

## 22.5 The harness

```ts
export interface Harness {
  app: Express;
  prisma: PrismaClient;
  actAs(slug: string, role?: DealerRole): void;   // ← act as a different dealership/seat
  agent(): request.Agent;
  drain(): Promise<void>;                          // ← run the outbox to exhaustion
  close(): Promise<void>;
}
```

**`actAs` — and why it exists at the container level.** The docblock:

> The container's `sessions` override is the seam that makes tenant-isolation
> testing possible at all: the production resolver reads a *server-configured*
> identity, so **there is no header a test (or an attacker) could set to become
> another dealer.** Here the identity is swapped by the harness, out of band, at
> the same place production will one day read a cookie.

The `role` parameter exists because *"the permission table is only meaningfully
tested from a seat that lacks the permission."* Testing that `OWNER` can delete a
vehicle proves nothing about `requirePermission`; testing that `SALES` gets a 403
does.

**`drain()`:**

```ts
async drain() {
  // A handler can enqueue further work, so drain until the table is quiet.
  for (let pass = 0; pass < 10; pass += 1) {
    if ((await container.outbox.drain()) === 0) return;
  }
}
```

Because indexing and notification are deliberately asynchronous, a test that
asserts on the public catalogue must advance the pipeline first. With
`JOBS_ENABLED=false` the queue runs handlers inline, so one drain is the whole
chain: outbox → bus → job handler → `listing_search`.

**Sign-in is tested one seam lower.** `tests/auth.test.ts` (44 tests) uses
`buildContainer({ oauth })` to replace Google — so the transaction cookie, the
state check, the PKCE plumbing and the session row all run **unmodified**. No
test ever talks to Google, and none of them fakes a session either.

## 22.6 What each suite actually pins

| Suite | The property it defends |
|---|---|
| `tenant-isolation` | a cross-tenant read is a 404. Delete a guard, this goes red. |
| `credits` | the ledger's **shape** — reason, delta, `balanceAfter`, `listingId` — not just the arithmetic |
| `listing-lifecycle` | the transition table as a unit, then double-approve conflicts and forged `status` |
| `public-visibility` | rule 6 in both directions, and rule 7 by scanning **whole responses for every phone number in the database** |
| `errors` | the RFC 9457 envelope, `.strict()` rejections, fractional paise, 401/403 per seat |
| `contracts` | every response parses against `packages/contracts` |
| `openapi` | nothing invented, nothing missed — both directions |
| `postman` | the committed collection is byte-identical to a fresh generation |
| `rate-limit` | limits turned back **on**, in its own module registry (the rest of the suite disables them) |

## 22.7 The four commands, and what each catches

```bash
pnpm lint       # ESLint, at the ROOT
pnpm typecheck  # tsc --noEmit, src + tests
pnpm test       # vitest, unit + integration
pnpm build      # tsc + next build
```

| Command | Catches | Real example from this repo |
|---|---|---|
| `lint` | module-boundary violations, `express` in a service, unused code | **26 imports reaching into other modules' internals** — the linter had been catching it all along, nobody had run it at the root (`CONTEXT.md` §10.3) |
| `typecheck` | type errors in **tests and seed** too | tests and `prisma/seed` were outside every tsconfig `include`, so they were neither typechecked nor lintable. Fixing that immediately surfaced a real seed bug under `noUncheckedIndexedAccess` (§10.4) |
| `test` | behaviour, invariants, contracts, docs | the credit double-hold on resubmit (§10.1) |
| `build` | prerender failures, RSC/client boundary errors | `/cars` could not prerender — `useSearchParams` with no Suspense boundary (§10.5) |

**All four. At the root. Before anything is called done.** `CONTEXT.md` §13:
*"Three of the five bugs in §10 were found by running them for the first time."*

## 22.8 Visual QA

```bash
node scripts/browse.mjs <url> <out.png> [--width=1440] [--steps=steps.json]
```

A CDP driver for headless Chrome, where a step is `{eval}`, `{wait}` or `{shot}`.
It prints console errors. Two gotchas are recorded:

- headless Chrome may apply **auto-dark-mode** — check
  `getComputedStyle(document.body).backgroundColor` before believing a screenshot
- **assign eval helpers to `window.`**, not `const` — a second `eval` step in the
  same context otherwise fails with "already declared"

## 22.9 One flake, recorded rather than buried

`CONTEXT.md` §11 records a 401-on-a-public-GET that occurred twice in ~30 runs and
has not reproduced in 21 consecutive runs since. It lists what was ruled out (only
`requireDealer`/`requireAdmin` construct a 401; public routers carry no guard;
`validate()` never calls `next('route')`; the rate limiter answers 429; env
leakage is impossible with `pool: 'forks'` + `fileParallelism: false`).

> If you see it again, capture the response body and the `x-trace-id` before
> doing anything else — that is the missing evidence.

**This is how to handle an unexplained flake.** Not `retry: 3`. Not deleting the
test. Write down what you ruled out and what evidence you need.

---
---

# Part 23 — Production architecture

> **This part was rewritten in full.** The previous version described a
> single-box EC2 deployment and listed CI/CD workflows and the web Dockerfile as
> "not present". Both now exist, and the production target is AWS ECS Fargate.
> The source of truth is `.github/workflows/`, `deploy/aws/README.md`,
> `apps/*/Dockerfile` and `docs/DEPLOYMENT.md`.

## 23.1 The three ways this system runs

The same source tree runs in three shapes, and knowing which one you are looking
at prevents most confusion.

| | **Laptop** | **`docker compose --profile app`** | **AWS (dev and production)** |
|---|---|---|---|
| Web | `next dev --turbopack` on :3000 | `dd-web` container | ECS Fargate task, `next start` |
| API | `tsx watch` on :4000 | `dd-api` container | ECS Fargate task, `node dist/index.js` |
| Postgres | Docker container on :5432 | same container | **RDS PostgreSQL 16**, private subnet |
| Object storage | filesystem (`.storage/`) or MinIO | MinIO on :9000 | **Cloudflare R2** |
| Mail | console logger | Mailpit on :8025 | console logger (still) |
| Jobs | inline in the API process | inline in the API process | inline in the API process |
| Identity | `AUTH_MODE=dev` or real Google | real Google | real Google, one OAuth client per environment |
| TLS | none | none | ACM certificate at the ALB |

The command that starts each:

```bash
pnpm infra:up      # postgres + minio + mailpit only
pnpm dev           # turbo run dev — web and api on the host, with hot reload
pnpm app:up        # scripts/app-up.sh — builds the real images and runs everything in Docker
```

`pnpm app:up` matters more than it looks: it is the only local command that
exercises the **production images**, the production Next build and the migrator
container. If something is going to break in CI's `images build` job, it breaks
here first, for free.

## 23.2 What actually runs on AWS

One AWS account, one region (`ap-south-1`, Mumbai — the buyers are in Tamil
Nadu), one VPC, **one Application Load Balancer shared by both environments**.
The environments share that infrastructure and nothing else: separate databases,
separate buckets, separate secrets, separate OAuth clients, separate IAM roles.

```
                              INTERNET
                                 │
                     ┌───────────▼────────────┐
                     │  Cloudflare / Route 53 │   DNS only (grey cloud) —
                     │  dealers-drive.com     │   proxying would break the
                     │  www · dev             │   per-IP rate limits (§23.6)
                     └───────────┬────────────┘
                                 │ 443
        ┌────────────────────────▼─────────────────────────────────┐
        │        Application Load Balancer  (sg: dd-alb)           │
        │        TLS terminates here, ACM cert, 80 → 301 → 443     │
        │                                                          │
        │  host dev.…   path /v1/* /health/* /media/* /api/docs* ──┼──▶ tg-api-dev
        │  host dev.…   everything else ───────────────────────────┼──▶ tg-web-dev
        │  host www.…   path /v1/* /health/* /media/* ─────────────┼──▶ tg-api-prod
        │  host www.…   everything else ───────────────────────────┼──▶ tg-web-prod
        │  host apex    301 ──▶ www                                │
        └───────┬────────────────────────────────────┬─────────────┘
                │                                    │
   ┌────────────▼──────────────┐        ┌────────────▼──────────────┐
   │  ECS Fargate  dd-web-*    │        │  ECS Fargate  dd-api-*    │
   │  next start, :3000        │        │  node dist/index.js, :4000│
   │  health /api/health       │        │  health /health/ready     │
   │  prod desired-count 2     │        │  desired-count 1 (capped) │
   │  sg: dd-app               │        │  sg: dd-app               │
   └────────────┬──────────────┘        └────────────┬──────────────┘
                │ server-side fetch                  │
                │ (Service Connect / ALB)            │
                └──────────────┬─────────────────────┘
                               │ 5432 (sg: dd-rds allows dd-app only)
                  ┌────────────▼─────────────────┐
                  │  RDS PostgreSQL 16           │
                  │  dd-postgres-dev  t4g.micro  │
                  │  dd-postgres-prod t4g.small  │
                  │  gp3, encrypted, private,    │
                  │  7-day PITR on production    │
                  │  application tables +        │
                  │  listing_search + outbox +   │
                  │  the `pgboss` schema         │
                  └──────────────────────────────┘

   Browser ──── PUT presigned URL ────▶ Cloudflare R2  dd-media-dev / dd-media-prod
   (photo bytes never touch either ECS task)

   Secrets:  SSM Parameter Store SecureStrings under /dealers-drive/<env>/*
             resolved by the ECS *execution* role at task start
   Registry: ECR — dealers-drive/{api,web,migrator}, IMMUTABLE tags
   Logs:     CloudWatch Logs, one JSON line per request, Container Insights on
```

### Why one hostname per environment, not `api.` and `www.`

This is the single most consequential layout decision, and it is a security one.

If the API lived at `api.dealers-drive.com` and the site at
`www.dealers-drive.com`, the `dd_session` cookie would have to be scoped to
`.dealers-drive.com` so both hosts could read it. A parent-domain cookie is sent
to **every** host on that domain — including `dev.dealers-drive.com`. A dev
session would be presented to production on every request.

Putting both behind one hostname, split by path at the load balancer, makes the
cookie **host-only**: `SESSION_COOKIE_DOMAIN` is empty in every environment
(`apps/api/src/config/env.ts`), `dev.` and `www.` cannot read each other's
cookies, there is no CORS preflight between the two apps, and the OAuth callback
is a same-site navigation.

The cost is one listener-rule subtlety worth memorising: the API rule must name
`/api/docs*` explicitly and **must not** claim `/api/*`, because the web app's
own BFF routes live at `/api/dealer/*` and `/api/vehicles/*`
(`apps/web/src/app/api/`). Sending those to Express would break photo upload and
the enquiry inbox with a 404 that looks like an application bug.

## 23.3 The three images

`release.yml` builds three images from one commit. They are not three copies of
the app; they are three different jobs.

| Image | Dockerfile target | What it is | Entry |
|---|---|---|---|
| `dealers-drive/api` | `apps/api/Dockerfile` → `runner` | the HTTP process, production deps only | `node apps/api/dist/index.js` |
| `dealers-drive/migrator` | `apps/api/Dockerfile` → `migrator` | the schema owner — **dev deps kept**, because `prisma` (the CLI) and `tsx` (the seed) are devDependencies | `pnpm db:migrate:deploy`, runs to completion and exits |
| `dealers-drive/web` | `apps/web/Dockerfile` → `runner` | the Next.js server | `next start` |

Three properties of these images carry the whole deployment model:

**1. `GIT_SHA` is the only build argument, and it configures nothing.** It names
the artifact. `/health/ready` reports it as `version`, and `/api/health` on the
web app does the same. This is the only way a pipeline can distinguish "the new
image is serving" from "the old image is still serving and answering exactly as
well" — both are 200s.

**2. The web build must succeed with nothing running.** No API, no database. That
is a requirement, not a convenience: every data route is
`export const dynamic = 'force-dynamic'`, so `next build` prerenders no page that
calls the API. If it ever did, the image would contain HTML — and a
`robots.txt` — built from whichever environment the build machine could reach,
and one image could no longer be promoted from dev to production. It is the same
rule that bans `NEXT_PUBLIC_*` (`apps/web/src/lib/config.ts`). CI's
`images build` job is what catches a regression here, on the pull request.

**3. Both runtime images are non-root (`USER node`) — including the migrator.** A
container process running as root turns a container escape into a host
compromise, and a compromised migration is exactly the thing you do not want
holding root.

## 23.4 The pipeline in one paragraph each

The full walk-through is **Part 31**. In outline:

- **`ci.yml`** — every pull request and every push to `main`. Three jobs:
  `verify` (lint · typecheck · test · build against a real Postgres service
  container), `docker` (both images build from a clean context, nothing running),
  `audit` (`pnpm audit`, blocking at critical). It holds **no credentials** — a
  fork PR can run it in full.
- **`security.yml`** — Semgrep and gitleaks, on PRs, on `main`, and weekly.
  Weekly matters: a rule published upstream can find something in code nobody has
  touched for months.
- **`release.yml`** — on push to `main` (which, after branch protection, means
  "on every merged PR"). Builds the three images, pushes them to ECR tagged
  `sha-<commit>`, then calls `_deploy.yml` with `environment: dev`. **Production
  is never touched by this workflow.**
- **`promote.yml`** — `workflow_dispatch`, manual. A preflight job reads dev's
  `/health/ready`, resolves which SHA to promote, and refuses if dev is degraded
  or is not running the SHA you asked for. Then it calls `_deploy.yml` with
  `environment: production`, and GitHub pauses for a **required reviewer**.
- **`_deploy.yml`** — reusable, and **identical for dev and production**. It
  never builds an image. It verifies the images exist in ECR, runs migrations as
  a one-off Fargate task, deploys API then web (each gated on service stability),
  and finally runs `scripts/smoke.sh` against the public URLs.

One deploy path, exercised on every merge, with a human standing in front of it
for production. A production-only deploy path is a path that runs once a month
and is therefore the one that breaks.

## 23.5 The reliability mechanisms, and which one does what

Four separate things can save a bad deploy. They are often confused.

| Mechanism | Where it is configured | What it catches |
|---|---|---|
| Container `HEALTHCHECK` | both Dockerfiles | the process died or wedged; Docker/ECS restarts it |
| ALB target group health check | `tg-api-*` → `/health/ready`, `tg-web-*` → `/api/health` | a task that is running but cannot serve; it is removed from rotation |
| ECS **deployment circuit breaker** (`enable=true, rollback=true`) | the ECS service | new tasks that never go healthy → ECS restores the previous task definition **by itself**, before the new version serves a single request |
| `minimumHealthyPercent=100, maximumPercent=200` | the ECS service | there is never a moment with fewer healthy tasks than before the deploy |

The workflow does not orchestrate the rollback. `wait-for-service-stability: true`
means the workflow *waits for* the circuit breaker's verdict and fails loudly
when it fires — the rollback is reported rather than silent.

Note the deliberate asymmetry in the two health checks:

- The **API** is checked on `/health/ready`, which runs `SELECT 1`. A task that
  cannot reach Postgres should not receive traffic.
- The **web app** is checked on `/api/health`, which touches **nothing**. It must
  not fail because the API is down — otherwise an API incident would pull the
  front end out of rotation too, and there would be nothing left to serve an
  error page.

`/health/live` exists for a third purpose: it never touches a dependency, so a
database blip cannot get the container killed and restarted. Liveness answers
"is this process alive"; readiness answers "should this process get traffic".
Conflating them is how a five-second database hiccup becomes a restart storm.

## 23.6 Graceful shutdown, and why it is required rather than polite

`apps/api/src/index.ts`:

```ts
process.on('SIGTERM', () => shutdown('SIGTERM'));

function shutdown(signal: string): void {
  const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS); // 10s
  forceExit.unref();                       // the timer must not keep the process alive
  server.close(async (closeError) => {     // stop accepting; drain in-flight requests
    await closeContainer(container);       // outbox.stop() → queue.stop() → prisma.$disconnect()
    process.exit(closeError ? 1 : 0);
  });
}
```

When ECS replaces a task it sends `SIGTERM`, waits, then `SIGKILL`s. Without the
handler, every request in flight at that instant is a connection reset in a
dealer's browser — during a deploy that is otherwise "zero downtime". With it,
`server.close()` stops accepting new connections and lets the existing ones
finish.

The 10-second backstop exists because a hung request must not block a deploy
forever, and `forceExit.unref()` is the detail people miss: an un-unref'd timer
keeps the Node event loop alive for its full duration, so the process that
finished cleanly in 200ms would still sit there for ten seconds.

## 23.7 Configuration: three layers, and what may live in each

| Layer | Holds | Where |
|---|---|---|
| **Baked into the image** | nothing environment-specific. Only `GIT_SHA`. | `ARG GIT_SHA` |
| **Task definition environment** | non-secret values: `APP_ENV`, `WEB_BASE_URL`, `API_BASE_URL`, `STORAGE_DRIVER`, `S3_BUCKET`, `MEDIA_BASE_URL` | `deploy/aws/taskdef/*.json` (registered in AWS, not committed) |
| **Task definition `secrets`** | SSM SecureString ARNs: `DATABASE_URL`, `SESSION_SECRET`, `UPLOAD_SIGNING_SECRET`, `GOOGLE_CLIENT_*`, `S3_*_KEY` | `/dealers-drive/<env>/*` |

Two consequences worth stating explicitly:

- **GitHub never holds a database credential.** `DATABASE_URL` is an SSM
  parameter referenced by the migrate task definition; the migration runs *inside*
  the VPC and the value never leaves AWS.
- **The task definitions live in AWS, not in git.** `_deploy.yml` fetches the
  current one with `describe-task-definition`, changes exactly one field (the
  image), and re-registers it. A value someone changed in the console is
  therefore not silently reverted by a stale file in the repository — and the
  repository does not have to contain the SSM ARNs.

`env.ts` is the last gate. It validates everything at boot and `process.exit(1)`s
with every problem listed. In production it refuses: `AUTH_MODE=dev`,
`STORAGE_DRIVER=local`, the default `SESSION_SECRET`, the default
`UPLOAD_SIGNING_SECRET`, missing Google credentials, and missing S3 keys when the
driver needs them. A misconfigured production task fails its health check and is
rolled back — it never serves.

## 23.8 The one thing that is not horizontally scalable yet

`dd-api-prod` runs `desired-count 1`, and that is not an oversight.

`WORKER_INLINE=true` means the pg-boss job handlers and the scheduled cron jobs
run **inside the HTTP process** (`container.ts` → `startBackground`). Two API
tasks would mean every scheduled job — the listing expiry sweep, the counter
reconciliation, the orphan-media GC — runs twice.

The second piece of per-instance state is the rate limiter: `middleware/rate-limit.ts`
keeps fixed-window counters in a process-local `Map`. N tasks would mean N× the
effective limit, and a restart clears it.

So growing the API today means a **bigger task**, not more of them. Lifting the
cap is the subject of **Part 33**, and it is two changes: a separate worker
entrypoint, and a shared counter store behind a `CachePort`.

Everything else about the API is already stateless: sessions are rows in
Postgres, there is no in-memory user cache, and uploads go to object storage
rather than local disk. `dd-web-prod` already runs two tasks for exactly that
reason — the Next server holds nothing.

## 23.9 Cost, honestly

From `docs/DEPLOYMENT.md` §L, at an early-stage volume (a few hundred listings,
~5k page views/day, ~50 GB of photos, ~200 GB/month of image egress):

| | Dev | Production | Shared |
|---|---:|---:|---:|
| Fargate (api + web) | $20 | $62 | |
| RDS Postgres | $17 | $32 | |
| ALB | | | $22 |
| Data transfer out | $1 | $20 | |
| CloudWatch | $3 | $9 | |
| ECR | | | $2 |
| Cloudflare R2 | $1 | $2 | |
| **Total** | **~$42** | **~$125** | **~$27** |

**≈ $195/month.** R2 rather than S3 is the largest single saving: on an
image-heavy marketplace where the browser downloads photos directly, R2's zero
egress charge removes the line item that would otherwise dominate.

---
---

# Part 24 — Eight complete user journeys

## Journey 1 — A buyer searches for a car

```
 1  Buyer types "used swift vellore" in Google → clicks a result
        │
 2  GET https://dealers-drive.com/cars?city=vellore&make=maruti-suzuki
        │
 3  Next.js: (public)/cars/page.tsx — a Server Component, revalidate = 60
        │  · if a fresh ISR entry exists → HTML served instantly, no API call
        │  · else → render on the server:
        │
 4      generateMetadata()  → GET /v1/cities (revalidate 60)
        │                     title: "Used cars in Vellore"
        │                     seoMetadata({ kind: 'cars', city, hasFilters })
        │
 5      Promise.all([
          GET /v1/vehicles?city=vellore&make=maruti-suzuki      (revalidate 60)
          GET /v1/vehicles/facets?city=vellore&make=…           (revalidate 60)
          GET /v1/cities                                        (revalidate 60)
        ])
        │  NOTE: revalidate is a NUMBER → cached → NO session cookie forwarded.
        │  These are anonymous, cacheable, shared requests. (lib/api.ts)
        │
 6  API: requestContext (traceId) → helmet → cors → parsers → logger
        │
 7      routes.ts: v1.use(createSearchRouter(...))  — NO guard on this mount
        │
 8      rateLimit('public-read', { limit: 120, windowSeconds: 60 })   keyed by req.ip
        │
 9      validate({ query: VehicleQuery })  — .strict()
        │  a typo'd `?colour=white` would 400 here, naming the parameter
        │
10      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
        │
11      search.service.search(query)  →  repo.list(query)
        │
12      SELECT <columns> FROM listing_search
         WHERE city_slug = $1 AND make_slug = $2
         ORDER BY approved_at DESC
         LIMIT $3 OFFSET $4;
        SELECT count(*)::bigint FROM listing_search WHERE …;
        │
        │  ★ THE VISIBILITY RULE IS NOT EVALUATED HERE.
        │    Membership in listing_search IS the rule (§12).
        │    Suspended dealers' cars are simply not rows.
        │
13      toVehicleCard() → { title, priceLabel: '₹6.45 Lakh', kmLabel: '42,180 km',
                            image: { url, srcset, blurhash, alt }, dealerName, … }
        │
14      200 + resultLabel ("18 cars") + appliedFilters (removable chips with hrefs)
        │
15  Next renders <VehicleCard> ×18 + <FilterPanel facets> + ItemList JSON-LD
        │
16  HTML streams to the browser. Complete page. Prices, photos, links — all in the
    source. The crawler indexes it. The buyer sees content, not a spinner.
        │
17  Buyer clicks a card → /car/2021-maruti-swift-vxi-vellore-a3f8
        │  Server Component again: GET /v1/vehicles/{slug}
        │  → SELECT … FROM listing_search WHERE vehicle_slug = $1 LIMIT 1
        │  → not present? 404 → notFound() → the not-found page
        │
18  Buyer clicks "Show number" (a Client Component)
        │  → revealContactAction (Server Action, forwards the buyer's real IP)
        │  → POST /v1/vehicles/{id}/reveal-contact
        │      · search.byVehicleId(id) → 404 if not publicly visible
        │      · consumeRateLimit(`reveal-hour:${ip}`, hourlyCap, 3600)
        │      · repo.revealsToday(ip) >= dailyCap → 429
        │      · INSERT phone_reveals
        │      · INSERT enquiries (source: CALL_BUTTON) — deduped per (ip-derived
        │        placeholder phone, vehicle) within 24h, so tapping Call three
        │        times produces ONE lead
        │      · enqueueOutbox(PhoneRevealed)
        │  → { phone, phoneDisplay, callHref: 'tel:…', whatsappHref, revealsRemainingToday }
        │
19  ~2s later: outbox → PhoneRevealed → notification.enquiry-to-dealer (priority 100)
    → the dealer's phone buzzes.
```

**No account. No cookie. No session.** The buyer is anonymous throughout.

## Journey 2 — A dealer signs in with Google

Covered in full in §4.4. The compressed version, with what is written where:

```
 1  /dealer/login (Server Component) → GET /v1/auth/providers
    → { google: { enabled: true, startUrl } }   (or enabled:false + a reason,
       so the screen explains instead of rendering a button that fails on click)
 2  Click → GET /v1/auth/google/start?returnTo=/dealer
 3  createOAuthTransaction: state, nonce, codeVerifier (32 random bytes each),
    returnTo = safeReturnTo(input)
 4  Set-Cookie dd_oauth = <base64url(json)>.<HMAC-SHA256>  · HttpOnly · 600s
 5  302 → accounts.google.com  (code_challenge = S256(verifier), prompt=select_account)
 6  User picks an account
 7  302 → /v1/auth/google/callback?code&state    (SameSite=Lax lets dd_oauth ride along)
 8  openTransaction: verify HMAC with timingSafeEqual, verify age < 600s
 9  clearOAuthCookie — single use, whatever happens next
10  transaction.state === query.state ? else 401 OAUTH_STATE_INVALID
11  POST oauth2.googleapis.com/token  { code, client_id, client_secret,
                                        redirect_uri, grant_type, code_verifier }
12  id_token claims checked: iss · aud · exp(+60s) · nonce · sub · email · email_verified
13  oAuthIdentity.findUnique({ provider_providerSubject })
      found     → refresh email/displayName/pictureUrl/lastLoginAt
                  user.status !== ACTIVE → 403 ACCOUNT_SUSPENDED
      not found → createIdentity(): user.email collision → 409 ACCOUNT_LINK_REQUIRED
                  else INSERT users + oauth_identities in one transaction
14  dealerMember.findFirst({ userId, status: ACTIVE })
15  sessions.issue({ userId, scope: 'DEALER' })
      token = randomBytes(32).base64url          ← returned once, never stored
      INSERT sessions (tokenHash = SHA256(token), expiresAt = +30d, ip, userAgent)
16  next = !membership              ? 'ONBOARDING'
        : dealer.status === 'DRAFT' ? 'ONBOARDING'
        : dealer.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL'
        : 'DASHBOARD'
17  Set-Cookie dd_session · HttpOnly · Secure(prod) · SameSite=Lax · Expires +30d
18  302 → WEB_BASE_URL + (next === 'ONBOARDING' ? '/dealer/onboarding' : transaction.returnTo)
19  If ONBOARDING: POST /v1/auth/onboarding creates, in ONE transaction:
      user details · dealer (status DRAFT, ALWAYS) · DealerMember OWNER ·
      three DealerDocument rows (REQUIRED) · an audit row
20  Dealer uploads KYC → POST /v1/dealer/submit → status PENDING_APPROVAL
21  Admin approves → status ACTIVE → DealerApproved → reindex + notify
```

**Failures redirect, they do not render JSON.** The callback route maps error
codes to `/dealer/login?error=<code>` — `google_declined`, `invalid_callback`,
`sign_in_failed`, `identity_unverified`, `account_link_required`,
`account_suspended` — because *"a failed sign-in is a screen, not a JSON body."*
Anything unexpected still goes to the error handler, because a bug is still a bug.

## Journey 3 — A dealer creates a vehicle

```
POST /v1/dealer/vehicles
{ "makeId":"…", "modelId":"…", "variantId":"…", "year":2021,
  "fuel":"PETROL", "transmission":"MANUAL", "bodyType":"HATCHBACK" }

 1  requestContext                → traceId
 2  requireDealer                 → cookie → session → member → DealerPrincipal
                                    setContextValue('dealerId') — every later log line has it
 3  requirePermission('vehicle:write')
                                  → SALES seat → 403 FORBIDDEN, right here
 4  validate({ body: CreateVehicleInput })   .strict()
                                  → a stray `dealerId` or `status` → 400 UNRECOGNIZED_KEY
 5  handler: const { dealerId } = dealerPrincipal(req)      ← the only source
 6  service.create(dealerId, input)
 7    assertCatalogue({ makeId, modelId, variantId })
        repo.findBrokenCatalogueRef():
          make exists?
          model exists AND model.makeId === makeId?     ← COHERENCE, not just existence
          variant exists AND variant.modelId === modelId?
        broken → 404 NOT_IN_CATALOGUE with errors[0].field = 'modelId'
 8    repo.create(dealerId, { ...data, dealerId, status: 'DRAFT' })
        INSERT vehicles (…, "dealerId" = <from the session>, status='DRAFT')
        FK violation impossible — step 7 already checked
 9  toDto(vehicle):
      displayStatus(vehicle, null) → 'DRAFT'
      completeness() → { percent: 30, missing: ['kmDriven','ownerNumber','colorId',
                         'cityId','pricePaise','description','photos'],
                         canSubmit: false,
                         blockers: [{ code:'TOO_FEW_PHOTOS', message:'Add 5 more photos…' }] }
      creditPreview  → { balance: 12, cost: 1, balanceAfterPublish: 11 }
10  201 + the DTO
11  log: {"traceId":"…","dealerId":"…","method":"POST","status":201,"durationMs":31}
```

**Why `assertCatalogue` exists** is the §10.6 bug from `CONTEXT.md`: without it a
bad `makeId` reached Prisma, produced a foreign-key error, and surfaced as a
**500 with the failing SQL attached** — a client mistake reported as a server
fault, leaking internals.

**Why coherence and not just existence:** ARCHITECTURE §6.2 constrains dealers to
dropdowns precisely because *a Kia Seltos filed under Maruti Suzuki takes search,
filters and SEO down with it*, and nothing downstream re-checks the pairing.

The `PATCH` path is more subtle — it validates the row **as it will be**, not as
it was sent:

```ts
const touchesTaxonomy = input.makeId !== undefined || input.modelId !== undefined
                                                   || input.variantId !== undefined;
await assertCatalogue({
  ...(touchesTaxonomy ? { makeId:  input.makeId  ?? existing.makeId,
                          modelId: input.modelId ?? existing.modelId,
                          variantId: input.variantId === undefined ? existing.variantId
                                                                   : input.variantId } : {}),
  …
});
```

*"A PATCH may move the model without naming the make, or the make without naming
the model, and either way the pair that ends up stored has to hold together."*
And it is skipped entirely when none of the three is touched — whatever is stored
already passed this check on the way in.

## Journey 4 — A dealer uploads photos

```
 1  Dealer drops 8 photos onto the uploader (a 'use client' component)
 2  Browser compresses each: longest edge 2400px, JPEG q0.85, via canvas
      → a 12MB phone photo becomes ~800KB, which is uploadable on a yard's 4G
 3  POST /api/dealer/media/presign  (Next BFF)
      MediaPresignInput.safeParse — validated here too
 4  → POST /v1/dealer/media/presign  (apiSend forwards dd_session server-side)
 5  API: requireDealer → media.service.presign(dealerId, input)
      · vehicle.findFirst({ id: ownerId, dealerId, deletedAt: null })
          not yours → 404. TENANT CHECK, right here.
      · vehicle.media.length >= 20 → 422 TOO_MANY_PHOTOS
      · mediaId = randomUUID()
      · key = `vehicles/${ownerId}/${mediaId}/original`
      · INSERT media (id, dealerId ← FROM THE SESSION, storageKey, mimeType,
                      bytes, status='PENDING')
      · storage.presignPut({ key, contentType, contentLength })
          content-type AND content-length are BAKED INTO THE SIGNATURE
 6  ← 201 { mediaId, uploadUrl, method:'PUT', headers, expiresInSeconds:300, maxBytes }
 7  Browser: PUT <uploadUrl>  with exactly those headers
      → local: /uploads?…&signature=…  (HMAC verified with timingSafeEqual)
      → minio/r2: straight to object storage, SigV4
      ★ THE BYTES NEVER TOUCH THE NEXT SERVER OR THE API PROCESS
 8  POST /v1/dealer/media/{mediaId}/commit  { position }
 9  API: media.service.commit(dealerId, mediaId, position)
      · media.findFirst({ id, dealerId })       ← tenant check again
      · storage.head(key)
          null            → 422 UPLOAD_MISSING
          bytes mismatch  → media.status='FAILED' + 422 UPLOAD_MISMATCH
      · vehicleMedia.upsert({ vehicleId, mediaId, position })
      · queue.send('media.process', { mediaId })
10  ← 202-ish { mediaId, status:'PROCESSING', poll:'/v1/dealer/media/{id}',
                estimatedSeconds: 6 }
11  Worker 'media.process':
      · sharp reads the original — FAILS on anything that is not really an image
      · strips EXIF  ← removes GPS coordinates: a dealer's home address
      · derivatives at 320 / 640 / 1024 / 1600
      · blurhash → the placeholder the card shows while the image loads
      · media.status = 'READY'
12  Browser polls GET /v1/dealer/media/{id} every 1.2s (limit 25) until READY
13  Reorder: PUT /v1/dealer/media/reorder { mediaIds: [...] }
      the FULL ordered array, always — no partial-swap bugs
      position 0 becomes vehicle.primaryMediaId, denormalized so cards need no join
```

Every step where the client could lie is checked against something else: the
tenant against the session, the size against storage, the format against `sharp`.

## Journey 5 — A dealer submits a listing

```
POST /v1/dealer/vehicles/{id}/submit

 1  requireDealer
 2  requireDealerActive         ← dealer.status !== 'ACTIVE' → 403 DEALER_NOT_ACTIVE
 3  requirePermission('listing:submit')   ← SALES → 403
 4  validate({ params: IdParam })
 5  service.submit(dealerId, userId, vehicleId):

    Pre-flight (outside the transaction — cheap rejections first):
      a. dealers.findById(dealerId); status !== ACTIVE → 403 (belt and braces)
      b. profileGaps(dealer) → 422 PROFILE_INCOMPLETE, errors[] naming each field
      c. repo.findForDealer(dealerId, vehicleId) → 404 if not yours  ← TENANT
      d. previous listing in ['PENDING_REVIEW','APPROVED'] → 409 ALREADY_SUBMITTED
      e. completeness(vehicle):
           minPhotos from platform_config (runtime-tunable)
           READY photos < minPhotos → 422 TOO_FEW_PHOTOS
           any required field missing → 422 VEHICLE_INCOMPLETE with errors[]
      f. reusesHold = previous?.creditHeld === true && previous.creditTxnId !== null

    withTenant(prisma, dealerId, tx):        ← SET LOCAL app.dealer_id
      if (reusesHold)
        heldTxnId = previous.creditTxnId
        balanceBefore = balanceAfter = currentBalance(tx, dealerId)   ← NO movement
      else
        balance = currentBalance(tx, dealerId)
        balance < 1 → throw InsufficientCreditsError(1, balance)      ← 422
        moveCredits(tx, { delta: -1, reason: 'HOLD_SUBMIT',
                          label: 'Submitted for review — 2021 Maruti Swift VXi',
                          actorType: 'DEALER', actorId: userId })
          → SELECT "creditBalance" FROM dealers WHERE id=$1 FOR UPDATE   ★ THE LOCK
          → newest ledger row by seq DESC
          → balanceAfter < 0 → InsufficientCreditsError
          → INSERT credit_transactions (seq auto, delta -1, balanceAfter)
          → UPDATE dealers SET creditBalance

      listing = previous
        ? UPDATE listings SET status = transition(previous,'RESUBMIT','DEALER'),
                              submittedAt=now(), reviewedAt=NULL, reviewedBy=NULL,
                              rejectionReason=NULL, changeRequestNote=NULL,
                              creditHeld=true, creditTxnId=heldTxnId
        : INSERT listings (vehicleId, dealerId, status='PENDING_REVIEW',
                           creditHeld=true, creditTxnId=heldTxnId)

      UPDATE credit_transactions SET listingId = listing.id WHERE id = heldTxnId
      UPDATE vehicles SET status='READY', slug = <unique slug>
      refreshHeldCount(tx, dealerId)
      enqueueOutbox(tx, { type:'ListingSubmitted', aggregateId: listing.id,
                          traceId: getContext()?.traceId })
    COMMIT           ← all of it, or none of it

 6  201 { listingId, status:'PENDING_REVIEW', displayStatus:'PENDING',
          statusLabel:'Pending approval', submittedAt, expectedReviewBy,
          credit: { held: 1, balanceBefore, balanceAfter } }

 7  ~2s: outbox → ListingSubmitted → search.remove-listing
      (a resubmission of a previously-approved listing leaves the catalogue
       immediately — correct, it is under review again)
```

## Journey 6 — An admin approves a listing

**"What happens from the moment I click Approve until the car is publicly
visible?"** — the question this whole document builds toward.

```
POST /v1/admin/listings/{id}/approve

 1  requireAdmin
      readSessionToken(req) → sessions.resolve(token, 'ADMIN')   ← scope in the WHERE
      user.isPlatformAdmin && user.adminRole && user.status==='ACTIVE'
      → AdminPrincipal { permissions: permissionsForAdminRole(adminRole) }
      a DEALER-scope cookie never matches → 401
 2  admin.service.approveListing(admin, listingId)
 3  assertPermission(admin, 'admin:listing:moderate')
      a SUPPORT admin → 403 FORBIDDEN
 4  durationDays = await config.number('listing.durationDays')   ← platform_config
 5  withTransaction(prisma, async (tx) => {

      listing = tx.listing.findUnique({ id, include: { dealer, vehicle{make,model,variant} } })
        null → 404

      next = transition(listing, 'APPROVE', 'ADMIN')
        ★ not PENDING_REVIEW → 409 INVALID_TRANSITION
          "This listing is approved and cannot be approved."
          — this is the second moderator on the same card

      approvedAt = now
      expiresAt  = approvedAt + durationDays × 86_400_000

      moveCredits(tx, { delta: 0, reason: 'CONSUME_APPROVE',
                        label: 'Listing published — 2021 Maruti Swift VXi',
                        listingId, actorType: 'ADMIN', actorId: admin.userId })
        → SELECT … FOR UPDATE on the DEALER's row
        → INSERT a zero-delta ledger row  (permitted by ledger_delta_meaningful)
          the money already moved at hold time; this is the dealer's receipt

      UPDATE listings SET status = next, approvedAt, expiresAt,
                          reviewedAt, reviewedBy = admin.userId,
                          creditHeld = false,
                          rejectionReason = NULL, changeRequestNote = NULL
        ★ the CHECK constraint approved_has_expiry is satisfied by expiresAt

      refreshHeldCount(tx, dealerId)        creditsHeld  -= 1
      refreshActiveListings(tx, dealerId)   activeListings += 1

      audit.record(tx, { actorType:'ADMIN', actorId, dealerId,
                         action:'listing.approved', entityType:'Listing', entityId,
                         before:{status:'PENDING_REVIEW'},
                         after:{status:'APPROVED', expiresAt} })
        ← inside the tx: the audit row cannot outlive a rolled-back write
        ← ip and traceId come from the request context automatically

      enqueueOutbox(tx, { type:'ListingApproved', aggregateType:'Listing',
                          aggregateId: listingId, dealerId,
                          actor:{type:'ADMIN', id: admin.userId},
                          traceId, payload:{ listingId, vehicleId } })
        ← "Indexing, revalidation and the dealer email are all asynchronous and
           none of them can roll back the approval."
    })
    COMMIT

 6  200 { listingId, status:'APPROVED', displayStatus:'ACTIVE',
          approvedAt, expiresAt, expiryLabel:'01 Sep 2026',
          credit:{ consumed:1, transactionId, dealerBalanceAfter },
          publicUrl:'https://dealers-drive.com/car/2021-maruti-swift-vxi-…',
          toast:'Listing approved — now live in the public catalogue.' }
       ← ~40ms. The moderator's next card is already loading.

 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ everything below is asynchronous ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

 7  ≤2s: OutboxPublisher.drain()
      SELECT id, payload FROM outbox_events WHERE publishedAt IS NULL
        AND attempts < 10 ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED
 8  bus.publish(ListingApproved)
      ├─ subscriber 1 → queue.send('search.index-listing',        { listingId })
      └─ subscriber 2 → queue.send('notification.listing-reviewed',{ listingId })
 9  job search.index-listing → search.index(listingId)
      re-derive from scratch:
        listing.status === 'APPROVED'          ✓
        listing.dealer.status === 'ACTIVE'     ✓
        vehicle.deletedAt === null             ✓
        vehicle.status !== 'SOLD'              ✓
        vehicle.slug !== null                  ✓
        vehicle.pricePaise !== null            ✓
        vehicle.kmDriven !== null              ✓
      → INSERT INTO listing_search (…36 columns…) ON CONFLICT DO UPDATE SET …
      → search_doc tsvector is GENERATED by Postgres, weights A/B/C/D
10  job notification.listing-reviewed
      re-fetch the listing + the OWNER member's user
      mailer.send({ to: owner.email,
                    subject: 'Listing update — 2021 Maruti Swift VXi',
                    body: '… is now live in the catalogue until 01 Sep 2026.' })
      ★ DEV-ONLY: ConsoleMailer logs it. No email is sent.
11  THE CAR IS NOW PUBLICLY VISIBLE
      GET /v1/vehicles?city=vellore                   → included
      GET /v1/vehicles/facets                         → counts include it
      GET /v1/vehicles/{slug}                         → 200 instead of 404
      GET /v1/home                                    → may feature it
      GET /v1/dealers/{slug}                          → in their inventory
      POST /v1/vehicles/{id}/reveal-contact           → now answers
      sitemap.ts                                      → includes the URL
      Next ISR: within 60 seconds the cached /cars page regenerates

Total wall-clock: HTTP 200 in ~40ms; publicly visible in ~2s; in the cached
public HTML within 60s.
```

## Journey 7 — A dealer is suspended

Covered in §12.6. The point worth repeating: **the listings are not touched.**

```
Admin suspends Velavan Cars (18 approved listings)
   → UPDATE dealers SET status='SUSPENDED', suspendedAt, statusReason
   → audit row
   → outbox DealerSuspended
        ├─ search.reindex-dealer   → index() ×18 → all 18 fail the ACTIVE check
        │                          → DELETE FROM listing_search ×18
        └─ notification.dealer-reviewed → email the owner

18 cars vanish from search, facets, city counts, the directory, the homepage,
the sitemap and every "N cars" label — simultaneously.

The listings rows are still APPROVED, still have their expiresAt, still have
their consumed credit and their full history.

Reinstate → status='ACTIVE' → DealerReinstated → reindex → all 18 return.

NO listing is re-approved. NO moderator re-reviews anything. NO credit is
re-charged.
```

Meanwhile the dealer can still sign in and read their console — they need to see
*why*. Only `requireDealerActive` routes (submit, renew) refuse, with
`403 DEALER_NOT_ACTIVE` and a message explaining what happens next.

## Journey 8 — A dealer buys credits

**Today (development provider):**

```
1  Dealer opens /dealer/billing → GET /v1/dealer/billing/packs
     4 packs from the DB, prices formatted by formatRupees
2  Clicks "Buy 20 credits" → a Server Action → POST /v1/dealer/billing/orders { packId }
     ★ packId ONLY. No amount. The server prices it.
3  requireDealer → requirePermission('billing:purchase')   ← OWNER only. A MANAGER
     can see the balance (billing:read) but cannot spend the company's money.
4  billing.service.createOrder:
     pack   = creditPack.findFirst({ id: packId, isActive: true })   → 404 if not
     gst    = config.number('billing.gstPercent')
     tax    = amountPaise * BigInt(gst) / 100n                       ← BigInt maths
     total  = amount + tax
     INSERT orders (status='PENDING', credits, amountPaise, taxPaise, totalPaise,
                    gateway='development')
5  payments.createOrder(...) → DevelopmentPaymentProvider:
     { gatewayOrderId:'dev_order_…', settlement:'immediate',
       capture:{ gatewayPaymentId:'dev_pay_…', method:'development', amountPaise,
                 rawPayload:{ note:'Settled locally — no payment gateway was contacted.' }}}
6  UPDATE orders SET gatewayOrderId
7  settlement === 'immediate' → settleCapturedPayment(order.id, capture)
     withTenant(prisma, dealerId, tx):
       idempotencyKey = `order:${order.id}:capture`
       creditTransaction.findUnique({ idempotencyKey })
         found → return { creditsAdded: 0, replay: true }      ← replay guard
       payment.upsert({ where:{ gatewayPaymentId }, … status:'CAPTURED' })
       order.update({ status:'PAID', paidAt })
       moveCredits(tx, { delta:+20, reason:'PURCHASE', orderId, idempotencyKey })
         → FOR UPDATE → ledger row → cache refresh
       invoice.create({ number: nextInvoiceNumber(tx), gstin,
                        placeOfSupply:'33', pdfMediaKey:`invoices/${number}.pdf` })
       enqueueOutbox({ type:'CreditsPurchased', payload:{ orderId, credits, invoiceNumber }})
8  201 { orderId, gatewayOrderId, credits:20, totalLabel:'₹2,360', autoCaptured:true }
9  Client calls POST /v1/dealer/billing/orders/{id}/verify
     ★ THIS NEVER CREDITS. It verifies the handshake and reports state.
     → { verified:true, orderStatus:'PAID', creditsAdded:20, creditBalance:32,
         invoice:{ id, number }, message:'20 credits added — payment captured.' }
10 outbox → CreditsPurchased → notification.invoice → console mailer  (DEV-ONLY)
```

**With Razorpay (when written):**

```
Steps 1–4 identical.

5' RazorpayProvider.createOrder → POST api.razorpay.com/v1/orders
     { gatewayOrderId:'order_xyz', settlement:'webhook' }    ← no capture

7' settlement !== 'immediate' → NOTHING is settled here.

8' 201 { gatewayOrderId, autoCaptured:false, prefill:{ name, email, contact } }
     → the browser opens Razorpay Checkout with gatewayOrderId

   [ the dealer pays. The tab may then close, lose signal, or be suspended. ]

9' Razorpay → POST /v1/webhooks/razorpay        ← NOT IMPLEMENTED
     X-Razorpay-Signature: <HMAC-SHA256 of the RAW body>
     · express.raw() on THIS ROUTE ONLY — verify the exact bytes
     · timingSafeEqual against HMAC(rawBody, WEBHOOK_SECRET)
     · INSERT webhook_events (gatewayEventId) FIRST
         duplicate → unique violation → 200 OK, do nothing else
     · settleCapturedPayment(orderId, capture)      ← THE SAME FUNCTION
     · 200 quickly, or Razorpay retries

10' The client's verify call, meanwhile:
     order.status !== 'PAID' → 202
       { verified:true, orderStatus:'PENDING', creditsAdded:0, pollAfterSeconds:2,
         message:'Payment received. Your credits will appear in a few seconds.' }
     ★ that branch is ALREADY WRITTEN and already documented
     The client polls. When the webhook lands, verify reports PAID.
```

**One `settleCapturedPayment`. Two providers. Swapping providers changes *when* a
credit is written, never *how*.**

---
---

# Part 25 — "What happens if…"

For each: **(1) what happens · (2) which layer handles it · (3) what the client
gets · (4) what is logged · (5) retried? · (6) is the database consistent?**

## 25.1 Authentication

### The cookie is missing
1. `readSessionToken` → `undefined` → `sessions.resolve(undefined, …)` returns
   `null` immediately (there is a `if (!token) return null` short-circuit, so no
   query runs).
2. `requireDealer` in `middleware/auth.ts`.
3. `401 NOT_AUTHENTICATED`, `"You must be signed in to do that."`
4. `warn` — `{ traceId, status: 401, code, method, url }`. No `userId`, because
   there is none.
5. No.
6. Yes — nothing was written.

*Web side:* the dealer layout catches the 401, and `hasSession()` is false, so
it redirects to `/dealer/login?error=session_expired`.

### The cookie is expired
1. `expiresAt > now()` is in the `WHERE` clause, so the row does not match.
2. `session.service.resolve`.
3. `401`.
4. `warn`. Indistinguishable from "missing" in the response — deliberately.
5. No.
6. Yes. The row stays in `sessions` for forensics; nothing sweeps it.

### The session is revoked
1. `revokedAt IS NULL` is in the same `WHERE` clause. Takes effect on the **very
   next request** — no cache, no grace period.
2. Same.
3. `401`.
4. `warn`.
5. No.
6. Yes.

### A Google account has no `DealerMember`
1. `signedIn()` finds no membership → returns a `PendingPrincipal`.
   `resolveDealer` narrows on `kind === 'DEALER'` → `null`.
2. `cookie-session.adapter.ts`.
3. `401` on `/v1/dealer/**`. But `GET /v1/auth/me` returns `200` with
   `next: 'ONBOARDING'`, and `POST /v1/auth/onboarding` works.
4. `warn` for the 401.
5. No.
6. Yes.

*Web side:* the layout sees the 401, `hasSession()` is **true**, so it redirects
to `/dealer/onboarding` instead of the login screen.

### A Google email collides with an existing account
1. `createIdentity()` finds a `User` with that email and no linked identity.
2. `auth.service.ts` — a deliberate refusal, not a merge.
3. `409 ACCOUNT_LINK_REQUIRED` → the callback maps it to
   `/dealer/login?error=account_link_required`.
4. `warn` — `{ event: 'auth.oauth.failed', reason: 'unlinked-account' }`. The
   email is **not** in the log line.
5. No.
6. Yes — no `User` and no `OAuthIdentity` are created. The whole thing is inside
   `withTransaction` and the throw happens before it.

**Support's manual fix today:** insert the `oauth_identities` row. A deliberate
linking flow is **NOT IMPLEMENTED**.

### The dealership is suspended
1. The principal still resolves — `dealerStatus: 'SUSPENDED'` — so the dealer can
   read their console.
2. `requireDealerActive`, on submit/renew only.
3. `403 DEALER_NOT_ACTIVE`: *"Your dealership is not active yet. Listings can be
   published once our team approves it."*
4. `warn`.
5. No.
6. Yes.

Separately, their approved listings have already left `listing_search` via
`search.reindex-dealer` (§12.6).

### An admin hits a dealer endpoint
1. `resolveDealer` queries `sessions` with `scope: 'DEALER'`. The admin's row has
   `scope = 'ADMIN'` and does not match.
2. `session.service.resolve` — the scope is in the `WHERE` clause.
3. `401`, not 403. There is no valid *dealer* session.
4. `warn`.
5. No.
6. Yes.

### A dealer hits an admin endpoint
Mirror image. `resolveAdmin` requires `scope: 'ADMIN'` **and**
`user.isPlatformAdmin` **and** `user.adminRole` **and** `user.status === 'ACTIVE'`.
→ `401 "Sign in to the admin console to do that."`

## 25.2 Authorization

### A dealer requests another dealer's vehicle
1. `repo.findForDealer(dealerId, vehicleId)` →
   `WHERE id = $1 AND "dealerId" = $2 AND "deletedAt" IS NULL` → no row.
2. The repository, then the service.
3. **`404 NOT_FOUND`**, `"That vehicle does not exist."` — never 403 (§7.5).
4. `warn` with the requesting `dealerId` in context, so repeated probing is
   visible in the logs.
5. No.
6. Yes.

### A dealer guesses a random UUID
Identical response. **That is the point** — a real id belonging to someone else
and a fabricated id are indistinguishable from outside.

### A dealer puts `dealerId` in the request body
1. `.strict()` rejects the unknown key.
2. `validate()` middleware → `ZodError` → error handler.
3. `400 VALIDATION_FAILED` with
   `errors[0] = { field: 'body.dealerId', code: 'UNRECOGNIZED_KEY', message: '`dealerId` is not a recognised field.' }`.
4. `warn`.
5. No.
6. Yes — the handler never ran.

### A dealer puts `status: "APPROVED"` in the body
Identical. `status` is in no dealer-writable schema. Even if it were accepted, it
would have to pass `transition()`, which refuses `DEALER` for `APPROVE`. Two
independent defences (§11.4).

## 25.3 Database

### Two requests spend the same last credit
Walked through in §10.6. Short version: `SELECT … FOR UPDATE` serialises them; the
first succeeds; the second re-reads the balance as 0 and throws.

1. Request B blocks, then reads the fresh balance.
2. `moveCredits`.
3. `422 INSUFFICIENT_CREDITS` with `creditBalance: 0`, `actionLabel: 'Buy credits'`,
   `actionHref: '/dealer/billing'`.
4. `warn`.
5. Not automatically — the dealer buys credits and retries.
6. **Yes.** B's whole transaction rolls back: no ledger row, no listing, no
   outbox event.

### Two admins approve the same listing simultaneously
1. Both read `PENDING_REVIEW`. Both call `transition`. Both begin an `UPDATE`.
   The updates serialise on the row lock. The loser's transaction, on retry or on
   its next read, sees `APPROVED`.
2. `transition()` inside the transaction; then, as a last resort,
   `listings_one_approved_per_vehicle`.
3. Winner: `200` with the toast. Loser: `409 INVALID_TRANSITION` — *"This listing
   is approved and cannot be approved."*
4. `warn`.
5. No.
6. **Yes.** Exactly one `CONSUME_APPROVE` row, one `approvedAt`, one audit entry,
   one outbox event.

### A transaction fails mid-way
1. Prisma rolls back everything in the callback.
2. `$transaction`.
3. `500 INTERNAL` — `detail` omitted in production.
4. `error` with the full `err` object and the `traceId`.
5. No automatic retry at the HTTP layer.
6. **Yes** — that is what a transaction is for. Critically, the **outbox row rolls
   back too**, so no notification is sent for something that did not happen.

### A foreign key is invalid
1. Ideally caught by `findBrokenCatalogueRef` before Prisma.
2. `vehicles.service.assertCatalogue`.
3. `404 NOT_IN_CATALOGUE`, `errors[0].field: 'makeId'`, *"Pick one from GET
   /v1/catalog/bundle."*
4. `warn`.
5. No.
6. Yes.

If a *different* FK slipped through (a path with no pre-check), it becomes an
unhandled Prisma error → `500` with the detail suppressed in production. That is
the `CONTEXT.md` §10.6 bug; the fix pattern is to pre-check and name the field.

### A duplicate listing is created
1. `listings_one_approved_per_vehicle` — the partial unique index.
2. PostgreSQL. Before that, `ALREADY_SUBMITTED` (409) in
   `vehicles.service.submit` catches the ordinary case.
3. Normally `409 ALREADY_SUBMITTED`. If somehow bypassed, a `500` from the index
   violation.
4. `warn` / `error` respectively.
5. No.
6. **Yes** either way. The 500 is ugly; the data is intact. That is the correct
   priority for a last-resort constraint.

## 25.4 Storage

### The presigned upload never happens
1. The `Media` row sits at `status: 'PENDING'`. `commit` calls `storage.head()`
   → `null`.
2. `media.service.commit`.
3. `422 UPLOAD_MISSING`, *"The upload did not complete. Try again."*
4. `warn`.
5. The client retries the whole presign → PUT → commit cycle.
6. Yes, but with a stray `PENDING` row — which the `media.gc-orphans` cron
   (03:00 IST) deletes.

*This is one of the thirteen expected non-2xx responses in the Postman run: a
collection cannot PUT the file a presign was issued for.*

### Commit happens without an upload
Same as above — `head()` is the check, and it asks **storage**, not the client.

### The uploaded size does not match what was declared
1. `object.bytes !== media.bytes`.
2. `commit`.
3. `422 UPLOAD_MISMATCH`, and the media row is marked `FAILED`.
4. `warn`.
5. Client retries with a fresh presign.
6. Yes.

### The content type is wrong
1. The declared content-type is **in the signature**, so a mismatched
   `Content-Type` header fails the PUT itself (S3 rejects it; the local adapter's
   HMAC does not verify).
2. Object storage / `local.adapter.ts`.
3. `403`/`400` from storage, surfaced to the uploader as an upload error.
4. Client-side.
5. Yes, on retry.
6. Yes.

**And even if a wrong type got through:** `media.process` runs the bytes through
`sharp`, which fails on anything that is not really an image, and re-encodes
everything it accepts. A polyglot file does not survive re-encoding.

## 25.5 Jobs

### A notification fails
1. The handler throws. pg-boss catches it, marks the job failed, and schedules a
   retry (`retryLimit: 3`, `retryBackoff: true`).
2. pg-boss.
3. **The client already got its 200.** The dealer's listing is approved and live
   regardless.
4. `error`.
5. Yes — 3 retries with exponential backoff, then dead-lettered.
6. Yes. The business state was committed before the job was ever enqueued.

### A job retries
Handlers are written to be idempotent. `search.index` uses
`ON CONFLICT DO UPDATE`; `settleCapturedPayment` checks the idempotency key.
Notification handlers are the exception — a retry sends a second email, which is
annoying rather than dangerous.

### A duplicate webhook arrives
> **NOT IMPLEMENTED — there is no webhook route.** When there is:
1. `INSERT webhook_events` violates `gatewayEventId @unique`.
2. The webhook route.
3. `200 OK` — you must acknowledge a duplicate, or the gateway keeps retrying.
4. `info`.
5. N/A.
6. Yes. And the second layer — `CreditTransaction.idempotencyKey` — would catch
   it even if the first were missed.

### The worker crashes mid-job
1. pg-boss's job lease expires and the job is re-delivered to another worker.
   Unpublished outbox rows are simply picked up by the next `drain()`.
2. pg-boss + `OutboxPublisher`.
3. N/A — no client is waiting.
4. Whatever was logged before the crash, plus the container restart.
5. Yes — **at-least-once**, which is why idempotency is mandatory.
6. Yes. The outbox row is only marked `publishedAt` **after** a successful
   `bus.publish`, so a crash in between means redelivery, not loss.

## 25.6 API

### An unknown field is sent
`400 VALIDATION_FAILED`, one `UNRECOGNIZED_KEY` error **per stray key**, each
naming the key. §16.5.

### An invalid query parameter
Same. `?limit=abc` → `z.coerce.number()` fails →
`400`, `errors[0].field: 'query.limit'`.

### A malformed request body
1. `express.json()` throws a `BodyParserError` with `type:
   'entity.parse.failed'` **before any route runs**.
2. `errorHandler`'s `BODY_PARSER_CODES` map.
3. `400 MALFORMED_BODY`, *"The request body is not valid JSON."*
4. `warn`.
5. No.
6. Yes.

Without that mapping it would be an unhandled error and a 500 — which is why the
map exists: *"They are client mistakes, not bugs, so they must not fall through
to a 500."*

### A body over 1 MB
`413 PAYLOAD_TOO_LARGE`.

### An unexpected database error
1. Falls through every `instanceof` branch in `toProblem`.
2. `errorHandler`.
3. `500 INTERNAL`. **In production `detail` is `undefined`** — no SQL, no table
   names, no parameter values. The client gets `type`, `title`, `status`, `code`,
   `traceId`.
4. `logger.error({ …, err: error })` with the full stack, correlated by
   `traceId`. (And a marked TODO where Sentry should go.)
5. No.
6. Depends — if it happened inside a transaction, yes.

### An unmatched route
`notFound` middleware → `404 NOT_FOUND`, *"No route matches GET /v1/nonsense."*
Never Express's default HTML error page.

### The response has already started streaming
```ts
if (res.headersSent) { next(error); return; }
```
Delegates to Express's default handler, which destroys the socket. You cannot
send a JSON error body after the status line has gone out.

---
---

# Part 26 — Why did we build it this way?

Format for each: **Decision · Reason · Alternative · Why rejected · Trade-off**

### PostgreSQL
- **Reason:** the invariants here are relational and financial. Constraints,
  transactions and row locks hold against code that does not exist yet. And the
  core feature is a faceted cross-tenant search.
- **Alternative:** MongoDB.
- **Rejected because:** every invariant becomes an application-level suggestion.
  A negative credit balance would be reachable by any future write path.
- **Trade-off:** migrations are mandatory; schema changes need thought.

### Prisma
- **Reason:** type-safe queries, checked-in SQL migrations, and a real `Tx` handle
  services can pass around.
- **Alternative:** raw `pg`, Knex, TypeORM, Drizzle.
- **Rejected because:** raw SQL loses compile-time safety on every query;
  TypeORM's ActiveRecord model encourages logic in entities.
- **Trade-off:** Prisma's query API is limited for complex SQL — so the code drops
  to `$queryRaw`/`$executeRaw` where needed, which is the right escape hatch.

### Modular monolith
- **Reason:** one deployable; transactional consistency across modules for free;
  boundaries enforced by ESLint rather than by network calls.
- **Alternative:** microservices.
- **Rejected because:** the credit hold and the listing state change must commit
  together. Splitting them means sagas, compensating transactions and a
  reconciliation job — a large amount of machinery for a problem the product does
  not have.
- **Trade-off:** you cannot scale one module independently; discipline is
  required to keep boundaries real (and it slipped once — 26 violating imports).

### Next.js App Router
- **Reason:** the public marketplace lives or dies on organic search, so pages
  must be server-rendered with real content in the HTML.
- **Alternative:** Vite + React SPA, or Remix.
- **Rejected because:** an SPA delivers an empty div to a crawler.
- **Trade-off:** the RSC mental model is genuinely new; the server/client boundary
  is a real source of confusion.

### Server Components by default
- **Reason:** less JavaScript shipped, data fetched next to the API, secrets never
  reaching the browser.
- **Alternative:** `'use client'` everywhere with `useEffect` fetching.
- **Rejected because:** it reintroduces the SPA's SEO and waterfall problems.
- **Trade-off:** you have to think about where each component runs.

### Zod contracts in a shared package
- **Reason:** one definition validates the request, types both apps, generates the
  OpenAPI document, and parses responses in tests.
- **Alternative:** TypeScript interfaces + a hand-written validator, or io-ts,
  or class-validator.
- **Rejected because:** interfaces vanish at runtime; a separate validator drifts
  from the type.
- **Trade-off:** a runtime parse on every request (microseconds, and worth it).

### `.strict()` everywhere
- **Reason:** an unknown field becomes a loud 400 naming the field, rather than a
  silent strip.
- **Alternative:** the default strip.
- **Rejected because:** silent stripping means a mass-assignment attempt looks
  like a success, and a client typo hides for months.
- **Trade-off:** clients must send exactly the declared shape — including `{}`
  rather than nothing for an all-optional body, which caused a real bug.

### Session cookies, not JWT in `localStorage`
- **Reason:** `HttpOnly` puts the token out of JavaScript's reach; revocation is
  one `UPDATE`; permissions can never be stale.
- **Alternative:** JWT access + refresh tokens.
- **Rejected because:** an admin suspending a fraudulent dealer must take effect
  *now*, and a JWT denylist is a database lookup you have re-implemented badly.
- **Trade-off:** 1–2 extra indexed queries per authenticated request, and the API
  is not stateless in the "no shared store" sense (it already needs Postgres).

### Database-backed sessions with only the hash stored
- **Reason:** a leaked database dump hands over nothing usable.
- **Alternative:** store the token in plaintext.
- **Rejected because:** backups leak.
- **Trade-off:** one SHA-256 per request. Negligible.

### Google OAuth for dealers
- **Reason:** no password to store, reset, or leak; email verification is Google's
  job; dealers already have a Google account.
- **Alternative:** email + password, or phone OTP.
- **Rejected because:** passwords mean hashing, resets, breach exposure, and a
  support burden. OTP means SMS cost and DLT registration before you can send a
  single message in India.
- **Trade-off:** a hard dependency on Google; a dealer without a Google account
  cannot sign in. And **seeded dealers cannot sign in at all**, because their
  emails are fictional.

### Argon2id for admin passwords
- **Reason:** memory-hard, so GPU parallelism does not help an attacker. OWASP's
  current recommendation.
- **Alternative:** bcrypt, scrypt, PBKDF2.
- **Rejected because:** bcrypt is not memory-hard; PBKDF2 is GPU-friendly.
- **Trade-off:** 19 MiB and ~50 ms per verification — which is also what makes
  `verifyDecoy` necessary to keep timing uniform.

### pg-boss on the same database
- **Reason:** real queue semantics with zero new infrastructure, and the queue
  lives where the transaction does.
- **Alternative:** BullMQ + Redis, SQS, RabbitMQ.
- **Rejected because:** a Redis instance is a second stateful thing to run,
  secure, back up and page about, for a workload of a few thousand jobs a day.
- **Trade-off:** lower throughput ceiling. The `Queue` port is four methods, so
  the swap is contained.

### No Redis
- **Reason:** every use case has a good-enough answer already (§1.8).
- **Trade-off:** **rate limits are per-process.** With N instances a client gets
  N× the limit, and a restart resets every window. The file names the fix.

### No MongoDB / no GraphQL / no microservices
Covered in §1.6 and §1.9.

### The credit ledger
- **Reason:** an append-only record answers "why is my balance 5?" and makes
  reversals possible without losing history.
- **Alternative:** a `creditBalance` integer.
- **Rejected because:** no history, no audit, no reversal, and a race condition.
- **Trade-off:** more rows, more code, and a cache column to keep honest — which
  is why the nightly reconcile job exists.

### `seq BIGSERIAL` for ledger ordering
- **Reason:** `createdAt` ties inside a transaction because Postgres gives every
  statement the same `now()`, making "the newest row" ambiguous.
- **Alternative:** `createdAt`, or a `(createdAt, id)` composite.
- **Rejected because:** the tie is broken arbitrarily and can differ between
  executions; a uuid tiebreaker is not ordered.
- **Trade-off:** one extra indexed column.

### Invariants as database constraints
- **Reason:** they apply to every writer, including scripts, jobs and code that
  does not exist yet.
- **Alternative:** application-only validation.
- **Rejected because:** the application is one of many possible writers.
- **Trade-off:** a violated constraint surfaces as a 500 rather than a friendly
  message — which is why the application *also* validates. Both layers, different
  jobs.

### 404 not 403 across tenants
- **Reason:** a 403 confirms the id is real and is an enumeration oracle.
- **Alternative:** 403.
- **Rejected because:** competitive intelligence handed over for free.
- **Trade-off:** slightly confusing for a legitimate user who genuinely lost
  access — mitigated by clear messaging elsewhere.

### The repository pattern with `dealerId` first
- **Reason:** an unscoped query becomes a **type error**.
- **Alternative:** query in the service; or a base repository with an implicit
  tenant.
- **Rejected because:** implicit is invisible, and invisible is forgettable.
- **Trade-off:** slightly verbose signatures. Worth it.

### Facades
- **Reason:** a module's public surface is a written decision; refactors stay
  local; dependencies are greppable.
- **Alternative:** import whatever you need.
- **Rejected because:** it produced 26 boundary violations before the linter was
  run at the root.
- **Trade-off:** an extra file per module.

### A service layer that never sees `req`/`res`
- **Reason:** testable without HTTP; reusable from jobs and scripts; forces the
  error handler to own HTTP concerns.
- **Alternative:** logic in controllers.
- **Rejected because:** it cannot be called from a job, and it tempts you to build
  responses in three places.
- **Trade-off:** more files.

### Object storage with presigned URLs
- **Reason:** bytes never traverse the API; container filesystems are ephemeral;
  it scales horizontally.
- **Alternative:** multipart upload to the API and local disk.
- **Rejected because:** photos disappear on redeploy and the API becomes a file
  server.
- **Trade-off:** a three-step client flow (presign → PUT → commit) instead of one.

### `StoragePort` with three drivers
- **Reason:** the test suite runs with no container; local dev runs MinIO;
  production runs R2 — through **one** S3 adapter for the last two.
- **Trade-off:** the local adapter is extra code — but it implements the *same*
  signed, expiring, type-and-length-constrained contract, so it is a stand-in and
  not a shortcut.

### OpenAPI generated from Zod
- **Reason:** the reference can only be wrong the same way the code is wrong.
- **Alternative:** hand-written docs, or JSDoc annotations.
- **Rejected because:** hand-written docs drift, and drifted docs are worse than
  none.
- **Trade-off:** adding a route fails a test until you document it. That is the
  intended cost.

### Integration tests against a real database
- **Reason:** every invariant worth testing lives in the database. A mocked Prisma
  tests the mock.
- **Alternative:** mock Prisma.
- **Rejected because:** it cannot test `FOR UPDATE`, partial unique indexes, CHECK
  constraints or `ORDER BY seq`.
- **Trade-off:** the suite needs a live Postgres and runs serially. Slower, and
  correct.

### Development payment provider
- **Reason:** it settles through the **same** `settleCapturedPayment` a webhook
  will call, so the accounting is exercised end to end today.
- **Alternative:** stub the whole billing module.
- **Rejected because:** then the ledger, the locking and the invoicing would be
  untested.
- **Trade-off:** it is not a gateway, and must never be mistaken for one.

---
---

# Part 27 — Code reading guide

**Do not read everything.** Read in this order. Each step says what it teaches.

## Day 1 — orientation (~6 hours)

**Morning — get it running (90 min)**

```bash
pnpm install
docker compose up -d                 # postgres + minio + mailpit
cp .env.example .env
pnpm --filter @dealers-drive/api db:migrate:deploy
pnpm --filter @dealers-drive/api db:seed
pnpm dev
```

Then open, in this order:
- `http://localhost:3000` — the public marketplace
- `http://localhost:3000/cars?city=vellore` — search with filters in the URL
- `http://localhost:4000/api/docs` — the OpenAPI reference, all 73 operations
- `http://localhost:3000/admin/login` — sign in with `DEV_ADMIN_EMAIL` /
  `DEV_ADMIN_PASSWORD` from `.env`

> **Two things that look like bugs and are not.** There is **no `chennai`** in the
> seed — the cities are Vellore-district (`vellore`, `katpadi`, `arcot`,
> `ranipet`, `gudiyattam`), so `?city=chennai` legitimately returns zero results.
> And **none of the seeded dealers can sign in with Google** — their emails are
> fictional. Set `AUTH_MODE=dev` to enter `sri-lakshmi-motors`'s console, or
> press "Continue with Google" to walk the real new-dealer path.

**Read (in order):**

| # | Read | Because it teaches you |
|---|---|---|
| 1 | `CONTEXT.md` §1–§6 | what this is, why the stack is fixed, and the nine rules everything follows |
| 2 | `apps/api/src/routes.ts` (89 lines) | the entire API surface and the whole authorization model, in one file |
| 3 | `apps/api/src/server.ts` (65 lines) | why middleware order **is** the security model |
| 4 | `apps/api/src/container.ts` (223 lines) | how everything is wired, and where every test seam is |
| 5 | `apps/api/src/middleware/request-context.ts` | how `traceId` reaches every log line without being passed |
| 6 | `apps/api/src/middleware/auth.ts` | the three guards, and why all three exist |
| 7 | `apps/api/src/modules/auth/session.port.ts` | the `Principal` types and the full permission table |

**Then trace one request by hand:** `GET /v1/dealer/vehicles`, from
`routes.ts:72` → `requireDealer` → `vehicles.routes.ts:29` →
`vehicles.service.inventory` → `vehicles.repository.listForDealer`. Use §3 of this
document as the map.

**End-of-day check:** you can answer *"where does `dealerId` come from, and why
can a client not send it?"*

## Day 2–3 — the core invariants

| # | Read | Because it teaches you |
|---|---|---|
| 8 | `apps/api/prisma/schema.prisma` — `User`, `Session`, `OAuthIdentity`, `Dealer`, `DealerMember` | the five identity nouns and how they relate |
| 9 | `modules/auth/session.service.ts` + `cookie-session.adapter.ts` | how a cookie becomes a principal, and why the principal is rebuilt every request |
| 10 | `modules/auth/oauth-transaction.ts` | `state`, `nonce`, PKCE, and the open-redirect guard |
| 11 | `modules/auth/google.provider.ts` | the OIDC claim checks, and why the signature is not verified |
| 12 | `prisma/migrations/…_search_and_invariants/migration.sql` | **the invariants the application is not trusted with** |
| 13 | `modules/billing/credits.service.ts` (138 lines) | `moveCredits` — the single most important function in the system |
| 14 | `prisma/migrations/…_credit_ledger_sequence/migration.sql` | why `createdAt` cannot order a ledger |
| 15 | `modules/listings/listing.state.ts` | the state machine as an authorization table |
| 16 | `modules/vehicles/vehicles.service.ts` — `submit()` | how all of the above compose into one transaction |

**Then run and read a test:**

```bash
pnpm --filter @dealers-drive/api exec vitest run credits
pnpm --filter @dealers-drive/api exec vitest run tenant-isolation
```

Read `tests/credits.test.ts` **while** reading `credits.service.ts`. Note that the
tests assert the ledger's *shape* — reason, delta, `balanceAfter`, `listingId` —
not just the final number.

**Then inspect the database:**

```sql
SELECT seq, delta, "balanceAfter", reason, label, "createdAt"
FROM credit_transactions
WHERE "dealerId" = (SELECT id FROM dealers WHERE slug = 'sri-lakshmi-motors')
ORDER BY seq DESC LIMIT 20;

SELECT "creditBalance", "creditsHeld" FROM dealers WHERE slug = 'sri-lakshmi-motors';
-- creditBalance MUST equal the newest balanceAfter. If it does not, that is
-- exactly the drift counters.reconcile alerts on.

SELECT count(*) FROM listings WHERE status = 'APPROVED';
SELECT count(*) FROM listing_search;
-- These differ by the listings whose dealer is not ACTIVE. gokul-cars is
-- PENDING_APPROVAL in the seed on purpose.
```

**End of day 3 check:** you can answer *"why can't we just do `dealer.creditBalance -= 1`?"*
and *"why does an approved car disappear when its dealer is suspended?"*

## Week 1 — the rest

**Day 4 — async and storage**

| # | Read | Because it teaches you |
|---|---|---|
| 17 | `platform/events/bus.ts` | the transactional outbox, and why payloads carry ids not PII |
| 18 | `platform/events/outbox-publisher.ts` | `FOR UPDATE SKIP LOCKED`, at-least-once delivery |
| 19 | `platform/jobs/queue.ts` | pg-boss, priorities, and the inline queue that makes tests deterministic |
| 20 | `platform/jobs/handlers.ts` | all eleven jobs and every subscriber — read `counters.reconcile` twice |
| 21 | `platform/storage/storage.port.ts` + `local.adapter.ts` | presign → PUT → commit, and why content-type and length are in the signature |
| 22 | `modules/media/media.service.ts` | why `commit` exists and what it refuses to trust |

**Do:** add a photo through the console at `/dealer/vehicles/{id}/edit` with your
browser's network tab open. Watch the three requests: presign (to Next), PUT (to
MinIO — note it does **not** go to the API), commit (to Next → API).

**Day 5 — contracts, docs, errors**

| # | Read | Because it teaches you |
|---|---|---|
| 23 | `packages/contracts/src/common.ts` | the shared envelope and the Indian formatting rules |
| 24 | `packages/contracts/src/dealer.ts` — `CreateVehicleInput`, `UpdateVehicleInput` | `.strict()` and where domain bounds live |
| 25 | `middleware/validate.ts` | why parsed values go to `req.valid`, not back onto `req` |
| 26 | `platform/errors.ts` + `middleware/error-handler.ts` | the whole error vocabulary and RFC 9457 |
| 27 | `docs/schemas.ts` | why there are two conversions, and what breaks if you swap them |

**Do:**

```bash
curl -i localhost:4000/v1/vehicles?colour=white      # 400, naming the parameter
curl -i localhost:4000/v1/vehicles/does-not-exist    # 404 problem+json
curl -i localhost:4000/v1/dealer/vehicles            # 401 (no cookie)
```

Read each response body. Note `traceId`, then find that id in the API's log
output.

**Day 6 — the frontend**

| # | Read | Because it teaches you |
|---|---|---|
| 28 | `apps/web/src/lib/api.ts` | the caching/session rule: **never both** |
| 29 | `apps/web/src/app/(public)/cars/page.tsx` | a Server Component with ISR, parallel fetches, SEO |
| 30 | `apps/web/src/app/(dealer)/dealer/layout.tsx` | a layout as a guard, and why it is UX not security |
| 31 | `apps/web/src/features/enquiry/actions.ts` | Server Actions, and why the buyer's IP is forwarded |
| 32 | `apps/web/src/features/vehicle/photo-uploader.tsx` | a justified `'use client'` |
| 33 | `apps/web/src/app/api/dealer/media/presign/route.ts` | what a BFF handler is for, and what it is not for |

**Day 7 — make a change**

Pick something small and end-to-end. A good first task: **add a `sunroof` boolean
filter to the public search.** It touches every layer:

```
1. packages/contracts/src/public.ts   add to VehicleQuery (.strict() — so the API
                                      rejects it until you do)
2. search.repository.ts               add the predicate to the WHERE clause
                                      (features is a text[] with a GIN index —
                                       decide whether this is a feature tag or a
                                       new column, and say why)
3. search.mapper.ts                   add the removable filter chip
4. modules/search/search.docs.ts      document the parameter
5. pnpm --filter @dealers-drive/api docs:postman     regenerate the collection
6. components/search/filter-panel.tsx add the checkbox
7. pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Step 5 is not optional — `tests/postman.test.ts` compares the committed collection
byte-for-byte and will fail without it. That is the intended cost.

## The five files to know by heart

If you only truly internalise five:

1. **`apps/api/src/routes.ts`** — the whole surface and the whole auth model
2. **`apps/api/src/middleware/auth.ts`** — the three guards
3. **`apps/api/src/modules/billing/credits.service.ts`** — the ledger
4. **`apps/api/src/modules/listings/listing.state.ts`** — the state machine
5. **`apps/api/prisma/migrations/…_search_and_invariants/migration.sql`** — the
   invariants

## Working agreements — non-negotiable

- **`pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass** before
  anything is called done. All four, at the root.
- **Do not invent an endpoint.** If `docs/API-SPEC.md` does not describe it,
  report the gap instead of filling it. The OpenAPI test enforces the converse: a
  route with no documentation fails the build.
- **Verify by running it, not by reading it.** `scripts/browse.mjs` drives headless
  Chrome for visual QA.
- **Commit on a branch.** `main` is the default branch.
- **Check for stale processes** before concluding a build is broken:
  `lsof -nP -iTCP:<port> -sTCP:LISTEN`. A two-day-old `node dist/index.js`
  squatting on a port cost real time once.
- **Re-seed after a Postman run.** It mutates the database.

---
---

# Part 28 — Glossary

Each entry: **term · plain definition · Dealers-Drive example · why it matters.**

**Authentication** — establishing *who you are*. → `SessionResolver` turns a
`dd_session` cookie into a `DealerPrincipal`. → Without it, every request is
anonymous and no tenant can be resolved.

**Authorization** — deciding *what you may do*. → `requirePermission('vehicle:write')`
refuses a `SALES` seat. → Authentication without authorization means everyone who
can log in can do everything.

**Principal** — the in-memory answer to "who is making this request". →
`DealerPrincipal { userId, dealerId, dealerSlug, role, dealerStatus, permissions }`,
attached to `req.principal`. → It is the **only** source of `dealerId`, which is
what makes tenant isolation structural rather than remembered.

**Session** — a server-side record that a browser is currently acting as an
account. → a row in `sessions` with `tokenHash`, `scope`, `expiresAt`,
`revokedAt`. → Revocation is one `UPDATE` and takes effect on the next request.

**Cookie** — a named string the server asks the browser to store and send back
automatically. → `dd_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, 30 days. →
`HttpOnly` keeps it out of JavaScript's reach; `SameSite=Lax` is the CSRF defence.

**Opaque token** — a credential that encodes nothing; it is only a lookup key. →
`randomBytes(32).toString('base64url')`, with **only its SHA-256 stored**. → A
leaked database dump hands over nothing usable.

**OAuth 2.0** — a protocol for delegated authorization: getting a token to act on
a resource on someone's behalf. → the redirect dance with Google. → On its own it
does **not** tell you who the user is.

**OIDC (OpenID Connect)** — a thin identity layer on top of OAuth 2.0 that adds a
signed `id_token` of claims about the user. → the `id_token` decoded in
`google.provider.ts`. → It is what turns "I got a token" into "I know who this
is."

**Authorization Code Flow** — the OAuth flow where the browser receives a
short-lived `code` and the **server** exchanges it for tokens using its client
secret. → `/v1/auth/google/start` → `/callback` → `POST /token`. → The tokens
never pass through the browser.

**PKCE** — Proof Key for Code Exchange. A random `code_verifier`, of which
`SHA-256` is sent as the `code_challenge`; redeeming the code requires the
verifier. → `challengeFor(codeVerifier)` in `google.provider.ts`. → An
intercepted authorization code is useless without the verifier.

**Nonce** — a one-time value placed in the authorization request and echoed inside
the `id_token`. → `claims.nonce !== expected.nonce → reject`. → Prevents replaying
an ID token obtained in a different session.

**`state`** — a CSRF token for the OAuth redirect itself. → sealed into the
`dd_oauth` cookie and compared on callback. → Prevents **login CSRF**: being
signed in as the attacker without noticing.

**`sub` (subject)** — the identity provider's **stable** identifier for an
account. → `OAuthIdentity.providerSubject`, unique with `provider`. → The email
can change hands; the `sub` cannot. Looking up by email is an account-takeover
primitive.

**Tenant** — a customer whose data must be invisible to every other customer, in a
shared database. → a `Dealer` row and everything carrying its `dealerId`. → A
missed `WHERE` clause is a data breach.

**Multi-tenancy** — one application serving many tenants. → shared schema with a
`dealerId` discriminator column on every dealer-owned table. → Physical isolation
would make cross-tenant search impossible, and that search is the product.

**RBAC** — Role-Based Access Control: permissions attach to roles, users get
roles. → `OWNER`/`MANAGER`/`SALES` × the `PERMISSIONS` table. → Adding a role is a
table edit, not an audit of every `if`.

**Permission** — one named capability. → `'billing:purchase': ['OWNER']`. →
Per-operation rather than per-role blanket, so a `MANAGER` can read the balance
without being able to spend money.

**Scope** — which console a session may reach. → `sessions.scope` is `DEALER` or
`ADMIN`, and it is in the `WHERE` clause. → A dealer's cookie cannot reach
`/v1/admin/**`, even for one human holding both seats.

**Middleware** — a function in the request pipeline that can inspect, modify,
short-circuit, or pass the request along. → `requestContext` → `helmet`/`cors` →
parsers → logger → guards → `validate` → handler. → **The order is the security
model.**

**Request context** — per-request data available anywhere without threading a
parameter. → `AsyncLocalStorage<RequestContext>` holding `traceId`, `ip`,
`userId`, `dealerId`. → The pino mixin stamps every log line automatically.

**Transaction** — a set of database operations that all succeed or all fail. →
`withTenant(prisma, dealerId, tx => { moveCredits(tx, …); tx.listing.create(…) })`. →
No credit charged for a listing that was never created.

**Row lock (`SELECT … FOR UPDATE`)** — an exclusive lock on one row, held until
the transaction commits. → `SELECT "creditBalance" FROM dealers WHERE id = $1 FOR UPDATE`. →
It is the only thing preventing two concurrent submits from both spending the last
credit.

**Race condition** — two operations interleaving in a way neither anticipated. →
two submits reading balance = 1 simultaneously. → Application-level checks are
suggestions under concurrency.

**TOCTOU** — Time Of Check To Time Of Use: verifying a condition, then acting on it
after it has stopped being true. → check ownership, then `UPDATE … WHERE id = ?`
with no `dealerId`. → Put the ownership predicate **in the write's `WHERE`
clause**, or hold a lock across both.

**Idempotency** — the property that doing something twice has the same effect as
doing it once. → `CreditTransaction.idempotencyKey @unique`; `INSERT … ON CONFLICT
DO UPDATE` in `search.index`. → Queues are at-least-once and gateways retry, so
non-idempotent handlers eventually double-charge someone.

**Webhook** — a third party calling *your* server when something happens. →
`POST /v1/webhooks/razorpay` — **NOT IMPLEMENTED**. → It is the only trustworthy
payment signal, because the browser can be closed, throttled, or lying.

**Outbox (transactional outbox)** — writing an intended side effect as a row in
your own database, in the same transaction as the state change, and delivering it
later. → `enqueueOutbox(tx, { type: 'ListingApproved', … })`. → Solves **dual
write**: it makes the side effect exactly as durable as the change that caused it.

**Dual write** — the impossible problem of atomically changing your database *and*
an external system. → "approve the listing and send the email". → The outbox is
the standard answer.

**Queue** — a durable list of work to be done later, with retries. → pg-boss in
the `pgboss` schema of the same Postgres. → It keeps slow, failure-prone work off
the request path.

**At-least-once delivery** — a message may be delivered more than once, but never
zero times. → the outbox marks `publishedAt` *after* publishing, so a crash in
between means redelivery. → This is why idempotency is mandatory, not optional.

**Eventual consistency** — a derived view catches up shortly after the source of
truth changes. → `listing_search` lags an approval by up to ~2 seconds. → Fine for
a catalogue; **not** fine for a credit balance, which is why the ledger is
transactional.

**Ledger** — an append-only record of movements, never updated, never deleted;
corrections are new rows. → `CreditTransaction` with `delta`, `balanceAfter`,
`reason`, `seq`. → It answers "why is my balance 5?" and makes reversals possible.

**`balanceAfter` (materialised running balance)** — the balance *after* this
movement, stored on the row. → read from the newest row by `seq DESC`. → Turns
"what is the balance?" into one indexed row read instead of a `SUM` over history.

**Read model** — a denormalized table shaped for how you query, derived from the
write model. → `listing_search`, one flat row per publicly visible car. →
Membership **is** the public-visibility rule, so no endpoint can get it wrong.

**Write model** — the normalized, constrained source of truth. → `dealers`,
`vehicles`, `listings`, `credit_transactions`. → Optimised for correctness, not
for query shape.

**Denormalization** — deliberately duplicating data to avoid joins. →
`listing_search.dealer_name`; `Listing.dealerId` (reachable via the vehicle);
`Vehicle.primaryMediaId`. → Trades write complexity for read speed; requires a
mechanism to keep copies fresh.

**CQRS-lite** — separating the model you write through from the model you read
through. → write model + `listing_search`. → You do not need the full pattern to
get most of the benefit.

**Presigned URL** — a time-limited, cryptographically signed URL granting one
specific operation on one specific object. → `storage.presignPut({ key,
contentType, contentLength })`. → The API grants permission without ever touching
the bytes.

**Object storage** — a service for storing blobs by key, addressed over HTTP. →
MinIO locally, Cloudflare R2 in production, both through one S3 adapter. →
Container filesystems are ephemeral; the API is not a file server.

**Content-addressed signature constraints** — baking content-type and
content-length into the signature. → a client that declared `image/jpeg` cannot
upload `text/html`, and one that declared 200 KB cannot upload 4 GB. → Without
them, "stored XSS on your own domain" and "unbounded storage bill."

**SSR (Server-Side Rendering)** — HTML generated on the server per request. → the
dealer console (`force-dynamic`). → The browser receives content, not a shell.

**ISR (Incremental Static Regeneration)** — cached server-rendered HTML,
regenerated in the background after a TTL. → `export const revalidate = 60` on
`/cars` and `/car/[slug]`. → Static-like speed with fresh-ish data.

**RSC (React Server Component)** — a component that runs only on the server, can
`await` data directly, and ships **no JavaScript**. → every page in
`app/(public)`. → SEO, smaller bundles, secrets stay server-side.

**Client Component** — a component marked `'use client'` that hydrates and runs in
the browser. → `photo-uploader.tsx` (needs `File`, `canvas`), `saved-store.tsx`
(needs `localStorage`). → Only where an event handler or browser API is genuinely
required.

**Hydration** — attaching React event handlers to server-rendered HTML in the
browser. → happens only for Client Components. → A hydration mismatch means the
server and client rendered different trees.

**Server Action** — a `'use server'` function a form or client component can call,
which executes on the server. → `submitEnquiryAction`, `adminLoginAction`. → Lets
a real `<form>` work without JavaScript, and keeps cookies and secrets
server-side.

**BFF (Backend For Frontend)** — a thin server-side endpoint that exists to serve
one specific client. → the seven handlers under `app/api/`. → Keeps the API base
URL out of the browser bundle, so no `NEXT_PUBLIC_*` is needed.

**OpenAPI** — a machine-readable description of an HTTP API. → generated from the
Zod contracts; 73 operations at `/api/docs`. → It is generated, not written, so it
cannot drift.

**Contract** — a schema that defines the shape of data crossing a boundary. →
`packages/contracts` — one definition that validates, types, documents and tests.
→ Eliminates the class of bug where client and server disagree about a field.

**`.strict()`** — Zod's mode where an unknown key is an error rather than being
silently stripped. → every input schema in `packages/contracts`. → Turns a
mass-assignment attempt into a loud, greppable 400.

**RFC 9457 (Problem Details)** — a standard JSON error envelope:
`type`/`title`/`status`/`detail`/instance, plus extensions. → every error this API
emits, as `application/problem+json` with `code` and `traceId`. → One error handler
in the client instead of one per endpoint.

**Observability** — the ability to answer questions about a running system you did
not anticipate. → structured pino logs with an automatic `traceId`. → "It's slow"
becomes a query rather than a guess.

**Structured logging** — one JSON object per event instead of a formatted string.
→ `{"level":"info","traceId":"…","dealerId":"…","durationMs":42}`. → Queryable and
aggregatable; a string is only greppable.

**Trace ID** — a per-request identifier that appears everywhere. → `nanoid(10)`
in `request-context.ts`, in the `x-trace-id` header, every log line, every error
body, every `AuditLog` row, and every `DomainEvent`. → A dealer quotes it and you
get the whole story, including from a job three seconds later.

**Health check** — an endpoint reporting whether a process is alive
(`/health/live`) or able to serve (`/health/ready`). → liveness deliberately
touches **nothing**, so a database blip cannot get every container killed.

**Rate limiting** — capping requests per identity per window. → 5 enquiries/hour
per IP; 5 admin logins/15 min per email; reveal-contact limited hourly **and**
daily. → Prevents brute force, spam, scraping — and controls SMS spend.

**CSRF** — Cross-Site Request Forgery: another site causing your browser to make
an authenticated request. → defended by `SameSite=Lax` plus a one-origin CORS
allow-list. A double-submit token is specified and **NOT IMPLEMENTED**. →
Cookies are attached automatically, which is exactly what the attack exploits.

**CORS** — a browser-enforced rule about which origins may *read* a cross-origin
response. → `cors({ origin: env.webOrigins, credentials: true })`. → Not
server-side access control — `curl` ignores it entirely.

**CSP (Content Security Policy)** — a header restricting which scripts, styles and
resources a page may load. → set by `helmet()`, with two documented per-route
exceptions (Swagger UI, media delivery). → The main defence-in-depth against XSS.

**Enumeration attack** — using response differences to discover which identifiers
or accounts exist. → defended by 404-not-403, identical login failures with a
timing decoy, UUID primary keys, and a platform-wide enquiry sequence. → Handing
a competitor a list of your live inventory ids is a competitive-intelligence leak.

**Argon2id** — a memory-hard password hashing function; OWASP's current
recommendation. → 19 MiB, 2 passes, in `password.ts`. → Memory hardness collapses
a GPU attacker's parallelism advantage.

**Row-Level Security (RLS)** — PostgreSQL policies restricting which rows a
database *role* can see. → **NOT IMPLEMENTED.** `withTenant` already issues
`SET LOCAL app.dealer_id`, so the hook is waiting. → It would be the backstop
behind session context, repository signatures and tests.

**Composition root** — the single place where all dependencies are constructed and
wired. → `container.ts`, `buildContainer(overrides)`. → Explicit, greppable, and
trivially testable: pass fakes in, get a module out.

**Port / Adapter** — an interface defining what the application needs, and
implementations providing it. → `StoragePort` (local/S3), `PaymentProvider`
(development/Razorpay), `MailerPort`, `SmsPort`, `SessionResolver`. → The
application depends on the interface, so swapping an implementation is one line in
the container.

**Facade** — the single file another module may import from a module. →
`billing.facade.ts` re-exports `moveCredits`, `currentBalance`,
`refreshHeldCount`. → Makes a module's public surface a written decision rather
than an accident.

**Paise** — 1/100 of a rupee; the integer unit all money is stored in. →
`pricePaise: BigInt` — `645000` is ₹6,450. → Floats lose money; conversion happens
only at the UI boundary via `formatLakh`.

**Soft delete** — marking a row deleted rather than removing it. →
`Vehicle.deletedAt`, plus `deletedAt: null` in every read predicate. → Preserves
history and referential integrity; **you must remember the predicate everywhere.**

**Slug** — a URL-safe identifier derived from a name. →
`/car/2021-maruti-swift-vxi-vellore-a3f8`, `/dealers/sri-lakshmi-motors`. → Better
for SEO and humans than a UUID; the uniqueness logic lives in `uniqueSlug()`.

**Seed** — a script that builds a known dataset for development and tests. →
5 dealers, 23 vehicles, 18 live listings, 4 credit packs, ~100 images. → The credit
ledger is **built, not asserted** — each dealer's balance is whatever the chain of
grants, purchases, holds and consumptions arrives at, *because the ledger is the
truth*.

---
---

# Part 29 — Consolidated gaps, mocks, and spec/code conflicts

Read this before promising anyone a feature.

## 29.1 NOT IMPLEMENTED

| Thing | Evidence | Notes |
|---|---|---|
| **Razorpay adapter** | only `development.provider.ts` exists | port shaped for it; §12.2 of `CONTEXT.md` has the plan |
| **Payment webhook route** | no `/v1/webhooks/*` in `routes.ts` | `WebhookEvent` model exists, unused by any code |
| **Refund endpoint** | `admin:payment:refund` in the permission table | no route behind it |
| **Resend mailer** | `createConsoleMailer()` only | `MAIL_DRIVER` accepts `smtp`/`resend`; neither is wired |
| **PostgreSQL RLS** | `prisma/rls.sql` **does not exist** (confirmed again 2026-08-24) | `withTenant` issues `SET LOCAL app.dealer_id`; nothing reads it. Layers 1, 2 and 4 of the four-layer model are in place and tested |
| **CSRF double-submit token** | no `X-CSRF-Token` anywhere | specified in ARCHITECTURE §8.2 and API-SPEC §0.3 |
| **Admin TOTP / 2FA** | `totpSecret`, `totpEnabledAt` never read or written | ARCHITECTURE §8.2 says "mandatory" |
| **Separate worker process** | no `worker.ts` | `WORKER_INLINE=true`; this is why `dd-api-prod` is capped at `desired-count 1` (§23.8, §33.2) |
| ~~Web Dockerfile~~ | **NOW IMPLEMENTED** — `apps/web/Dockerfile`, multi-stage, non-root, builds with nothing running | §23.3 |
| ~~CI/CD workflows~~ | **NOW IMPLEMENTED** — `ci.yml`, `security.yml`, `release.yml`, `promote.yml`, `_deploy.yml`, plus `dependabot.yml` | **Part 31** |
| **Sentry** | `SENTRY_DSN` validated; **no SDK installed** | TODO marked in `error-handler.ts` |
| **Metrics / `/metrics`** | none | the four that matter are named in `CONTEXT.md` §12.4. Credit-ledger drift is the one worth alerting on first (§32.9) |
| **Log shipping** | none | stdout is the interface; nothing consumes it |
| **Alerting** | none configured | the six CloudWatch alarms are specified in `docs/DEPLOYMENT.md` §Monitoring but are not yet created (§32.9) |
| **Job observability** | none | pg-boss state lives in the `pgboss` schema, unsurfaced |
| **Audit-log UI** | `GET /v1/admin/audit-logs` exists and is documented | no admin screen |
| **Account linking flow** | `ACCOUNT_LINK_REQUIRED` is a refusal | support inserts the `oauth_identities` row manually |
| **Team seats / invites** | `MANAGER`, `SALES`, `member:manage` all exist | no invite endpoint; every dealership has one member |
| **Photo requests** | `CreatePhotoRequestInput`, `photo:request`, `PhotoRequest` model | no endpoint |
| **Cross-instance rate limiting** | in-process `Map` | N instances = N× the limit; restart clears it. The `CachePort` + Redis swap is item 4 in §33.11 |
| **Invoice PDF** | `pdfMediaKey` is written | no PDF is generated |
| **Sitemap `lastmod`** | omitted deliberately | no public response carries a listing timestamp; left out rather than fabricated |
| **Mobile/tablet layouts** | desktop-scoped by the brief | breakpoints implemented where cheap |
| **CDN / public media domain** | `MEDIA_BASE_URL` points at the API in every environment, so image reads proxy through the Node process | one variable away; the DNS record is already reserved. **The highest-leverage scaling change available** (§33.3, §33.11 item 1) |
| **ECS autoscaling** | services run at a fixed `desired-count` | blocked on the worker entrypoint for the API; the web app could autoscale today (§33.4) |
| **Read replica** | one RDS instance per environment | `listing_search` is already a separate read path, so this is a second Prisma client, not a rewrite (§33.6) |
| **Multi-AZ RDS failover** | single-AZ, deliberately | a cost decision, written down rather than forgotten (§32.1) |
| **Multi-region / cross-region backups** | regional only, deliberately | region loss is an accepted multi-day RTO (§32.7) |
| **Backup restore rehearsal** | never performed | PITR is configured; nobody has restored from it. An untested backup is a hope (§35.11 item 9) |

## 29.2 DEV-ONLY / mocked

| Thing | What it really is | Production equivalent |
|---|---|---|
| `PAYMENT_PROVIDER=development` | settles inline, no gateway contacted | Razorpay + webhook |
| `MailerPort` = `createConsoleMailer()` | logs what would have been sent | Resend/SMTP |
| `SmsPort` = `console` (default) | logs | MSG91 |
| `AUTH_MODE=dev` | server-configured identity, **refused in production**, warns on every boot | `CookieSessionResolver` |
| `STORAGE_DRIVER=local` | filesystem + HMAC-signed `/uploads` route; **refused in production** | MinIO / R2 (same S3 adapter) |
| `JOBS_ENABLED=false` | inline queue, handlers run at send time | pg-boss |
| `WORKER_INLINE=true` | job handlers inside the HTTP process | separate worker process |

**`Msg91Sms` deserves its own line:** it is real code, written against MSG91's
documented API and unit-tested with a stubbed `fetch` — and it has **never sent a
real message.** India's DLT registration of the entity, sender header and every
template must land before the first send.

## 29.3 SPEC ≠ CODE

| Conflict | ARCHITECTURE / API-SPEC says | Code does | Resolution |
|---|---|---|---|
| Session expiry | "Max-Age 30 days (**sliding**)" | fixed `expiresAt` at issue; never extended | **not sliding** |
| Session rotation | "rotates on login and on any privilege change" | issued at sign-in only | **no rotation** |
| CSRF | double-submit `X-CSRF-Token` | `SameSite=Lax` + CORS allow-list | **not implemented** |
| Admin 2FA | "mandatory TOTP" | columns exist, unused | **not implemented** (ARCHITECTURE flags it in an r3 note) |
| RLS | four-layer model, layer 3 = RLS | `SET LOCAL` issued, no policies | **layers 1, 2, 4 only** |
| `Vehicle` nullability | ARCHITECTURE implies non-null | API-SPEC's draft flow requires nullable | **resolved in favour of API-SPEC** — drafting is otherwise unimplementable. `CONTEXT.md` §11 flags this as the one place two source-of-truth documents disagree, and says it is worth a decision from whoever owns the specs |
| `docs/MVP-SCOPE.md` | referenced by ARCHITECTURE | absent | ARCHITECTURE §5.5 carries the same numbered rules |

## 29.4 Stale entries inside `CONTEXT.md` itself

`CONTEXT.md` §11's "Known gaps" table has drifted from §6 of the same file and
from the code. Trust the code:

| §11 claims | Reality |
|---|---|
| "R2 storage adapter — not written" | `STORAGE_DRIVER=r2` is supported by the shared S3 adapter (`env.ts`, `factory.ts`, `s3.adapter.ts`), and §6 of the same document says so |
| "MSG91 adapter — not written" | `platform/notify/msg91.adapter.ts` exists, is wired by `container.ts` under `SMS_DRIVER=msg91`, and is unit-tested |

The Resend mailer row **is** accurate — that one is genuinely not written.

Also note §7's test-file table lists 10 files while the prose says 8; the
repository currently has 11 integration test files plus a large unit tree. The
counts in that section have drifted; the *descriptions* of what each file pins are
still accurate.

## 29.5 The one unexplained flake

`CONTEXT.md` §11 records a **401 on a public GET** seen twice in ~30 runs, not
reproduced in 21 consecutive runs since. What was ruled out is documented there.

> If you see it again, capture the response body and the `x-trace-id` **before
> doing anything else** — that is the missing evidence.

## 29.6 Traps that have already cost someone time

From `CONTEXT.md` §9, so they only cost it once:

- **Tailwind v4 CSS variables:** `bg-(--var)` is the arbitrary-value syntax. The
  v3 shorthand `bg-[--var]` compiles silently and emits invalid CSS. 66
  occurrences were fixed once; do not reintroduce it.
- **helmet's `Cross-Origin-Resource-Policy: same-origin`** blocks cross-origin
  image embedding. The media route sends `cross-origin`; the JSON API keeps the
  strict default.
- **`'use server'` modules may only export async functions.** Constants go in a
  sibling file (`features/enquiry/shared.ts`).
- **`.strict()` rejects `undefined`.** An action with no input must send `{}`.
  `lib/api.ts` defaults non-DELETE bodies to `{}` for exactly this reason —
  bypassing it silently 400s, and once made admin Approve do nothing at all.
- **A placeholder is page source.** The enquiry form's phone placeholder once
  matched a seeded dealer's real number. It is now `9876543210`.
- **Swagger UI needs a looser CSP** than the API — replaced on that route only.
- **Express 5 compiles mount paths** into matcher functions and does not keep the
  string, so the full path cannot be recovered from the router tree. The OpenAPI
  coverage test works around this.
- **Stale processes squat on ports.** Check
  `lsof -nP -iTCP:<port> -sTCP:LISTEN` before concluding a build is broken.

---
---

# Part 30 — Turborepo and the monorepo build system

You do not need Turborepo to understand this codebase. You need it to understand
why `pnpm test` at the root does the right thing, why CI is fast, and why the
Docker builds are shaped the way they are.

## 30.1 First principles: what problem a monorepo creates

A **monorepo** is one git repository containing several independently-built
packages. Dealers-Drive has four:

```
dealers-drive/
├── apps/
│   ├── api          @dealers-drive/api        Express 5 server
│   └── web          @dealers-drive/web        Next.js 15 app
└── packages/
    ├── contracts    @dealers-drive/contracts  Zod schemas + inferred types
    └── config       @dealers-drive/config     shared eslint + tsconfig presets
```

The alternative — four repositories — has one fatal property for this system:
`contracts` defines the request and response shapes that `api` validates against
and `web` renders. In four repos, changing a shape means publishing a new
`contracts` version, then a PR to `api`, then a PR to `web`, and in between there
is a window where the deployed API and the deployed web app disagree about what a
`VehicleDto` is. In one repo, one commit changes all three and CI type-checks all
three together. **That is the entire reason this is a monorepo.**

But a monorepo creates a problem of its own: dependency order. `api` imports
`@dealers-drive/contracts`, and nothing that imports `@dealers-drive/contracts`
compiles until `contracts` has been built into `dist/`. Run the four builds in
the wrong order and everything fails. Run them all serially every time and a
one-line CSS change costs a full rebuild of everything.

Two tools split that problem:

- **pnpm workspaces** answers *"where does `@dealers-drive/contracts` resolve
  from?"*
- **Turborepo** answers *"in what order do these tasks run, and which of them can
  I skip?"*

## 30.2 pnpm workspaces — the resolution half

`pnpm-workspace.yaml`, in full:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

That tells pnpm those directories are members of one workspace. When
`apps/api/package.json` says:

```json
"@dealers-drive/contracts": "workspace:*"
```

`workspace:*` is a pnpm protocol meaning **"do not go to the npm registry; link
the local package"**. `pnpm install` creates
`apps/api/node_modules/@dealers-drive/contracts` as a symlink to
`packages/contracts`. An import in the API resolves to the local source tree, so
a change there is visible immediately — no publish, no version bump, no `npm
link`.

Two more pnpm properties that matter here:

**The content-addressable store.** pnpm keeps one copy of each package version on
disk (`~/.pnpm-store`) and hard-links it into each `node_modules`. Four packages
that all depend on `zod@4.4.3` cost one copy, not four. That is why
`pnpm install --frozen-lockfile` in CI is fast and why the Docker `deps` layer is
small.

**Strict `node_modules` by default.** npm and yarn flatten `node_modules`, so a
package can `import` something it never declared as a dependency and it happens
to work — until the transitive dependency that supplied it is removed. pnpm's
layout makes an undeclared import fail immediately. `.npmrc` in the repo root is
where any exception to that would live.

`--frozen-lockfile` deserves a sentence of its own: it makes `pnpm install` fail
rather than update `pnpm-lock.yaml`. Every install in CI and in every Dockerfile
uses it, which is what makes "the dependency tree CI tested" and "the dependency
tree the image contains" the same tree.

## 30.3 Turborepo — the ordering half

`turbo.json` in full, annotated:

```jsonc
{
  "ui": "stream",
  "globalDependencies": [".env", ".nvmrc", "tsconfig.json"],
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],                        // ← the important line
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev":       { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "lint":      { "dependsOn": ["^build"], "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": ["dist/**", "*.tsbuildinfo"] },
    "test":      { "dependsOn": ["^build"], "outputs": [], "cache": false },
    "clean":     { "cache": false }
  }
}
```

### `dependsOn: ["^build"]` — the caret is everything

- `"build"` (no caret) would mean *"this package's own build task"*.
- `"^build"` means **"the `build` task of every package this package depends
  on"**.

So `turbo run build` reads the dependency graph from the `package.json` files,
sees that `api` and `web` both depend on `contracts`, and produces this plan:

```
                    ┌─ contracts#build ─┐
                    │                    ├─▶ api#build   ─┐
   (nothing) ───────┤                    │                 ├─▶ done
                    │                    ├─▶ web#build   ─┘
                    └────────────────────┘
                     runs first, alone      then these two, IN PARALLEL
```

`api#build` and `web#build` have no relationship to each other, so Turbo runs
them concurrently across cores. You never write that plan down; it is derived.

`test`, `lint` and `typecheck` all declare `dependsOn: ["^build"]` for the same
reason: none of them can run against `@dealers-drive/contracts` until its `dist/`
exists, because `packages/contracts/package.json` points `types` and `main` at
`./dist/`.

### `outputs` — what caching actually is

Turborepo's cache is a **content-addressed function cache**. Before running a
task it hashes:

- every non-ignored file in the package,
- the resolved dependency versions,
- the task's own configuration,
- the hashes of all `dependsOn` tasks,
- anything named in `globalDependencies` (here: `.env`, `.nvmrc`, root
  `tsconfig.json`),
- the environment variables named in `globalEnv` / `env`.

If that hash is already in the cache, Turbo **does not run the task**. It
replays the recorded stdout and restores the declared `outputs` from the cache
directory (`.turbo/cache/`, or a remote cache if one is configured). You see:

```
contracts#build: cache hit, replaying logs
```

This is why `outputs` must be declared correctly. A task whose real output is not
listed will appear to succeed from cache while leaving nothing on disk. Notice
`"!.next/cache/**"` on `build`: Next's own incremental cache is machine-local
scratch, and caching it would bloat every cache entry for no benefit.

And this is why `test` sets `"cache": false`. The integration suite talks to a
real Postgres; its result depends on database state that Turbo cannot hash. A
cached "pass" would be a lie.

### `persistent: true`

`dev` never exits. `persistent` tells Turbo not to wait for it before considering
the run complete, and to refuse to let another task depend on it — a task that
never finishes cannot be a prerequisite. This is why `pnpm dev` starts
`contracts` in watch mode, `tsx watch` for the API and `next dev` for the web app
and holds all three open in one terminal.

### `globalEnv` and the environment-hash trap

Turbo deliberately hashes only the environment variables you declare. If a task's
output depends on an undeclared variable, you get a cache hit that produces the
wrong bytes. Here `globalEnv` is just `["NODE_ENV"]` — which is safe **precisely
because** `NEXT_PUBLIC_*` is banned and nothing environment-specific is read at
build time (§23.3). The two rules protect each other.

## 30.4 The six root commands

```bash
pnpm dev        # turbo run dev        — everything in watch mode, one terminal
pnpm build      # turbo run build      — contracts, then api and web in parallel
pnpm lint       # turbo run lint       — eslint in each package
pnpm typecheck  # turbo run typecheck  — tsc --noEmit in each package
pnpm test       # turbo run test       — vitest in each package, coverage gates on
pnpm clean      # turbo run clean      — rm -rf dist .next .turbo *.tsbuildinfo
```

`lint`, `typecheck`, `test`, `build` are the four commands the working agreements
name, and they are exactly the four `ci.yml` runs. Nothing you can pass CI with
is something you could not have run locally in one line.

To scope a command to one package, use pnpm's filter rather than `cd`:

```bash
pnpm --filter @dealers-drive/api test
pnpm --filter @dealers-drive/api db:migrate
pnpm --filter @dealers-drive/web dev
```

`--filter @dealers-drive/api...` (with the trailing `...`) means *"that package
**and everything it depends on**"*. That is what the Dockerfiles use:

```dockerfile
RUN pnpm install --frozen-lockfile --prod --filter @dealers-drive/api...
```

— install production dependencies for the API *and* for `contracts`, and nothing
for `web`. It is why the API image does not contain React.

## 30.5 `packages/config` — why shared presets are a package

`@dealers-drive/config` ships no code. It exports files:

```json
"exports": {
  "./tsconfig/base.json": "./tsconfig/base.json",
  "./tsconfig/node.json": "./tsconfig/node.json",
  "./tsconfig/next.json": "./tsconfig/next.json",
  "./eslint/base":        "./eslint/base.js",
  "./eslint/node":        "./eslint/node.js",
  "./eslint/next":        "./eslint/next.js"
}
```

Each app's `tsconfig.json` extends the right preset, and each app's
`eslint.config.js` imports the right flat config. Without this, "strict mode on"
is a decision made four times and silently relaxed in one of them. With it,
tightening a compiler option is one commit in one file, and the four packages
either all pass or the PR is red.

This is also where the module-boundary rules are enforced. ARCHITECTURE §5.5
rule 2 says only `*.repository.ts` may import `platform/db/prisma` — that is an
ESLint rule living in `packages/config/eslint/node.js`, not a convention people
remember.

## 30.6 How the monorepo shapes the Dockerfiles

Both Dockerfiles are built **from the repository root**, not from the app
directory:

```bash
docker build -f apps/api/Dockerfile -t dealers-drive-api .
#                                                        ↑ the whole monorepo
```

They have to be: the API imports `@dealers-drive/contracts`, which lives outside
`apps/api/`. A build context of `apps/api` could not see it.

The `deps` stage then does something that looks pedantic and is not:

```dockerfile
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile
```

Only the **manifests** are copied before `pnpm install`. Docker caches layers by
their inputs, so this `RUN` is re-executed only when a `package.json` or the
lockfile changes — not when someone edits a `.tsx` file. Copy the whole tree
first and every source change reinstalls the entire dependency tree, turning a
30-second image build into a four-minute one.

`.dockerignore` is the other half of that: it keeps `node_modules`, `.next`,
`dist` and `.git` out of the build context entirely, so the daemon is not
shipping a gigabyte of files it will overwrite anyway.

## 30.7 What breaks, and what it looks like

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '@dealers-drive/contracts'` | `contracts/dist` does not exist | `pnpm build`, or `pnpm --filter @dealers-drive/contracts build` |
| Types are stale after editing a Zod schema | `contracts` watch not running, or `dist` is old | `pnpm dev` at the root, not `next dev` in `apps/web` |
| `Cannot find module '@prisma/client'` or `PrismaClient` has no models | the Prisma client is **generated**, not committed | `pnpm --filter @dealers-drive/api db:generate` |
| A task "passed" but produced nothing | wrong or missing `outputs` in `turbo.json` | fix `outputs`; `pnpm clean` to prove it |
| Lockfile mismatch in CI or Docker | someone installed without committing `pnpm-lock.yaml` | commit the lockfile; `--frozen-lockfile` is doing its job |
| A cached build that should not have been cached | an input Turbo does not hash | add it to `globalDependencies` or the task's `env` |

> The Prisma one catches nearly everyone once. `prisma generate` writes the typed
> client into `node_modules/.prisma/client` from `schema.prisma`. It is a build
> artifact, so it is in `.gitignore`, so a fresh clone has no `PrismaClient`
> types at all. Both `ci.yml` and the API Dockerfile run it explicitly, before
> anything that type-checks.

---
---

# Part 31 — CI/CD: from a pull request to production

This part answers the question the way you would ask it out loud: *"I opened a
PR. Then I merged it. Then somebody promoted it. What actually happened at each
of those three moments?"*

## 31.1 First principles: what CI and CD are, and why they exist

**Continuous Integration (CI)** is the practice of proving, automatically and on
every change, that the codebase still works — *before* the change becomes part of
the shared branch. The failure it prevents is not "a bug shipped"; it is "`main`
is broken and now nobody can ship anything".

**Continuous Delivery (CD)** is the practice of making a deployment a
*decision*, not a *procedure*. If deploying means fifteen manual steps, you
deploy rarely, each deploy contains a month of changes, and when one breaks you
cannot tell which change did it. If deploying is one button, you deploy small
changes often and the blast radius of any one of them is small.

Both rest on the same idea: **the artifact you test is the artifact you ship.**
This is why the pipeline builds an image *once*, tags it with the commit SHA, and
promotes those exact bytes. A rebuild for production would be a different
artifact from the one dev has been running.

The GitHub vocabulary you need:

| Term | Meaning |
|---|---|
| **Workflow** | a YAML file in `.github/workflows/` describing what runs and when |
| **Trigger** (`on:`) | what starts it — `pull_request`, `push`, `workflow_dispatch` (a button), `schedule` (cron), `workflow_call` (another workflow) |
| **Job** | a unit that runs on its own fresh virtual machine. Jobs are parallel unless one `needs:` another |
| **Step** | one command or one reusable Action inside a job |
| **Runner** | the VM (`ubuntu-latest`), destroyed when the job ends |
| **Service container** | a Docker container the runner starts alongside the job — here, Postgres |
| **Environment** | a named deployment target (`dev`, `production`) carrying its own secrets and, optionally, **required reviewers** |
| **Secret** vs **variable** | secrets are masked in logs; variables are not. `AWS_DEPLOY_ROLE_ARN` is a secret; `ECS_CLUSTER` is a variable |
| **OIDC** | GitHub mints a short-lived signed token proving *"this job, in this repo, on this ref"*. AWS trades it for temporary credentials. **No AWS key is stored anywhere in this repository** |

## 31.2 The five workflows, and what each one proves

```
   ┌──────────────────────────────────────────────────────────────────┐
   │  YOU OPEN A PULL REQUEST                                         │
   │                                                                  │
   │   ci.yml ──────┬── verify   lint · typecheck · test · build      │
   │                ├── docker   both images build, nothing running   │
   │                └── audit    pnpm audit, blocking at critical     │
   │   security.yml ┬── semgrep  static analysis                      │
   │                └── gitleaks secrets, including in history        │
   │                                                                  │
   │   NO CREDENTIALS. NO IMAGE PUSHED. NO ENVIRONMENT TOUCHED.       │
   └───────────────────────────┬──────────────────────────────────────┘
                               │ all required checks green, review approved
                               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  YOU MERGE TO main                                               │
   │                                                                  │
   │   ci.yml + security.yml run again on main                        │
   │   release.yml ─┬── build & push  api · migrator · web            │
   │                │                 → ECR, tag sha-<commit>         │
   │                └── calls _deploy.yml  environment: dev           │
   │                                                                  │
   │   DEV IS NOW RUNNING YOUR COMMIT. PRODUCTION IS UNTOUCHED.       │
   └───────────────────────────┬──────────────────────────────────────┘
                               │ a human tests dev and decides
                               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  Actions → "Promote to Production" → Run workflow                │
   │                                                                  │
   │   promote.yml ─┬── preflight   read dev /health/ready,           │
   │                │               resolve + verify the SHA          │
   │                └── calls _deploy.yml  environment: production    │
   │                          ⏸  GitHub pauses for a required review  │
   │                                                                  │
   │   NO BUILD STEP. THE SAME BYTES DEV HAS BEEN RUNNING.            │
   └──────────────────────────────────────────────────────────────────┘
```

## 31.3 Moment one — you open a pull request

### `ci.yml` job `verify`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env: { POSTGRES_USER: dealersdrive, POSTGRES_PASSWORD: dealersdrive, POSTGRES_DB: dealersdrive }
    ports: ['5432:5432']
    options: --health-cmd "pg_isready -U dealersdrive -d dealersdrive" ...
```

Those credentials are **not placeholders**. `apps/api/tests/global-setup.ts`
connects to exactly that URL and creates `dealersdrive_test` from it. Change them
here and the integration suite cannot find a database.

Then, in order:

1. `pnpm install --frozen-lockfile`
2. **`pnpm --filter @dealers-drive/api db:generate`** — the Prisma client is a
   build artifact, not a committed file. Nothing that imports `@prisma/client`
   type-checks until it exists, so this runs *before* the checks rather than as
   part of one.
3. `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`

The Postgres service is there because the integration suite is **not mocked**. It
asserts invariants that only exist in the database — the `creditBalance >= 0`
check constraint, the partial unique index that stops two live listings for one
vehicle, `SELECT … FOR UPDATE` ordering under concurrency. A mock cannot fail
those, which means a mock cannot prove them.

> **`pnpm format:check` is deliberately absent**, with the reason written in the
> workflow: it currently reports ~120 pre-existing files, so adding it would make
> every PR red for reasons unrelated to the change in it — and a check that is
> always red is a check nobody reads. Run `pnpm format` once across the
> repository and it becomes a one-line addition worth making.

### `ci.yml` job `docker`

Builds both images with `push: false` and **no registry login**. It proves
something `verify` cannot: that the two Dockerfiles still produce an image from a
clean checkout, with nothing running.

The web build is the one that earns its place. It must succeed with no API and no
database (§23.3). If a route ever starts prerendering data again, this job is
where it fails — on the pull request, rather than on `main` after the merge.

### `ci.yml` job `audit`

```yaml
- run: pnpm audit --audit-level=critical      # blocks
- run: pnpm audit --audit-level=high          # continue-on-error: true
  continue-on-error: true
```

The split is deliberate. Every current high-severity advisory here is transitive
through `next` or `prisma` and has no fix this repository can apply. A gate that
is red for reasons nobody can act on gets ignored — and then the critical one is
ignored too. `.github/dependabot.yml` is what actually closes these, by raising
the upstream bump as a weekly grouped PR.

### `security.yml`

Two tools, two different questions:

- **Semgrep** — *is there a vulnerability in the code we wrote?* It runs in the
  official `semgrep/semgrep` container with `--metrics=off`, and it **replaced
  CodeQL** for a licensing reason rather than a technical one: uploading CodeQL
  results needs GitHub Code Security on a private repository. Semgrep OSS fails
  the job directly on findings, which is the part that gates a merge.
- **gitleaks** — *is there a credential in the repository, or anywhere in its
  history?* A secret that was committed and later deleted is still leaked;
  scanning only the working tree would miss it. `.gitleaks.toml` extends the
  default rule set with exactly one allowlist entry — object-storage *keys* in
  the storage adapter's tests, which the `generic-api-key` rule reads as
  credentials. The rule recorded there for adding to it is worth keeping:
  allowlist a **pattern that cannot be a secret**, never a path that merely
  happens to contain one today.

Both also run **weekly on a cron**, because a rule published upstream can find
something in code nobody has touched for months.

### Branch protection

None of the above matters unless it is required. `main` requires: the five checks
above, a pull request, an up-to-date branch, no force pushes, no deletions — and
**including administrators**. A rule you can wave through is a rule you will wave
through at 11pm.

## 31.4 Moment two — you merge to `main`

`release.yml` fires. It is **the only place an image is ever built**.

### Step 1 — assume the CI role, via OIDC

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_CI_ROLE_ARN }}
    aws-region: ${{ vars.AWS_REGION }}
```

`permissions: id-token: write` lets the job request a signed OIDC token from
GitHub. It contains claims including `repo:owner/dealers-drive:ref:refs/heads/main`.
The `dd-gha-ci` IAM role's trust policy accepts **only** that subject, and its
permission policy allows **only** pushing to the three ECR repositories. It
cannot deploy anything. Building and deploying are different privileges, so they
are different roles.

### Step 2 — build and push three images

```yaml
build-args: GIT_SHA=${{ github.sha }}
tags: ${{ steps.ecr.outputs.registry }}/${{ vars.ECR_REPO_API }}:sha-${{ github.sha }}
cache-from: type=gha,scope=api
cache-to:   type=gha,scope=api,mode=max
provenance: true
```

- **`sha-<commit>` and nothing else.** No `latest`. `latest` is a moving target,
  and a moving target cannot be rolled back to. The ECR repositories are created
  with `--image-tag-mutability IMMUTABLE`, so `sha-9f2c1a` means one set of bytes
  forever.
- **`cache-from`/`cache-to: type=gha`** reuses Docker layers across workflow
  runs. The `deps` layer (§30.6) is the one this saves.
- **`provenance: true`** attaches a signed SLSA attestation recording which
  workflow, which commit and which runner produced the image — supply-chain
  evidence.

### Step 3 — deploy to dev

```yaml
deploy-dev:
  needs: build
  uses: ./.github/workflows/_deploy.yml
  with: { environment: dev, sha: ${{ needs.build.outputs.sha }} }
```

Note the absent `secrets: inherit`. The called workflow's job declares
`environment: dev` and reads `AWS_DEPLOY_ROLE_ARN` from that environment's own
secret store. Inheriting would hand every repository secret to the called
workflow for no benefit.

**Production is not touched. Ever. By this workflow.**

## 31.5 `_deploy.yml` — the same procedure for both environments

One workflow deploys dev and production. Production is not a different
procedure; it is the same procedure with a different environment name, a
different set of secrets, and a human standing in front of it.

**It never builds an image.** It takes a SHA and rolls out what already exists.

```
 1. checkout at inputs.sha        ← the smoke test must be the one from THIS commit
 2. check AWS_DEPLOY_ROLE_ARN is set   → a clear error instead of an opaque OIDC failure
 3. assume the deployment role (OIDC, environment-scoped)
 4. resolve image references      → registry/repo:sha-<commit>, ×3
 5. VERIFY THE IMAGES EXIST in ECR    → fail in 5 seconds, not 5 minutes
 6. RUN MIGRATIONS                    → one-off Fargate task, migrator image, inside the VPC
 7. deploy the API   → wait-for-service-stability
 8. deploy the web   → wait-for-service-stability
 9. SMOKE TEST the public URLs
10. write a job summary
```

### Why that order

**Images before anything.** A tag that is not in ECR means a promotion of
something that was never built — most often a SHA someone typed by hand. Say so
immediately, before touching a service.

**Migrations before the new tasks take traffic.** Which means, for a minute or
two, the *old* code is running against the *new* schema. That is legal only
because every migration is expand/contract (§32.5) — and it is the same property
that makes rolling back to the previous image safe.

**API before web.** The web app calls the API server-side on nearly every render.
The API is the one that must already be answering.

The migration step is worth reading closely:

```bash
CURRENT=$(aws ecs describe-task-definition --task-definition "$FAMILY" --query taskDefinition)
NEXT=$(echo "$CURRENT" | jq --arg image "$IMAGE_MIGRATOR" '.containerDefinitions[0].image = $image | del(...)')
TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json "$NEXT" ...)
TASK_ARN=$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$TASK_DEF_ARN" --launch-type FARGATE ...)
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"
EXIT_CODE=$(aws ecs describe-tasks ... --query 'tasks[0].containers[0].exitCode')
[ "$EXIT_CODE" != "0" ] && { echo "::error::Migrations failed. Nothing has been deployed — the running version is untouched."; exit 1; }
```

The migrator is a **task, not a service**: it runs `pnpm db:migrate:deploy`,
exits, and its exit code is the gate. `DATABASE_URL` is an SSM parameter
referenced by the task definition, so it is resolved inside AWS and GitHub never
sees a database credential for any environment.

### The shell-injection discipline

Every `${{ }}` in a `run:` block is bound to an environment variable first and
read as `$VAR` by the shell:

```yaml
env:
  SHA: ${{ inputs.sha }}
run: |
  TAG="sha-$SHA"       # ← data
```

`inputs.sha` and `inputs.reason` come from a `workflow_dispatch` form — strings a
human typed. **A string interpolated directly into a `run:` block is executed by
the runner.** `$SHA` is data; `${{ inputs.sha }}` inside a script is code. This
is a real GitHub Actions vulnerability class, not a style preference.

### Deploying a service

```yaml
- name: Fetch the current API task definition        # from AWS, not from git
- name: Render API task definition                   # change exactly one field: image
  uses: aws-actions/amazon-ecs-render-task-definition@v1
- name: Deploy the API
  uses: aws-actions/amazon-ecs-deploy-task-definition@v2
  with: { wait-for-service-stability: true }
```

Fetching from AWS rather than committing the task definition is deliberate: it
carries the environment variables and the SSM ARNs for that environment's
secrets, so keeping it in AWS means GitHub never holds them, and a value changed
in the console is not silently reverted by a stale file in git.

`wait-for-service-stability: true` is what makes a failed deploy fail the
workflow. ECS holds the rollout until the new tasks pass the target group health
check; the deployment circuit breaker restores the previous task definition on
its own if they never do (§23.5).

### Step 9 — the smoke test

`scripts/smoke.sh <web-url> <api-url> <expected-sha>`. A green ECS deployment
means the containers answered their health check. It does not mean the site
works, and it does not mean the *new* containers are the ones answering.

It is **deliberately read-only** — it signs nobody in, writes no row and uploads
no photo. A smoke test that mutates production is a smoke test nobody dares run
when they most need to. What it checks:

| Check | Why it exists |
|---|---|
| `/health/live` and `/health/ready` | a 503 from `/ready` names the failing dependency — a diagnosis, not a mystery |
| **`.version` equals the expected SHA** | the one thing a health check cannot answer: are the *new* tasks taking traffic, or are the old ones still answering just as well? |
| `GET /v1/vehicles` returns an array | the public marketplace read path — what a buyer sees |
| `GET /v1/auth/providers` → `google.enabled` | a deployment with no OAuth credentials starts perfectly and then cannot sign anybody in |
| `GET /v1/dealer/vehicles` → 401 | a deployment that lost its guard middleware must never reach a person |
| web `/api/health` `.version` | the same build check, for the Next task |
| the home page contains real markup | a 200 containing an error shell would pass a status check and fail every buyer |
| `robots.txt` matches `APP_ENV` | production must be crawlable; dev must **not** compete with production in search |
| the response is HTTPS, and `x-powered-by` is absent | TLS terminated, `app.disable('x-powered-by')` still in effect |

## 31.6 Moment three — promoting to production

Actions → **Promote to Production** → Run workflow.

```
sha:             blank = promote whatever dev is running now  (the common case)
skip_dev_check:  false  (true only for a rollback)
reason:          one line, recorded on the deployment
```

### The `preflight` job

It enters **no environment** and holds **no production secret** — it only reads a
public health endpoint. Everything checkable before a human is asked to approve
is checked here, so an approval is never spent on a promotion that was going to
fail on a typo.

```bash
READY=$(curl -fsS "$DEV_API_BASE_URL/health/ready")   # dev must be answering at all
LIVE_SHA=$(echo "$READY" | jq -r '.version')
STATUS=$(echo "$READY" | jq -r '.status')
SHA="${REQUESTED:-$LIVE_SHA}"                          # blank input = ship what I tested

if [ "$SKIP" != "true" ]; then
  [ "$STATUS" = "ok" ]      || die "dev reports status=$STATUS. Promoting a degraded build is how an outage spreads."
  [ "$SHA" = "$LIVE_SHA" ]  || die "$SHA is not what dev is running ($LIVE_SHA)."
fi
```

The `skip_dev_check` switch exists for exactly one reason, and it is why it is
not the default: **the SHA you want back during a rollback is, by definition, not
the one dev is running.**

### The approval gate

The gate is not a step in the workflow. It is the `production` **environment**
having required reviewers configured (Settings → Environments → production).
GitHub pauses the job before its first step and notifies the reviewers.

That same mechanism is what scopes the credentials. The `dd-gha-deploy-production`
IAM role trusts the OIDC subject
`repo:owner/dealers-drive:environment:production` — GitHub only mints a token
with that subject for a job that has **entered** the production environment, and
entering it requires the approval. A dev deploy cannot read a production secret
or touch a production service, because the token it can obtain does not say
`environment:production`.

The `iam:PassRole` permission on each deploy role is restricted to that
environment's own task roles, which is what stops a dev deployment from launching
a task wearing production's identity.

## 31.7 Rolling back

| Situation | What happens | How long |
|---|---|---|
| New tasks never go healthy | **Nothing to do.** ECS's circuit breaker restores the previous task definition by itself, before the new version serves a request. The workflow fails and says so. | seconds |
| A bad release that *is* healthy | Promote the previous SHA with `skip_dev_check: true` | < 5 min |
| Bad data or a destructive migration | RDS point-in-time recovery **into a new instance** (§32.7) | < 1 hour |
| Region loss | Accepted. Backups are regional. Stated out loud rather than implied. | days |

Rolling back the application is *rolling forward to older bytes* — no build, and
the images are the exact ones that were serving before. ECR's immutable tags are
what guarantee that.

**The database does not roll back.** A Prisma migration has no `down`. The
strategy that makes the application rollback safe is expand/contract, and it is
covered in §32.5.

## 31.8 What each moment costs you

| Moment | Wall clock | What is at risk |
|---|---|---|
| PR checks | ~5–8 min | nothing — no credentials, no environment |
| Merge → dev live | ~10–15 min | dev only |
| Promote → production live | ~4–6 min after approval | production, gated by a human and the circuit breaker |
| Rollback | ~4–6 min | the previous known-good bytes |

GitHub Actions usage is roughly 900 minutes/month against 2,000 free.

---
---

# Part 32 — Database operations

Part 9 covered *PostgreSQL the data model* — constraints, transactions, indexes,
row locking. This part covers *PostgreSQL the operated service*: who provisions
it, how the schema changes without downtime, what happens when the data is wrong,
and precisely where AWS's responsibility ends and yours begins.

## 32.1 The one-line summary of the shared-responsibility split

> **AWS keeps the database running. You keep the data correct.**

| | **AWS (RDS) does this** | **You do this** |
|---|---|---|
| Hardware, host OS, hypervisor | ✅ | |
| PostgreSQL installation, minor version patching | ✅ (in a maintenance window you configure) | |
| Major version upgrades | offers them | **you decide when, and test first** |
| Automated daily snapshots + continuous WAL archiving | ✅ | **you set the retention period** |
| Restore mechanics (PITR, snapshot restore) | ✅ | **you decide when to restore and to what point** |
| Storage autoscaling, encryption at rest | ✅ | you enable it |
| Multi-AZ failover | ✅ *if you pay for it* | **not enabled here** — single AZ |
| Replication plumbing for read replicas | ✅ | **you decide to create one and to route reads to it** |
| Metrics (CloudWatch, Performance Insights) | ✅ collects | **you set the alarms and read them** |
| Network isolation | provides subnet groups + SGs | **you configure them** |
| **Schema** | — | **entirely yours** |
| **Migrations** | — | **entirely yours** |
| **Query performance and indexes** | Performance Insights shows you | **entirely yours** |
| **Connection budget** | enforces `max_connections` | **entirely yours to stay under** |
| **Data correctness, ledger integrity, tenant isolation** | — | **entirely yours** |
| **Backup *testing*** | — | **yours. An untested backup is a hope, not a backup** |

The pattern generalises: a managed service removes the *operational* failure
modes (a disk fills, a host dies, a patch is missed) and removes **none** of the
*application* failure modes (a migration drops a column, a query has no index, a
connection leak exhausts the pool).

## 32.2 How the database is provisioned

Two RDS instances, created once by hand (`deploy/aws/README.md` §4):

```bash
aws rds create-db-instance \
  --db-instance-identifier dd-postgres-prod \
  --engine postgres --engine-version 16 \
  --db-instance-class db.t4g.small \
  --allocated-storage 20 --storage-type gp3 --storage-encrypted \
  --master-username dealersdrive --manage-master-user-password \
  --db-name dealersdrive \
  --no-publicly-accessible \
  --vpc-security-group-ids "$RDS_SG" --db-subnet-group-name dd-subnets \
  --backup-retention-period 7 --preferred-backup-window 18:00-19:00 \
  --deletion-protection \
  --enable-performance-insights
```

Every flag there is a decision:

| Flag | Why |
|---|---|
| **Two instances, not two databases on one instance** | An accidental `DATABASE_URL` with the wrong database *name* would still point at production's disk, CPU and connection limit. One runaway dev query would be a production incident. |
| `--no-publicly-accessible` + `dd-rds` security group | The database has no route from the internet, and accepts 5432 **only** from the `dd-app` security group. Not from a laptop. To open `psql`, use SSM Session Manager port-forwarding through a task — audited, and no bastion with a key somebody keeps. |
| `--storage-encrypted` | Encryption at rest, including snapshots. Free. |
| `--manage-master-user-password` | RDS generates and stores the password in Secrets Manager. Nobody types it, nobody pastes it into Slack. |
| `--backup-retention-period 7` | **This one flag is what enables point-in-time recovery.** 7 days on production, 1 on dev. Setting it to 0 disables PITR entirely. |
| `--deletion-protection` | Production only. `delete-db-instance` is refused until it is turned off deliberately. |
| `--enable-performance-insights` | The query-level profiler (§32.9). Free at 7-day retention. |
| `db.t4g.small` / `db.t4g.micro` | Graviton (ARM) burstable. ~$32 and ~$17/month. The first scaling decision you will make is `t4g.medium` (§33). |

**Local and CI are not RDS.** Locally it is the `postgres:16-alpine` container in
`docker-compose.yml`. In CI it is a GitHub Actions service container with the
same image. Same major version everywhere — a `pg_trgm` extension or a
`GENERATED ALWAYS AS` column that works locally and not in production is a class
of bug that version parity removes.

## 32.3 What is actually in the database

Three logical groups sharing one instance:

```
dealersdrive
├── public schema
│   ├── the write model      users, sessions, oauth_identities, dealers,
│   │                        dealer_members, dealer_documents, vehicles,
│   │                        vehicle_media, media, listings, enquiries,
│   │                        credit_transactions, orders, payments, invoices,
│   │                        audit_logs, cities, makes, models, variants, rtos…
│   ├── listing_search       the DENORMALIZED READ MODEL (Part 12)
│   │                        one row per publicly-visible listing, rebuilt by a
│   │                        job, with a generated tsvector + 10 indexes
│   └── outbox_events        the transactional outbox (Part 13)
└── pgboss schema            pg-boss's job queue tables
```

That last one is a real architectural choice, not an accident: **the queue lives
in the same database as the data**. It is what makes "enqueue a job" and "write
the row that job is about" one transaction, and it is why there is no Redis in
this system (Part 13, §26).

## 32.4 Migrations — the mechanics

A **migration** is a versioned, ordered SQL script that moves the schema from one
state to the next. The alternative — someone running `ALTER TABLE` by hand — has
no record, no ordering and no way to reproduce the schema on a new machine.

Prisma's model: `prisma/schema.prisma` is what you edit; the migration files are
what actually run.

```
apps/api/prisma/migrations/
├── 20260816183407_init/                     migration.sql
├── 20260816183500_search_and_invariants/    migration.sql
├── 20260816200000_credit_ledger_sequence/   migration.sql
├── 20260818120000_google_oauth_identity/    migration.sql
└── migration_lock.toml
```

Each is a timestamped directory containing raw SQL. **They are committed, and
they are immutable once merged.** Editing a migration that has already run
somewhere means that environment's schema and the file no longer agree; Prisma
detects this by checksum and refuses to proceed.

### The two commands, and never confusing them

| | `prisma migrate dev` | `prisma migrate deploy` |
|---|---|---|
| Where | **your laptop only** | **every deployed environment** |
| What it does | diffs `schema.prisma` against the DB, *generates* a new migration, applies it, regenerates the client | applies pending migrations, in order. Nothing else |
| Can it drop data? | **yes** — it will offer to reset the database | no. It only runs what is in the files |
| In this repo | `pnpm --filter @dealers-drive/api db:migrate` | `pnpm --filter @dealers-drive/api db:migrate:deploy` |

`migrate deploy` is the `CMD` of the migrator image. It never generates
anything, so what runs against production is exactly the SQL that ran in CI and
on dev.

### The developer loop

```bash
# 1. edit apps/api/prisma/schema.prisma
pnpm --filter @dealers-drive/api db:migrate      # names it, writes the SQL, applies it
# 2. READ the generated SQL. Every time. It is the thing that will run in production.
# 3. commit schema.prisma AND the migration directory together
```

Other commands you will use:

```bash
pnpm --filter @dealers-drive/api db:generate   # regenerate the typed client (after any schema edit)
pnpm --filter @dealers-drive/api db:studio     # a browser UI over the local database
pnpm --filter @dealers-drive/api db:reset      # DROP EVERYTHING, re-migrate, re-seed. Laptop only.
```

### Seeding: `db:seed` vs `db:bootstrap` — the distinction that matters most

| | `db:seed` | `db:bootstrap` |
|---|---|---|
| Where | **a laptop. Only.** | dev and production |
| What it does | **truncates every application table**, then invents 5 dealerships, 23 cars, enquiries, a credit ledger and placeholder images | writes the reference catalogue (cities, RTOs, colours, makes/models/variants), the credit packs, the config defaults and one platform admin |
| Idempotency | idempotent *by truncation* | **create-if-missing, never overwrite** — every write is an upsert with an empty update |
| Run it twice on production | catastrophe | harmless |

> **Never run `pnpm db:seed` against dev or production.** It truncates first.
> `db:bootstrap` is the deployed-environment command, run as a one-off Fargate
> task from the migrator image (`deploy/aws/README.md` §13).

An empty production database is not a blank slate — it is a broken product. A
dealer cannot list a car whose make does not exist, so the catalogue is part of
the deployment, not part of the data.

## 32.5 Expand/contract — why this is the most important idea in the part

During a rolling deploy, **two versions of the code are live at the same time.**
And `_deploy.yml` runs migrations *before* the new tasks take traffic, so there is
a window in which the **old** code is running against the **new** schema.

Therefore: **every migration must be backward-compatible with the currently
deployed release.**

```
❌ ONE STEP
   ALTER TABLE vehicles DROP COLUMN old_price;
   → the old tasks still SELECT it → 500s for every request during the rollout

✅ THREE RELEASES
   EXPAND   (release N)    add the new nullable column / new table / new index.
                           The running old code ignores it. Safe.
   MIGRATE  (release N)    the new code writes BOTH shapes; a job backfills the
                           new column from the old one; reads switch over.
   CONTRACT (release N+2)  once nothing reads the old column, drop it.
```

This is also **why "redeploy the previous image" is a complete rollback**: because
every migration is compatible with the previous release, the previous image
always runs correctly against the current schema. Expand/contract is not a purity
exercise; it is the precondition for §31.7 working at all.

The rules, ordered by how expensive they are to learn the hard way:

- **A rename is two releases.** Never one. Add the new column, dual-write,
  backfill, switch reads, then drop.
- **Never `ALTER COLUMN … SET NOT NULL`** on a populated table without a default
  and a *completed* backfill. It takes an `ACCESS EXCLUSIVE` lock and scans the
  whole table.
- **`CREATE INDEX CONCURRENTLY`** in production, always. A plain `CREATE INDEX`
  blocks every write to that table for the duration. `CONCURRENTLY` does not, at
  the cost of two passes and the possibility of leaving an invalid index that you
  must drop and retry.
- **Set `lock_timeout` and `statement_timeout`** in any migration touching a
  large table. Without them, a migration that cannot get its lock **queues behind
  a long-running query and then blocks every query behind itself** — and the site
  goes down while the migration is still "waiting".
- **A `DROP COLUMN` or `DROP TABLE` is irreversible without a restore.** If one
  ships and is wrong, the only recovery is PITR — which means losing every write
  since the restore point. On a marketplace, that is enquiries a dealer has
  already been called about.

**Dev is the rehearsal.** Every migration runs there on merge and only reaches
production on promotion, so it has always executed once against real data shapes
before it touches a real dealer.

## 32.6 Backups — what RDS actually keeps

Two different things, often confused:

**1. Automated backups (`--backup-retention-period 7`).** Once a day, in the
`18:00-19:00` UTC window, RDS takes a storage-level snapshot. *Continuously*, it
ships the write-ahead log (WAL) to S3. Together, the daily snapshot plus the WAL
since it are what make point-in-time recovery possible. They are deleted when
they age past the retention period — and, importantly, **they are deleted with
the instance** unless you took a final snapshot.

**2. Manual snapshots.** A snapshot you take yourself. It lives until you delete
it. Take one before anything genuinely irreversible:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier dd-postgres-prod \
  --db-snapshot-identifier prod-before-contract-migration-2026-08-24
```

That one command before a `DROP COLUMN` release converts "restore to a point in
time and lose the last hour" into "restore a known-good copy". It costs cents.

**What is the WAL?** Postgres does not write changed pages to disk immediately.
It first appends a record of *the change* to the write-ahead log, and only later
writes the pages. Crash recovery replays the WAL. RDS exploits the same property
for backups: snapshot + WAL replay = the database as it was at any second in
between. This is also the mechanism read replicas and Multi-AZ use.

**What is *not* backed up:**

- **Cloudflare R2.** The photos are not in the database and not in an RDS
  snapshot. R2 has its own versioning and lifecycle settings, configured
  separately. A restore of the database that references media R2 no longer holds
  gives you a catalogue of broken images.
- **SSM parameters.** Version-history is kept by Parameter Store, but nothing
  ties it to a database restore point.
- **The `pgboss` schema is** backed up (it is in the same database), which means
  a restore replays jobs. Worth knowing before you restore over anything live.

## 32.7 Point-in-time recovery, and how to actually use it

PITR restores to **any second** within the retention window. It **always creates
a new instance** — it never overwrites the source, and RDS will not let it.

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier dd-postgres-prod \
  --target-db-instance-identifier dd-postgres-prod-restore-20260824 \
  --restore-time 2026-08-24T09:14:00Z \
  --db-subnet-group-name dd-subnets \
  --vpc-security-group-ids "$RDS_SG" \
  --no-publicly-accessible
```

The procedure that works, and the one people get wrong:

```
❌ WRONG   Restore "over" production, or repoint DATABASE_URL at the restored
           instance immediately. You have just discarded every write since the
           restore point — enquiries, credit purchases, approvals — silently.

✅ RIGHT   1. Restore into a NEW instance.
           2. Point psql at it. Extract exactly the rows you need.
           3. Reconcile into production by hand, or with a scripted, reviewed
              backfill.
           4. Delete the restored instance.
```

Restore-over-production is correct only in a total-loss scenario (the data is
comprehensively wrong and recent writes are worth less than correctness). On a
marketplace with a credit ledger, that bar is very high — the ledger is an
append-only record and re-applying it by hand is possible; unpicking a silent
truncation of it is not.

**PITR only rewinds the database.** R2 objects, sent emails and SMS, and anything
a dealer already acted on do not rewind with it.

### Recovery objectives, stated

| Scenario | Target | Mechanism |
|---|---|---|
| Bad release, caught by health checks | seconds | ECS circuit breaker — automatic, no human |
| Bad release, caught by a person | < 5 min | Promote the previous SHA |
| Database corruption / bad data migration | < 1 hour, to any second in the last 7 days | RDS PITR into a **new** instance |
| **Region loss** | **days** | **Accepted.** Backups are regional. A multi-region story is not worth its cost at this stage — said out loud rather than implied |

That last row is the honest one. It is not a gap someone forgot; it is a
deliberate, written-down decision. Changing it means cross-region automated
backup replication, a second VPC, and roughly doubling the infrastructure cost.

## 32.8 Connection management — the failure mode you will meet first

### The first principle: a Postgres connection is a process

Every connection to Postgres forks an OS process on the database host, with its
own memory. This is why `max_connections` exists and why it is not large: on a
`db.t4g.small` RDS derives it from memory and lands in the low hundreds. Exceed
it and every new connection is refused with:

```
FATAL: sorry, too many clients already
```

— and that arrives **under load**, not in staging.

### What Prisma does

`createPrisma()` builds **one `PrismaClient` per process**, and that client holds
a connection **pool**: a small set of connections kept open and handed to queries
as they arrive. Opening a TCP connection and authenticating costs milliseconds;
doing it per query at a few hundred requests per second is unaffordable.

Prisma's default pool size is `num_physical_cpus × 2 + 1`, tunable in the
connection string:

```
postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

The arithmetic you must do before scaling anything:

```
total connections  =  (API tasks × pool_size)
                   +  (worker tasks × pool_size)
                   +  pg-boss's own connections
                   +  any migration task
                   +  every psql session a human has open

… and that total must stay comfortably under max_connections.
```

Today: **one** API task, `WORKER_INLINE=true` so no separate worker, a small
pool. Nowhere near the limit. At ten API tasks and a default pool it becomes the
binding constraint — which is exactly the §33.5 discussion.

### The PgBouncer caveat, stated before you need it

The standard answer to connection exhaustion is a **connection pooler** —
PgBouncer or RDS Proxy — sitting between the app and Postgres, multiplexing many
client connections onto few server ones.

**Transaction-mode pooling breaks session-level state.** A client gets a
different backend connection per transaction, so anything set outside a
transaction does not persist — and prepared statements need care.

That is not abstract here. `withTenant()` issues:

```sql
SET LOCAL app.dealer_id = '<uuid>'
```

`SET LOCAL` is scoped to the current transaction, which is exactly why it is
*compatible* with transaction-mode pooling — but the moment anyone reaches for
plain `SET`, or session-level advisory locks, or `LISTEN`/`NOTIFY`, it breaks.
pg-boss in particular should be given a direct connection rather than routed
through a transaction-mode pooler.

**Know this before you reach for it, not after.**

## 32.9 Monitoring the database

| Question | Tool | What to look at |
|---|---|---|
| Is it about to run out of connections? | CloudWatch `DatabaseConnections` | against `max_connections` — alarm well before it |
| Is it CPU-bound? | CloudWatch `CPUUtilization` | sustained > 70% on a burstable class also means **CPU credits are draining** — a `t4g` that exhausts its credits throttles hard |
| Is it about to run out of disk? | CloudWatch `FreeStorageSpace` | the classic 3 a.m. page. Enable storage autoscaling |
| Is a query slow, and which one? | **Performance Insights** | top SQL by wait time, with the actual statement. This is the single most useful database tool AWS gives you |
| Is replication lagging? | `ReplicaLag` | only once a read replica exists (§33.6) |
| Is memory pressure causing disk reads? | `FreeableMemory`, `ReadIOPS` | a working set that no longer fits in the buffer cache |

Six CloudWatch alarms → SNS → email is the configured baseline (ALB 5xx rate, ALB
p95 latency, unhealthy target count, ECS CPU/memory, RDS CPU, RDS free storage,
RDS connections).

And the one **application-level** database metric that is worth more than all of
them here: **credit-ledger drift** — `Dealer.creditBalance` compared against the
newest `CreditTransaction.balanceAfter`. It is always zero. Any non-zero value
catches a write path that bypassed `moveCredits()`, which is the single worst bug
this system could have. The nightly `counters.reconcile` job computes it; nothing
yet alerts on it (Part 21).

### Reading a slow query

```sql
EXPLAIN ANALYZE
SELECT … FROM listing_search WHERE city_slug = 'vellore' ORDER BY price_paise LIMIT 24;
```

`Seq Scan` on a large table is the thing to find. `Index Scan` using
`listing_search_city_price` is the thing you want. The read model already carries
ten purpose-built indexes for exactly the filters the search UI offers —
including a GIN index on the generated `search_doc` tsvector for full-text and a
`pg_trgm` GIN index for fuzzy make/model matching.

## 32.10 What is yours, restated as a checklist

Before any schema change reaches production:

- [ ] The migration is expand/contract — the **currently deployed** code still works against it
- [ ] Any new index on a large table uses `CREATE INDEX CONCURRENTLY`
- [ ] `lock_timeout` and `statement_timeout` are set if a large table is touched
- [ ] A manual snapshot was taken if the change is destructive
- [ ] It ran on dev first (it did — that is automatic on merge)
- [ ] Every new query has an index that serves it, checked with `EXPLAIN ANALYZE`
- [ ] Every dealer-owned table carries `dealerId` and the query filters on it
- [ ] Invariants that must never be violated are **CHECK constraints or unique indexes**, not application code (Part 9)

---
---

# Part 33 — Scaling: 10 users → 100,000+

This is the part to read slowly. Almost every claim in it is checkable against a
file in this repository, and where something is *not* yet built I say so and name
what would have to change.

## 33.1 The three principles everything below follows from

**1. Find the bottleneck. Everything else is noise.**
A system is exactly as fast as its slowest saturated resource. Adding API tasks
when the database is the bottleneck makes things *worse* — more tasks means more
connections and more concurrent queries against the same saturated instance.
Always ask "what is at 100%?" before "what do I add?".

**2. Reads and writes scale differently.**
On a used-car marketplace, reads outnumber writes by roughly 1000:1. Buyers
browse; dealers occasionally list. Reads can be duplicated (caches, replicas,
CDNs) almost without limit. Writes have to be serialised somewhere, because
correctness demands it. **Which is why the read path and the write path are
already separate structures in this codebase** — `listing_search` is a
denormalized read model, not a view over the write tables (Part 12).

**3. Stateless scales; stateful does not.**
If a process holds nothing a request depends on, you can run N of them behind a
load balancer and it just works. The moment a process remembers something, you
must either replicate that memory or pin the user to that process — and pinning
destroys most of the benefit. This is why sessions are rows in Postgres rather
than objects in Node memory (Part 5).

## 33.2 The journey, stage by stage

### 10 users — today

```
1 ALB → 1 dd-api task (0.5 vCPU / 1 GB) → RDS db.t4g.small
      → 2 dd-web tasks
        Photos: browser PUTs direct to R2; reads proxy back through the API
```

Everything is idle. The database is doing single-digit queries per second. The
API task is using a few percent of its CPU. **Change nothing.** The most common
scaling mistake at this stage is building for a load that will not arrive for two
years, and paying for it every month in complexity.

What *is* worth doing at this stage costs nothing: make sure the alarms exist and
somebody reads them, so you find out you are at 60% before you are at 100%.

### 1,000 users — the first real load

Say 1,000 dealers, ~50k listings, ~100k page views a day. That is roughly
**2–5 requests/second average, 20–50 at peak.** A single Node process handles
this comfortably; a well-indexed Postgres barely notices it.

What starts to show:

| Symptom | Why | Fix |
|---|---|---|
| Image bandwidth dominates the AWS bill | `MEDIA_BASE_URL=https://www.dealers-drive.com/media` — **every image read proxies through the API task** and out of the ALB | **Point `MEDIA_BASE_URL` at R2's public bucket domain or a CDN.** One environment variable. See §33.3 |
| A search page occasionally feels slow | one filter combination without an index | `EXPLAIN ANALYZE`, add the index |
| `dd-web` restarts blip | 2 tasks already; fine | nothing |

The single highest-leverage change in this whole part lives at this stage, and it
is one environment variable.

### 10,000 users — the architecture has to change

~10k dealers, 500k listings, 1M page views a day. **~12 req/s average, 100–200
at peak, spikier around evenings.**

Now the two pieces of per-instance state in the API become blocking, and they are
the reason `dd-api-prod` is pinned to `desired-count 1`:

**(a) `WORKER_INLINE=true`.** Job handlers and cron schedules run inside the HTTP
process (`container.ts` → `startBackground`). Two API tasks would run every
scheduled job **twice**: the listing-expiry sweep twice, `counters.reconcile`
twice, orphan-media GC twice.

**(b) The rate limiter is a process-local `Map`** (`middleware/rate-limit.ts`).
N tasks = N× the effective limit, and a restart clears it. The limits on phone
reveal and enquiry creation are a *spend control* as much as a security control —
every SMS costs money — so N× is not a rounding error.

The work to lift the cap, in order:

```
1. WORKER ENTRYPOINT.  A second entry file that builds the same container and
   calls startBackground() WITHOUT app.listen(). Deploy it as a separate ECS
   service, desired-count 1, no load balancer, no target group.
   API tasks then run with WORKER_INLINE=false and only serve HTTP.
   → the API becomes genuinely stateless; desired-count can go to 2, 4, 8.

2. SHARED RATE-LIMIT COUNTERS.  A CachePort with two adapters: the existing
   in-memory Map (local, tests) and Redis/ElastiCache (deployed). This is the
   first thing in the system that genuinely needs Redis, and it is worth
   noting that it is the ONLY thing so far — the queue is in Postgres, and
   sessions are in Postgres, precisely to avoid needing it earlier.

3. AUTOSCALING.  ECS target-tracking on ALB RequestCountPerTarget or CPU.
   min 2, max N. Two, not one, is the floor — one task means a restart is an
   outage and an AZ failure is an outage.

4. CONNECTION BUDGET.  Do the arithmetic in §32.8 BEFORE step 3, not after.
```

Also at this stage: the database instance goes from `t4g.small` to `t4g.medium`
or `m7g.large`, and you start caring about which queries are hot.

### 100,000+ users — the database becomes the conversation

~100k dealers, several million listings, 10M+ page views a day. **~120 req/s
average, 1,000+ at peak.** API tasks are now cheap and boring; the interesting
constraint is Postgres.

The moves, roughly in the order they pay off:

1. **CDN in front of everything cacheable.** Media is already
   content-addressed and immutable (§33.3) — cache hit rates near 100%. Public
   listing and search pages are anonymous and server-rendered, so they are
   cacheable too.
2. **Read replicas** for the read model (§33.6).
3. **A cache layer** for the genuinely hot, genuinely repeated queries — facet
   counts, the home page's per-city tiles, the catalogue (§33.7).
4. **Separate the worker fleet from the API fleet** properly: independent
   scaling, so a burst of media processing does not compete with HTTP for CPU.
5. **Only then** consider partitioning `listing_search`, or moving search to a
   dedicated engine (OpenSearch/Typesense).

Note what is *not* on that list: microservices. Splitting the modular monolith
into services adds network hops, distributed transactions and deployment
complexity, and does nothing for the actual bottleneck, which is one Postgres
instance. Part 26 explains why the monolith is the right shape here, and it stays
the right shape well past 100k users.

## 33.3 Object storage, media, and the CDN — the cheapest win available

This deserves its own section because the current configuration has one
straightforward, high-value change waiting in it.

### How it works today

**Uploads already scale perfectly.** The browser gets a presigned PUT and sends
the bytes **directly to R2** — the API never touches an image byte on the upload
path (Part 14). A dealer uploading twelve 8 MB photos costs the API one signature
and nothing else. That is already the right architecture at any scale.

**Reads currently do not.** `MEDIA_BASE_URL=https://www.dealers-drive.com/media`,
so every `<img>` on every search result page hits:

```
GET /media/vehicles/by-media/<mediaId>/640.webp
   → ALB → dd-api task → media.serve() → storage.get(key) → R2 → back through
     the API process → back through the ALB → the browser
```

The bytes make a round trip through a Node process that has nothing to add to
them. At 24 cards per search page with 4 srcset widths, one page view is a lot of
image requests, and each one occupies an API task's event loop and burns ALB
data-transfer.

`docs/DEPLOYMENT.md` §L names this directly: *"Data transfer out $20 — mostly
`/media`; this is the line CloudFront or an R2 public domain removes."*

### The change

Point `MEDIA_BASE_URL` at a public R2 bucket domain (or CloudFront in front of
R2) instead of at the API. `deploy/aws/README.md` §10 already reserves the DNS
record for it:

| Name | Type | Value |
|---|---|---|
| `media` | CNAME | the R2 public bucket domain |

Nothing in the application changes. `platform/media/urls.ts` builds every image
URL from `MEDIA_BASE_URL`, so one variable moves the entire delivery path off the
API. The `/media/...` route stays exactly where it is and keeps serving local
development and MinIO.

### Why the URL scheme makes this safe

```ts
export function mediaUrl(mediaId: string, width: number): string {
  return `${env.MEDIA_BASE_URL}/vehicles/by-media/${mediaId}/${width}.webp`;
}
```

Media is addressed by **id and width, never by storage key**. That gives two
properties a CDN needs:

- **Content-addressed and immutable.** A new upload is a new id and therefore a
  new URL. The route sets
  `Cache-Control: public, max-age=31536000, immutable`. **A cache never has to be
  invalidated**, which is the hardest problem in CDN operation, removed by
  construction.
- **The storage layout can change** without invalidating a single cached page.

### The CDN itself, from first principles

A **Content Delivery Network** is a fleet of caching servers in cities around the
world. A request goes to the nearest edge; if that edge has the object it answers
in ~10 ms without your infrastructure being involved at all. If not, it fetches
once from the origin and serves every subsequent request from cache.

Two things it gives you here: latency (a buyer in Chennai fetching from an edge
in Chennai rather than a Mumbai bucket) and **origin offload** — at a 99% hit
rate your origin serves 1% of the traffic.

And R2 specifically is why this is cheap: **R2 charges nothing for egress**. On an
image-heavy marketplace, that is the single largest line item avoided, and it is
the reason R2 was chosen over S3 (`deploy/aws/README.md` §5).

### What about the KYC documents?

They are the deliberate exception and must **never** be CDN-cached. They have no
public route at all; the only way one is ever served is
`storage.signedReadUrl(key, seconds)` — a short-lived signed URL, minutes not
hours, and every issue of one is audit-logged.

That is the difference worth internalising:

| | Vehicle photos | KYC documents |
|---|---|---|
| Bucket | private | private |
| Delivery | public, immutable, cacheable URL | short-lived **signed** URL |
| Who may see it | anyone with the link (it is a public listing) | an admin, for minutes, audit-logged |
| CDN | yes, aggressively | **never** |

## 33.4 How application servers scale

### Vertical vs horizontal, precisely

**Vertical (scale up)** — a bigger machine. More vCPU, more memory.
*Advantages:* zero code change, no distributed-systems problems, and it is the
right first move almost every time.
*Limits:* there is a largest machine; it is a single point of failure; and the
price curve turns superlinear near the top.

**Horizontal (scale out)** — more machines.
*Advantages:* effectively unbounded, and redundancy comes free — one task dying
is a capacity event, not an outage.
*Requirements:* the process must be **stateless**, and something must distribute
traffic across the instances.

Node's single-threaded event loop shapes this. One Node process uses **one CPU
core** for JavaScript. Giving a task 4 vCPU does not make one Node process four
times faster; running four tasks does. So for this system, vertical scaling helps
mainly with memory and with the I/O-bound parts (the event loop handles thousands
of concurrent awaits happily) and horizontal scaling is what buys CPU.

**Where the CPU actually goes here:** almost everything the API does is I/O —
awaiting Postgres, awaiting R2, awaiting Google's token endpoint. The two genuine
CPU consumers are `sharp` image processing (which is why it belongs in a worker,
not the HTTP process) and Argon2id password hashing (deliberately expensive, and
only on admin sign-in).

### How the load balancer distributes traffic

The **Application Load Balancer** is a Layer 7 (HTTP-aware) reverse proxy. Every
request from the internet arrives at it, and it:

1. terminates TLS (the ACM certificate lives here; the containers speak plain
   HTTP inside the VPC),
2. matches **listener rules** — host + path — to choose a target group (§23.2),
3. picks a target from that group's healthy members (round-robin by default),
4. forwards, and adds `X-Forwarded-For` with the real client IP.

Three consequences that show up in this codebase:

**`app.set('trust proxy', 1)`** in `server.ts`. Without it, `req.ip` would be the
load balancer's address for every request, and every per-IP rate limit would
count one bucket for the entire internet. `1` means "trust exactly one proxy
hop" — which is also why `deploy/aws/README.md` §10 insists the DNS records stay
**DNS-only (grey cloud)** on Cloudflare: proxying them adds a second hop, and the
API would then read the Cloudflare edge as the client.

**Health checks are how the ALB knows what is healthy.** Every 15 seconds it
polls `/health/ready` (API) and `/api/health` (web). Two consecutive successes
puts a target in rotation; three failures takes it out. This is the same
mechanism that gates deploys (§23.5).

**No sticky sessions, deliberately.** Any task can serve any request, because the
session lives in Postgres. Sticky sessions would undo most of the benefit of
horizontal scaling and would make a task restart into a mass sign-out.

### The ECS autoscaling that is not yet configured

```
Target tracking on ALB RequestCountPerTarget (or ECS CPU):
  min 2   ← never 1: a restart or an AZ loss must not be an outage
  max N   ← bounded by the connection budget (§32.8), not by ambition
  scale-out cooldown short, scale-in cooldown long
```

Scale-in slower than scale-out is the standard asymmetry: adding capacity too
eagerly costs money, removing it too eagerly costs an outage.

## 33.5 Database connections under scale

This is the interaction that surprises people, so it gets its own section.

Adding API tasks multiplies database connections. From §32.8:

```
total = (API tasks × pool) + (worker tasks × pool) + pg-boss + migrations + humans
        must stay comfortably under max_connections
```

Concretely:

| API tasks | Pool per task | Connections | On a `db.t4g.small` |
|---:|---:|---:|---|
| 1 | 5 | ~5 + pg-boss | today. Nowhere near the limit |
| 4 | 5 | ~20 + workers | fine |
| 10 | 9 (Prisma default on 4 vCPU) | ~90 + workers + pg-boss | **at or over the limit** |

The failure is not graceful. It is `FATAL: sorry, too many clients already` on
new connections, under load, while the healthy connections keep working — so the
error rate climbs but the health check may still pass.

**The order of operations when scaling out:**

1. Set `connection_limit` explicitly in `DATABASE_URL`. Do not leave it to a
   default that changes with the task's vCPU allocation.
2. Compute the budget for your maximum task count.
3. If the budget does not fit: a **bigger** database instance raises
   `max_connections` (it is derived from memory), or introduce a pooler.
4. If you introduce a pooler, use **transaction mode**, and re-read the
   `SET LOCAL` caveat in §32.8. Give pg-boss a direct connection.

**Why a pooler helps at all:** most connections are idle most of the time — a
request holds one for the few milliseconds it is querying. A transaction-mode
pooler lets 500 application-side connections share 20 real Postgres backends,
because they are never all mid-transaction simultaneously.

## 33.6 How the database scales

In the order you would actually do them:

### 1. Indexes and query shape — always first, and free

A missing index turns a 2 ms lookup into a 2-second sequential scan, and no
amount of hardware fixes it. Postgres reads indexes as **B-trees**: a balanced
structure that finds a value in a few page reads instead of scanning every row.

The read model already carries ten purpose-built indexes:

```sql
CREATE INDEX listing_search_doc_idx      ON listing_search USING GIN (search_doc);   -- full text
CREATE INDEX listing_search_features_idx ON listing_search USING GIN (features);     -- array containment
CREATE INDEX listing_search_city_price   ON listing_search (city_slug, price_paise);
CREATE INDEX listing_search_make_model   ON listing_search (make_slug, model_slug, year);
CREATE INDEX listing_search_price_recent ON listing_search (price_paise, approved_at DESC);
CREATE INDEX listing_search_trgm         ON listing_search USING GIN (
  (coalesce(make_name,'') || ' ' || coalesce(model_name,'')) gin_trgm_ops);          -- fuzzy match
```

Three index types, three jobs: **B-tree** for ranges and equality and sorting,
**GIN** for "does this document/array contain this" (full-text and the features
array), **GIN + `pg_trgm`** for typo-tolerant substring matching on make and
model.

Column order in a composite index matters: `(city_slug, price_paise)` serves
"cars in Vellore, cheapest first" and "cars in Vellore"; it does **not** serve
"all cars under ₹5L" — the leading column has to be constrained.

The costs of an index, so you do not add them reflexively: every `INSERT`/`UPDATE`
must maintain it, and it occupies memory in the buffer cache. Index the queries
you actually run.

### 2. Vertical scaling — one command, minutes of downtime

```bash
aws rds modify-db-instance --db-instance-identifier dd-postgres-prod \
  --db-instance-class db.t4g.medium --apply-immediately
```

`t4g.small → t4g.medium → m7g.large → …`. More memory means more of the working
set fits in the buffer cache, which means fewer disk reads, which is usually
where the win comes from. It also raises `max_connections`.

This is the right answer far longer than people expect. A modern
`db.m7g.2xlarge` handles a very large marketplace.

### 3. Read replicas — the first real architecture change

A **read replica** is a second instance receiving a continuous stream of the
primary's WAL and replaying it. It is read-only, and it is **eventually
consistent** — typically milliseconds behind, occasionally more.

```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier dd-postgres-prod-replica \
  --source-db-instance-identifier dd-postgres-prod
```

**Why this system is unusually well-suited to replicas:** the public read path
already queries a *separate table* — `listing_search` — through a *separate
repository* (`search.repository.ts`). Routing it to a replica is a second Prisma
client with a different `DATABASE_URL`, injected at the composition root
(`container.ts`), not a rewrite.

**The replication-lag trap, and why it does not bite here.** The classic bug is:
a user writes, is redirected, reads from a replica that has not caught up, and
sees stale data — "I just saved that and it is not there".

In Dealers-Drive, the write path and the public read path are already
**asynchronously decoupled by design**. A listing becomes publicly visible via
`search.index-listing`, a background job, *after* approval. The dealer's own
console reads the write tables, not the read model. So a few milliseconds of
replica lag is invisible against a job latency that is already measured in
seconds — the product's own semantics absorb it.

**What must never go to a replica:** anything in a write transaction, anything
using `SELECT … FOR UPDATE` (the credit ledger), and the session lookup that runs
on every authenticated request — a session revoked a moment ago must stop working
*now*, not after replication catches up.

### 4. Partitioning, sharding, and a different engine — much later

- **Partitioning** splits one large table into physical chunks by a key (say,
  `approved_at` by month). Queries that name the key touch one partition. Worth
  it when a table is tens of millions of rows.
- **Sharding** splits data across separate database *instances*. It is a large,
  invasive change and should be the last resort.
- **A dedicated search engine** (OpenSearch, Typesense) is worth considering when
  Postgres full-text stops keeping up. Note that the migration is unusually cheap
  here, because `listing_search` is already a rebuilt-from-events projection —
  you would be adding a second consumer of the same job, not inventing an
  indexing pipeline.

## 33.7 Caching — the layers, and which ones exist

**Caching is storing the result of expensive work so the work is not repeated.**
The universal cost is staleness, and every layer below has a different answer to
"how do you know when it is wrong?".

| Layer | Where | Staleness answer | Status here |
|---|---|---|---|
| **Browser cache** | the user's browser | `Cache-Control` headers | ✅ media: `max-age=31536000, immutable` |
| **CDN / edge** | Cloudflare / CloudFront | immutable URLs, so never invalidated | ⚠️ **available, not yet configured** (§33.3) |
| **Next.js data cache** | the Next server | `revalidate: N` seconds, or tags | ✅ `lib/api.ts` — public pages only |
| **Application cache** | Redis / in-process | TTL, or explicit invalidation | ❌ not present |
| **Database buffer cache** | Postgres memory | automatic (LRU) | ✅ free, and why RAM matters |
| **The read model** | `listing_search` | rebuilt by a job on every state change | ✅ **the big one** |

Two of those are worth expanding.

### `listing_search` is a cache, and it is the most important one

It is a **materialized read model**: a table containing exactly what a search
result needs, denormalized, with every join already done. A search query touches
one table and one index instead of joining vehicles → listings → dealers →
cities → media.

Its invalidation strategy is the interesting part. It is not TTL-based; it is
**event-driven and idempotent**. A listing is approved → an outbox event → the
`search.index-listing` job → `index(listingId)` rebuilds that one row, or removes
it if the listing no longer satisfies `APPROVED && dealer ACTIVE`. The rebuild
assumes it will run twice.

That single rule — *only APPROVED listings belonging to ACTIVE dealers are in
this table* — is the entire public-visibility model. Suspending a dealer removes
every one of their cars from search with one job, and because **every count in
the product is derived from this table** (cars available, per-city tiles, facet
counts, "from ₹x"), a listing that should not be public cannot leak into a number
either.

### The Next.js caching trap, already avoided

`apps/web/src/lib/api.ts` forwards the `dd_session` cookie **only for uncached
requests**:

```ts
const uncached = options.revalidate === false || method !== 'GET';
if (uncached) {
  init.cache = 'no-store';
  const session = await sessionCookie();
  if (session) init.headers = { ...init.headers, Cookie: `${SESSION_COOKIE}=${session}` };
}
```

That is not a convenience. **Attaching a session to a cached fetch is how one
dealer's console ends up in another dealer's browser.** Public pages stay
anonymous and cacheable; anything behind a session is `revalidate: false` and
never shared. Keep that invariant when you add caching, because it is the one
whose failure is a data breach rather than a stale number.

### When you do add Redis

The first genuine need is the shared rate-limit counter (§33.2). After that, the
candidates are the ones that are hot, repeated and tolerant of seconds of
staleness: facet counts, the home page's per-city tiles, and the reference
catalogue (makes/models/variants — it changes monthly and is read constantly).

Do **not** cache: anything session-derived, anything in the credit ledger path,
or anything whose staleness would show a suspended dealer's car.

## 33.8 Queues and background workers

The principle: **anything that does not have to happen before the response
should not.** A request that returns in 80 ms and finishes its work in the
background beats one that returns in 3 seconds because it waited on an SMS
gateway.

The current shape (Part 13):

```
   HTTP request
        │
        ├── writes rows        ┐
        └── writes an          ├── ONE TRANSACTION — both or neither
            outbox_events row  ┘
        │
        └──▶ 200 to the browser

   outbox publisher (every 2s, SELECT … FOR UPDATE SKIP LOCKED)
        └──▶ event bus ──▶ pg-boss job ──▶ handler
                                            · media.process (sharp: re-encode,
                                              EXIF strip, 4 derivatives, blurhash)
                                            · search.index-listing
                                            · notification.enquiry-to-dealer  ← priority 100
                                            · listings.expire-sweep (cron, IST)
                                            · counters.reconcile (cron)
```

**Why the outbox exists:** you cannot atomically write to Postgres *and* send to
an external queue. Either the row commits and the message is lost, or the message
is sent and the transaction rolls back. Writing the event **into the same
database, in the same transaction** makes it atomic; a poller then moves it out.
Delivery is therefore **at-least-once**, which is why every handler is
idempotent.

**`FOR UPDATE SKIP LOCKED`** is what lets several publishers drain the same table
concurrently without either seeing the other's rows. It is the standard
Postgres-as-a-queue primitive.

### How this scales

| Scale | Change |
|---|---|
| Today | `WORKER_INLINE=true` — handlers run in the API process |
| 10k users | **separate worker service**, `desired-count 1`, no load balancer. The API becomes stateless and can scale out |
| 100k users | scale the worker fleet independently. `media.process` is CPU-bound (`sharp`), notifications are I/O-bound — eventually different services with different task sizes |
| Beyond | if pg-boss stops keeping up, the outbox publisher is *the only file that changes* to point at a real broker (SQS, Kafka). That is what the seam is for |

The queue being *in Postgres* is a deliberate trade with a known ceiling: real
queue semantics (retries, exponential backoff, scheduling, dead-lettering,
priorities) with **zero new infrastructure** and transactional enqueue. It buys
years. When it stops, the replacement is one file, because nothing above
`platform/events/bus.ts` knows what the transport is.

## 33.9 Bottlenecks: where they appear, and how to recognise them

### Server bottlenecks

| Symptom | Cause | Fix |
|---|---|---|
| High CPU, event loop lag, slow responses across the board | CPU-bound work in the HTTP process — `sharp`, or a hot JSON serialisation | move it to the worker; scale out |
| Memory climbing until the task is OOM-killed | a leak, or unbounded in-memory accumulation (the rate-limit `Map` never evicts) | fix the leak; move the counters to Redis |
| Latency high but CPU low | waiting on I/O — usually the database | look at the database, not the app |
| 502/504 at the ALB | tasks unhealthy, or slower than the ALB idle timeout | health checks; find the slow request |
| Errors only during deploys | graceful shutdown not draining | already handled (§23.6) — check `SIGTERM` reaches PID 1 |

### Database bottlenecks

| Symptom | Cause | Fix |
|---|---|---|
| One query dominating Performance Insights | missing index, or a bad plan | `EXPLAIN ANALYZE`; add the index |
| `too many clients already` | connection budget exceeded | §33.5 |
| High CPU on a `t4g` after a period of fine behaviour | **CPU credits exhausted** — burstable classes throttle hard | move to a non-burstable class |
| Lock waits, statements queueing | a long transaction holding a lock; a non-`CONCURRENTLY` index build | shorten transactions; `lock_timeout` |
| Writes fine, reads slow | the read path saturating the primary | read replica (§33.6) |
| Slow after a data-volume jump | the working set no longer fits in RAM | more memory, or partitioning |

### The bottleneck this system will actually hit first

**Image delivery through the API** (§33.3), and it arrives long before any of the
above. It is also the cheapest to fix — one environment variable.

## 33.10 What AWS handles and what you handle

| Concern | Managed for you | Yours |
|---|---|---|
| Server provisioning, patching the host | ✅ Fargate | choosing task CPU/memory |
| Restarting a crashed container | ✅ ECS | making shutdown graceful |
| Replacing an unhealthy task | ✅ ECS + ALB | writing an honest health check |
| Rolling back a bad deploy | ✅ circuit breaker | expand/contract so rollback is *safe* |
| Distributing traffic | ✅ ALB | `trust proxy`, listener rules |
| TLS certificates and renewal | ✅ ACM | keeping the DNS validation records |
| **Autoscaling** | ✅ *once configured* | **configuring it, and the connection budget** |
| Database host, patching, snapshots, WAL | ✅ RDS | retention, and testing a restore |
| Database failover | ✅ *if Multi-AZ* | **not enabled here — a deliberate cost choice** |
| Object storage durability | ✅ R2 | bucket policy, CORS, lifecycle |
| Edge caching | ✅ *once configured* | cache headers and URL design |
| **Schema, queries, indexes** | ❌ | **entirely yours** |
| **Application state (or the absence of it)** | ❌ | **entirely yours** |
| **Knowing what your bottleneck is** | ❌ | **entirely yours** |

The honest summary: AWS removes the operations that used to consume a team, and
removes **none** of the architecture. Every scaling problem in §33.9 is one you
design your way out of.

## 33.11 The roadmap, in priority order

| # | Change | Unlocks | Effort |
|---|---|---|---|
| 1 | **`MEDIA_BASE_URL` → R2 public domain / CDN** | removes the largest bandwidth and CPU load from the API | **one variable** |
| 2 | CloudWatch alarms wired to somebody who reads them | knowing you are at 60% before you are at 100% | hours |
| 3 | **Separate worker entrypoint** | the API becomes stateless → `desired-count > 1` | ~1 day |
| 4 | `CachePort` + Redis for rate limits | correct limits across N tasks | ~1 day |
| 5 | ECS autoscaling (min 2) | traffic spikes, AZ resilience | hours |
| 6 | Explicit `connection_limit`, budget documented | prevents `too many clients` under load | hours |
| 7 | Vertical scale the database | headroom | one command |
| 8 | Read replica for `listing_search` | read scaling | ~1 day |
| 9 | Application cache for facets and the catalogue | database load | days |
| 10 | Partitioning / a dedicated search engine | tens of millions of rows | weeks |

Items 1–6 take a system that is capped at one API task to one that scales
horizontally on demand. That is the entire near-term scaling story, and none of
it is architectural upheaval — because the architectural work (stateless
sessions, a separate read model, a transactional outbox, a storage port, a
composition root) was done up front.

---
---

# Part 34 — The concepts, from first principles

Part 28 is a glossary: short definitions to look a term up. **This part is
different.** Each entry answers five questions in the same order:

> **What it is** → **Why it exists** (what breaks without it) → **How it works
> internally** → **Where Dealers-Drive uses it** → **An analogy**, where one
> genuinely helps.

Read it straight through once. After that, jump to whatever you are stuck on.

---

## A. The network — what happens between a browser and a server

### A1. DNS

**What.** The system that turns `www.dealers-drive.com` into an IP address like
`13.234.x.x`.

**Why.** Machines route by number; humans remember names. Names also let the
number change — you can replace a load balancer without asking anybody to update
a bookmark.

**How.** Your browser asks a resolver. The resolver walks a hierarchy — root
servers → `.com` servers → the nameservers for `dealers-drive.com` — and gets
back a record. `A` maps a name to an IPv4 address; `CNAME` maps a name to another
name; ALIAS/CNAME-flattening is a provider feature that lets the *apex* domain
(which cannot legally be a CNAME) point at a load balancer's changing name.
Results are cached for the record's **TTL**, which is why DNS changes are not
instant.

**Here.** `deploy/aws/README.md` §10: `www` and `dev` are CNAMEs to the ALB, the
apex is an ALIAS/flattened CNAME redirecting to `www`, and `media` is reserved
for the R2 public bucket domain. The records for the app hostnames are kept
**DNS-only (grey cloud)** on Cloudflare — proxying them would insert a second
proxy hop and break `trust proxy 1`.

**Analogy.** A phone book. You look up a name to get a number; the number can
change without the name changing.

### A2. TCP, and why "a connection" costs something

**What.** The protocol that gives you a reliable, ordered byte stream between two
machines.

**Why.** IP packets can be lost, duplicated or reordered. TCP hides all of that.

**How.** A three-way handshake (SYN → SYN-ACK → ACK) opens the connection —
one full round trip before a single byte of your data moves. Then sequence
numbers and acknowledgements make it reliable.

**Here.** This is why **connection pooling** matters (§32.8): a Postgres
connection costs a TCP handshake *plus* authentication, and paying that per query
at a few hundred requests per second is unaffordable. It is also why HTTP
keep-alive exists.

### A3. TLS and HTTPS

**What.** TLS encrypts a TCP connection and authenticates the server. HTTPS is
HTTP running inside TLS.

**Why.** Without it, everyone between the browser and the server — the café
Wi-Fi, the ISP, anyone on the path — can read and *modify* the traffic. For this
system that means reading the `dd_session` cookie and becoming that dealer.

**How.** The server presents a certificate signed by a Certificate Authority the
browser already trusts. The browser verifies the signature and that the
certificate covers the hostname it asked for. Then both sides derive a shared
symmetric key and encrypt everything after that.

**Here.** TLS terminates at the **ALB**, using a certificate issued and
auto-renewed by **ACM** (`deploy/aws/README.md` §7). Inside the VPC the traffic is
plain HTTP between the ALB and the tasks, which is safe because the security
groups mean nothing else can reach those ports. Port 80 gets exactly one listener
rule: redirect to 443. And `Secure` on the session cookie (`env.isProduction`)
means the browser will not send it over plain HTTP at all.

**Analogy.** A tamper-evident sealed envelope, where the seal also proves who
sealed it.

### A4. HTTP: request, response, method, status, header, body

**What.** The request/response protocol the whole web runs on.

**How.** A request is a **method** (`GET`, `POST`, `PATCH`, `DELETE`), a **path**,
**headers** (metadata: `Content-Type`, `Cookie`, `Authorization`), and optionally
a **body**. A response is a **status code**, headers, and a body.

The method semantics matter more than people assume:

- `GET` is **safe** (changes nothing) and **cacheable**. This is why
  `GET /v1/vehicles` can be cached and `POST /v1/enquiries` cannot.
- `PUT` is **idempotent** — doing it twice equals doing it once. That is why the
  presigned upload is a `PUT`: a retried upload is not a second photo.
- `POST` is neither.

Status classes: `2xx` it worked, `3xx` go somewhere else, `4xx` you did something
wrong, `5xx` we did something wrong. The `4xx`/`5xx` split is a real boundary — a
`5xx` should page someone; a `422 INSUFFICIENT_CREDITS` should not.

**Here.** The API answers errors as **RFC 9457 Problem Details**
(`application/problem+json`) — a structured error body with `type`, `title`,
`status`, `code` and per-field `errors`, so a client can branch on `code` rather
than parse English (Part 20).

### A5. Origin, and the same-origin policy

**What.** An **origin** is the triple **scheme + host + port**.
`https://www.dealers-drive.com` and `https://api.dealers-drive.com` are different
origins. So are `http://` and `https://` versions of the same host.

**Why.** The browser's core security boundary. JavaScript from one origin must
not be able to read another origin's data — otherwise any page you visit could
read your bank.

**Here.** This single concept drives the entire hostname layout (§23.2). Serving
the API and the web app on **one** origin, split by path at the load balancer,
means the session cookie is host-only, there is no cross-origin fetch between
them, and the OAuth callback is a same-site navigation.

### A6. CORS

**What.** Cross-Origin Resource Sharing: the mechanism by which a server *opts
in* to being called by JavaScript from another origin.

**Why.** The same-origin policy blocks it by default. CORS is the controlled
exception.

**How.** For anything non-trivial the browser first sends a **preflight**
`OPTIONS` request asking "may origin X use method Y with header Z?". The server
answers with `Access-Control-Allow-Origin` and friends. Crucially, for the
browser to send **cookies**, the server must send
`Access-Control-Allow-Credentials: true` **and** name a specific origin —
`*` is refused with credentials.

**Here.** `server.ts`:

```ts
app.use(cors({ origin: env.webOrigins, credentials: true, maxAge: 86_400 }));
```

`env.webOrigins` is an allow-list parsed from `WEB_ORIGIN`, not a wildcard. And
because the two apps share an origin in every deployed environment, this
allow-list is mostly a safety net rather than a load-bearing part of normal
operation. The other CORS surface is the **R2 bucket**, which allows `PUT` from
its own environment's origin only — that is what makes the direct browser upload
possible at all.

### A7. Reverse proxy and load balancer

**What.** A server that sits in front of your servers, receives every request,
and forwards it.

**Why.** One public address; TLS terminated in one place; traffic spread across
instances; unhealthy instances removed automatically.

**How (Layer 7).** The ALB parses HTTP, so it can route on **host** and **path**,
not just IP. It health-checks its targets and only sends traffic to healthy ones.
It adds `X-Forwarded-For` carrying the original client IP.

**Here.** One ALB serves both environments and both apps (§23.2). Two
consequences show up in code: `app.set('trust proxy', 1)` so `req.ip` is the real
client rather than the balancer, and the listener rule that must name
`/api/docs*` rather than `/api/*` so the web app's own BFF routes are not
swallowed.

**Analogy.** A receptionist. One phone number for the building; they know which
desk each call belongs to, and they stop routing to a desk nobody is sitting at.

---

## B. Identity — the vocabulary people mix up

### B1. Authentication vs authorization

- **Authentication** — *who are you?* Establishing identity.
- **Authorization** — *may you do this?* Checking permission.

They fail differently, and the API says so: **401 Unauthorized** means "I do not
know who you are" (badly named — it is about authentication); **403 Forbidden**
means "I know who you are and the answer is no".

**Here.** Authentication is Google OIDC for dealers and Argon2id passwords for
admins, resolved by the `SessionResolver` at the edge. Authorization is
`requirePermission()` plus the tenant predicate inside the write itself. Both
always — the guard is never the only check (Part 6, Part 8).

### B2. Credential, cookie, session, token — the four that get confused

This table is worth memorising:

| | **Credential** | **Cookie** | **Session** | **Token** |
|---|---|---|---|---|
| What it is | proof of identity | a browser storage + transport mechanism | server-side state about a signed-in person | a string that stands in for identity |
| Lives where | the person's head / Google | the browser | the **`sessions` table in Postgres** | in the cookie |
| Example here | a Google account; an admin password | `dd_session=<32 random bytes>` | a row: `userId`, `scope`, `tokenHash`, `expiresAt`, `revokedAt` | the 32 random bytes themselves |
| Lifetime | forever-ish | until it expires or is cleared | 30 days (dealer) / 12 hours (admin) | the same |

The sentence that resolves most of the confusion:

> **The cookie is the envelope. The token is the ticket inside it. The session is
> the row in our database that the ticket refers to.**

### B3. Cookie — what it actually is on the wire

**What.** A name/value pair the server asks the browser to store and send back on
subsequent requests to that host.

**How.** The server sends:

```
Set-Cookie: dd_session=8Kx...; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=...
```

and the browser sends `Cookie: dd_session=8Kx...` on every matching request,
**automatically**, without any JavaScript involved.

The attributes are the security model:

| Attribute | Effect | Why here |
|---|---|---|
| `HttpOnly` | JavaScript **cannot read it** (`document.cookie` does not see it) | an XSS bug cannot steal the session |
| `Secure` | only sent over HTTPS | no plaintext leak. `env.isProduction` |
| `SameSite=Lax` | not sent on cross-site **POST**; **is** sent on top-level cross-site **GET navigation** | **required, not lax thinking** — the OAuth callback *is* a top-level cross-site GET from Google, and `Strict` would withhold the cookie on exactly that navigation. `Lax` also does the CSRF work: a cross-site POST arrives with no cookie |
| `Path=/` | sent for every path | one origin serves both apps |
| **no `Domain`** | **host-only** | a `.dealers-drive.com` cookie would be sent to `dev.` too — a dev session presented to production. `SESSION_COOKIE_DOMAIN` is empty in every environment, deliberately |

**Here.** `apps/api/src/modules/auth/session.cookie.ts` is the only file that
touches cookies, and it is separate from `session.service.ts` on purpose: the
service takes a user id and returns a token and can be tested with no HTTP
request in sight.

### B4. Opaque token vs JWT

**What.** A **JWT** is a signed, self-describing token: header, payload and
signature, base64url-encoded and dot-separated. Anyone can decode the payload
(it is **not** encrypted); the signature proves it was not altered. An **opaque
token** is a meaningless random string whose meaning exists only in the issuer's
database.

**The trade.**

| | JWT | Opaque + database |
|---|---|---|
| Verify | signature check, no I/O | one indexed lookup |
| Revoke immediately | **no** — you need a denylist, which is a database, only slower to consult and easier to forget | **yes** — one `UPDATE` |
| Contains | claims that were true at issue time | nothing; the truth is re-read |
| Leak of the store | the signing key forges any token | only hashes; a dump does not hand anyone a live session |

**Here.** `dd_session` is **opaque**: 32 random bytes, base64url. Only its
**SHA-256** is stored (`session.service.ts`). Two properties follow, and they are
the reason for the whole design:

1. **Revocation is one line of SQL**, effective on the very next request.
   Suspending a dealer, or signing them out everywhere, is an `UPDATE`.
2. **The principal is rebuilt from the database on every request**
   (`cookie-session.adapter.ts`). Nothing is cached in the token, so a role
   change or a suspension takes effect immediately, with no window in which a
   stale claim is still honoured.

Dealers-Drive *does* handle one JWT — Google's **ID token** — but it never issues
one and never stores one (§B8).

**Analogy.** A JWT is a passport: it carries your details and a hard-to-forge
seal, and it stays valid until it expires even if the issuing country would
rather it did not. An opaque token is a cloakroom ticket: the number means
nothing, and the coat can be released, held, or refused at any moment.

### B5. Hashing, and why it is not encryption

**What.** A hash function maps input to a fixed-length output, deterministically
and **irreversibly**.

**Why.** So a stolen database is not a stolen set of credentials.

**How.** Encryption is reversible with a key; hashing is not reversible at all.
You verify by hashing the presented value and comparing.

**Here — two very different uses, and the difference is the point:**

- **`SHA-256`** for the session token (`hashToken`). Fast is *fine*, because the
  input is 32 random bytes — there is nothing to guess.
- **`Argon2id`** for admin passwords (`modules/auth/password.ts`), at the OWASP
  floor: 19 MiB of memory, two passes. **Slow and memory-hard is the point.**
  Passwords are low-entropy and guessable, so the memory cost is what makes a
  stolen hash expensive to attack on a GPU. *A plain SHA-256 of a password is not
  a password hash.*

And the timing detail: `verifyDecoy()` hashes against a dummy when the email does
not exist, so "no such account" and "wrong password" take the same time. Without
it, the login endpoint is an account-enumeration oracle.

### B6. HMAC — proving *we* wrote this

**What.** A keyed hash: `HMAC(secret, message)` produces a tag that only someone
holding the secret can produce or verify.

**Why.** To hand a value to an untrusted party and detect if they change it.

**Here — twice, and both are worth understanding:**

1. **The OAuth transaction cookie** (`oauth-transaction.ts`).
   `<base64url(json)>.<hmac>` seals the `state`, `nonce`, PKCE verifier and
   `returnTo` into one 10-minute cookie. The browser *holds* it and cannot
   *edit* it. This is why there is no `oauth_states` table: the row would exist
   only between two requests seconds apart and would need its own expiry sweep,
   while the cookie is already scoped to exactly the browser that must present
   it.
2. **The local storage adapter's presigned PUT** (`local.adapter.ts`) — an HMAC
   over key + content-type + content-length + expiry, which is a deliberate
   miniature of what S3's SigV4 does.

Both comparisons use `timingSafeEqual`, not `===`. A naive comparison returns
early on the first differing byte, which leaks how much of a guess was correct.

**Analogy.** A wax seal on a letter you hand to a courier. They carry it; they
cannot alter it without you noticing.

### B7. OAuth 2.0 — authorization *delegation*, not login

**What.** A protocol that lets a user grant one application limited access to
their data at another, **without giving it their password**.

**Why.** The alternative is asking dealers for their Google password. Nobody
should build that, and nobody should type it.

**The four roles:**

- **Resource owner** — the dealer.
- **Client** — Dealers-Drive.
- **Authorization server** — Google (`accounts.google.com`).
- **Resource server** — Google's APIs.

**The authorization code flow, which is the one used here:**

```
1. Browser navigates to Google with client_id, redirect_uri, scope, state,
   nonce, code_challenge.
2. The dealer authenticates WITH GOOGLE. Dealers-Drive never sees it.
3. Google redirects the browser back to redirect_uri with ?code=…&state=…
4. The API POSTs that code + client_secret + code_verifier to Google's token
   endpoint, SERVER TO SERVER.
5. Google returns tokens.
```

**Why the code, rather than the token, in step 3?** Because step 3 goes through
the **browser**, where the value lands in an address bar, a `Referer` header,
browser history and possibly a proxy log. An authorization code is *single-use*
and worthless without the client secret, which never leaves the server. This is
the entire reason the flow has two steps instead of one.

**Here.** `google.provider.ts` builds the authorization URL and performs the
exchange. Note `access_type=online`: no refresh token is requested, because the
application session is the thing that outlives the sign-in and a stored Google
refresh token would be a long-lived credential this product has no use for.

**Analogy.** A valet key. It starts the car; it does not open the boot, and it is
not your house key.

### B8. OpenID Connect and the ID token

**What.** A thin identity layer **on top of** OAuth 2.0. OAuth answers *"may this
app access that?"*; OIDC answers *"who is this person?"*.

**How.** Requesting the `openid` scope makes the token response include an **ID
token**: a JWT whose claims describe the user.

The claims that matter here:

| Claim | Meaning | What the code does |
|---|---|---|
| `iss` | issuer | must be `https://accounts.google.com` |
| `aud` | audience | must equal **our** `client_id` — otherwise it is a token minted for a different application |
| `sub` | subject — Google's **stable, permanent** id for the account | **this is the account** |
| `exp` | expiry | checked with 60 s of clock leeway |
| `nonce` | echoes what we sent | ties this token to *this* browser's sign-in |
| `email`, `email_verified` | the address, and whether Google checked it | `email_verified !== true` is a **refusal**, not a warning |

**The single most important design decision in the auth module:**

> **The account is the `sub`, not the email.**

`prisma/schema.prisma` puts a unique index on `(provider, providerSubject)`, and
`auth.service.ts` looks up by exactly that. The email is refreshed on every
sign-in and is **never** the thing looked up — because a person can change their
Google email address, and because an email that merely *matches* an existing
account is not proof of ownership. Hence `ACCOUNT_LINK_REQUIRED`: an existing
account with the same email and no linked identity is refused rather than
silently merged. Silently merging on a matching string is how an expired domain
becomes somebody else's inventory.

**Why the ID token's signature is *not* verified here, and why that is correct.**
OIDC Core §3.1.3.7 item 6: a token received **directly from the token endpoint**
over a TLS connection whose certificate was validated may be trusted without
checking its signature. This code POSTed to `oauth2.googleapis.com` itself, with
a client secret, over Node's TLS stack. The token never passed through a browser,
so there is no untrusted hop. The **claims** are still all checked. (If the token
had arrived via the browser — the implicit flow — the signature check would be
mandatory.)

### B9. `state`, `nonce`, and PKCE — three defences, three different attacks

They are constantly confused. They defend against three distinct things.

**`state` — CSRF on the callback.**
A random value sent to Google and echoed back. The API compares Google's echo
against the value sealed in *this browser's* `dd_oauth` cookie. Without it, an
attacker can send you a link to `/callback?code=<attacker's code>` and log your
browser into **their** account — after which anything you upload lands in their
inventory. A callback with no cookie, a stale cookie, or somebody else's state is
refused **before the code is worth anything**.

**PKCE (`code_challenge` / `code_verifier`) — authorization-code interception.**
The client generates a random `code_verifier`, sends
`code_challenge = BASE64URL(SHA256(verifier))` in step 1, and sends the raw
verifier in step 4. Google checks they correspond. So a stolen authorization code
is useless without the verifier, which never travelled through the browser.
PKCE (RFC 7636) began as a mobile-app protection and is now recommended for
**all** clients, confidential ones included — belt and braces alongside the
client secret.

**`nonce` — ID-token replay.**
A random value sent in step 1 that Google embeds **inside the signed ID token**.
The API checks it matches what this browser's transaction expected. It is why an
ID token captured elsewhere cannot be replayed here.

All three are generated in `createOAuthTransaction()`, sealed into the HMAC'd
`dd_oauth` cookie, and — importantly — the cookie is **cleared as the very first
thing** the callback does, whatever happens next. Single-use, always.

### B10. Multi-tenancy

**What.** One application instance serving many customers whose data must never
mix. Here a **tenant** is a **dealership**.

**Why.** The alternative — one deployment per dealer — does not work
commercially or operationally.

**How, and the rule that carries it:**

> **`dealerId` always comes from the session. Never from the request.**

There is no endpoint anywhere in this API that accepts a `dealerId`. It is a
property of the resolved principal (`session.port.ts`), written into the request
by `requireDealer`, and passed as the first argument to every repository
function. `GET /vehicles?dealerId=123` is not a feature with a bug; it is an
architecture that cannot be made safe.

**Four layers** (Part 7), of which three are live:

1. session-derived context ✅
2. repository signatures that make an unscoped query a type error ✅
3. PostgreSQL **row-level security** — `withTenant()` issues
   `SET LOCAL app.dealer_id`, but the policies are **not written yet**
4. tests that assert cross-tenant access fails ✅

And cross-tenant access returns **404, not 403**. A 403 confirms the row exists,
which is an enumeration oracle.

---

## C. Data — PostgreSQL as an engine

### C1. ACID and transactions

**What.** A **transaction** is a group of statements that commit together or not
at all.

- **Atomicity** — all or nothing.
- **Consistency** — constraints hold at commit.
- **Isolation** — concurrent transactions do not see each other's partial work.
- **Durability** — once committed, it survives a crash.

**Why here.** Onboarding writes a user, a dealer, a membership and three KYC rows.
A crash halfway through must leave *nothing*, not a dealership with no owner.

**How internally.** Postgres uses **MVCC** (multi-version concurrency control):
an `UPDATE` writes a new row version rather than overwriting, so readers never
block writers and writers never block readers. Durability comes from the
**WAL** — the change is appended to the write-ahead log and flushed before commit
returns; the data pages follow later. Crash recovery replays the WAL. (The same
WAL is what makes PITR and read replicas possible — §32.6.)

**Here.** `withTransaction()` and `withTenant()` in `platform/db/tenant-tx.ts`.

### C2. Row locking — `SELECT … FOR UPDATE`

**What.** Reading a row *and* locking it so no other transaction can modify it
until yours ends.

**Why.** The read-modify-write race. Two requests both read `balance = 1`, both
decide "yes, affordable", both write `balance = 0`. Two cars published, one
credit spent.

**Here.** The credit ledger. Every write path re-reads the balance under
`FOR UPDATE` inside the transaction that spends it (Part 10). The second
transaction **blocks** until the first commits, then reads the true post-commit
value. Combined with the `creditBalance >= 0` CHECK constraint, the invariant
holds even if application logic is wrong.

**Analogy.** Taking the last item off the shelf while holding the shelf, rather
than looking, walking away, and coming back.

### C3. Index, and what a B-tree does

**What.** A separate data structure that lets the database find rows without
reading all of them.

**How.** A **B-tree** is a balanced tree kept sorted by the indexed columns.
Finding a value is a handful of page reads instead of a full scan, and because it
is sorted it also serves range queries (`price BETWEEN …`) and `ORDER BY`
directly.

**Composite index column order matters.** `(city_slug, price_paise)` serves "cars
in Vellore, cheapest first" and "cars in Vellore". It does **not** serve "all cars
under ₹5L" — the leading column must be constrained. Think of a phone book sorted
by surname then first name: useless for finding every "Priya".

**Other index types here:** **GIN** for containment queries — full-text over the
generated `search_doc` tsvector, and `features` array membership — and
**GIN + `pg_trgm`** for typo-tolerant substring matching on make and model.

**Costs.** Every write maintains every index on that table, and indexes occupy
buffer cache. Index the queries you run.

### C4. Denormalization and the read model

**Normalization** stores each fact once. **Denormalization** duplicates it to make
reads cheap.

**Here.** `listing_search` is a fully denormalized projection — dealer name, city
name, make/model names, primary media id and blurhash, all copied onto one row —
so a search touches one table and one index instead of five joins. It is
maintained by a background job on every state change, and it is **the entire
public-visibility model**: only `APPROVED` listings belonging to `ACTIVE` dealers
are ever in it. Also denormalized: `Vehicle.primaryMediaId`, so a result card
needs no join, and `Dealer.creditBalance`, which is explicitly a **cache** of the
newest `CreditTransaction.balanceAfter` and never authoritative on its own.

The rule: **denormalize deliberately, and name the thing that maintains it.**
Undocumented duplication is just drift.

### C5. Connection and pool

See §32.8 for the operational detail. In one paragraph: a Postgres connection is
an OS process on the database host, so they are finite and not free. A **pool** is
a small set of connections kept open and reused. `createPrisma()` builds one
`PrismaClient` per process, holding one pool. `instances × pool_size` must stay
under `max_connections`, and that arithmetic is what bounds horizontal scaling
(§33.5).

### C6. Migration

A versioned, ordered, immutable script that moves the schema forward. **Prisma
migrations have no `down`.** Safety comes from **expand/contract**, not from
reversal (§32.5).

### C7. Read replica and eventual consistency

A second instance replaying the primary's WAL, read-only, typically milliseconds
behind. **Eventual consistency** means a read may briefly return a value from
just before the latest write.

Whether that is acceptable is a *product* question, not a technical one. Here it
mostly is, because the public read path is already asynchronously decoupled — a
listing becomes visible via a background job after approval (§33.6). Where it is
**not** acceptable: session lookups (a revoked session must die *now*) and
anything in a write transaction.

---

## D. Storage — files, objects, and signed URLs

### D1. Filesystem vs object storage

**A filesystem** has directories, is mounted to one machine, supports partial
writes and appends, and dies with the machine.

**Object storage** is a flat key/value store over HTTP. A **bucket** is a
namespace; a **key** is the whole path (`vehicles/<vehicleId>/<mediaId>/640.webp`
— the slashes are just characters). Objects are written and read whole, are
replicated for durability, and are addressed by URL.

**Why here.** Container filesystems are ephemeral: a redeploy replaces the
container and everything written to its disk is gone. `env.ts` refuses to start
in production with `STORAGE_DRIVER=local` for exactly that reason. Object storage
is also independently scalable and directly reachable by the browser — which is
what makes the next two entries possible.

**Here.** `StoragePort` (`platform/storage/storage.port.ts`) is the seam. Three
drivers, one interface: `local` (filesystem + an HMAC-signed `/uploads` route),
`minio` and `r2` — and the last two are **the same adapter**, because they speak
the same protocol. There is no `if (isR2)` anywhere in `s3.adapter.ts`. That is
the whole content of the claim "changing provider is configuration".

### D2. Presigned URL

**What.** A URL that already contains a cryptographic signature authorising one
specific operation on one specific object, until a specific time.

**Why.** So the browser can upload **directly to storage** without the API ever
touching the bytes, and without the browser ever holding a storage credential.

**How (S3 SigV4).** The server, holding the secret key, computes a signature over
a canonical form of the request — method, bucket, key, expiry, **and the headers
it names as signed**. The storage service recomputes it and compares.

**The detail that makes the whole design safe:**

```ts
getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType, ContentLength }), {
  expiresIn: expiresInSeconds,
  signableHeaders: new Set(['content-type', 'content-length']),
});
```

`content-type` **and** `content-length` are *signed*, not hints. A client that
asks to upload 400 KB of JPEG and then sends 40 MB of something else is rejected
**by the object store**, before a byte is stored. That check is why the `commit`
step can trust what it finds.

**Here.** The three-step upload (Part 14): `presign` → browser `PUT`s the bytes
straight to R2 → `commit` (the API `HEAD`s the object and verifies the size
matches what was declared, then enqueues processing). The API never sees an image
byte on the upload path. A dealer uploading twelve 8 MB photos costs one
signature.

The local adapter reproduces the *contract* with its own HMAC over the same four
values (`local.adapter.ts` + the `PUT /uploads` route), so the code path the
browser takes is identical whichever driver is configured.

**Analogy.** A one-time, time-limited delivery authorisation for one named parcel
at one named loading bay — not a key to the warehouse.

### D3. Signed *read* URL, and why KYC documents are different

`signedReadUrl(key, seconds)` is the only way a KYC document is ever served —
minutes, not hours, and every issue of one is audit-logged. Those documents have
**no public route at all**.

Vehicle photos are the opposite: public, immutable, and served from a URL
addressed by media id and width. Never confuse the two paths (§33.3).

### D4. CDN, cache headers, and content addressing

Covered in §33.3. The concept in one sentence: a CDN is a fleet of caching
servers near your users; **`Cache-Control` is how you tell it what it may keep
and for how long**; and if your URLs are content-addressed and immutable, cache
invalidation — the hard part — never has to happen.

```ts
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
```

`public` = any cache may store it. `max-age=31536000` = one year. `immutable` =
do not even revalidate. Safe **only** because a new upload gets a new media id
and therefore a new URL.

The counterpart appears on every authenticated response: `Cache-Control: no-store`
on `/v1/auth/me`, on admin login, on `/v1/auth/providers`.

---

## E. Runtime — processes, containers, and the platform

### E1. Process, thread, and Node's event loop

**A process** is a running program with its own memory. **A thread** is a line of
execution inside it.

**Node.js runs your JavaScript on a single thread**, with an **event loop**: when
you `await` something I/O-bound, the thread is handed back to the loop to run
other work, and your continuation is queued when the I/O completes.

**Consequences that matter here:**

- **I/O-bound work scales beautifully.** Thousands of concurrent requests, each
  awaiting Postgres or R2, are fine — that is nearly everything this API does.
- **CPU-bound work blocks everything.** While `sharp` is re-encoding a 12 MP
  photo, that process serves no other request. This is *the* reason
  `media.process` belongs in a worker rather than the HTTP process, and it is
  the concrete meaning of §33.2's worker-entrypoint item.
- **One process uses one core** for JavaScript. Four vCPU does not make one Node
  process four times faster — four tasks does (§33.4).

**Analogy.** One very fast waiter. They can keep thirty tables moving because
most of the time they are waiting on the kitchen. Ask them to *cook* one dish and
all thirty tables wait.

### E2. Container and image

**An image** is an immutable, layered filesystem plus metadata (entrypoint,
environment, ports). **A container** is a running instance of one, isolated by
kernel namespaces and cgroups.

**Why.** "Works on my machine" becomes "works, because it *is* my machine's
filesystem". The image built in CI is the image that runs in production.

**Layers and caching.** Each Dockerfile instruction produces a layer, cached by
its inputs. This is why the `deps` stage copies only manifests before
`pnpm install` (§30.6): editing a `.tsx` file must not reinstall the dependency
tree.

**Multi-stage builds.** `base → deps → build → runner` (plus `migrator` for the
API). Build tools stay in the build stage; the runtime image contains only what
it needs. It is why the API image has production dependencies only and no React.

**`USER node`.** Both runtime images and the migrator run as non-root. A
container process running as root turns a container escape into a host
compromise.

**Analogy.** An image is a recipe plus every ingredient, sealed. A container is
the meal being cooked from it. Two kitchens produce the same meal.

### E3. Orchestration — ECS, Fargate, task, service

| Term | Meaning |
|---|---|
| **Task definition** | the blueprint: image, CPU, memory, environment, secret ARNs, log config |
| **Task** | one running instance of a task definition — roughly, one container |
| **Service** | a controller that keeps N tasks running, registers them with a target group, and manages rollouts |
| **Cluster** | the logical grouping |
| **Fargate** | serverless compute — AWS runs the host; you never see or patch a VM |

A **rolling deployment** starts new tasks, waits for them to pass the target
group health check, then drains and stops the old ones.
`minimumHealthyPercent=100, maximumPercent=200` means the new task must be
healthy before an old one is stopped, so there is never a moment with reduced
capacity.

### E4. Health check: liveness vs readiness

- **Liveness** — *is this process alive?* If not, restart it.
- **Readiness** — *should this process receive traffic?* If not, remove it from
  rotation but leave it running.

Conflating them is a classic outage: if a liveness probe checks the database, a
five-second database blip restarts every container simultaneously.

**Here.** `/health/live` touches nothing. `/health/ready` runs `SELECT 1` and
returns 503 with the failing dependency **named**, plus `version` (the deployed
`GIT_SHA`), `appEnv` and `uptimeSeconds`. The web app's `/api/health` touches
nothing at all — deliberately, so an API incident does not pull the front end out
of rotation too (§23.5).

### E5. Stateless, and what "state" actually means

**Stateless** means no request depends on which instance served the previous one.

The audit for this API:

| | Status |
|---|---|
| Sessions in Postgres, not process memory | ✅ |
| No in-memory user cache | ✅ |
| Uploads to object storage, not local disk | ✅ |
| **Rate-limit counters in a process-local `Map`** | ⚠️ the one piece of per-instance state |
| **`WORKER_INLINE=true` — job handlers in every API process** | ⚠️ the other one |

Those two ⚠️ rows are exactly why `dd-api-prod` is capped at one task, and
exactly what §33.2 items 3 and 4 remove.

### E6. Graceful shutdown

Covered in §23.6. The concept: on `SIGTERM`, stop accepting new connections,
let in-flight requests finish, release resources, exit — with a hard timeout so a
hung request cannot block a deploy forever, and `timer.unref()` so the timer
itself does not keep the process alive.

### E7. Environment variables, secrets, and configuration

**Why not a config file in git?** Because the same image must run in dev and in
production. Configuration is *injected*, not baked (§23.7).

Three rules this repo enforces:

1. **`env.ts` is the only place `process.env` is read.** Everywhere else imports
   the validated, frozen `env` object. Reading `process.env` elsewhere is a bug.
2. **Validation happens at boot**, with cross-field rules — "this is required
   *because* of that". Production refuses `AUTH_MODE=dev`,
   `STORAGE_DRIVER=local`, the local `SESSION_SECRET`, the local
   `UPLOAD_SIGNING_SECRET`, and missing Google or S3 credentials. A misconfigured
   production task fails its health check and is rolled back; it never serves.
3. **`NEXT_PUBLIC_*` is banned.** Those are inlined at build time, which would
   force one image per environment and break build-once-promote-many. Anything
   the browser needs is read on the server (`lib/config.ts`) and passed down as
   props.

**Secrets** differ from configuration only in handling: SSM SecureStrings,
resolved by the ECS execution role at task start, never in git, never in a
workflow file, never in an image.

---

## F. Distributed-systems ideas you will meet in this code

### F1. Idempotency

**What.** An operation that, performed twice, has the same effect as performing
it once.

**Why.** Networks retry. A response can be lost after the work was done. Without
idempotency, a retry double-charges.

**Here.** Every job handler is idempotent, because outbox delivery is
**at-least-once**. `sessions.revoke()` is idempotent — signing out twice must not
be an error. `search.index(listingId)` rebuilds a row from scratch and assumes it
will run twice. `db:bootstrap` is create-if-missing so running it twice is
harmless. And payment webhooks are keyed so a duplicate delivery adds no credits
(Part 15).

### F2. At-least-once vs exactly-once

**Exactly-once delivery does not exist** in a distributed system. You get
at-least-once (retries, possible duplicates) or at-most-once (no retries,
possible loss). The practical answer is **at-least-once delivery plus idempotent
handlers**, which is *effectively* exactly-once processing.

**Here.** That is precisely the outbox + pg-boss design (Part 13).

### F3. Race condition and TOCTOU

**A race condition** is a bug whose outcome depends on timing. **TOCTOU** —
time-of-check to time-of-use — is the specific shape where you check a condition
and then act on it, and something changes in between.

**Here.** The guard (`requirePermission`) checks capability at the edge; the
service re-checks ownership **inside the transaction that writes**, with the
tenant predicate in the `WHERE` clause of the write itself. Both checks, always,
so there is no gap between "you may" and "this row is yours" (Part 8).

### F4. The transactional outbox

**The problem.** You cannot atomically write to your database *and* publish to an
external queue. Either the row commits and the message is lost, or the message is
sent and the transaction rolls back.

**The solution.** Write the event **into the same database, in the same
transaction**. A poller reads unpublished rows and forwards them.

**Here.** `outbox_events` + `outbox-publisher.ts`, polling every 2 s with
`SELECT … FOR UPDATE SKIP LOCKED` so several publishers can drain concurrently
without seeing each other's rows. When the sink becomes a real broker, this is
**the only file that changes**.

### F5. CQRS, in the shape actually used here

**Command Query Responsibility Segregation**: the model you write through and the
model you read through are different structures.

Not the full ceremony — no event sourcing, no separate services. Just the useful
half: writes go to the normalized tables; public reads go to `listing_search`,
rebuilt by a job. That single separation is what makes read scaling (replicas,
caches, a search engine) a routing decision rather than a rewrite (§33.6).

### F6. Backpressure and priority

When work arrives faster than it can be done, something must give. A queue
absorbs the burst; **priorities** decide what is done first when it cannot all be
done at once.

**Here.** `notification.enquiry-to-dealer` has priority **100** — the highest —
with the comment *"It is the product."* A buyer's enquiry reaching a dealer fast
is the thing dealers pay for. Media processing (50) can wait a few seconds; a
lead cannot.

---
---

# Part 35 — Reference links for learning

Official documentation first, because it is the thing that stays correct. Videos
and courses are listed where they genuinely explain something better than prose
does; for those I give the **title and the channel**, so search for the title
rather than trusting a link that may have moved.

A suggested order is at the end (§35.11).

## 35.1 The web platform — HTTP, cookies, CORS

| Resource | Why |
|---|---|
| [MDN — HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP) | The reference. Methods, status codes, headers, caching |
| [MDN — Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) | Read the `SameSite`, `HttpOnly` and `Secure` sections carefully — they are §B3 of this document |
| [MDN — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) | Especially preflight and `Access-Control-Allow-Credentials` |
| [MDN — Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) | The boundary the whole hostname layout (§23.2) exists to respect |
| [web.dev — HTTP caching](https://web.dev/articles/http-cache) | `Cache-Control`, `immutable`, and why content-addressed URLs never need invalidating |
| [RFC 9457 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc9457) | The exact error format this API returns (Part 20) |

**Video:** *"HTTP/1.1 vs HTTP/2 vs HTTP/3"* and the TLS handshake series on
[Hussein Nasser's channel](https://www.youtube.com/@hnasr) — genuinely good at
the packet-level "why" behind connections, TLS and connection pooling.

## 35.2 OAuth 2.0 and OpenID Connect

Read these in this order. This is the densest area in the codebase.

| Resource | Why |
|---|---|
| [oauth.net/2](https://oauth.net/2/) | The best plain-English entry point. Start with "Authorization Code" and "PKCE" |
| [Google — OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) | Exactly the flow `google.provider.ts` implements |
| [Google — OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) | The ID token, its claims, and the `sub` |
| [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | §3.1.3.7 is the clause that justifies not re-verifying the ID token signature (§B8). Worth reading the actual words |
| [RFC 6749 — OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749) | The base spec. §4.1 is the authorization code grant |
| [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636) | §4.1–4.2 define `code_verifier` and the S256 challenge. Short, and the code matches it line for line |
| [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics) | Why PKCE is now recommended for confidential clients too |
| [jwt.io](https://jwt.io/) | Paste a JWT and see its claims. Do this once with a real Google ID token — it makes §B8 concrete |

**Video:** *"OAuth 2.0 and OpenID Connect (in plain English)"* by Nate
Barbettini, on the [OktaDev channel](https://www.youtube.com/@OktaDev). The
clearest hour on this topic; it builds the flow up from the naive version and
shows what each addition defends against.

## 35.3 Sessions, passwords, and application security

| Resource | Why |
|---|---|
| [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Token entropy, storage, expiry, revocation. §B4 in one page |
| [OWASP — Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | The source of the Argon2id parameters in `password.ts` (19 MiB, 2 passes) |
| [OWASP — CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Read the `SameSite` section: it is the defence this system relies on |
| [OWASP Top 10](https://owasp.org/www-project-top-ten/) | Broken access control is #1, and it is what Parts 6–8 are about |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) | The index. Also see Authorization, Multi-tenancy, and File Upload |
| [helmet documentation](https://helmetjs.github.io/) | Every header `app.use(helmet())` sets, and what each one blocks |

## 35.4 PostgreSQL

| Resource | Why |
|---|---|
| [PostgreSQL 16 documentation](https://www.postgresql.org/docs/16/index.html) | The reference |
| [Concurrency Control (MVCC)](https://www.postgresql.org/docs/current/mvcc.html) | Why readers never block writers, and what `FOR UPDATE` actually does |
| [Indexes](https://www.postgresql.org/docs/current/indexes.html) | B-tree, GIN, GiST, and multicolumn index ordering |
| [Full Text Search](https://www.postgresql.org/docs/current/textsearch.html) | `tsvector`, `setweight`, and the GIN index behind `listing_search` |
| [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) | The trigram index used for fuzzy make/model matching |
| [Write-Ahead Logging](https://www.postgresql.org/docs/current/wal-intro.html) | The mechanism under durability, PITR and read replicas |
| [EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) | How to read a query plan. The single most useful database skill |
| **[Use The Index, Luke](https://use-the-index-luke.com/)** | **Free, and the best explanation of indexing anywhere.** If you read one thing in this section, read this |
| [PgBouncer](https://www.pgbouncer.org/) | Read the pooling-modes page before you ever consider one (§32.8) |

## 35.5 Prisma and the ORM layer

| Resource | Why |
|---|---|
| [Prisma documentation](https://www.prisma.io/docs) | Start with the Prisma Client CRUD and relations guides |
| [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate) | Especially "Migrate in development" vs "Migrate in production" — §32.4 |
| [Prisma — Transactions and batch queries](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) | Interactive transactions, which is what `withTransaction` uses |
| [Prisma — Connection pool](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool) | `connection_limit`, and the arithmetic in §33.5 |

## 35.6 Node, Express, Next.js, React

| Resource | Why |
|---|---|
| [Node — The event loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) | §E1. Why CPU-bound work belongs in a worker |
| [Express 5 documentation](https://expressjs.com/) | Routing, middleware order, error handling |
| [Next.js — App Router](https://nextjs.org/docs/app) | The whole of Part 18 |
| [Next.js — Caching](https://nextjs.org/docs/app/building-your-application/caching) | Read this before touching `lib/api.ts`. The session/cache interaction in §33.7 is here |
| [Next.js — Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) | How `features/*/actions.ts` works |
| [React — Server Components](https://react.dev/reference/rsc/server-components) | Why a component can `await` a database call |
| [Zod](https://zod.dev/) | `.strict()`, `.superRefine()`, coercion — Part 16 |

## 35.7 Monorepo tooling

| Resource | Why |
|---|---|
| [Turborepo documentation](https://turborepo.com/docs) | Start with "Configuring tasks" and "Caching". Part 30 |
| [Turborepo — `turbo.json` reference](https://turborepo.com/docs/reference/configuration) | `dependsOn`, `outputs`, `persistent`, `globalDependencies` |
| [pnpm — Workspaces](https://pnpm.io/workspaces) | `workspace:*`, filtering, `--filter pkg...` |
| [pnpm — Filtering](https://pnpm.io/filtering) | The `...` suffix the Dockerfiles depend on |

## 35.8 Containers, CI/CD, and AWS

| Resource | Why |
|---|---|
| [Docker — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/) | Both Dockerfiles |
| [Docker — Build cache](https://docs.docker.com/build/cache/) | Why only manifests are copied before `pnpm install` |
| [Docker — Dockerfile best practices](https://docs.docker.com/build/building/best-practices/) | Layer ordering, non-root users, `.dockerignore` |
| [GitHub Actions documentation](https://docs.github.com/en/actions) | Workflow syntax, jobs, reusable workflows |
| [GitHub Actions — OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) | Exactly what `configure-aws-credentials` does, and why no AWS key is stored |
| [GitHub — Security hardening for Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) | **Read the script-injection section.** It is why every `${{ }}` here is bound to an env var first (§31.5) |
| [GitHub — Deployment environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) | Required reviewers, environment secrets — the production gate |
| [Amazon ECS developer guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html) | Task definitions, services, deployment circuit breaker |
| [AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/userguide/what-is-fargate.html) | The serverless compute model |
| [Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) | Listener rules, target groups, health checks |
| [Amazon RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html) | Instance classes, parameter groups, maintenance |
| [RDS — Point-in-time recovery](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html) | §32.7. Note that it always restores into a **new** instance |
| [RDS — Read replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html) | §33.6 |
| [AWS shared responsibility model](https://aws.amazon.com/compliance/shared-responsibility-model/) | §32.1, from the source |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | The S3 API compatibility page is the one that matters here |
| [S3 — Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) | §D2 |
| [AWS SigV4](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv4_signing.html) | What `getSignedUrl` actually computes, and why signed headers matter |

## 35.9 Architecture, queues, and scaling

| Resource | Why |
|---|---|
| [microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) | The pattern in Part 13, named and diagrammed |
| [microservices.io — Idempotent consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html) | §F1 |
| [Martin Fowler — CQRS](https://martinfowler.com/bliki/CQRS.html) | And read his caution about when *not* to use it — §F5 |
| [pg-boss](https://github.com/timgit/pg-boss) | The README explains the Postgres-as-a-queue design and its limits |
| [The Twelve-Factor App](https://12factor.net/) | Config, backing services, disposability, dev/prod parity. This codebase follows it closely and it is a 30-minute read |
| [Google SRE Book](https://sre.google/books/) | Free. The chapters on **SLOs**, **monitoring distributed systems** and **release engineering** are the ones to read now |
| [AWS Well-Architected — Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) | A structured way to think about §33 |
| **Designing Data-Intensive Applications** — Martin Kleppmann (book) | The single best book for everything in Parts 32–34. Chapters 5 (replication), 7 (transactions) and 11 (stream processing) map directly onto this system |

**Video:** *"Scaling Postgres"* — the [Scaling Postgres channel](https://www.youtube.com/@ScalingPostgres)
is a weekly digest of real Postgres performance and operations material.

## 35.10 Tools worth having open while you learn

- **`psql`** — nothing teaches SQL faster than a prompt.
  `pnpm --filter @dealers-drive/api db:studio` is friendlier for browsing.
- **`EXPLAIN ANALYZE`** on every query you write. Twice a week for a month and
  indexing stops being mysterious.
- **Browser DevTools → Network → a request → Cookies / Headers.** Watch
  `Set-Cookie` arrive on the OAuth callback. Watch the presigned `PUT` go to a
  different host than everything else on the page.
- **[jwt.io](https://jwt.io/)** with a real Google ID token.
- **`docker compose logs -f api`** while you click through the app.

## 35.11 A suggested order

If you read everything in §35.1–§35.9 you will be here for a month. Read this
much, in this order, and you will understand the system:

1. **The Twelve-Factor App** — 30 minutes, and it explains half the decisions in
   this repo.
2. **MDN: Using HTTP cookies**, the `SameSite`/`HttpOnly`/`Secure` sections.
3. **oauth.net/2** → the *"OAuth 2.0 and OpenID Connect in plain English"* talk
   → **RFC 7636** (PKCE) → then re-read Part 4 of this document with the code
   open.
4. **Use The Index, Luke**, at least the first three chapters.
5. **PostgreSQL: MVCC** and **Using EXPLAIN**.
6. **Turborepo: Configuring tasks and Caching** — an hour, and Part 30 becomes
   obvious.
7. **Docker: Multi-stage builds** and **Build cache**.
8. **GitHub Actions: security hardening** — specifically script injection.
9. **RDS: point-in-time recovery**, then actually perform a restore into a
   throwaway instance on dev. **An untested backup is a hope, not a backup.**
10. **Designing Data-Intensive Applications**, chapters 5, 7 and 11 — over the
    following months, not this week.

---
---

# Closing — the questions you should now be able to answer

Work through these. If any is uncertain, the section is named.

| Question | Section |
|---|---|
| Where does my identity come from? | §4.4, §5.6 |
| How does the server know who I am? | §5.6 |
| Where is my session stored? | §5.5 |
| What happens when my session expires? | §5.8 |
| Why can't I send `dealerId`? | §7.3 |
| How does the system know which dealership I belong to? | §7.4 |
| Why can't Dealer A access Dealer B's vehicle? | §7.5 |
| Why 404 and not 403? | §7.5 |
| Why do we need transactions? | §9.3, §10.4 |
| Why do we lock database rows? | §8.3, §10.6 |
| What is a race condition? | §10.6 |
| What is TOCTOU? | §8 |
| Why do we need a ledger? | §10.1, §10.2 |
| Why can't we simply update the credit balance? | §10.1 |
| Why can't a dealer directly change listing status? | §11.3, §11.4 |
| Why can an approved car disappear when a dealer is suspended? | §12.6 |
| Why do we need background jobs? | §13.1 |
| Why do we need an outbox? | §13.3 |
| Why are images uploaded directly to storage? | §14.1, §14.2 |
| Why can't the client tell us a payment succeeded? | §15.4 |
| Why do we need webhooks? | §15.5 |
| Why do we need idempotency? | §15.6, §13.3 |
| Why do we need Zod if TypeScript has types? | §16.1 |
| Why do we need OpenAPI? | §17.7 |
| Why do we test against a real database? | §22.2 |
| Why do public pages use Server Components? | §18.4 |
| What happens from "Approve" until the car is publicly visible? | §24, Journey 6 |
| What is the difference between a token, a session and a cookie? | §34-B2 |
| Why is `dd_session` opaque rather than a JWT? | §34-B4, §5.9 |
| What do `state`, `nonce` and PKCE each defend against? | **§34-B9** |
| Why is the ID token's signature not re-verified? | §34-B8, §4.5 |
| Why is the account the Google `sub` and not the email? | §34-B8, §4.3 |
| Why is `SameSite=Lax` required rather than `Strict`? | §34-B3, §5.10 |
| Why is a presigned upload safe to hand to a browser? | §34-D2, §14.2 |
| Why does `contracts` have to build before anything else? | §30.3 |
| What does `dependsOn: ["^build"]` mean, and why the caret? | §30.3 |
| Why does Turbo cache `build` but not `test`? | §30.3 |
| What happens, exactly, when I merge a PR to `main`? | **§31.4** |
| Why does production never rebuild the image? | §31.1, §31.6 |
| Why is every `${{ }}` bound to an env var before the shell sees it? | §31.5 |
| What is expand/contract, and why is it not optional? | **§32.5** |
| How do I recover from a bad data migration? | §32.7 |
| What does AWS do for me, and what is still mine? | §32.1, §33.10 |
| Why is `dd-api-prod` capped at one task? | §23.8, §33.2 |
| What is the first thing that will break as we grow? | **§33.3** — image reads proxying through the API |
| Why does adding API tasks make the database problem worse? | §33.5 |
| When is a read replica safe here, and when is it not? | §33.6 |
| Why does this system need no Redis yet, and what needs it first? | §33.7 |

---

## The five sentences that carry the most weight

1. **The database is where invariants live; the application is where policy
   lives.** An application check is a suggestion under concurrency.
2. **`dealerId` always comes from the session.** Never a body, never a query,
   never a path.
3. **Check authorization twice** — capability in the middleware, ownership inside
   the transaction that writes.
4. **Never store a balance; store the movements.** The current value is a cache of
   the newest row.
5. **Evaluate a rule once, in one place.** Public visibility is membership in
   `listing_search`, which is why suspending a dealer removes their cars and
   reinstating brings them back without re-approving anything.

---

## And three more, added with Parts 30–35

6. **The artifact you test is the artifact you ship.** One image, built once,
   tagged with the commit SHA, promoted — never rebuilt for production.
7. **Stateless scales; stateful does not.** The two pieces of per-instance state
   left in the API (the rate-limit `Map` and `WORKER_INLINE`) are the entire
   reason it is capped at one task.
8. **Find the bottleneck before adding capacity.** Adding API tasks when the
   database is saturated makes it worse, because each task brings its own
   connection pool.

---

*Written from the code in this repository. Where documentation and implementation
disagreed, both are recorded — see Part 29. Corrections belong in this file and in
`CONTEXT.md`.*

*Revision 2026-08-24: Part 23 rewritten against the AWS ECS deployment that now
exists; Parts 30–35 added (Turborepo, CI/CD, database operations, scaling,
first-principles concepts, reference links); the stale rows in Part 29 corrected.
Traced from `.github/workflows/`, `deploy/aws/`, `apps/*/Dockerfile`,
`apps/api/src/`, `apps/web/src/` and `apps/api/prisma/`.*
