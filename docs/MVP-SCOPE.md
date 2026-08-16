# Dealers-Drive — Revised 8-Week MVP

**Supersedes:** the 14-week plan, for the next two months only.
**Companion to:** `dealers-drive-architecture.md` (still the reference for anything not restated here).
**Scope:** 40 working days. Dealer auth → inventory → admin approval → public catalog with full filtering.

---

# 1. Your five decisions, assessed

### ✅ 1. No customer sign-in — public browsing only. **Correct. Take the cut.**

This removes more than you probably realise: customer registration, the customer role, favorites, saved searches, the `/saved` page, buyer email flows, the anonymous→logged-in favorites merge, and a whole branch of the permission model. Roughly **6 days of work** gone, for zero loss of validation value.

One consequence to accept deliberately: **favorites go to `localStorage` only.** A buyer who saves three cars and clears their browser loses them. That's fine at this stage — it's the cheapest possible version and it costs you nothing to upgrade later, because you'll already have the vehicle ids.

Keep the `users` table anyway. Dealers and admins are users; you just won't have any customer rows in it.

### ✅ 2. Express instead of NestJS. **Accepted — with one condition.**

This is a reasonable call. Express is faster to start, you almost certainly know it already, and there's no magic to fight. What you're giving up is the four things NestJS was doing for free in my original design:

| Lost | Replacement (all in §3 below) |
|---|---|
| Dependency injection | A manual composition root — 40 lines, arguably clearer |
| Decorator guards (`@RequirePermission`) | Explicit middleware chains on each route |
| Validation pipes | A `validate(schema)` middleware using the same Zod contracts |
| Auto-generated OpenAPI | Skip it for now. Your contracts package is the contract. |

**The condition:** the module-boundary discipline stays. NestJS made it structural; in Express you have to enforce it with folder conventions plus the ESLint rule. If you skip that, you'll have a genuine ball of mud by week 6 — Express makes it very easy to reach across modules and call another module's repository directly. The rule is in §3.4 and it's non-negotiable.

Use **Express 5** (async errors propagate to the error handler natively). If you must stay on 4, add `express-async-errors` on line one of `server.ts`.

### ✅ 3. Every listing admin-approved. **Correct, and good for trust.**

This was already in the architecture as `auto_approve_listings = false`; you're just making it permanent. It gives you quality control on day one, which matters enormously when you have 300 listings and every bad one is 0.3% of your inventory.

Two consequences to plan for:

- **You are the bottleneck.** At 30 dealers adding 3 cars a week, that's ~90 listings/week to review. Build the keyboard-shortcut moderation queue — approve/reject/skip on A/R/S — or you will stop doing it by week three.
- **Set an SLA and show it.** "Reviewed within 24 hours" on the dealer's screen. A dealer who uploads a car and hears nothing for two days assumes the platform is dead.

### ✅ 4. Dealers can request photography. **Keep it — and it's better than you're presenting it.**

This isn't a convenience feature. It's the answer to the single biggest friction point in dealer onboarding, and it's a **future revenue line** (₹500/car for a photo shoot is an easier sell than a listing fee, because the dealer can see what they got).

Build it dead simple for now: a request form, a status field, an admin queue, and the ability for an admin to upload photos onto a dealer's vehicle. **No scheduling engine, no calendar integration, no photographer app.** You'll do the first fifty shoots yourself with a phone and a bedsheet.

### ⚠️ 5. Keep it simple, build phase by phase. **Agreed — but your list is missing something load-bearing.**

Your six features describe a catalog. They don't describe a marketplace, because **there is no way for a buyer to contact a dealer.**

If a dealer lists 12 cars, waits for admin approval, sees them go live, and then receives nothing — no call, no message, no enquiry — they will churn before month three and you'll have learned nothing about whether the model works. The lead *is* the product. Everything else is plumbing.

So I'm adding three things back. They total about four days.

---

# 2. Three things I'm adding back

### 2.1 A contact path 🔴 Non-negotiable — 2 days

Minimum viable:
- **"Show number"** button on the vehicle page and the dealer page. Reveals the dealer's phone, logs the reveal, rate-limited per IP. This alone protects your dealers' numbers from being scraped by competitors, which is a real and immediate threat.
- **A simple enquiry form** — name, phone, optional message. No account needed. Emails the dealer within 30 seconds and appears in a basic list on their dashboard.

That's it. No inquiry status workflow, no internal notes, no CRM. Two tables, one email template, one page.

### 2.2 Indian SMS/DLT registration 🔴 Start on Day 1 — bureaucratic blocker

You want OTP to both email and phone. Sending transactional SMS in India requires **DLT (Distributed Ledger Technology) registration** with a telecom operator: register the entity, register a sender header, and get each message template approved. This typically takes **3–10 working days** and can't be rushed.

**Start it on Day 1**, before you write any code. Recommended provider: MSG91 (they walk you through DLT) or Fast2SMS. Budget ₹0.15–0.25 per SMS.

**Fallback if it isn't ready by Day 6:** ship with email verification required and phone verification optional-but-prompted, behind a config flag. Flip the flag when DLT clears. Do not let a telecom queue block your build.

### 2.3 The `listings` table 🟡 The one piece of future-proofing I won't cut — 20 lines

Everything else I'm happy to simplify. This one I'd keep separate from `vehicles`, because it's exactly where your revenue attaches in month three.

A **vehicle** is the physical car. A **listing** is a publication window with a status and an expiry. Right now a listing costs nothing, so it's just a thin row. In month three when you charge per listing, add renewals, or add featured placement, you'll attach all of it here instead of doing a schema migration on your busiest table with live dealers on it.

Cost today: one extra insert on publish, one extra join you won't notice. That's a good trade.

---

# 3. Revised scope

## 3.1 In / out

| | In the 8 weeks | Deferred to month 3+ |
|---|---|---|
| **Auth** | Dealer signup (email + phone), dual OTP verification, sessions, password reset, admin login with 2FA | Customer accounts, OAuth/Google, dealer staff sub-accounts, impersonation |
| **Dealer** | Profile/portfolio, logo, about, location, contact details, dealer public page | KYC document upload, verification badges, multi-branch |
| **Vehicles** | Full CRUD, all filterable attributes, drafts, soft delete, mark sold | Bulk CSV import, VIN decode, condition reports |
| **Media** | Direct-to-R2 upload, client compression, derivatives, EXIF strip, reorder, primary image | Watermarking, perceptual-hash dedupe, NSFW detection |
| **Photo requests** | Request form, admin queue, admin uploads on dealer's behalf | Scheduling, photographer app, payment for shoots |
| **Listings** | Submit → admin approve/reject → live. Reject reasons. | Expiry, renewal, featured/boost, credits |
| **Public site** | Homepage, /cars with all 13 filters, vehicle detail, dealer page | Saved searches, comparison, EMI calculator, similar-vehicle ML |
| **Contact** | Show-number reveal + enquiry form + dealer email alert | Inquiry status workflow, WhatsApp, call tracking |
| **Admin** | Dealer approval, listing moderation queue, photo request queue, basic platform stats | Refunds, config editor UI, audit log viewer, disputes |
| **Payments** | ❌ **None.** Invoice your first cohort by hand. | Razorpay, credits, invoices, subscriptions — month 3 |
| **SEO** | Metadata, canonical URLs, JSON-LD on vehicle pages, sitemap | Facet landing pages, city pages, programmatic SEO |
| **Ops** | Sentry, structured logs, backups, one runbook | OpenTelemetry, Grafana, load testing, canary deploys |

## 3.2 On leaving payments out

This is the right call for eight weeks, but be clear-eyed: **you will finish this build without having validated that dealers pay.** Compensate deliberately:

- Onboard your first cohort with a written agreement and an **invoice you raise by hand**. ₹X for the first 20 listings, payable on onboarding. A bank transfer against a manual invoice is exactly as valid a proof of willingness-to-pay as a Razorpay integration, and it costs you zero development days.
- Add a `dealers.listing_allowance` integer and decrement it on publish. Twelve lines. When Razorpay lands in month three, the credit ledger replaces it and the semantics are already familiar to your dealers.

## 3.3 Revised stack

| Layer | Choice | Change from the original |
|---|---|---|
| Web | Next.js 15 App Router, Tailwind v4 | unchanged |
| API | **Express 5** + TypeScript | was NestJS |
| ORM | Prisma 6 | unchanged |
| Database | PostgreSQL 16 (Neon) | unchanged |
| Validation | Zod, shared via `packages/contracts` | unchanged |
| Jobs | pg-boss | unchanged |
| Storage | Cloudflare R2 + Images | unchanged |
| Email | Resend | unchanged |
| **SMS** | **MSG91 (DLT-registered)** | **new** |
| Payments | — | **removed for now** |
| Search | Postgres + `listing_search` table | unchanged |
| Errors | Sentry | unchanged |
| Hosting | Vercel + Render + Neon + Cloudflare | unchanged |

---

# 4. Express architecture

Since this is the biggest structural change, here is the shape concretely. The goal is to reproduce the discipline NestJS gave you, using nothing but folders, plain functions and one ESLint rule.

## 4.1 Layout

```
apps/api/src/
├── server.ts                  # express app assembly, nothing else
├── container.ts               # composition root — wires every module by hand
├── routes.ts                  # mounts module routers under /v1
├── config/
│   └── env.ts                 # zod-validated process.env, fails fast at boot
├── middleware/
│   ├── request-context.ts     # AsyncLocalStorage: traceId, userId, dealerId, ip
│   ├── auth.ts                # requireAuth, optionalAuth
│   ├── permissions.ts         # requireRole('OWNER'), requireAdmin()
│   ├── tenant.ts              # resolveDealer — puts dealerId in context
│   ├── validate.ts            # validate({ body, query, params }) using Zod
│   ├── rate-limit.ts
│   ├── error-handler.ts       # RFC 9457 Problem Details, last in the chain
│   └── not-found.ts
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts     # ONLY this file touches express Router
│   │   ├── auth.controller.ts # req/res → service call → res. No logic.
│   │   ├── auth.service.ts    # all business logic. Never sees req/res.
│   │   ├── auth.repository.ts # ONLY place prisma is touched in this module
│   │   ├── auth.facade.ts     # the ONLY file other modules may import
│   │   └── auth.types.ts
│   ├── dealers/  catalog/  vehicles/  listings/  media/
│   ├── search/   enquiries/  photoRequests/  admin/
│   └── notifications/
├── platform/
│   ├── db/            prisma.ts · tx.ts (transaction helper)
│   ├── jobs/          queue.ts (pg-boss) · handlers/ · scheduler.ts
│   ├── storage/       storage.port.ts · r2.adapter.ts · minio.adapter.ts
│   ├── mail/          mailer.port.ts · resend.adapter.ts
│   ├── sms/           sms.port.ts · msg91.adapter.ts · console.adapter.ts
│   ├── events/        bus.ts · outbox.ts · publisher.ts
│   ├── audit/         audit.service.ts
│   └── telemetry/     logger.ts (pino) · sentry.ts
└── worker.ts                  # same codebase, runs pg-boss handlers
```

## 4.2 The composition root — this replaces DI

```ts
// container.ts
export function buildContainer(prisma: PrismaClient) {
  // platform
  const storage = createR2Storage(env);
  const mailer  = createResendMailer(env);
  const sms     = env.SMS_PROVIDER === 'msg91'
                  ? createMsg91Sms(env) : createConsoleSms();
  const queue   = createQueue(env.DATABASE_URL);
  const events  = createEventBus(queue);
  const audit   = createAuditService(prisma);

  // modules — each returns { router, facade }
  const auth    = createAuthModule({ prisma, mailer, sms, audit });
  const dealers = createDealersModule({ prisma, audit, events });
  const catalog = createCatalogModule({ prisma });
  const media   = createMediaModule({ prisma, storage, queue });
  const vehicles= createVehiclesModule({ prisma, catalog: catalog.facade,
                                          media: media.facade, events });
  const listings= createListingsModule({ prisma, vehicles: vehicles.facade,
                                          events, audit });
  const search  = createSearchModule({ prisma });
  const enquiries = createEnquiriesModule({ prisma, mailer, events });
  const photos  = createPhotoRequestsModule({ prisma, events });
  const admin   = createAdminModule({ prisma, audit,
                    dealers: dealers.facade, listings: listings.facade,
                    photos: photos.facade, media: media.facade });

  return { auth, dealers, catalog, vehicles, listings, media, search,
           enquiries, photos, admin, queue, events };
}
```

Explicit, greppable, and trivially testable — pass fakes in, get a module out. No decorators, no reflection, no framework magic to debug at 2am.

## 4.3 A module's router — guards as middleware chains

```ts
// modules/vehicles/vehicles.routes.ts
export function createVehiclesRouter(c: VehiclesController) {
  const r = Router();

  // ── dealer-scoped ──────────────────────────────────────────────
  r.use('/dealer/vehicles', requireAuth, resolveDealer, requireDealerActive);

  r.post('/dealer/vehicles',
    requireRole('OWNER', 'MANAGER'),
    validate({ body: CreateVehicleInput }),
    c.create);

  r.get('/dealer/vehicles',
    validate({ query: DealerVehicleQuery }),
    c.listMine);

  r.patch('/dealer/vehicles/:id',
    requireRole('OWNER', 'MANAGER'),
    validate({ params: IdParam, body: UpdateVehicleInput }),
    c.update);

  r.post('/dealer/vehicles/:id/submit',      // → PENDING_REVIEW
    requireRole('OWNER', 'MANAGER'),
    validate({ params: IdParam }),
    c.submitForReview);

  return r;
}
```

The middleware order **is** the security model. `resolveDealer` puts `dealerId` into the request context from the session; the controller never reads it from the body.

## 4.4 The four rules that keep Express from becoming a mud ball

1. **Only `*.routes.ts` imports from `express`.** Services and repositories never see `req` or `res`. If a service takes a `Request` parameter, it's wrong.
2. **Only `*.repository.ts` imports `prisma`.** Grep for `prisma.` outside repositories in code review — it should return nothing.
3. **Cross-module imports go through `*.facade.ts` only.** Enforced by ESLint:

```js
'no-restricted-imports': ['error', { patterns: [{
  group: ['**/modules/*/!(*.facade)'],
  message: 'Import <module>.facade.ts, not its internals.',
}]}]
```

4. **Every dealer-scoped repository method takes `dealerId` as its first required parameter.** Not optional, not from a context lookup inside the repository — an explicit argument, so an unscoped query is a type error.

## 4.5 Error handling and async

Express 5 propagates async errors automatically. Your error handler is the last middleware and produces Problem Details:

```ts
// middleware/error-handler.ts
export function errorHandler(err, req, res, _next) {
  const ctx = getContext();
  if (err instanceof ZodError)        return problem(res, 400, 'VALIDATION_FAILED', err, ctx);
  if (err instanceof NotFoundError)   return problem(res, 404, err.code, err, ctx);
  if (err instanceof ForbiddenError)  return problem(res, 403, err.code, err, ctx);
  if (err instanceof DomainError)     return problem(res, 422, err.code, err, ctx);
  logger.error({ err, traceId: ctx.traceId }, 'unhandled');
  Sentry.captureException(err, { tags: { traceId: ctx.traceId } });
  return problem(res, 500, 'INTERNAL', null, ctx);   // detail stripped in prod
}
```

---

# 5. Revised database schema

Changes from the original, in both directions.

## 5.1 Removed for now

`Favorite` · `Review` · `Payment` · `CreditLedger` · `Invoice` · `WebhookEvent` · `Subscription` · `DealerDocument` (KYC) · customer rows in `User`.

## 5.2 Added for your filter list and new features

```prisma
model Vehicle {
  // … everything from ARCHITECTURE.md §7.2, plus:
  seats          Int?                 // filter
  airbags        Int?                 // "safety" filter
  rtoCode        String?              // "MH-01" — filter
  colorId        String?  @db.Uuid    // normalized, not free text — filter
  // removed for now: insuranceValidTill, condition (keep the column, hide the UI)
  @@index([rtoCode])
  @@index([seats])
}

model Rto {                            // ~1,400 rows in India, seed once
  code   String @id                    // "MH-01"
  name   String                        // "Mumbai Central"
  city   String
  state  String
  @@index([state])
}

model Color {                          // ~24 rows. Normalized so the filter works.
  id      String @id @default(uuid()) @db.Uuid
  slug    String @unique               // "pearl-white"
  name    String                       // "Pearl White"
  hex     String                       // for the swatch in the filter UI
  family  String                       // white|black|silver|grey|blue|red|…
  sortOrder Int
}

model PhotoRequest {
  id          String @id @default(uuid()) @db.Uuid
  dealerId    String @db.Uuid
  vehicleId   String? @db.Uuid          // null = "come shoot several"
  vehicleCount Int    @default(1)
  status      PhotoRequestStatus @default(REQUESTED)
  // REQUESTED → SCHEDULED → COMPLETED | CANCELLED
  preferredDate DateTime?
  scheduledFor  DateTime?
  address     String
  contactName String
  contactPhone String
  notes       String?
  adminNote   String?
  completedAt DateTime?
  createdAt   DateTime @default(now())
  @@index([status, createdAt])
  @@index([dealerId, createdAt])
}

model Enquiry {                          // simplified from the original Inquiry
  id        String @id @default(uuid()) @db.Uuid
  vehicleId String @db.Uuid
  dealerId  String @db.Uuid
  name      String
  phone     String                       // E.164
  message   String?
  source    String                        // "vdp" | "dealer_page"
  ip        String?
  createdAt DateTime @default(now())
  @@index([dealerId, createdAt])
}

model PhoneReveal {                      // anti-scraping signal + lead metric
  id        BigInt @id @default(autoincrement())
  vehicleId String? @db.Uuid
  dealerId  String @db.Uuid
  ip        String
  userAgent String?
  createdAt DateTime @default(now())
  @@index([dealerId, createdAt])
  @@index([ip, createdAt])
}

model VerificationCode {                 // email + phone OTP
  id         String @id @default(uuid()) @db.Uuid
  userId     String @db.Uuid
  channel    Channel                     // EMAIL | PHONE
  codeHash   String                      // never store the plaintext code
  attempts   Int      @default(0)
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime @default(now())
  @@index([userId, channel, consumedAt])
}

model Listing {                          // kept, but thin (§2.3)
  id          String @id @default(uuid()) @db.Uuid
  vehicleId   String @db.Uuid
  dealerId    String @db.Uuid
  status      ListingStatus @default(PENDING_REVIEW)
  // PENDING_REVIEW → APPROVED → (SOLD | REMOVED) | REJECTED
  submittedAt DateTime @default(now())
  reviewedAt  DateTime?
  reviewedBy  String?  @db.Uuid
  rejectionReason String?
  approvedAt  DateTime?
  viewCount   Int @default(0)
  enquiryCount Int @default(0)
  @@index([status, submittedAt])         // ← the moderation queue query
  @@index([dealerId, status])
}

model Dealer {
  // … as before, minus KYC fields, plus:
  listingAllowance Int @default(0)        // manual stand-in for credits (§3.2)
}
```

## 5.3 The `listing_search` table gains your filter columns

Add to §7.5's definition: `seats`, `airbags`, `rto_code`, `rto_state`, `color_slug`, `color_family`, and indexes on each. Thirteen filters is a lot — the denormalized table is what stops each one becoming another join.

---

# 6. The 40-day plan

Same prompt format as before: paste `docs/CONTEXT.md`, then the day's prompt. Every prompt references `docs/ARCHITECTURE.md` (the original doc) and `docs/MVP-SCOPE.md` (this one) — commit both.

| Week | Days | Theme | Ends with |
|---|---|---|---|
| 1 | 1–5 | Foundations | A commit reaches production automatically |
| 2 | 6–10 | Dealer auth | A dealer signs up and verifies email + phone |
| 3 | 11–15 | Catalog & dealer profile | A dealer has a portfolio; catalog is seeded |
| 4 | 16–20 | Vehicles | A dealer adds a car through a wizard |
| 5 | 21–25 | Media & photo requests | Photos upload, process, reorder |
| 6 | 26–30 | Public catalog & search | All 13 filters work on /cars |
| 7 | 31–35 | Detail pages, approval, contact | The full loop: submit → approve → live → enquiry |
| 8 | 36–40 | Polish, SEO, hardening, launch | Live in one city |

---

## Week 1 — Foundations

### Day 0 (do this before Day 1, it takes 20 minutes)

Start **DLT/SMS registration** with MSG91. Register the entity, request a sender header (`DLRDRV` or similar), and submit two templates: an OTP template and a "new enquiry" alert template. This runs in the background for the next week or two — it is the only thing in this plan you cannot compress by working harder.

### Day 1 — Monorepo + Express skeleton

```
CONTEXT
Day 1 of an 8-week MVP. Nothing exists. Specs are in docs/ARCHITECTURE.md and
docs/MVP-SCOPE.md. I'm using Express 5, not NestJS.

TASK
Scaffold the monorepo: apps/web (Next.js 15, App Router, TS strict, Tailwind v4),
apps/api (Express 5 + TypeScript), packages/contracts, packages/config.
Turborepo + pnpm. One `pnpm dev` runs both.

Build the Express skeleton exactly as in MVP-SCOPE §4.1: server.ts, container.ts,
routes.ts, config/env.ts (zod-validated, fails fast at boot), and the middleware
folder with stubs for request-context, validate, error-handler and not-found.
Implement request-context (AsyncLocalStorage with traceId) and error-handler
(RFC 9457) for real — the rest can be stubs.

CONSTRAINTS
- Node 22, pnpm 9, TS strict + noUncheckedIndexedAccess
- No DI framework. Manual composition root per §4.2.
- /health/live and /health/ready endpoints.
- No database, no auth, no UI library yet.

DONE WHEN
`pnpm dev` runs both; a deliberately-throwing route returns a correct Problem
Details body with a traceId that also appears in the log line.

OUTPUT
Commands in order, then every config file and the Express skeleton in full.
```

### Day 2 — Deploy pipeline

```
CONTEXT
Day 2. Monorepo works locally, nothing is deployed. web→Vercel, api→Render.

TASK
1. Multi-stage Dockerfile for apps/api: pnpm workspace aware, non-root, $PORT,
   healthcheck on /health/ready, under 400MB.
2. .github/workflows/ci.yml — path-filtered with turbo: install, lint,
   typecheck, build. Must not run the api job when only web changed.
3. deploy-api.yml on merge to main, gated on the health check, with the
   previous image tag recorded so I can roll back with one command.
4. Vercel monorepo config including `npx turbo-ignore` as the ignored build step.
5. docs/infrastructure.md: every env var, what it does, which environments it's
   in. Names only, no values.

DONE WHEN
A trivial push to main updates both production URLs, and I can roll the API
back to the previous image in under two minutes.

OUTPUT
Workflows, Dockerfile, .dockerignore, and the manual dashboard steps as a
numbered checklist.
```

### Day 3 — Database & schema

```
CONTEXT
Day 3. Deploys work. No database.
[PASTE ARCHITECTURE.md §7.2 and MVP-SCOPE.md §5]

TASK
1. docker-compose.yml: postgres:16, MinIO, Mailpit.
2. Prisma schema — the full §7.2 schema MINUS everything in MVP-SCOPE §5.1,
   PLUS everything in §5.2 (seats, airbags, rtoCode, colorId, Rto, Color,
   PhotoRequest, Enquiry, PhoneReveal, VerificationCode, thin Listing,
   dealer.listingAllowance). One migration, whole shape committed now.
3. Raw SQL extras: pg_trgm extension, monthly partitioning on audit_logs with
   a next-partition helper, and a partial unique index enforcing one APPROVED
   listing per vehicle.
4. platform/db/: prisma.ts with lifecycle hooks, tx.ts with a run(cb) helper
   that all writes will use.
5. prisma/seed/ skeleton: catalog.ts, rto.ts, colors.ts, cities.ts, admin.ts.

CONSTRAINTS
- Money as BigInt paise (you'll need it in month 3). UUID ids. timestamptz.
- Migration applies cleanly to an empty database in one shot.

DONE WHEN
The schema exists locally and on my Neon dev branch, from one migration.

OUTPUT
docker-compose.yml, schema.prisma in full, the raw SQL migration, db helpers.
```

### Day 4 — Design tokens & primitives

```
CONTEXT
Day 4. [PASTE ARCHITECTURE.md §25.2 tokens and §25.3 component specs]

TASK
1. The full token set as Tailwind v4 CSS variables (@theme): colours, type
   scale, spacing, radius, two shadow steps, motion.
2. Fonts via next/font: Cabinet Grotesk (display) + Inter (UI), with a
   tabular-nums utility for prices.
3. Eight primitives in components/ui/, using Radix where it earns its place,
   styled with CVA: Button, Input, Select, Checkbox, Card, Badge, Plate, Dialog.
   Plate is the signature component from §25.1 — the bordered badge with the
   cobalt left band.
4. Sentry in both apps: source maps, release from the git SHA, /debug-sentry.

CONSTRAINTS
- Keyboard accessible, 2px cobalt focus ring at 2px offset, reduced-motion
  respected.
- Nothing in components/ui/ may import a Dealers-Drive domain type.

DONE WHEN
/styleguide renders all eight in every variant and state, and deliberate errors
from both apps land in Sentry with working source maps.

OUTPUT
globals.css, tailwind config, the eight components, the styleguide page.
```

### Day 5 — Contracts, boundaries, conventions

```
CONTEXT
Day 5. [PASTE ARCHITECTURE.md §10.3 error/pagination conventions, §19.1
contracts, and MVP-SCOPE.md §4.4 the four Express rules]

TASK
1. packages/contracts with Zod: common.ts (UuidSchema, PaiseSchema serializing
   BigInt as string, PaginationQuery, CursorQuery, Problem). Both apps import it.
2. middleware/validate.ts — validate({ body, query, params }), .strict()
   everywhere so unknown keys are rejected, not ignored.
3. Finish the error handler: ZodError→400, NotFoundError→404, ForbiddenError
   →403, DomainError→422, unknown→500 with detail stripped in production.
   traceId in the body, the log line and the Sentry event.
4. pino request logging: one structured line per request.
5. The ESLint boundary rule from §4.4 rule 3. Verify it fails on a deliberate
   cross-module import.
6. apps/web: a typed apiFetch wrapper and an ApiError class that parses Problem
   Details so the UI can switch on `code`.
7. docs/CONVENTIONS.md capturing the four Express rules so future prompts can
   point at it.

DONE WHEN
A failing endpoint produces a correct Problem Details response, the same
traceId appears in logs and Sentry, and ESLint rejects a cross-module import.

OUTPUT
All of it, plus CONVENTIONS.md.
```

---

## Week 2 — Dealer authentication

### Day 6 — Signup & credentials

```
CONTEXT
Day 6. No auth. Only dealers and admins log in — there are no customer
accounts in this MVP. [PASTE ARCHITECTURE.md §9.1]

TASK
modules/auth/ following the layout in MVP-SCOPE §4.1.

POST /v1/auth/register   { email, phone, password, brandName }
  → creates User (unverified) + Dealer (DRAFT) + DealerMember (OWNER)
    in one transaction, then issues BOTH verification codes.
POST /v1/auth/login      → 403 with code EMAIL_NOT_VERIFIED or
                            PHONE_NOT_VERIFIED until both are done
POST /v1/auth/password/forgot | /reset

CONSTRAINTS
- Argon2id password hashing. Minimum 10 chars, checked against a common-password
  list — no character-class theatre.
- Indian phone numbers normalized to E.164 and unique.
- Login errors always generic. Reset tokens: 32-byte CSPRNG, hash stored only,
  single use, 30-min TTL, invalidate all sessions on use.
- Register is idempotent-ish: re-registering an unverified email resends codes
  rather than erroring, so a dealer who lost the SMS isn't stuck.

DONE WHEN
Integration tests: register creates all three rows; duplicate email → 409;
duplicate phone → 409; login blocked until verified; reset token single-use.

OUTPUT
The module (routes/controller/service/repository/facade), contracts, tests.
```

### Day 7 — Dual OTP verification

```
CONTEXT
Day 7. Registration creates unverified users. Nothing sends codes.
DLT registration may not be approved yet — design for that.

TASK
1. platform/sms/: SmsPort + Msg91Adapter + ConsoleAdapter (logs the code in
   dev). Selected by env, never by a conditional in calling code.
2. platform/mail/: MailerPort + ResendAdapter + MailpitAdapter.
3. Verification flow using the VerificationCode table:
     POST /v1/auth/verify/request  { channel: EMAIL|PHONE }
     POST /v1/auth/verify/confirm  { channel, code }
   6-digit numeric, 10-minute TTL, max 5 attempts then invalidate, only the
   hash stored, resend cooldown of 60 seconds.
4. Rate limits: 3 code requests per phone per hour, 5 per email per hour,
   10 per IP per hour. SMS costs real money — treat this as a spend control,
   not just a security control.
5. A REQUIRE_PHONE_VERIFICATION env flag. When false, phone verification is
   prompted but not blocking, so DLT approval can't block my launch.

CONSTRAINTS
- Never log a code, in any environment except the console adapter.
- Timing-safe comparison.
- Email and phone verify independently; the UI shows both states separately.

DONE WHEN
I register, receive a code by email and (with the console adapter) see the SMS
code in logs, verify both, and can then log in. Six wrong attempts locks the
code and forces a resend.

OUTPUT
Both ports, all four adapters, the endpoints, rate limiters, tests including
expiry, attempt-lockout and cooldown.
```

### Day 8 — Sessions & guards

```
CONTEXT
Day 8. Users can verify but sessions don't exist.
[PASTE ARCHITECTURE.md §9.1 cookie spec, §9.2 permissions, §8.2 isolation]

TASK
1. Session service: create, validate, sliding refresh (when under 7 days
   remain), revoke one, revoke all. Opaque 32-byte token, SHA-256 hash stored.
2. Cookie exactly per §9.1: dd_session, httpOnly, Secure, SameSite=Lax, domain,
   30-day max-age. Rotate on login and on any privilege change.
3. Middleware: requireAuth, optionalAuth, resolveDealer (dealerId from the
   session's DealerMember — NEVER from the request), requireDealerActive,
   requireRole(...roles), requireAdmin.
4. Double-submit CSRF token on all state-changing requests.
5. GET /v1/auth/me → user, dealer, status, permissions.
6. Postgres RLS on vehicles, listings, media, enquiries, photo_requests, with
   the app_tenant / app_platform role split, wired to tx.ts via SET LOCAL.

CONSTRAINTS
- A dealerId in a body or query is ignored. Add an explicit test asserting it.
- Cookie forwarding must work for the Next.js server-to-server path, not just
  direct browser calls.

DONE WHEN
Full cycle works with cookies, and revoking a session server-side takes effect
on the very next request.

OUTPUT
Before coding: file list and any decision I might disagree with. Then the code
and tests.
```

### Day 9 — Auth UI

```
CONTEXT
Day 9. The API has complete dealer auth. The web app has none.
[PASTE ARCHITECTURE.md §17.2 server/client table]

TASK
1. (auth) route group: /register, /verify, /login, /forgot-password,
   /reset-password. Server Actions — must work with JS disabled.
2. /verify is a two-panel page: email status and phone status side by side,
   each with its own code input, resend button with a visible cooldown timer,
   and clear success states. Both green → continue to the dashboard.
3. lib/session.ts (server-only): getSession, requireSession, requireDealer.
4. Route protection in the (dealer) and (admin) layouts, redirecting to
   /login?next=…
5. A Header that renders differently for anonymous, dealer and admin, with the
   session read server-side (no client fetch waterfall).
6. Map Problem Details `code` values to field errors and banners. Show
   "Reference: <traceId>" small at the bottom of unexpected errors.

CONSTRAINTS
- react-hook-form + zodResolver against the SAME contract the API validates with.
- 6-digit code inputs: auto-advance, paste-a-whole-code support, numeric
  keyboard on mobile. Dealers will do this on a phone.

DONE WHEN
A stranger registers, verifies both channels, logs in and sees their brand name
in the header — on a phone.

OUTPUT
All pages, the session helper, the header, the Server Actions.
```

### Day 10 — Isolation test suite + admin login

```
CONTEXT
Day 10, end of week 2. [PASTE ARCHITECTURE.md §24.2 Tier 1]

TASK
1. Test harness: Vitest + real Postgres (Testcontainers locally, service
   container in CI), migrations per run, truncation between tests, factories:
   makeUser, makeDealer, makeVerifiedDealer, asDealer, asAdmin.
2. The isolation suite — write these now, extend them as entities land:
   - Dealer A GET/PATCH/DELETE Dealer B's resource → 404, not 403
   - Dealer A cannot list Dealer B's resources
   - dealerId in the body is ignored; the session's dealer wins
   - unverified user cannot log in
   - revoked session rejected immediately
   - suspended dealer's members are rejected
   - admin can read across tenants, and the read is audited
3. Admin login: isPlatformAdmin + adminRole, mandatory TOTP 2FA with backup
   codes, a 12-hour session, harder rate limits, and a seed script creating
   the first super admin from env vars, idempotently.
4. Wire the suite into CI as a required check.

CONSTRAINTS
- No mocking Prisma. Real database, real middleware, real HTTP.
- Deleting resolveDealer from a route must turn at least three tests red.

DONE WHEN
Green in CI, and the sabotage check above fails as expected.

OUTPUT
Harness, factories, the suite, admin auth, seed script, CI job. Then write
docs/CONTEXT.md covering days 1–10.
```

---

## Week 3 — Catalog & dealer portfolio

### Day 11 — Catalog module

```
CONTEXT
Day 11. [PASTE ARCHITECTURE.md §7.4 the catalog problem]
My filter list is: brand, budget, model year, kms, fuel, body type,
transmission, colour, seats, owners, RTO, airbags, dealer.

TASK
modules/catalog/ — makes, models, variants, cities, RTO offices, colours,
and the fixed feature/safety taxonomy.

  GET /v1/catalog/makes?popular=true
  GET /v1/catalog/makes/:slug/models
  GET /v1/catalog/models/:id/variants
  GET /v1/catalog/cities?q=
  GET /v1/catalog/rto?state=&q=
  GET /v1/catalog/colors
  GET /v1/catalog/bundle          everything in one payload, CDN-cacheable

Plus admin endpoints to add a make/model/variant, and a "model not listed"
request queue so dealers never free-type.

CONSTRAINTS
- In-process LRU cache, 1h TTL, invalidated on admin write. Hit on every page.
- /bundle: Cache-Control public, max-age=3600.
- Colours are a normalized table with a hex swatch and a colour family — the
  filter groups by family so "white" catches "Pearl White" and "Arctic White".
- Slugs are immutable once used in a URL.

DONE WHEN
The bundle returns a correctly-shaped empty catalog, cached.

OUTPUT
Module, contracts, admin endpoints, cache, tests.
```

### Day 12 — Seed data

```
CONTEXT
Day 12. The catalog module has no data. This is a data day, not a code day.
Market: India, used cars.

TASK
1. Tell me honestly where this data comes from — what public sources exist,
   the licensing considerations, and how much manual curation this really needs.
   Don't invent a clean free API if there isn't one.
2. Seed scripts reading from editable CSV/JSON files, not hardcoded arrays:
   catalog.ts, cities.ts, rto.ts, colors.ts. Idempotent upsert by slug/code.
3. Starter datasets:
   - top 25 makes with their high-volume models, body type, year ranges
   - top 40 cities with lat/lng
   - RTO codes by state (this one is well-defined and enumerable)
   - ~24 colours with hex and family
   Flag clearly which rows you're confident about and which I must verify.
   200 verified rows beat 3,000 invented ones.
4. A validation script: duplicate slugs, orphan models, impossible year ranges,
   missing body types, RTO codes not matching their state.

DONE WHEN
`pnpm db:seed` produces a usable catalog and the validator passes.

OUTPUT
Sourcing strategy first, then the scripts, then the starter data.
```

### Day 13 — Dealer profile / portfolio

```
CONTEXT
Day 13. Dealers exist as rows with a brand name and nothing else.

TASK
1. modules/dealers/: profile CRUD, slug generation (brandName + city,
   collision-safe, immutable once the dealer is ACTIVE), and the status state
   machine: DRAFT → PENDING_APPROVAL → ACTIVE → SUSPENDED ⇄ ACTIVE, → REJECTED.
   Explicit transition table with actor authority. Invalid transitions throw.
2. Profile fields: brand name, legal name, about, logo, cover, city, address,
   pincode, lat/lng, contact phone, contact email, working hours, established
   year, specialities (e.g. "German cars", "budget hatchbacks").
3. POST /v1/dealer/submit — moves DRAFT → PENDING_APPROVAL once the profile
   is complete. A completeness resolver returns exactly what's missing, so the
   UI can render a checklist from one source of truth.
4. Logo upload uses the Day 21 media pipeline — stub it today, wire it Day 22.

CONSTRAINTS
- status, verifiedAt, suspendedAt, listingAllowance are not dealer-writable.
  Test that they're stripped.
- Every transition emits a domain event (a no-op bus stub is fine for now;
  leave the call sites in).

DONE WHEN
A verified dealer completes their profile, submits, and sits in
PENDING_APPROVAL with a clear "what happens next" state.

OUTPUT
Module, state machine + unit tests, completeness resolver, contracts, tests.
```

### Day 14 — Dealer portfolio UI + admin dealer approval

```
CONTEXT
Day 14. [PASTE ARCHITECTURE.md §25.4 dealer dashboard]

TASK
1. The (dealer) shell: sidebar, mobile drawer, and a status banner that renders
   per DealerStatus.
2. /dealer/profile — the portfolio editor: logo and cover upload slots, all the
   Day 13 fields, live preview of how the dealer's public page will look, and a
   completeness checklist driven by the server resolver.
3. /dealer — dashboard shell with four stat plates (wired to zeroes) and a
   prominent "what to do next" card driven by dealer status.
4. (admin) shell + /admin/dealers: list with status filter, detail drawer with
   the full profile, approve / reject (reason required) / suspend actions
   driving the Day 13 state machine. Ugly is acceptable; functional is not
   optional — you cannot run this marketplace without this screen.
5. Email the dealer on approval and on rejection with the reason.

CONSTRAINTS
- RSC for data, client components only for the forms.
- A dev-only way to force a dealer into any status, for testing.

DONE WHEN
Register → verify → complete profile → submit → approve from admin → dashboard
changes state, all through the browser.

OUTPUT
All pages and components.
```

### Day 15 — Audit + platform config

```
CONTEXT
Day 15, end of week 3. Nothing is audited and several values are hardcoded.
[PASTE ARCHITECTURE.md §21.2 audit row]

TASK
1. platform/audit/: write(action, entityType, entityId, before, after) pulling
   actor/dealer/ip/traceId from request context. Applied to every dealer state
   transition, every profile update, and every admin action.
   Grant INSERT and SELECT only — no UPDATE or DELETE on audit_logs, enforced
   by the grant, not by convention. Redact secrets from before/after.
   Audit failures must never fail the originating request.
2. platform_config with a typed key registry and defaults in code (the table
   holds overrides only). Keys for now: max images per vehicle, min images to
   submit, dealer listing allowance default, review SLA hours, enquiry rate
   limits, phone reveal limits, REQUIRE_PHONE_VERIFICATION, and the feature
   flags for photo requests and enquiries.
3. GET /v1/config/public exposing only public keys, CDN-cacheable.
4. A minimal /admin/config editor: grouped, typed inputs, diff confirmation,
   audited.

DONE WHEN
Changing a config value in admin is reflected in the public endpoint within
60 seconds with an audit row, and a wiped config table doesn't break the app.

OUTPUT
Audit service, config registry and service, endpoints, admin page, tests.
Then update docs/CONTEXT.md.
```

---

## Week 4 — Vehicles

### Day 16 — Vehicle module

```
CONTEXT
Day 16. Catalog is seeded, dealers have profiles. Time for the core entity.
[PASTE ARCHITECTURE.md §7.2 Vehicle + MVP-SCOPE.md §5.2 added fields]

TASK
modules/vehicles/ per the Express module layout.

  POST   /v1/dealer/vehicles
  GET    /v1/dealer/vehicles?status=&q=&cursor=
  GET    /v1/dealer/vehicles/:id
  PATCH  /v1/dealer/vehicles/:id
  DELETE /v1/dealer/vehicles/:id        → soft delete

Fields must cover every filter I need: make, model, variant, year, price, km,
fuel, transmission, body type, owners, colour (catalog id), seats, airbags,
RTO code, city, description, features.

Domain:
- isComplete() / missingFields() — what's required before submitting for review
- slug: {year}-{make}-{model}-{variant}-{city}-{6charId}, stable across edits
- cross-field validation: variant belongs to model belongs to make; year within
  the model's production range; RTO code valid; colour id valid. Reject
  mismatches — this is what keeps the catalog meaningful.

CONSTRAINTS
- dealerId only from request context. Test that a body dealerId is ignored.
- status, slug, publishedAt are not dealer-writable.
- Price as BigInt paise, serialized as a string.
- Extend the Day 10 isolation suite to cover vehicles properly.

DONE WHEN
A dealer can create, list, fetch, update and soft-delete their own vehicles;
Dealer B gets 404 on all of them.

OUTPUT
Before coding: file list and any decision I might push back on. Then the
module, contracts, tests.
```

### Day 17 — Inventory list API

```
CONTEXT
Day 17. Vehicle CRUD works. The list endpoint is naive.

TASK
1. Cursor pagination on /v1/dealer/vehicles — opaque base64 over
   (createdAt, id), stable under concurrent inserts, correct hasMore.
2. Dealer-side filters: status, make, model, year range, price range, free
   text. Whitelisted params only; unknown params → 400.
3. GET /v1/dealer/vehicles/summary — counts by status, total inventory value,
   oldest vehicle. Feeds the dashboard stat plates.
4. Design the create service so a future CSV importer can call it in a loop
   inside one transaction. Write the signature accordingly and note it.
5. Seed 3,000 vehicles across 40 dealers as a fixture, then include
   EXPLAIN ANALYZE output for every filter combination and fix anything not
   using an index.

CONSTRAINTS
- No N+1. One query plus at most one for media.
- Cap limit at 100.

DONE WHEN
Every filter combination returns in under 50ms against the fixture, verified
with EXPLAIN.

OUTPUT
Endpoints, the fixture generator, the query plans, the fixes.
```

### Day 18 — Add vehicle wizard (steps 1–2)

```
CONTEXT
Day 18. [PASTE ARCHITECTURE.md §25.4 "Add vehicle — 4 steps"]

TASK
Build /dealer/vehicles/new, steps 1 and 2.

Step 1 Identify: cascading Make → Model → Variant → Year, each level searchable
  (400+ models means a plain select is unusable), loading on parent selection,
  with a "can't find your model?" request link.
Step 2 Details: price (₹ prefix, live Indian grouping, value held in paise),
  km, fuel, transmission, body type (prefilled from the model, editable),
  owners, colour (swatch picker), seats, airbags, RTO (searchable, filtered by
  state), city, description with counter, features (grouped checkboxes).

- Step indicator with back-navigation.
- Autosave as DRAFT after each step, debounced, with a subtle "Saved" marker.
- Resume: /dealer/vehicles/[id]/edit reopens the wizard at the furthest step.

CONSTRAINTS
- react-hook-form + zodResolver against the shared contract, per-step validation.
- Mobile-first. A dealer will do this on a phone standing next to the car:
  large tap targets, numeric keyboards, no tiny dropdowns.
- Fully keyboard navigable.

DONE WHEN
I complete steps 1–2 on a 375px viewport, close the tab, reopen, and find the
draft exactly as I left it.

OUTPUT
Wizard shell, both steps, the cascading selector, autosave hook, resume logic.
```

### Day 19 — Inventory page

```
CONTEXT
Day 19. Vehicles can be created but there's no inventory screen.
[PASTE ARCHITECTURE.md §25.3 Table spec]

TASK
/dealer/inventory:
- Table: thumbnail, title, price, km, status badge, submitted date, actions.
  Sticky header, 48px rows, per-column sort, sticky right action column.
- Status tabs: All / Draft / Under review / Live / Rejected / Sold.
- Search box and a make filter. Filter state in the URL.
- Row actions: Edit, Preview, Submit for review, Mark sold, Delete (confirm
  modal naming the vehicle).
- Rejected rows show the admin's reason inline — a dealer must never have to
  hunt for why their car was rejected.
- Empty state with an illustration and a primary CTA.
- Mobile: cards, not a horizontally-scrolling table.
- Wire the four dashboard stat plates to the real summary endpoint.

CONSTRAINTS
- RSC shell for the first page; a client component for interaction.
- Skeleton rows matching real dimensions exactly.

DONE WHEN
With the 3,000-vehicle fixture the page is fast, filters and sorting work, and
it's genuinely usable at 375px.

OUTPUT
Page, table components, filter bar, empty state, skeletons.
```

### Day 20 — Edit, delete, submit

```
CONTEXT
Day 20, end of week 4.

TASK
1. /dealer/vehicles/[id]/edit — the same wizard in edit mode. For a vehicle
   that's already live, show a "what changed" summary before saving and warn
   that significant edits return it to review. Decide and implement which edits
   trigger re-review (price and photos: no; make/model/year/km: yes) and put
   that rule in one function.
2. Soft delete with a confirm modal; admin-visible restore.
3. Mark as sold, with an optional private sale price for future analytics.
4. Preview page rendering the vehicle exactly as buyers will see it — a
   faithful stub now, swapped for the real VDP components on Day 31.
5. POST /v1/dealer/vehicles/:id/submit → creates a Listing in PENDING_REVIEW.
   Guards: profile complete, dealer ACTIVE, vehicle complete, minimum images
   (this will fail until Day 22 — that's expected, wire the check now).

CONSTRAINTS
- Edits never change the slug.
- Every submit and status change emits a domain event.

DONE WHEN
Full lifecycle: create draft → edit → preview → submit → appears in the admin
queue as PENDING_REVIEW.

OUTPUT
Pages, modals, the re-review rule with unit tests, the submit endpoint. Then
update docs/CONTEXT.md.
```

---

## Week 5 — Media & photo requests

### Day 21 — Jobs, storage port, presigned uploads

```
CONTEXT
Day 21. No file storage, no queue.
[PASTE ARCHITECTURE.md §12.2 upload pipeline and §15 jobs]

TASK
1. platform/jobs/: pg-boss in its own schema, a typed QueueService, and a
   separate worker.ts entrypoint running the same codebase (plus a
   WORKER_INLINE mode so `pnpm dev` stays one command). Retry policies, dead
   letter, Sentry on failure, and queue depth exposed on /health/ready.
   Deploy the worker as a second Render service from the same image.
2. platform/storage/: StoragePort (presignPut, headObject, deleteObject,
   listByPrefix) + R2Adapter + MinioAdapter, selected by env.
3. modules/media/:
     POST /v1/dealer/media/presign     → { mediaId, uploadUrl, expiresIn }
     POST /v1/dealer/media/:id/commit
     DELETE /v1/dealer/media/:id
   Key: dealers/{dealerId}/{ownerType}/{ownerId}/{mediaId}/original.{ext}
4. Presign security: mime allowlist, content-length range baked into the
   signature, 5-minute expiry, per-dealer daily quota, rate limit.
5. Commit: HEAD the object, verify size and content-type match what was
   presigned, set PENDING, enqueue media.process.

CONSTRAINTS
- The API must never receive image bytes. If you're writing a multipart
  handler, stop.
- dealerId in the key comes from the session, always.

DONE WHEN
I presign, PUT to MinIO with curl, commit, and see a PENDING Media row with a
queued job. The worker runs in production.

OUTPUT
Queue, worker, both storage adapters, the media module, tests.
```

### Day 22 — Upload UI

```
CONTEXT
Day 22. Presigned uploads work from curl. [PASTE ARCHITECTURE.md §12.2]

TASK
The ImageUploader for step 3 of the wizard, plus the dealer logo/cover slots.

- Drag-drop and file picker; camera capture on mobile.
- Client-side pre-compression: longest edge to 2400px, quality 0.85, before
  upload. Show original → compressed size. An 8MB phone photo should leave the
  device at ~600KB.
- Per-file progress, max 3 concurrent, individual retry, cancel.
- Reorder by drag on desktop and by up/down buttons on mobile — drag on touch
  is unreliable and dealers are often one-handed.
- Set primary; primary is visually distinct and always first.
- Inline validation: max 20 images, min 5 to submit for review, 10MB each,
  jpeg/png/webp/heic.
- Per-image processing state (PENDING → READY) with polling, and a clear
  FAILED state with retry.
- Survive a page reload mid-upload without orphaning invisible rows.

CONSTRAINTS
- Handle HEIC from iPhones. Say whether you convert client- or server-side and
  why.
- No layout shift as images load.

DONE WHEN
On a real phone I add 10 photos, reorder them, set a primary, and all reach
READY over a throttled connection without losing state.

OUTPUT
Component, compression hook, upload queue, styleguide story with simulated
slow network.
```

### Day 23 — Image processing worker

```
CONTEXT
Day 23. Images sit in PENDING. [PASTE ARCHITECTURE.md §12.2 step 6, §12.3]

TASK
The media.process handler with sharp:
1. Download the original.
2. Verify magic bytes against the declared mime; mismatch → FAILED + alert.
3. Fully re-decode (this is the security step — never transform in place).
4. Auto-orient from EXIF, then strip ALL EXIF. GPS coordinates of a dealer's
   yard are PII and must not survive.
5. Derivatives: 320/640/1024/1600px in webp and avif. Never upscale.
6. Blurhash or a 20px LQIP for the placeholder.
7. Quality flags: too small (<800px), too dark, extreme aspect ratio.
8. Set READY with dimensions recorded.

Plus media.gc-orphans (daily): PENDING older than 24h and ORPHAN older than
30 days deleted from database and storage, and a weekly reconciliation listing
storage keys with no Media row.

CONSTRAINTS
- Concurrency 4. A 20-image upload must not starve other jobs.
- Idempotent — re-running on a READY image is a no-op.
- Memory-safe: cap sharp's pixel limit so a 50,000×50,000px decompression bomb
  can't OOM the worker.
- Failures must surface in the dealer UI, not silently.

DONE WHEN
Upload → all derivatives exist within ~5 seconds → READY, EXIF verified gone
with exiftool, and a corrupt file fails cleanly with a useful message.

OUTPUT
Handler, GC job, reconciliation job, tests with real fixtures including a
corrupt file and an EXIF-laden one.
```

### Day 24 — Media delivery

```
CONTEXT
Day 24. Derivatives exist but nothing serves them well.

TASK
1. img.dealersdrive.com in front of R2: the Cloudflare setup steps, cache
   rules, and the security headers from §12.3 (separate domain, nosniff).
2. mediaUrl(key, width, format) in packages/contracts — immutable,
   content-addressed URLs.
3. A custom next/image loader plus a VehicleImage component: correct srcset per
   context (card / gallery / thumbnail), blurhash placeholder, priority on the
   first gallery image, aspect ratio always reserved.
4. Cache-Control: public, max-age=31536000, immutable on derivatives.
5. Fallback image for vehicles with no photos; graceful FAILED state.
6. Wire into the Day 19 inventory table and the Day 22 uploader.

CONSTRAINTS
- Never serve originals to end users.
- Dealer logos get the same pipeline but a different derivative set (64/128/256
  square, contained not cropped).

DONE WHEN
Images render in the inventory table at correct sizes, AVIF is served where
supported, and Lighthouse reports no oversized-image or CLS warnings.

OUTPUT
Cloudflare steps, URL builder, loader, VehicleImage.
```

### Day 25 — Photo request feature

```
CONTEXT
Day 25, end of week 5. Dealers can upload photos but many take bad ones —
that's why they asked for this. [PASTE MVP-SCOPE.md §5.2 PhotoRequest]

TASK
Keep this deliberately manual. No scheduling engine.

1. modules/photoRequests/:
     POST  /v1/dealer/photo-requests   { vehicleId?, vehicleCount, address,
                                         contactName, contactPhone,
                                         preferredDate?, notes? }
     GET   /v1/dealer/photo-requests
     PATCH /v1/admin/photo-requests/:id   status + scheduledFor + adminNote
   Status: REQUESTED → SCHEDULED → COMPLETED | CANCELLED.
2. Dealer UI: a "Request a photo shoot" button on the empty-photos state of the
   wizard and on the inventory page, opening a short form prefilled with the
   dealer's address and phone. A status card showing where the request stands.
3. Admin queue at /admin/photo-requests: list by status, dealer, city and date;
   set a scheduled date; mark complete; add a note.
4. **Admin upload on behalf of a dealer** — the key capability. An admin can
   open any dealer's vehicle and add images to it through the same media
   pipeline. Every such upload is audit-logged with the admin's identity and
   shows in the dealer's UI as "added by Dealers-Drive".
5. Emails: dealer on request received, dealer on scheduled (with the date),
   dealer on completed (with a link to review the photos), admin on new request.
6. Also add a short "how to photograph a car" guide page — 8 bullet points and
   example angles. Free, and it'll reduce the number of shoots you have to do.

CONSTRAINTS
- Behind a config flag so you can switch it off if the volume overwhelms you.
- Requests capped per dealer per week, from config.
- No payment for shoots in this MVP — record what you'd have charged in the
  admin note so you have the data for month 3.

DONE WHEN
A dealer requests a shoot, I see it in the admin queue, mark it scheduled, then
upload photos onto their vehicle and they see them appear.

OUTPUT
Module, both UIs, the admin upload path, emails, the guide page. Then update
docs/CONTEXT.md.
```

---

## Week 6 — Public catalog & search

### Day 26 — Events, outbox, search index

```
CONTEXT
Day 26. I've been calling a no-op event bus stub since Day 13.
[PASTE ARCHITECTURE.md §16 events and §7.5 listing_search]

TASK
1. platform/events/: the DomainEvent envelope from §16.2, an OutboxService
   whose publish() takes the caller's transaction as a REQUIRED parameter, a
   publisher job draining outbox_events every 2 seconds with SKIP LOCKED, and
   a typed EventBus where each subscriber runs as its own job.
   Replace every stubbed emit from days 13–25 with a real publish.
2. The listing_search table from §7.5 PLUS my filter columns: seats, airbags,
   rto_code, rto_state, color_slug, color_family. Every index, the generated
   tsvector, the trigram index.
3. An indexer that builds a row from vehicle + dealer + catalog + media in one
   query, with subscribers:
     ListingApproved / VehicleUpdated / MediaProcessed → index
     ListingRejected / ListingRemoved / VehicleSold / DealerSuspended → remove
4. `pnpm search:reindex` — full rebuild, resumable, batched, with progress.
   You will need this more often than you expect.
5. A nightly drift check comparing counts between source tables and the index.

CONSTRAINTS
- listing_search is derived. Never written from a controller, never a source
  of truth.
- Indexing is idempotent and survives "listing deleted while job was queued".

DONE WHEN
A rollback proves the domain write and the outbox row are atomic, and the
3,000-vehicle fixture indexes fully via the reindex command.

OUTPUT
Events, outbox, indexer, subscribers, reindex command, drift job, tests.
```

### Day 27 — Public search API

```
CONTEXT
Day 27. The index is populated; nothing queries it.
[PASTE ARCHITECTURE.md §11.1 query shape, §10.3 filtering conventions]

TASK
1. SearchPort in modules/search/: search(), facets(), suggest(). No Postgres
   concept may leak through the interface — this is the seam that makes a
   future move to Typesense cheap.
2. PostgresSearchAdapter with a parameterized query builder covering ALL of my
   filters: make, model, variant, price range, year range, km max, fuel
   (multi), transmission (multi), body type (multi), owners, seats, airbags
   (min), colour family (multi), RTO code, RTO state, city, dealer, free text.
3. GET /v1/vehicles with that full query contract. Sorts: relevance,
   price asc/desc, year desc, km asc, newest. Unknown params → 400.
4. GET /v1/vehicles/facets — per-facet counts for the current filter set, in a
   SINGLE query using GROUPING SETS, not fifteen round trips. Cached 60s.
5. GET /v1/vehicles/:idOrSlug — the detail payload: vehicle + dealer + media +
   specs, one query plus media.
6. GET /v1/vehicles/:id/similar — same model ±2 years, ±20% price, same city
   first. No ML.
7. Cache-Control on all of these so Cloudflare can cache them.

CONSTRAINTS
- Free text: websearch_to_tsquery with a trigram similarity fallback.
  "fortunar" must find Fortuners.
- Only APPROVED listings from ACTIVE dealers ever appear. Test it explicitly.
- limit ≤ 48, page ≤ 40.
- EXPLAIN-verify every query uses an index.

DONE WHEN
Every filter works independently and in combination, facet counts are correct,
typo search works, and p95 is under 100ms on the fixture.

OUTPUT
Port, adapter, query builder, endpoints, and a test file covering each filter
individually plus three complex combinations.
```

### Day 28 — Vehicle card & listing page

```
CONTEXT
Day 28. The public API is ready. There's no public UI.
[PASTE ARCHITECTURE.md §25.3 Vehicle card, §25.4 Listing page]

TASK
1. VehicleCard exactly per §25.3: 4:3 image with blurhash, the year Plate top
   left, title with 2-line clamp, spec row (km · fuel · transmission · owners),
   price in tabular numerals, then a 1px divider and the dealer strip — logo,
   brand name, location. **The dealer strip appears on every card, always.**
   That's the product.
2. DealerBadge at three sizes with a generated monogram fallback (deterministic
   pastel from the dealer id) when there's no logo.
3. VehicleGrid: 3/2/1 columns responsive, plus a carousel variant.
   VehicleCardSkeleton matching real dimensions exactly.
4. /cars as an RSC with ISR 60s: fetches results and facets in parallel.
   URL is the single source of truth for every filter, sort and page.
5. lib/url.ts — parse search params into a typed filter object and serialize
   back, with canonical ordering. This same helper drives Day 36's SEO
   canonicalization, so build it properly.
6. Header with result count, sort select, active filter chips (each removable,
   plus Clear all), numbered pagination (not infinite scroll), and an empty
   state offering to remove the two least-restrictive filters.

CONSTRAINTS
- Zero client-side data fetching on first load.
- Filter changes update the URL via router.replace without scroll, using
  useTransition so the UI responds before the server does.
- Must work with JavaScript disabled (filters as a plain form submission).

DONE WHEN
I can filter, sort and paginate; every state is a shareable URL; it works with
JS off; and LCP is under 2s on throttled mobile.

OUTPUT
Card, badge, grid, skeleton, the page, url.ts with unit tests, sort and chips.
```

### Day 29 — Filter panel

```
CONTEXT
Day 29. /cars works but the filter UI is minimal. I have 13 filters — this is
the hardest UI in the product. [PASTE ARCHITECTURE.md §25.3 Filter panel]

TASK
FilterPanel, desktop and mobile.

- Desktop: sticky left rail, 280px, independent scroll.
- Mobile: bottom sheet with a live "Apply (128 cars)" button reflecting the
  pending selection before it's applied.
- Groups, in this order (most-used first — this ordering is a conversion
  decision, not a layout one):
    Budget (dual slider + two numeric inputs, ₹25k snapping)
    Make & model (searchable, nested)
    Year (range with presets)
    Km driven (range with presets: under 20k / 50k / 100k)
    Fuel · Transmission · Body type (checkbox groups with counts)
    Owners (1st / 2nd / 3rd+)
    Colour (swatch grid grouped by family)
    Seats (4/5/6/7+)
    Safety — airbags (2+/4+/6+)
    RTO (state first, then office, searchable)
    Dealer (typeahead, only shown once a city is chosen)
- Collapsible groups, "show more" past 6 options, live counts, count-0 options
  disabled but visible — never hidden, or users think the filter is broken.
- Counts update on change, debounced 300ms, in-flight requests cancelled.

CONSTRAINTS
- Every interaction writes to the URL. No hidden local filter state.
- Keyboard accessible throughout; the slider needs arrow keys and
  aria-valuetext reading "₹12,50,000".
- The mobile sheet must not scroll the body behind it.
- Collapse the less-used groups (colour, seats, airbags, RTO) by default —
  thirteen expanded groups is a wall.

DONE WHEN
On a phone I open filters, set a budget, pick two fuel types and 6+ airbags,
watch the count update, apply, and land on a correct shareable URL.

OUTPUT
FilterPanel and every facet component, plus styleguide stories.
```

### Day 30 — Homepage

```
CONTEXT
Day 30, end of week 6. [PASTE ARCHITECTURE.md §25.4 Homepage wireframe]

TASK
Build / to the §25.4 wireframe: hero with the search panel over an ink
background · trust strip · browse by brand (logo tiles) · browse by body type ·
recently listed · featured dealers · a "for dealers" inverted band with a
signup CTA · SEO footer with real internal links.

- Hero search: city, make, model, budget → navigates to a canonical /cars URL.
  Popular-model quick links beneath.
- City detection: cookie, else IP, else default to your launch city, with an
  always-visible switcher. Never block render on detection.
- Real live numbers in the subtitle (listings, dealers, cities) — more
  persuasive than adjectives, and free.
- The SEO footer generated from actual inventory, not a static list.

CONSTRAINTS
- ISR 5 min. LCP under 2s. No carousel, no autoplay video.
- Everything above the fold renders server-side.
- Mobile-first: on a phone the search panel IS the hero.

DONE WHEN
Homepage → search → results → (stub) detail works end to end and loads fast on
a throttled phone.

OUTPUT
The page and all sections. Then update docs/CONTEXT.md.
```

---

## Week 7 — Detail pages, approval, contact

### Day 31 — Vehicle detail page

```
CONTEXT
Day 31. Buyers can find cars but can't view one.
[PASTE ARCHITECTURE.md §25.4 Vehicle details page]

TASK
/car/[slug] as an RSC with ISR 5 min.

- Gallery left 60%: main image + thumbnail strip, keyboard arrows, full-screen
  lightbox with zoom, counter. Mobile: full-bleed swipeable.
- Sticky rail right 40%: title, location, price in a Plate, at-a-glance tiles
  (km / fuel / transmission / owners), dealer card, CTAs.
- Sections: overview, specifications (grouped zebra table including seats,
  airbags, RTO, colour), features as chips.
- Dealer card: logo, brand name, city, inventory count, "Show number" and
  "Send enquiry" (both wired on Day 33), "View all inventory".
- Similar vehicles carousel + "More from this dealer" carousel.
- Mobile: fixed bottom bar with price and the primary CTA.
- Breadcrumbs. Sold state with a banner and CTAs replaced by "View similar".
- 404 for unknown slugs.
- Swap the Day 20 preview stub to use these real components.

CONSTRAINTS
- First gallery image priority, rest lazy. No layout shift.
- The sticky rail must not overlap the footer or trap scroll on short viewports.

DONE WHEN
A VDP renders under 2s on throttled mobile, the gallery works by touch and
keyboard, and the sold state is correct.

OUTPUT
Page, gallery, spec table, dealer card, sticky rail.
```

### Day 32 — Dealer public page + admin moderation queue

```
CONTEXT
Day 32. Dealer branding on cards links nowhere, and there's no way to approve
a listing. [PASTE ARCHITECTURE.md §25.4 Dealer page]

TASK
Part 1 — /dealers/[slug] and /dealers:
- Cover band, logo, brand name, city, inventory count, member-since,
  "Show number", "Message".
- Tabs: Inventory / About / Location.
- The inventory tab REUSES the Day 28–29 filter and grid components scoped to
  this dealer. Do not build a second grid.
- /dealers directory with city filter. /dealers/in/[city] as its own route.
- ISR 10 min. Only ACTIVE dealers with at least one live listing are reachable;
  others 404 (an empty dealer page is an SEO liability).

Part 2 — /admin/listings, the moderation queue. This is the screen you'll live
in, so make it fast:
- CARD view, not a table — images at a usable size, key specs, dealer, price.
- Keyboard shortcuts: A approve, R reject (opens a reason picker), S skip,
  arrows to navigate, with a visible legend. You'll review ~90 listings a week
  and you will stop doing it if it needs a mouse.
- Reject reasons from a configurable list, each with dealer-facing copy.
- Automatic flags shown on the card: fewer than 5 images, price far outside the
  band for that model, a phone number or URL in the description, suspicious km
  for the year.
- Claim-on-open for 5 minutes so two admins don't collide.
- Takedown action for already-live listings, which de-indexes immediately.
- Every action audited with reason and a snapshot.

DONE WHEN
I moderate 20 seeded listings using only the keyboard, approvals appear on
/cars within seconds, and rejections show the reason in the dealer's inventory.

OUTPUT
Both dealer pages, the moderation queue, the flagging service, keyboard
handling, audit wiring.
```

### Day 33 — Contact path

```
CONTEXT
Day 33. There is still no way for a buyer to reach a dealer — which means
dealers currently get zero value from this platform.
[PASTE ARCHITECTURE.md §21.1 anti-scraping]

TASK
1. Show number: dealer phone numbers must NEVER appear in the initial HTML or
   in any public API response. Verify by curling a VDP and grepping.
     POST /v1/vehicles/:id/reveal-contact → returns the number, writes a
     PhoneReveal row, rate-limited per IP per hour and per day.
   Progressive friction: after the third reveal from an anonymous IP, require a
   captcha. Over 20 per IP per day, block. One click for a legitimate user —
   no modal, no login wall.
2. Enquiry form, inline on the VDP (not a modal — modals lose leads):
     POST /v1/enquiries { vehicleId, name, phone, message? }
   No account required. Honeypot field, per-IP and per-phone rate limits,
   duplicate suppression (same phone + same vehicle within 24h returns the
   existing enquiry). Phone normalized to E.164.
3. Dealer alert email within 30 seconds — buyer name, tappable phone, the
   vehicle with a thumbnail, and a direct link. Give this job its own
   high-priority queue and alert if p95 exceeds 60 seconds. **This email is
   the single most important message this system sends.**
4. A simple /dealer/enquiries list: name, tappable phone, tap-to-WhatsApp, the
   vehicle, message, age. No status workflow, no notes — just the list.
5. Success state naming the dealer and what happens next.

CONSTRAINTS
- Enquiries on a removed or sold listing fail gracefully with similar vehicles.
- Buyer details visible only to the owning dealer and admins. Add to the
  isolation suite.
- Count reveals AND enquiries as leads in the dealer's stats — for many dealers
  the reveal is the better signal.

DONE WHEN
A logged-out visitor on a phone reveals a number and submits an enquiry in
under 20 seconds, and the dealer's email arrives within 30 seconds.

OUTPUT
Both endpoints, rate limiters, the reveal and form components, the email
template, the dealer list, and a test that scrapes a VDP and asserts no phone
number is present.
```

### Day 34 — Notifications

```
CONTEXT
Day 34. Several flows send nothing, or send ad-hoc emails.

TASK
1. modules/notifications/: a template registry and per-channel dispatch over
   the existing MailerPort and SmsPort.
2. Templates (React Email or MJML, each with a plain-text alternative):
     dealer  new enquiry  ← highest priority
     dealer  listing approved / listing rejected (with the reason)
     dealer  account approved / rejected / suspended
     dealer  photo request received / scheduled / completed
     dealer  email + phone verification codes
     dealer  password reset
     admin   new dealer application
     admin   new listing awaiting review (batched hourly, not per listing)
     admin   new photo request
3. SMS only where it earns its cost: OTP, and a new-enquiry alert if the
   dealer opts in. Everything else is email.
4. Subscribers wiring each domain event to its notification job. Delivery
   tracking with retry ×5 and visible hard bounces.

CONSTRAINTS
- No PII in job payloads — pass ids and fetch inside the handler.
- Every email must render correctly in Gmail on mobile. Test it.
- The admin "listings awaiting review" digest is hourly and only sends when the
  queue is non-empty. Do not build a notification you'll learn to ignore.

DONE WHEN
Every flow above sends the right message, and the new-enquiry email arrives
within 30 seconds with a tappable phone number.

OUTPUT
Module, all templates, subscribers, delivery tracking, the latency alert.
```

### Day 35 — Dealer dashboard

```
CONTEXT
Day 35, end of week 7. The dashboard is still a shell with placeholder stats.

TASK
Make /dealer genuinely useful.

- Four live stat plates: live listings, under review, views (30d), leads (30d,
  reveals + enquiries combined).
- An action-required panel, ordered by urgency — this is the dashboard's real
  job:
    listings rejected and needing edits (with the reason)
    drafts never submitted
    enquiries from the last 48 hours not yet actioned
    vehicles with no photos
    profile incomplete
- Recent enquiries (5) with tap-to-call.
- Best and worst performing listings: live over 14 days with zero leads gets a
  nudge to reduce the price or improve the photos, with a "request a photo
  shoot" link.
- Simple 30-day views and leads chart.
- "Add vehicle" always visible as the primary action.
- An onboarding checklist for new dealers that disappears once complete.

CONSTRAINTS
- One round trip: a single dashboard endpoint, not eight parallel calls.
- Every number clicks through to the underlying list.
- Mobile: action-required panel first, stats second.

DONE WHEN
A dealer with real data lands on the dashboard and knows within five seconds
what needs their attention.

OUTPUT
The page, the aggregate endpoint, the action-required resolver, the chart.
```

---

## Week 8 — Polish, SEO, hardening, launch

### Day 36 — SEO

```
CONTEXT
Day 36. Pages have generic titles and no structured data.
[PASTE ARCHITECTURE.md §20.2 indexing policy, §20.3 metadata, §20.4 sitemaps]

TASK
Scope deliberately: MVP SEO only. No facet landing pages yet — those come in
month 3 when you have inventory depth to justify them.

1. generateMetadata on every public route: distinct titles under 60 chars
   leading with intent ("2021 Toyota Fortuner 4x2 AT — ₹28.5 Lakh | Mumbai"),
   descriptions from real attributes, canonical URLs, OpenGraph.
2. Canonicalization: /cars with filter query params gets noindex,follow and a
   canonical pointing at the clean /cars path. Tracking params ignored. Use the
   Day 28 url.ts helper so the rule lives in one place.
3. JSON-LD via a typed seo.ts: Vehicle + Offer + AutoDealer on the VDP,
   AutoDealer on dealer pages, BreadcrumbList everywhere, Organization +
   WebSite with SearchAction on the homepage.
4. Dynamic OG images (opengraph-image.tsx): car photo, price, key specs,
   dealer name, composited server-side and cached.
5. Sitemap index with sharded children: static, dealers, vehicles (50k per
   shard), generated from the database, regenerated hourly, accurate lastmod.
   Only indexable URLs.
6. robots.txt: disallow /api/, /dealer/, /admin/ and filtered query URLs.
7. Internal linking: every VDP links to its dealer page and 6 similar vehicles.
8. Set up Search Console and Bing, submit the sitemap, and give me a weekly
   checklist of what to watch.

CONSTRAINTS
- Never emit structured data contradicting the visible page. No fake ratings.
- Sold listings: keep the page, mark it sold, noindex after 30 days. Never 404
  a URL Google has indexed.

DONE WHEN
VDP, listing page, dealer page and homepage all pass the Rich Results Test with
no errors, and an OG image renders when a URL is pasted into WhatsApp.

OUTPUT
Metadata functions, seo.ts with tests, OG routes, sitemaps, robots.ts, the
validation results, the Search Console checklist.
```

### Day 37 — Caching, states, performance

```
CONTEXT
Day 37. Fixed TTLs everywhere; a sold car can show as available for five
minutes. Unhappy paths are unpolished.
[PASTE ARCHITECTURE.md §14 caching, §17.5 performance budget]

TASK
Part 1 — caching. Implement the §14.1 table: revalidate and Cache-Control per
route type, with stale-while-revalidate on listing pages. On-demand
revalidation via a signed /api/revalidate route, called by a job on
ListingApproved, ListingRemoved, VehicleSold, price change and
DealerSuspended. Cache tags so a dealer update revalidates all their pages.
A CachePort with a MemoryAdapter for the catalog and facet counts — do NOT add
Redis; this interface is what makes adding it later a half-day job.
Cloudflare cache rules with an explicit bypass for /dealer, /admin, /api/auth.

**Audit every cached route for accidental personalization.** A cached page that
contains one user's data served to another is the most dangerous bug in this
build. Add a test asserting no response with Set-Cookie is cacheable.

Part 2 — states. Every route needs loading.tsx with a dimension-accurate
skeleton, error.tsx with a recovery action and a reference id, an empty state
with a next action, and a not-found state. Global error boundary. A 404 page
that offers search.

Part 3 — performance against the §17.5 budget: LCP under 2.0s, INP under
200ms, CLS under 0.05, JS under 120KB on public pages. Report before numbers,
fix, report after. Add Lighthouse CI as a failing threshold.

DONE WHEN
Marking a car sold removes it everywhere within 10 seconds, no authenticated
page is ever cached, all four budgets are met, and every route has all four
states.

OUTPUT
Cache config, revalidation, CachePort, Cloudflare rules, the states, the
performance fixes with numbers, the CI config.
```

### Day 38 — Security pass

```
CONTEXT
Day 38. Feature complete. Never attacked. [PASTE ARCHITECTURE.md §21 in full]

TASK
Work through §21.2 as a checklist and report honestly on each row — implemented,
partial, or missing. A checklist that's all green after one day isn't credible.

Then fix the gaps, prioritizing:
1. Security headers and CSP (report-only first, with a reporting endpoint, and
   a plan to enforce).
2. Rate limits on every endpoint. Verify each actually fires — especially the
   OTP endpoints, since those cost real money per request.
3. Input validation: every endpoint uses .strict() Zod schemas. Find any that
   don't.
4. Every $queryRaw uses tagged templates with no string concatenation.
5. Upload security: magic bytes, re-encoding, EXIF stripping, separate domain.
6. Secrets: nothing in the repo, logs, or error messages; different keys per
   environment.
7. Tenant isolation: re-run and extend the suite to cover vehicles, listings,
   media, enquiries and photo requests.
8. PII inventory — what you store, where, why, for how long, who can read it.
   Write docs/DATA-INVENTORY.md. You'll need it for DPDP and for the first
   dealer who asks.

Then adversarially attack the flows that matter: submit a listing for another
dealer's vehicle, approve your own listing, read another dealer's enquiries,
reveal 500 phone numbers, upload a polyglot file, brute-force an OTP.
Report which attempts succeed. I expect at least one to.

OUTPUT
The audit report first, then the fixes, then DATA-INVENTORY.md and what's left
for a professional pen test to find.
```

### Day 39 — Observability, E2E, disaster recovery

```
CONTEXT
Day 39. [PASTE ARCHITECTURE.md §22.2 metrics, §22.3 alerts, §23.7 backups]

TASK
Part 1 — observability:
- Structured logs: one line per request with traceId, dealerId, route, status,
  duration. PII redacted.
- An /admin/health page with the business metrics that matter now: dealer
  signups, verification completion rate, listings submitted vs approved vs
  rejected, median time in the review queue, live listings, leads per listing,
  listings with zero leads after 14 days.
- Exactly these alerts: API 5xx over 2% for 5 min · job queue depth over 500 or
  oldest job over 15 min · enquiry email p95 over 60s · moderation queue over
  50 pending · database connections over 80% · site down. Nothing more —
  alert fatigue is the failure mode.
- Uptime checks on the homepage, a VDP and /health/ready.
- docs/RUNBOOK.md: site down, database at connection limit, queue backed up,
  images not processing, OTP not delivering, moderation backlog, security
  incident, how to revoke all sessions, how to rotate every secret. Each with
  symptom, diagnosis commands, fix, verification.

Part 2 — Playwright, exactly four journeys:
1. Buyer: homepage → filter → VDP → reveal number → submit enquiry → dealer
   receives it
2. Dealer: register → verify both channels → profile → admin approves → add
   vehicle with photos → submit → admin approves → appears on /cars
3. Admin rejects a listing → dealer sees the reason in their inventory
4. Isolation: dealer B cannot reach dealer A's vehicle by URL
Run against the preview deployment in CI, traces and video on failure. Under
5 minutes total or it'll get skipped.

Part 3 — disaster recovery rehearsal: restore the database from PITR and time
it; verify the weekly dump to R2 is restorable; confirm the web app degrades
gracefully when the API is down. Record the REAL RPO and RTO, not the
theoretical ones.

OUTPUT
Logging, health page, alerts, RUNBOOK.md, the four specs, the CI job, the DR
log with actual timings, and fixes for whatever it revealed.
```

### Day 40 — Launch

```
CONTEXT
Day 40. Everything built, tested, hardened. Launching in one city.

TASK
Produce docs/LAUNCH.md and work through it with me.

Pre-launch:
- all production env vars verified; any development secrets rotated
- DLT/SMS live and a real OTP delivered end to end to a real handset
- DNS, SSL, HSTS, www/apex redirect
- Search Console and Bing verified, sitemap submitted
- GA4 and PostHog receiving production events
- backups confirmed running; every alert confirmed firing (trigger each one)
- terms of service, privacy policy and dealer agreement published — tell me
  plainly which need a lawyer before I onboard paying dealers
- the manual invoice template and the dealer agreement for the founding cohort
  (§3.2 — you have no payment integration, so this is how you validate
  willingness to pay)
- support email and WhatsApp live with an SLA I can actually meet
- the seed catalog verified by someone who knows cars
- a rollback plan for the first 48 hours

Launch sequence:
- onboard 10 founding dealers by hand, sitting with the first three while they
  add a car. Watch where they get stuck WITHOUT helping. Write it down.
- the order of operations for going public
- what to watch, in what order, for the first six hours
- the thresholds at which I roll back rather than fix forward

Week one:
- a daily checklist
- the five metrics that tell me whether this is working
- how to collect and triage dealer feedback

CONSTRAINTS
- Be specific. "Check monitoring" isn't a checklist item; "leave a listing
  unreviewed for 2 hours and confirm the moderation-backlog alert fires" is.
- Tell me what you expect to go wrong in week one so I'm not surprised.

OUTPUT
LAUNCH.md, and a final docs/CONTEXT.md marking the 8-week MVP complete.
```

---

# 7. If you fall behind

Forty days is aggressive for one person. When you slip — and you will — cut in this exact order. Everything above the line can go without damaging the validation.

| # | Cut this | Cost of cutting | Days saved |
|---|---|---|---|
| 1 | The dashboard chart (Day 35) | A number in a table works fine | 0.5 |
| 2 | Similar vehicles + "more from this dealer" (Day 31) | Slightly worse browsing | 0.5 |
| 3 | OG images (Day 36) | Uglier WhatsApp shares. Use a static image. | 0.5 |
| 4 | The dealers directory `/dealers` (Day 32) | Individual dealer pages still work | 0.5 |
| 5 | RTO + seats + airbags filters (Day 29) | Ship 10 filters instead of 13. Add them in week 9. | 1 |
| 6 | The photo request feature (Day 25) | Take shoot requests over WhatsApp and upload as admin. **The admin-upload capability stays.** | 1.5 |
| 7 | Automatic moderation flags (Day 32) | Review everything by eye — volume is low anyway | 1 |
| 8 | The homepage beyond hero + recent listings (Day 30) | Less browsable, still functional | 1 |
| — | ─────────── **do not cut below this line** ─────────── | | |
| ✗ | Tenant isolation tests | An isolation bug ends the business | |
| ✗ | The contact path (Day 33) | Without it dealers get nothing and churn | |
| ✗ | The moderation queue (Day 32) | You cannot approve listings without it | |
| ✗ | Media processing (Day 23) | Unprocessed phone photos will destroy your page speed and your costs | |
| ✗ | Dual OTP (Day 7) | You asked for it, and phone verification is what makes dealers real | |
| ✗ | Day 38 security pass | | |

If you're more than five days behind by Day 25, drop items 1–6 immediately rather than compressing week 8. **Week 8 is the week that makes it production-ready** — a feature-complete app that hasn't had its security, caching and disaster-recovery day is not shippable.

---

# 8. Checkpoints

| After | The question | If the answer is no |
|---|---|---|
| **Day 10** | Can a stranger register, verify by email and SMS, and log in without me touching the database? | Stop and fix. Everything downstream depends on this. |
| **Day 20** | Can a dealer add a car in under 5 minutes on a phone? Time it on a real handset. | Simplify the wizard before adding photos to it. |
| **Day 25** | Show the dealer dashboard to three real dealers from your Q15 list. | Their reaction is the most valuable data in the whole build. Reorder weeks 6–8 around it. |
| **Day 30** | Show /cars to three people who buy used cars. Watch without helping. | Fix what they fumble before building the detail page. |
| **Day 33** | Does a lead reach a dealer's phone within 30 seconds? | This is the product. Nothing else matters if this is broken. |
| **Day 40** | Would you put your own car on this platform? | |

---

# 9. What month 3 looks like

You'll finish Day 40 with a working marketplace and no payment integration. Month 3 has one job: **prove dealers pay.** In rough order:

1. **Razorpay + the credit ledger** (~8 days). The full §13 design from the architecture doc. `dealers.listingAllowance` becomes the ledger; your manually-invoiced dealers migrate with a one-time grant.
2. **Listing expiry and renewal** (~2 days). The thin `Listing` table you kept gains `expiresAt`, an expiry sweeper and a renewal flow. This is what turns one-time revenue into recurring revenue.
3. **Bulk CSV import** (~3 days) — if your dealer interviews said what I expect they said, your 30+ car dealers won't onboard without it.
4. **SEO facet landing pages** (~4 days). `/cars/in/mumbai/toyota/fortuner` and city pages. By month 3 you'll have the inventory depth to justify them, and this is where organic traffic starts compounding.
5. **WhatsApp lead alerts** (~2 days). In India this will outperform email for dealer response time, which is the metric dealers judge you on.

Everything in that list attaches to a seam you've already built. That's the point of the boring structural work in weeks 1–2.

---

# 10. Summary of changes from the original plan

| | Original 14-week | Revised 8-week |
|---|---|---|
| API framework | NestJS + Fastify | **Express 5** |
| Customer accounts | Full auth, favorites, saved searches | **None — public browsing only** |
| Dealer auth | Email + password | **Email + phone, both OTP-verified** |
| Listing approval | Config flag, auto-approve default | **Always admin-reviewed** |
| Payments | Razorpay, credits, invoices (Sprint 5) | **Deferred to month 3; manual invoicing** |
| Photo shoots | Not in scope | **Request flow + admin uploads on behalf** |
| Filters | 8 | **13, incl. colour, seats, airbags, RTO** |
| KYC documents | Sprint 4 | Deferred |
| Reviews, subscriptions, analytics | Deferred | Deferred |
| Days | 70 | **40** |
| Contact path | Sprint 6 | **Day 33 — kept, non-negotiable** |

Commit this document as `docs/MVP-SCOPE.md` alongside `docs/ARCHITECTURE.md`. Every prompt above assumes both are in the repo.
