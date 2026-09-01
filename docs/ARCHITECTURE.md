# Dealers-Drive — Architecture

> **This is the single source of truth for the system.**
> Commit it as `docs/ARCHITECTURE.md`. Every build prompt references it by section number.
> Change it deliberately, via a `docs/DECISIONS.md` entry — never casually.

**Product:** B2B2C used-car marketplace. Independent dealers list their own inventory; buyers browse publicly. Dealers-Drive is the technology and marketplace layer, not the owner of the cars.

**Current phase:** 8-week MVP. Everything marked 🟢 is in scope now. 🟡 is prepared for but not built. 🔴 is explicitly deferred.

**Domains:** web `https://dealers-drive.com` · API `https://api.dealers-drive.com` · media `https://img.dealers-drive.com`.

> **Revision r2 — reconciled against the UI (16 Aug 2026).**
> This document was re-checked line by line against `Dealers-Drive.dc.html`, `DESIGN-SPEC.md` and the 20 screen captures in `screens/`.
> Twenty-three divergences were found and this document has been corrected — the UI is treated as the source of truth for *what the product does*, and this document remains the source of truth for *how it is built*.
> The full list, with the resolution taken for each, is in **§27 UI conformance matrix**. The largest changes: credits and payments moved from deferred into MVP scope (§26), dealer auth became passwordless phone-OTP (§8), listings now expire (§10), enquiries gained a lifecycle (§14), and KYC documents are collected and reviewed (§6, §26.6).

---

## Contents

| § | Section |
|---|---|
| 1 | Scope — what we are and aren't building |
| 2 | Technology stack |
| 3 | System architecture |
| 4 | Repository structure |
| 5 | Backend architecture (Express) |
| 6 | Database schema |
| 7 | Multi-tenancy & isolation |
| 8 | Authentication & authorization |
| 9 | API design |
| 10 | Listing lifecycle & admin approval |
| 11 | Search architecture |
| 12 | Media architecture |
| 13 | Photo request service |
| 14 | Leads & contact |
| 15 | Frontend architecture |
| 16 | Design system |
| 17 | SEO |
| 18 | Caching |
| 19 | Jobs & events |
| 20 | **Environments, CI/CD & deployment** |
| 21 | Security |
| 22 | Observability |
| 23 | Testing |
| 24 | Deferred work & triggers |
| 25 | Decision record |
| 26 | **Credits, payments & billing** |
| 27 | **UI conformance matrix** |

---

# 1. Scope

## 1.1 Actors

| Actor | Authenticates? | Can do |
|---|---|---|
| **Buyer** | ❌ No account, ever (this phase) | Browse, search, filter, view details, reveal dealer phone, send an enquiry, save cars to `localStorage` |
| **Dealer** | ✅ **Phone OTP (passwordless)**; work email captured at signup and verified in the background | Manage profile, manage inventory, upload photos, submit listings for review, **buy and spend listing credits**, work the enquiry inbox, request a photo shoot |
| **Admin** | ✅ Email + password + TOTP 2FA | Approve/reject dealers **and their KYC documents**, approve/reject/request-changes on every listing, manage photo requests, upload photos on a dealer's behalf, grant credits, view payments and platform metrics |

## 1.2 In scope (8 weeks)

Dealer signup with **phone-OTP sign-in** and background email verification · four-step dealer onboarding with **GSTIN, PAN and three KYC document uploads** · dealer profile/portfolio · vehicle CRUD with 13 filterable attributes · direct-to-object-storage image upload with server-side processing · **every listing admin-reviewed before going live** · **listing credits: purchase via Razorpay, hold on submit, consume on approval, 90-day listing life** · public catalog with search and filters · vehicle detail pages · dealer public pages · phone reveal + enquiry form · **dealer enquiry inbox with a New → Contacted → Closed / Spam lifecycle** · photo-shoot requests with admin fulfilment (🟡 no UI yet) · admin console including **payments and configuration** · transactional email + SMS · MVP SEO · three deployed environments.

## 1.3 Explicitly out of scope

| Deferred | Why | Comes back when |
|---|---|---|
| Buyer accounts, saved searches | No validation value; `localStorage` covers saved cars | Buyers ask for it |
| Dealer staff sub-accounts | Schema supports it; UI isn't needed at 30 dealers | A dealer asks twice |
| Reviews & ratings | Needs moderation capacity you don't have | Month 4+ |
| Subscriptions / auto-renew billing | Prepaid credit packs are simpler and match the UI | Dealers ask to stop topping up |
| Automated KYC verification against government APIs | A human reads three PDFs at this volume | 100+ dealers |
| Bulk CSV import | Likely month 3 — see §24 | A 30+ car dealer refuses to onboard without it |
| Refunds and credit expiry | No policy exists yet; credits are perpetual in MVP | First refund request |

> **Changed in r2.** Payments, listing credits, listing expiry/renewal and KYC document review were previously listed here as deferred. All four are visible and operable in the UI — the billing screen, the sidebar credit card, the inventory `Expires` column and the onboarding document step — so all four are now in scope. See §26 and §27.

## 1.4 The three things that must not be compromised

1. **A dealer can never see or touch another dealer's data.** Four independent layers enforce this (§7). An isolation bug ends the business.
2. **A lead reaches the dealer's phone within 30 seconds.** The lead is the product; everything else is plumbing.
3. **A credit is never double-spent and never silently lost.** Every balance change is a ledger row with a `balanceAfter`; the balance shown in the UI is the last row's `balanceAfter`, never a running sum computed at read time. Money in, listings out — if that arithmetic is ever wrong, dealers stop trusting the platform immediately.

---

# 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | Everywhere |
| Web | Next.js 15, App Router, RSC | `output: 'standalone'` for Docker |
| Styling | Tailwind CSS v4 + CVA | Tokens in `@theme` (§16) |
| UI primitives | Radix UI, styled locally | Accessibility without inherited visual identity |
| API | **Express 5** + TypeScript | Async errors propagate natively |
| ORM | Prisma 6 | `$queryRaw` for the search query |
| Database | PostgreSQL 16 (Neon) | Single database, single schema |
| Jobs | pg-boss | Postgres-backed. No Redis. |
| Object storage | Cloudflare R2 | S3-compatible, **zero egress** |
| Image delivery | Cloudflare Images | AVIF/WebP at the edge |
| Email | Resend | |
| SMS | MSG91 (DLT-registered) | India requires DLT approval — start early |
| **Payments** | **Razorpay Orders + Checkout + webhooks** | India-native, UPI/cards/netbanking, GST invoicing. Named in the UI's purchase toast. |
| **Invoice PDFs** | **Puppeteer → HTML template → R2** | The billing table's `PDF` action. No third-party invoicing SaaS. |
| Errors | Sentry | Both apps, source-mapped |
| Registry | GitHub Container Registry | §20 |
| CI/CD | GitHub Actions | Build once, promote many |
| Hosting | Render (or Fly.io) for containers | Migrate to ECS Fargate at ~$1,500/mo |
| Monorepo | Turborepo + pnpm workspaces | |

**Not used, deliberately:** MongoDB · Redis · Elasticsearch · Kafka · Kubernetes · GraphQL · NestJS · microservices. Each has a named trigger in §24.

---

# 3. System architecture

```
                    BUYER (no account)          DEALER            ADMIN
                          │                        │                 │
                          └────────────┬───────────┴─────────────────┘
                                       │ HTTPS
                          ┌────────────▼─────────────┐
                          │      Cloudflare          │
                          │  DNS · WAF · CDN · Bot   │
                          └────────────┬─────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │   dealers-drive-web (Next.js 15)    │
                    │                                     │
                    │  (public)   /  /cars  /car/[slug]   │
                    │             /dealers/[slug]         │
                    │  (dealer)   /dealer/*   [auth]      │
                    │  (admin)    /admin/*    [auth+2FA]  │
                    │                                     │
                    │  RSC fetch ─ Server Actions ─ BFF   │
                    └──────────────────┬──────────────────┘
                                       │ REST/JSON, session cookie
                                       │ forwarded server-to-server
                    ┌──────────────────▼──────────────────┐
                    │  dealers-drive-api (Express 5)      │
                    │                                     │
                    │  middleware: context · auth · tenant │
                    │              validate · rate-limit  │
                    │              error-handler          │
                    │                                     │
                    │  modules: auth dealers catalog      │
                    │           vehicles listings media   │
                    │           search enquiries          │
                    │           billing  ← credits,       │
                    │             orders, payments,       │
                    │             invoices (§26)          │
                    │           photoRequests admin       │
                    │           notifications             │
                    │                                     │
                    │  platform: db jobs storage mail     │
                    │            sms payments events audit│
                    └──────────────────┬──────────────────┘
                                       │
     ┌────────────┬──────────────┬─────┼────────┬──────────┬────────────┐
     ▼            ▼              ▼              ▼          ▼            ▼
┌─────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│Postgres │ │  pg-boss   │ │Cloudflare  │ │ Resend  │ │  MSG91   │ │ Razorpay │
│ primary │ │ (same DB,  │ │ R2 + Images│ │ (email) │ │  (SMS)   │ │ (orders, │
│ +JSONB  │ │  own       │ │  (media +  │ │         │ │          │ │ checkout,│
│ +FTS    │ │  schema)   │ │  invoices) │ │         │ │          │ │ webhooks)│
└─────────┘ └────────────┘ └────────────┘ └─────────┘ └──────────┘ └──────────┘

   Worker process: same image, WORKER=true, runs pg-boss handlers
   Observability:  Sentry (errors) · pino (logs) · UptimeRobot (synthetics)
```

## 3.1 Critical flows

```
LISTING GOES LIVE (the core loop)
  Dealer adds vehicle ─▶ uploads ≥6 photos ─▶ POST /v1/dealer/vehicles/:id/submit
        │                                            │
        │                    guards: dealer ACTIVE, profile complete,
        │                    vehicle complete, ≥6 images, credit balance ≥ 1
        │                                            │
        │                        ┌───────────────────┘
        │                        ▼
        │              CREDIT HOLD (ledger −1, reason HOLD_SUBMIT)
        │                        │
        └─▶ Listing created, status = PENDING_REVIEW, creditHeld = true
              │
              └─▶ Admin moderation queue
                    │
                    ├─▶ approve ─▶ status = APPROVED
                    │              expiresAt = now() + 90 days
                    │              CREDIT CONSUMED (hold settles, no new debit)
                    │                ├─▶ outbox: ListingApproved
                    │                ├─▶ job: index into listing_search
                    │                ├─▶ job: revalidate pages
                    │                └─▶ job: email dealer
                    │
                    ├─▶ reject (reason ≥ 6 chars, required) ─▶ status = REJECTED
                    │              CREDIT RELEASED (ledger +1, RELEASE_REJECT)
                    │                └─▶ job: email dealer + verbatim reason
                    │                    (reason shown as a banner in inventory,
                    │                     with an "Edit & resubmit" action)
                    │
                    └─▶ request changes ─▶ status = CHANGES_REQUESTED
                                   CREDIT STAYS HELD (the dealer is expected back)
                                     └─▶ job: email dealer + note

  90 days after approval ─▶ nightly job ─▶ status = EXPIRED
                             removed from listing_search
                             dealer emailed at T−7d and T−1d
                             renew = a fresh credit (§26.4)

BUYER SENDS A LEAD               (three sources, all land in the same inbox)
  VDP  ─▶ [Call dealer]   ─▶ POST /v1/vehicles/:id/reveal-contact
                              (rate limited, logged, captcha after 3)
                              └─▶ Enquiry(source=CALL_BUTTON, message=null)
  VDP  ─▶ [Enquire now]   ─▶ POST /v1/enquiries  (source=LISTING_PAGE, no account)
  Portfolio ─▶ [Enquire]  ─▶ POST /v1/enquiries  (source=DEALER_PAGE,
                                                   vehicleId omitted)
        └─▶ status = NEW, reference = DD-EN-#####
        └─▶ outbox: EnquiryCreated
              ├─▶ HIGH-PRIORITY job: email + SMS dealer (<30s)
              └─▶ job: increment listing.enquiryCount

  Dealer works the inbox: NEW ─▶ CONTACTED ─▶ CLOSED, or NEW ─▶ SPAM

DEALER BUYS CREDITS
  Dealer ─▶ POST /v1/dealer/billing/orders { packId }
              └─▶ Order(PENDING) + Razorpay order id ─▶ Checkout opens
  Razorpay ─▶ webhook payment.captured ─▶ (idempotent, signature-verified)
              ├─▶ Payment(CAPTURED)
              ├─▶ ledger +n (PURCHASE), balanceAfter recomputed in the same txn
              ├─▶ Invoice(DD-INV-YYYY-NNNN) ─▶ job: render PDF ─▶ R2
              └─▶ job: email dealer the invoice
  Razorpay ─▶ webhook payment.failed ─▶ Payment(FAILED), Order(FAILED),
                                        no ledger row, invoice row kept as FAILED
                                        so the dealer sees the attempt

PHOTO SHOOT                                     🟡 backend built, no UI yet
  Dealer ─▶ POST /v1/dealer/photo-requests ─▶ REQUESTED
  Admin  ─▶ schedules ─▶ SCHEDULED ─▶ shoots ─▶ uploads to the dealer's
            vehicle via the normal media pipeline (audit-logged as admin)
         ─▶ COMPLETED ─▶ email dealer
```

---

# 4. Repository structure

Single monorepo, **three independently deployable artifacts** (web image, api image, and the same api image run as a worker).

```
dealers-drive/
├── .github/workflows/
│   ├── ci.yml                    # PR: lint, typecheck, test, build
│   ├── release.yml               # merge to main: build images once → deploy dev
│   └── promote.yml               # manual: promote a SHA to production
├── apps/
│   ├── web/                      # Next.js 15
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/     # /  /cars  /car/[slug]  /dealers/[slug]
│   │   │   │   ├── (dealer)/     # /dealer/*
│   │   │   │   ├── (admin)/      # /admin/*
│   │   │   │   ├── (auth)/       # /login /register /verify
│   │   │   │   ├── api/          # BFF route handlers only
│   │   │   │   ├── sitemap.ts  robots.ts  layout.tsx  error.tsx
│   │   │   ├── components/       # §16.4
│   │   │   ├── features/         # co-located actions + hooks per feature
│   │   │   ├── lib/              # api-client, session, seo, url, format
│   │   │   └── styles/globals.css
│   │   ├── next.config.ts        # output: 'standalone'
│   │   └── Dockerfile
│   └── api/                      # Express 5
│       ├── src/                  # §5.1
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed/{catalog,cities,rto,colors,admin}.ts
│       ├── test/
│       └── Dockerfile
├── packages/
│   ├── contracts/                # Zod schemas — the API contract
│   └── config/                   # eslint, tsconfig, tailwind presets
├── docs/
│   ├── ARCHITECTURE.md           # ← this file
│   ├── MVP-PLAN.md               # the 40-day build plan
│   ├── CONTEXT.md                # rewritten daily; pasted into each session
│   ├── CONVENTIONS.md  TODO.md  DECISIONS.md  RUNBOOK.md
│   └── logs/day-NN.md            # one per working day
├── docker-compose.yml            # postgres + minio + mailpit
├── turbo.json
└── pnpm-workspace.yaml
```

**Why a monorepo:** atomic contract changes, direct type sharing via workspace imports, one CI cache. Independent deployment is achieved with path filters (§20), not with separate repositories.

**`packages/ui` does not exist yet.** Components live in `apps/web/src/components/`, structured as if they were already a package so promotion is a `git mv`. Trigger: a second app needs them.

---

# 5. Backend architecture

A **modular monolith** in Express. One deployable, hard internal boundaries. Microservices solve an organisational problem you do not have; the module boundaries below are what make extraction cheap later if you ever do.

## 5.1 Layout

```
apps/api/src/
├── server.ts                  # express app assembly ONLY
├── worker.ts                  # same code, WORKER=true, runs pg-boss handlers
├── container.ts               # composition root — wires every module by hand
├── routes.ts                  # mounts module routers under /v1
├── config/env.ts              # zod-validated process.env, fails fast at boot
├── middleware/
│   ├── request-context.ts     # AsyncLocalStorage: traceId, userId, dealerId, ip
│   ├── auth.ts                # requireAuth · optionalAuth
│   ├── tenant.ts              # resolveDealer · requireDealerActive
│   ├── permissions.ts         # requireRole(...) · requireAdmin(...)
│   ├── validate.ts            # validate({body,query,params}) — Zod, .strict()
│   ├── rate-limit.ts
│   ├── error-handler.ts       # RFC 9457 Problem Details — LAST in the chain
│   └── not-found.ts
├── modules/
│   ├── auth/                  # users, sessions, OTP, password reset
│   ├── dealers/               # profile, slug, status state machine, members
│   ├── catalog/               # makes, models, variants, cities, RTO, colours
│   ├── vehicles/              # vehicle CRUD, specs, slug, completeness
│   ├── listings/              # submit → review → approve/reject state machine
│   ├── media/                 # presign, commit, derivatives, GC
│   ├── search/                # SearchPort, Postgres adapter, indexer
│   ├── enquiries/             # leads, phone reveals
│   ├── photoRequests/         # shoot requests + admin fulfilment
│   ├── notifications/         # templates, dispatch
│   └── admin/                 # moderation queue, approvals, platform metrics
└── platform/
    ├── db/          prisma.ts · tx.ts
    ├── jobs/        queue.ts (pg-boss) · handlers/ · scheduler.ts
    ├── storage/     storage.port.ts · r2.adapter.ts · minio.adapter.ts
    ├── mail/        mailer.port.ts · resend.adapter.ts · mailpit.adapter.ts
    ├── sms/         sms.port.ts · msg91.adapter.ts · console.adapter.ts
    ├── events/      bus.ts · outbox.ts · publisher.ts
    ├── audit/       audit.service.ts
    ├── cache/       cache.port.ts · memory.adapter.ts     ← redis later
    └── telemetry/   logger.ts (pino) · sentry.ts
```

## 5.2 Inside a module

```
modules/vehicles/
├── vehicles.routes.ts       # the ONLY file importing 'express'
├── vehicles.controller.ts   # req/res → service → res. No business logic.
├── vehicles.service.ts      # all logic. NEVER sees req or res.
├── vehicles.repository.ts   # the ONLY file importing prisma in this module
├── vehicles.events.ts       # event payload types
├── vehicles.facade.ts       # the ONLY file other modules may import
└── vehicles.types.ts
```

Each module exports a factory:

```ts
export function createVehiclesModule(deps: VehiclesDeps) {
  const repo       = createVehiclesRepository(deps.prisma);
  const service    = createVehiclesService({ ...deps, repo });
  const controller = createVehiclesController(service);
  return {
    router: createVehiclesRouter(controller),
    facade: createVehiclesFacade(service),   // narrow, intentional surface
  };
}
```

## 5.3 The composition root (replaces DI)

```ts
// container.ts
export function buildContainer(prisma: PrismaClient) {
  const storage = createR2Storage(env);
  const mailer  = createResendMailer(env);
  const sms     = env.SMS_PROVIDER === 'msg91' ? createMsg91Sms(env)
                                               : createConsoleSms();
  const queue   = createQueue(env.DATABASE_URL);
  const events  = createEventBus(queue);
  const audit   = createAuditService(prisma);

  const auth     = createAuthModule({ prisma, mailer, sms, audit });
  const dealers  = createDealersModule({ prisma, audit, events });
  const catalog  = createCatalogModule({ prisma });
  const media    = createMediaModule({ prisma, storage, queue, audit });
  const vehicles = createVehiclesModule({ prisma, events,
                     catalog: catalog.facade, media: media.facade });
  const listings = createListingsModule({ prisma, events, audit,
                     vehicles: vehicles.facade });
  const search   = createSearchModule({ prisma });
  const enquiries= createEnquiriesModule({ prisma, events });
  const photos   = createPhotoRequestsModule({ prisma, events });
  const notify   = createNotificationsModule({ mailer, sms, prisma });
  const admin    = createAdminModule({ prisma, audit,
                     dealers: dealers.facade, listings: listings.facade,
                     photos: photos.facade, media: media.facade });

  return { auth, dealers, catalog, vehicles, listings, media, search,
           enquiries, photos, notify, admin, queue, events };
}
```

Explicit, greppable, trivially testable. Pass fakes in, get a module out.

## 5.4 Routing — guards are middleware chains

```ts
export function createVehiclesRouter(c: VehiclesController) {
  const r = Router();
  r.use('/dealer/vehicles', requireAuth, resolveDealer, requireDealerActive);

  r.post('/dealer/vehicles',
    requireRole('OWNER', 'MANAGER'),
    validate({ body: CreateVehicleInput }),
    c.create);

  r.post('/dealer/vehicles/:id/submit',
    requireRole('OWNER', 'MANAGER'),
    validate({ params: IdParam }),
    c.submitForReview);

  return r;
}
```

**The middleware order is the security model.** `resolveDealer` puts `dealerId` into request context from the session. The controller never reads it from the body.

## 5.5 The five rules that keep Express from becoming a mud ball

1. **Only `*.routes.ts` imports `express`.** A service that takes a `Request` is wrong.
2. **Only `*.repository.ts` imports `prisma`.** Grep for `prisma.` outside repositories — it should return nothing.
3. **Cross-module imports go through `*.facade.ts` only.** Enforced by ESLint:
   ```js
   'no-restricted-imports': ['error', { patterns: [{
     group: ['**/modules/*/!(*.facade)'],
     message: 'Import <module>.facade.ts, not module internals.',
   }]}]
   ```
4. **Every dealer-scoped repository method takes `dealerId` as its first required parameter.** Not optional, not looked up inside — an explicit argument, so an unscoped query is a type error.
5. **Side effects go through events, not direct calls.** `listings` does not call `search.index()`; it publishes `ListingApproved` and search subscribes.

## 5.6 Error contract

Every error response is RFC 9457 Problem Details:

```json
{
  "type": "https://dealers-drive.com/errors/insufficient-images",
  "title": "Not enough images",
  "status": 422,
  "code": "MIN_IMAGES_REQUIRED",
  "traceId": "a1b2c3d4e5",
  "detail": "At least 5 photos are required before submitting for review.",
  "errors": [{ "field": "media", "code": "TOO_FEW", "message": "5 required, 3 provided" }]
}
```

`code` is the machine-readable contract — the frontend switches on it, never on `detail`. `traceId` appears in the body, in every log line for that request, and in the Sentry event.

| Error class | Status | Code |
|---|---|---|
| `ZodError` | 400 | `VALIDATION_FAILED` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `UnauthorizedError` | 401 | `UNAUTHENTICATED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `DomainError` | 422 | `error.code` |
| `RateLimitError` | 429 | `RATE_LIMITED` |
| anything else | 500 | `INTERNAL` (detail stripped in production) |

---

# 6. Database schema

**PostgreSQL only.** Money, ownership and lifecycle are relational; variable vehicle specs go in `JSONB` with a GIN index. A second database would buy dual-write bugs and cost cross-table transactions.

```prisma
// ─────────── IDENTITY (dealers and admins only — no buyer accounts) ──────
model User {
  id              String   @id @default(uuid()) @db.Uuid
  fullName        String?                      // onboarding step 1 "Full name"
  roleTitle       String?                      // onboarding step 1 "Role" — free text
  email           String?  @unique             // nullable: phone is the identity
  phone           String   @unique             // E.164 — the login credential
  passwordHash    String?                      // ADMINS ONLY. Dealers are passwordless.
  emailVerifiedAt DateTime?
  phoneVerifiedAt DateTime?
  status          UserStatus @default(ACTIVE)  // ACTIVE SUSPENDED DELETED
  isPlatformAdmin Boolean  @default(false)
  adminRole       AdminRole?                   // SUPPORT MODERATOR SUPER_ADMIN
  totpSecret      String?                      // admins only
  totpEnabledAt   DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime @default(now())
  sessions        Session[]
  memberships     DealerMember[]
}
// r2: passwordHash is now nullable and admin-only. The dealer UI has no password
// field on any screen — sign-in is phone → 6-digit OTP → session. A dealer row with
// a non-null passwordHash and isPlatformAdmin=false is a bug; there is a test for it.

model Session {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @db.Uuid
  tokenHash  String   @unique          // SHA-256 of the opaque cookie value
  expiresAt  DateTime
  revokedAt  DateTime?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())
  @@index([userId, revokedAt])
  @@index([expiresAt])
}

model VerificationCode {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String?  @db.Uuid           // null on sign-up: no User row exists yet
  destination String                     // E.164 phone or email — what we sent to
  channel    Channel                     // EMAIL | PHONE
  purpose    OtpPurpose                  // SIGNIN | SIGNUP | EMAIL_VERIFY | PHONE_CHANGE
  codeHash   String                      // never store plaintext
  attempts   Int      @default(0)        // max 3, then invalidate (UI: "Two attempts remaining")
  resendCount Int     @default(0)
  lastSentAt DateTime @default(now())    // 60s cooldown; UI shows a 00:24-style countdown
  expiresAt  DateTime                    // +10 minutes (the OTP screen says so)
  consumedAt DateTime?
  ip         String?
  createdAt  DateTime @default(now())
  @@index([destination, purpose, consumedAt])
  @@index([userId, channel, consumedAt])
}

// ─────────── DEALERS (the tenant) ────────────────────────────────────────
model Dealer {
  id             String   @id @default(uuid()) @db.Uuid
  slug           String   @unique          // "sharma-motors-andheri"
  brandName      String                    // "Dealership name (public)" — on EVERY vehicle card
  legalName      String                    // "Registered legal name"
  gstin          String?                   // onboarding step 3, mono field
  pan            String?                   // onboarding step 3, mono field  ← r2
  about          String?                   // portfolio "About" paragraph
  tagline        String?                   // 1-line blurb on the directory card  ← r2
  logoMediaId    String?  @db.Uuid
  coverMediaId   String?  @db.Uuid
  status         DealerStatus @default(DRAFT)
  // DRAFT → PENDING_APPROVAL → ACTIVE → SUSPENDED ⇄ ACTIVE | REJECTED | CLOSED
  cityId         String?  @db.Uuid
  addressLine    String?
  pincode        String?
  lat            Float?
  lng            Float?
  contactPhone   String?
  contactEmail   String?
  landline       String?                   // onboarding step 2 "Landline"  ← r2
  workingHours   Json?                     // portfolio "Open: Mon–Sat, 9:30am – 8:00pm"
  establishedYear Int?                     // portfolio "Years operating" is derived from this
  specialities   String[]                  // portfolio + directory service tags
  creditBalance  Int      @default(0)      // ← r2. MIRROR of the last CreditTransaction
                                           //   .balanceAfter. Never authoritative on its
                                           //   own; reconciled nightly against the ledger.
  creditsHeld    Int      @default(0)      // held by PENDING_REVIEW / CHANGES_REQUESTED
  activeListings Int      @default(0)      // denormalized, reconciled nightly
  medianResponseMins Int?                  // portfolio "Response time · < 2 hrs"  ← r2
                                           //   rolling 30d median NEW→CONTACTED, nightly job
  approvedAt     DateTime?
  suspendedAt    DateTime?
  statusReason   String?
  createdAt      DateTime @default(now())
  members        DealerMember[]
  vehicles       Vehicle[]
  documents      DealerDocument[]
  @@index([status, cityId])
  @@index([slug])
}

// ─────────── KYC DOCUMENTS (onboarding step 3) ───────────────────────────
// r2: previously deferred. The onboarding UI uploads three documents with
// per-row status ("uploaded" / "Uploading — 62%" / "Required — PDF or JPG,
// max 5 MB") and the review screen says documents are never shown to buyers.
model DealerDocument {
  id             String @id @default(uuid()) @db.Uuid
  dealerId       String @db.Uuid              // ← tenant key
  type           DealerDocType                // GST_CERTIFICATE | PAN_CARD | ADDRESS_PROOF
  mediaId        String? @db.Uuid             // null until the upload commits
  fileName       String?                      // "gst-cert.pdf" — shown verbatim in the UI
  status         DocStatus @default(REQUIRED) // REQUIRED UPLOADING UPLOADED VERIFIED REJECTED
  rejectionReason String?
  reviewedBy     String? @db.Uuid
  reviewedAt     DateTime?
  createdAt      DateTime @default(now())
  @@unique([dealerId, type])                  // exactly one live doc per type
  @@index([status, createdAt])                // the admin verification queue
}
// Documents are PRIVATE. Their media is stored under a separate R2 prefix with NO
// public delivery route — served only through a short-lived signed URL to an admin.

model DealerMember {
  id          String @id @default(uuid()) @db.Uuid
  dealerId    String @db.Uuid
  userId      String @db.Uuid
  role        DealerRole                  // OWNER | MANAGER | SALES
  permissions String[]                    // grants beyond the role
  status      MemberStatus @default(ACTIVE)
  @@unique([dealerId, userId])
  @@index([userId])
}

// ─────────── CATALOG (curated taxonomy — dealers never free-type) ────────
model Make    { id String @id @default(uuid()) @db.Uuid
                slug String @unique  name String  logoUrl String?
                popularity Int @default(0)  models Model[] }
model Model   { id String @id @default(uuid()) @db.Uuid
                makeId String @db.Uuid  slug String  name String
                bodyType BodyType  yearFrom Int  yearTo Int?
                variants Variant[]  @@unique([makeId, slug]) }
model Variant { id String @id @default(uuid()) @db.Uuid
                modelId String @db.Uuid  slug String  name String
                fuel FuelType  transmission Transmission
                engineCc Int?  seats Int?  @@unique([modelId, slug]) }
model City    { id String @id @default(uuid()) @db.Uuid
                slug String @unique  name String  state String
                lat Float  lng Float  isActive Boolean @default(true) }
model Rto     { code String @id                     // "MH-01"
                name String  city String  state String  @@index([state]) }
model Color   { id String @id @default(uuid()) @db.Uuid
                slug String @unique  name String  hex String
                family String  sortOrder Int }      // family groups the filter

// ─────────── VEHICLES (the physical asset) ───────────────────────────────
model Vehicle {
  id             String   @id @default(uuid()) @db.Uuid
  dealerId       String   @db.Uuid          // ← tenant key on EVERY row
  makeId         String   @db.Uuid
  modelId        String   @db.Uuid
  variantId      String?  @db.Uuid
  year           Int
  pricePaise     BigInt                     // integer minor units, always
  kmDriven       Int
  fuel           FuelType
  transmission   Transmission
  bodyType       BodyType
  ownerNumber    Int
  colorId        String?  @db.Uuid          // normalized → filterable
  seats          Int?                       // filter
  airbags        Int?                       // "safety" filter
  rtoCode        String?                    // filter + VDP "Registration" row
  cityId         String   @db.Uuid
  regNumberMasked String?                   // "TN23••4417" — never the full number
  insuranceType  InsuranceType?             // COMPREHENSIVE | THIRD_PARTY | NONE   ← r2
  insuranceValidTill DateTime?              // VDP spec row "valid to Mar 2027"     ← r2
  priceNegotiable PriceNegotiability @default(SLIGHTLY)  // add-vehicle step 4     ← r2
                                            // SLIGHTLY | FIXED — drives the price-block line
  description    String?
  features       String[]                   // taxonomy-constrained
  specs          Json     @default("{}")    // JSONB + GIN, variable specs
  status         VehicleStatus @default(DRAFT)  // DRAFT READY SOLD ARCHIVED
  primaryMediaId String?  @db.Uuid
  slug           String   @unique
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?                  // soft delete
  media          VehicleMedia[]
  listings       Listing[]
  @@index([dealerId, status, createdAt])
  @@index([modelId, year])
  @@index([cityId, pricePaise])
}

model VehicleMedia {
  vehicleId String @db.Uuid
  mediaId   String @db.Uuid
  position  Int
  @@id([vehicleId, mediaId])
  @@index([vehicleId, position])
}

model Media {
  id          String @id @default(uuid()) @db.Uuid
  dealerId    String? @db.Uuid              // tenant key (null = platform)
  ownerType   MediaOwner                    // VEHICLE | DEALER_LOGO | DEALER_COVER
  storageKey  String @unique
  mimeType    String
  bytes       Int
  width       Int?
  height      Int?
  blurhash    String?
  uploadedByAdmin Boolean @default(false)   // photo-shoot uploads (§13)
  status      MediaStatus @default(PENDING) // PENDING READY FAILED ORPHAN
  createdAt   DateTime @default(now())
  @@index([status, createdAt])              // orphan GC sweep
}

// ─────────── LISTINGS (the publication — where revenue attaches later) ───
model Listing {
  id              String @id @default(uuid()) @db.Uuid
  vehicleId       String @db.Uuid
  dealerId        String @db.Uuid
  status          ListingStatus @default(PENDING_REVIEW)
  // PENDING_REVIEW → APPROVED → (SOLD | EXPIRED | REMOVED)
  //                → REJECTED  → (resubmit) → PENDING_REVIEW
  //                → CHANGES_REQUESTED → (resubmit) → PENDING_REVIEW
  submittedAt     DateTime @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?  @db.Uuid
  rejectionReason String?                   // verbatim to the dealer, ≥ 6 chars
  changeRequestNote String?                 // "Request changes" action            ← r2
  approvedAt      DateTime?
  expiresAt       DateTime?                 // approvedAt + 90 days                ← r2
                                            // UI: inventory "Expires" column, "—" when null
  expiryWarned7d  Boolean @default(false)
  expiryWarned1d  Boolean @default(false)
  creditHeld      Boolean @default(false)   // a credit is reserved for this listing ← r2
  creditTxnId     String? @db.Uuid          // the HOLD_SUBMIT ledger row
  renewedFromId   String? @db.Uuid          // set when a dealer renews an EXPIRED listing
  soldAt          DateTime?
  viewCount       Int @default(0)           // batched increments (lifetime)
  enquiryCount    Int @default(0)
  revealCount     Int @default(0)
  @@index([status, submittedAt])            // ← the moderation queue query
  @@index([dealerId, status])
  @@index([status, expiresAt])              // ← the nightly expiry sweep          ← r2
}
// Raw SQL: CREATE UNIQUE INDEX ON listings (vehicle_id) WHERE status='APPROVED';
// Raw SQL: ALTER TABLE listings ADD CONSTRAINT approved_has_expiry
//          CHECK (status <> 'APPROVED' OR expires_at IS NOT NULL);

// ─────────── VIEW ROLLUP (dealer dashboard "Views this week" chart) ──────
// r2: the dashboard draws a 7-bar Mon–Sun chart with a weekly total. A single
// cumulative Listing.viewCount cannot produce it. Raw view events are far too
// many to keep; a daily rollup is 1 row per listing per day and answers both
// the chart and the per-listing "Views" column.
model ListingViewDaily {
  listingId String   @db.Uuid
  dealerId  String   @db.Uuid               // ← tenant key, so the chart is one predicate
  day       DateTime @db.Date               // IST calendar day
  views     Int      @default(0)
  reveals   Int      @default(0)
  enquiries Int      @default(0)
  @@id([listingId, day])
  @@index([dealerId, day])
}
// Written by a batched worker (60s flush) from an in-memory counter, never
// synchronously on the request path. Retained 400 days, then rolled to monthly.

// ─────────── LEADS ───────────────────────────────────────────────────────
model Enquiry {
  id         String @id @default(uuid()) @db.Uuid
  reference  String @unique                 // "DD-EN-40912" — shown on the success   ← r2
                                            // screen and quoted by buyers on the phone
  vehicleId  String? @db.Uuid               // NULLABLE ← r2: the portfolio's "Enquire
                                            // with dealer" button has no vehicle
  listingId  String? @db.Uuid
  dealerId   String @db.Uuid                // denormalized → single-predicate scoping
  name       String
  phone      String                         // E.164
  email      String?
  message    String?
  source     EnquirySource                  // ← r2, was a free string
  // LISTING_PAGE | CALL_BUTTON | DEALER_PAGE — the UI renders these as
  // "Listing page" / "Call button" / "Dealer page" tag-accent chips
  status     EnquiryStatus @default(NEW)    // ← r2: NEW CONTACTED CLOSED SPAM
                                            // drives the four counted tabs
  contactedAt DateTime?
  contactedBy String? @db.Uuid
  closedAt   DateTime?
  closeReason String?                       // SOLD | NOT_INTERESTED | UNREACHABLE | OTHER
  markedSpamAt DateTime?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())
  @@index([dealerId, status, createdAt])    // ← the inbox tab query               ← r2
  @@index([dealerId, createdAt])
  @@index([vehicleId])
  @@index([phone, vehicleId, createdAt])    // 24h duplicate suppression
}
// Reference format: DD-EN- + a 5-digit value from a dedicated Postgres sequence
// offset to start at 10000. Never derived from the uuid, never guessable-sequential
// across dealers in a way that leaks volume — the sequence is platform-wide, and
// platform-wide lead volume is not sensitive.
//
// A phone reveal creates BOTH a PhoneReveal row (for rate limiting and abuse
// analysis) and an Enquiry row with source=CALL_BUTTON and message=null — because
// the dealer's inbox must show it as a lead. §14.4.

model PhoneReveal {
  id        BigInt @id @default(autoincrement())
  vehicleId String? @db.Uuid
  dealerId  String @db.Uuid
  ip        String
  userAgent String?
  createdAt DateTime @default(now())
  @@index([dealerId, createdAt])
  @@index([ip, createdAt])                  // anti-scraping
}

// ─────────── PHOTO SHOOTS ────────────────────────────────────────────────
model PhotoRequest {
  id           String @id @default(uuid()) @db.Uuid
  dealerId     String @db.Uuid
  vehicleId    String? @db.Uuid             // null = "come shoot several"
  vehicleCount Int    @default(1)
  status       PhotoRequestStatus @default(REQUESTED)
  // REQUESTED → SCHEDULED → COMPLETED | CANCELLED
  address      String
  contactName  String
  contactPhone String
  preferredDate DateTime?
  scheduledFor  DateTime?
  notes        String?
  adminNote    String?                      // record what you'd have charged
  completedAt  DateTime?
  createdAt    DateTime @default(now())
  @@index([status, createdAt])
  @@index([dealerId, createdAt])
}

// ─────────── CREDITS, ORDERS, PAYMENTS, INVOICES (§26) ───────────────────
// r2: entirely new. Previously "Dealer.listingAllowance, a manual stand-in".
// The billing screen sells four packs, shows a running ledger with a balance
// column, and lists invoices with a downloadable PDF — none of which a single
// integer can support.

model CreditPack {
  id            String @id @default(uuid()) @db.Uuid
  slug          String @unique               // "pack-10" | "pack-25" | "pack-50" | "pack-100"
  credits       Int                          // 10 | 25 | 50 | 100
  pricePaise    BigInt                       // 450000 | 1000000 | 1750000 | 3000000
  badge         String?                      // "Most popular" | "Best value" | null
  highlighted   Boolean @default(false)      // the 25-pack card takes the accent border
  sortOrder     Int
  isActive      Boolean @default(true)
  createdAt     DateTime @default(now())
}
// Per-listing rate (₹450 / ₹400 / ₹350 / ₹300) is DERIVED = pricePaise / credits.
// Never stored — a stored rate that disagrees with the division is a support ticket.

model CreditTransaction {                    // ← the ledger. Append-only. The truth.
  id            String @id @default(uuid()) @db.Uuid
  dealerId      String @db.Uuid              // ← tenant key
  delta         Int                          // +25, −1, +10, −13 … never 0
  balanceAfter  Int                          // materialised; the UI's "bal 27" column
  reason        CreditReason
  // PURCHASE | ADMIN_GRANT | HOLD_SUBMIT | RELEASE_REJECT | RELEASE_EXPIRED_UNREVIEWED
  // | CONSUME_APPROVE | ADMIN_ADJUSTMENT | REVERSAL
  label         String                       // "Purchased — 25 credit pack",
                                             // "Listing published — 2022 Tata Nexon XZ+"
  listingId     String? @db.Uuid
  orderId       String? @db.Uuid
  actorType     String                       // DEALER | ADMIN | SYSTEM
  actorId       String? @db.Uuid
  idempotencyKey String? @unique             // webhook + retry safety
  createdAt     DateTime @default(now())
  @@index([dealerId, createdAt(sort: Desc)]) // ← the credit-history panel query
  @@index([listingId])
}
// INVARIANTS, enforced by a nightly reconciliation job that alerts on any breach:
//   1. balanceAfter of row N = balanceAfter of row N−1 + delta of row N
//   2. Dealer.creditBalance = balanceAfter of the newest row
//   3. Dealer.creditsHeld  = count of listings in PENDING_REVIEW|CHANGES_REQUESTED
//                            with creditHeld = true
//   4. No dealer's balance is ever negative
// Rows are written inside the same transaction as the state change they pay for,
// with SELECT ... FOR UPDATE on the dealer row. That serialisation is what makes
// balanceAfter safe under concurrent submits.

model Order {
  id            String @id @default(uuid()) @db.Uuid
  dealerId      String @db.Uuid              // ← tenant key
  packId        String @db.Uuid
  credits       Int                          // snapshot — packs can be repriced
  amountPaise   BigInt                       // snapshot, ex-GST
  taxPaise      BigInt                       // 18% GST on a marketplace service
  totalPaise    BigInt
  currency      String @default("INR")
  status        OrderStatus @default(PENDING)  // PENDING PAID FAILED CANCELLED EXPIRED
  gateway       String @default("razorpay")
  gatewayOrderId String? @unique             // "order_xxxxxxxxxxxx"
  createdAt     DateTime @default(now())
  paidAt        DateTime?
  @@index([dealerId, createdAt])
  @@index([status, createdAt])
}

model Payment {
  id             String @id @default(uuid()) @db.Uuid
  orderId        String @db.Uuid
  dealerId       String @db.Uuid             // ← tenant key
  gatewayPaymentId String @unique            // "pay_xxxxxxxxxxxx"
  method         String?                     // upi | card | netbanking | wallet
  amountPaise    BigInt
  status         PaymentStatus               // CREATED AUTHORIZED CAPTURED FAILED REFUNDED
  failureReason  String?
  gatewaySignature String?
  rawPayload     Json                        // the verified webhook body, kept for disputes
  capturedAt     DateTime?
  createdAt      DateTime @default(now())
  @@index([dealerId, createdAt])
}

model Invoice {
  id            String @id @default(uuid()) @db.Uuid
  number        String @unique               // "DD-INV-2026-0418" — sequence per FY
  dealerId      String @db.Uuid              // ← tenant key
  orderId       String @db.Uuid
  paymentId     String? @db.Uuid
  amountPaise   BigInt                       // ex-GST
  taxPaise      BigInt
  totalPaise    BigInt
  status        InvoiceStatus                // CAPTURED | FAILED | REFUNDED
                                             // the UI's payment-history status tag
  gstin         String?                      // the dealer's, snapshotted at issue
  placeOfSupply String?                      // state code, needed for CGST/SGST vs IGST
  pdfMediaKey   String?                      // R2 key; null until the render job finishes
  issuedAt      DateTime @default(now())
  @@index([dealerId, issuedAt(sort: Desc)])
}
// A FAILED payment still gets an Invoice row so the dealer sees the attempt in
// payment history (the UI shows DD-INV-2026-0287 with a red "Failed" tag).
// A FAILED invoice has no PDF and no ledger row.

model WebhookEvent {                          // gateway idempotency
  id           String @id @default(uuid()) @db.Uuid
  gateway      String
  gatewayEventId String @unique               // Razorpay's x-razorpay-event-id
  eventType    String
  payload      Json
  processedAt  DateTime?
  attempts     Int @default(0)
  error        String?
  createdAt    DateTime @default(now())
  @@index([processedAt, createdAt])
}
// Every webhook is INSERTed first. A duplicate delivery collides on
// gatewayEventId and is acknowledged with 200 without re-running any side effect.
// This is the only thing standing between a retried webhook and a dealer being
// credited twice.

// ─────────── PLATFORM ────────────────────────────────────────────────────
model AuditLog {
  id         BigInt @id @default(autoincrement())
  actorType  String                         // DEALER | ADMIN | SYSTEM
  actorId    String? @db.Uuid
  dealerId   String? @db.Uuid
  action     String                         // "listing.approved"
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ip         String?
  traceId    String?
  createdAt  DateTime @default(now())
  @@index([entityType, entityId, createdAt])
  @@index([dealerId, createdAt])
}   // PARTITION BY RANGE (createdAt), monthly, from day one

model OutboxEvent {
  id            BigInt @id @default(autoincrement())
  aggregateType String
  aggregateId   String
  eventType     String
  payload       Json
  createdAt     DateTime @default(now())
  publishedAt   DateTime?
  attempts      Int @default(0)
  @@index([publishedAt, id])
}

model PlatformConfig {
  key       String @id
  value     Json
  updatedBy String? @db.Uuid
  updatedAt DateTime @updatedAt
}

// ─────────── ENUMS ───────────────────────────────────────────────────────
enum UserStatus         { ACTIVE SUSPENDED DELETED }
enum AdminRole          { SUPPORT MODERATOR SUPER_ADMIN }
enum Channel            { EMAIL PHONE }
enum OtpPurpose         { SIGNIN SIGNUP EMAIL_VERIFY PHONE_CHANGE }              // r2
enum DealerStatus       { DRAFT PENDING_APPROVAL ACTIVE SUSPENDED REJECTED CLOSED }
enum DealerRole         { OWNER MANAGER SALES }
enum MemberStatus       { ACTIVE INVITED REMOVED }
enum DealerDocType      { GST_CERTIFICATE PAN_CARD ADDRESS_PROOF }               // r2
enum DocStatus          { REQUIRED UPLOADING UPLOADED VERIFIED REJECTED }        // r2
enum FuelType           { PETROL DIESEL CNG ELECTRIC HYBRID LPG }
enum Transmission       { MANUAL AUTOMATIC }
enum BodyType           { HATCHBACK SEDAN SUV MUV LUXURY }
enum InsuranceType      { COMPREHENSIVE THIRD_PARTY NONE }                       // r2
enum PriceNegotiability { SLIGHTLY FIXED }                                       // r2
enum VehicleStatus      { DRAFT READY SOLD ARCHIVED }
enum ListingStatus      { PENDING_REVIEW CHANGES_REQUESTED APPROVED REJECTED     // r2
                          EXPIRED SOLD REMOVED }
enum DisplayStatus      { DRAFT PENDING CHANGES_REQUESTED ACTIVE REJECTED        // r2
                          EXPIRED SOLD REMOVED }                                 // derived, §27
enum MediaOwner         { VEHICLE DEALER_LOGO DEALER_COVER DEALER_DOCUMENT }     // r2
enum MediaStatus        { PENDING READY FAILED ORPHAN }
enum EnquirySource      { LISTING_PAGE CALL_BUTTON DEALER_PAGE }                 // r2
enum EnquiryStatus      { NEW CONTACTED CLOSED SPAM }                            // r2
enum PhotoRequestStatus { REQUESTED SCHEDULED COMPLETED CANCELLED }
enum CreditReason       { PURCHASE ADMIN_GRANT HOLD_SUBMIT RELEASE_REJECT        // r2
                          RELEASE_EXPIRED_UNREVIEWED CONSUME_APPROVE
                          ADMIN_ADJUSTMENT REVERSAL }
enum OrderStatus        { PENDING PAID FAILED CANCELLED EXPIRED }                // r2
enum PaymentStatus      { CREATED AUTHORIZED CAPTURED FAILED REFUNDED }          // r2
enum InvoiceStatus      { CAPTURED FAILED REFUNDED }                             // r2
```

## 6.1 Non-obvious decisions

| Decision | Why |
|---|---|
| Money as `BigInt` paise | Floating-point money is a bug, not a style choice. Needed in month 3. |
| `Listing` separate from `Vehicle` | A vehicle is the asset; a listing is a publication with a review lifecycle. Revenue attaches here in month 3 — separating now avoids a migration on your busiest table with live dealers on it. |
| Colours normalized, not free text | So the filter can group "Pearl White" and "Arctic White" under `family: white`. |
| Partial unique index on approved listings | The **database**, not application code, guarantees one live listing per vehicle. |
| `dealerId` on `Enquiry` and `Media` even though derivable | Tenant filtering must be one indexed predicate, never a join (§7). |
| Soft delete only | Dealers delete by accident; buyers bookmark URLs; disputes need history. |
| `regNumberMasked` | Full registration numbers are PII and enable vehicle-history scraping. |
| Audit log partitioned from day one | Retrofitting partitioning onto 500M rows is a maintenance window. Now it's 10 lines. |
| `uploadedByAdmin` on Media | Photo-shoot uploads must be visibly attributed, and audit-logged. |
| **Credit ledger, not a counter** ← r2 | The billing screen shows a running history with a balance per row. A counter cannot be audited, cannot explain itself to a dealer disputing a charge, and cannot be reconciled. `Dealer.creditBalance` exists only as a read cache of the newest `balanceAfter`. |
| **`balanceAfter` materialised** ← r2 | Summing the ledger on every page load is O(n) and gets slower for your best customers. Materialising it makes the invariant checkable, which is the actual point. |
| **Credit held at submit, consumed at approve** ← r2 | The UI decrements the balance when the admin approves. Charging at submit and refunding on rejection would be simpler but lets a dealer's balance flap; holding is what dealers expect from every ad platform they already use. |
| **`Enquiry.vehicleId` nullable** ← r2 | The portfolio's "Enquire with dealer" button produces a real lead with no vehicle attached. Forcing a synthetic vehicle would corrupt every per-vehicle metric. |
| **A phone reveal creates an Enquiry** ← r2 | §14 already says reveals count as leads. The inbox proves it — one of the four cards carries a "Call button" source chip. |
| **Daily view rollup, not raw events** ← r2 | The dashboard needs 7 numbers per dealer per week. Raw view events would be the largest table in the database within a month and would answer no question the rollup cannot. |
| **Invoice row for failed payments** ← r2 | The payment-history table shows a failed attempt. Hiding failures makes a dealer who was charged-then-reversed think you lost their money. |

## 6.2 The catalog is not optional

If dealers free-type "Maruti Suzuki Swift VXi" vs "Swift VXI" vs "MARUTI SWIFT vxi", search, filters and SEO all die at once. Dealer input for make/model/variant/colour/RTO is **constrained to dropdowns sourced from the catalog**, with a "model not listed" request queue for admins. Seed before onboarding dealer #1.

---

# 7. Multi-tenancy & isolation

**Shared database, shared schema, `dealer_id` discriminator column.** At every stage. Your core product is a cross-tenant search — a buyer searching "Fortuner in Mumbai" scans every dealer's inventory — so physical tenant isolation would make your main feature architecturally impossible. Schema-per-dealer and database-per-dealer are wrong here at any scale.

Four independent layers. Application bugs are inevitable; design so a single missed `WHERE` cannot leak data.

**Layer 1 — Tenant context is session-derived, never client-supplied.**
`resolveDealer` middleware reads the session's `DealerMember` row and writes `dealerId` into `RequestContext`. A `dealerId` in a body, query or param is **ignored**. There is an explicit test asserting this.

**Layer 2 — Repository signatures make unscoped queries a type error.**
```ts
class VehiclesRepository {
  findMany(dealerId: string, filter: VehicleFilter) { … }   // required, first
  // There is no findMany(filter) overload. Public reads use a separate,
  // explicitly-named PublicListingsRepository.
}
```

**Layer 3 — PostgreSQL Row-Level Security as the backstop.**
```sql
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vehicles
  USING (dealer_id = current_setting('app.dealer_id', true)::uuid);
-- tx.ts issues: SET LOCAL app.dealer_id = '<uuid>' at transaction start
```
Two database roles: **`app_tenant`** (RLS enforced — all dealer-scoped work) and **`app_platform`** (`BYPASSRLS` — public marketplace reads, admin, jobs). This makes "which code path can see all tenants" an explicit, auditable choice rather than an accident.

Applied to: `vehicles`, `listings`, `media`, `enquiries`, `phone_reveals`, `photo_requests`.

**Layer 4 — Tests and audit.**
One integration test per tenant-owned resource: *Dealer A requests Dealer B's resource → **404***. Not 403 — 404, so existence isn't leaked. Every cross-tenant admin read is written to `audit_logs`.

**Sabotage check:** deleting `resolveDealer` from a router must turn at least three tests red. If it doesn't, your suite isn't testing isolation.

---

# 8. Authentication & authorization

## 8.1 Dealer auth — Google sign-in

> **Changed in r3, and this supersedes the OTP design below.** Dealers sign in
> with **Google** (OAuth 2.0 authorization code + PKCE + OIDC nonce). There is no
> dealer password, no email OTP and no mobile OTP anywhere in the product, and
> the `VerificationCode` flow sketched in this section was never built.
>
> The r2 reasoning still holds — *a credential that exists in the API but nowhere
> in the product is an attack surface with no user* — and Google sign-in takes it
> one step further: there is no dealer credential at all. It also takes DLT
> registration off the launch critical path, which the r2 note below correctly
> identified as the biggest schedule risk in the design.
>
> What replaced it, in one line each:
>
> * `OAuthIdentity(provider, providerSubject)` is the account. The email is
>   refreshed on every sign-in and never used to find anybody.
> * A verified identity with no `DealerMember` row is a `PendingPrincipal`, which
>   can reach `POST /v1/auth/onboarding` and nothing else.
> * Admins keep email + password (§8.2), **without** the mandatory TOTP this
>   document specifies — that is a deliberate deferral, not an oversight.
> * Phone numbers are still collected at onboarding. Nothing sends a code to one.
>
> `docs/API-SPEC.md` Part B is the implemented contract. Everything below is kept
> for the reasoning, and for the day an SMS channel is wanted again.

> **Changed in r2.** The previous design was email + phone + password. **There is no password field on any dealer screen in the UI.** Sign-in is one phone number and a six-digit code; the sign-in screen says so out loud: *"We send a one-time code — no password to remember."* A password field that exists in the API but nowhere in the product is an attack surface with no user.

```
SIGN UP                             screens/SignUpPage
POST /v1/auth/otp/start { phone, email, purpose: "SIGNUP" }
   └─ no User row is created yet — an unverified phone must not occupy the
      unique index, or a stranger can squat on a dealer's number
   └─ VerificationCode row keyed on `destination`, 10-min TTL

POST /v1/auth/otp/verify { phone, code, purpose: "SIGNUP" }
   └─ ONE transaction: User (phoneVerifiedAt = now)
                     + Dealer (DRAFT)
                     + DealerMember (OWNER)
                     + Session
   └─ email verification is dispatched but NEVER BLOCKS — the dealer lands on
      onboarding step 1 immediately (UI: authVerify → onboarding)
   → 201 { session set as cookie, next: "ONBOARDING" }

SIGN IN                             screens/SignInPage
POST /v1/auth/otp/start  { phone, purpose: "SIGNIN" }
   → 404 PHONE_NOT_REGISTERED  (the UI offers "Create a dealer account")
POST /v1/auth/otp/verify { phone, code, purpose: "SIGNIN" }
   → 200, session issued, next = "DASHBOARD" | "ONBOARDING" (if incomplete)

RESEND            POST /v1/auth/otp/resend
   60-second cooldown — the UI runs a visible countdown ("Resend OTP (00:24)")
   and disables the control until it hits zero. The server enforces it anyway.

EMAIL FALLBACK    the "Use email instead" ghost button
POST /v1/auth/otp/start { email, purpose: "SIGNIN" }   same flow, EMAIL channel

ADMIN             separate flow, unchanged
POST /v1/auth/admin/login { email, password }  → then /v1/auth/admin/2fa/verify
```

**Code policy.** 6-digit numeric · 10-minute TTL (the OTP screen states it) · **max 3 attempts** then the code is invalidated — the UI's error banner reads *"That OTP is incorrect or expired. Two attempts remaining."*, which only makes sense with a budget of 3 · only the SHA-256 hash is stored · a successful verify consumes the code and invalidates every other live code for that destination.

**Enumeration.** `otp/start` for SIGNIN returns 404 on an unregistered number because the UI needs to offer sign-up. This is an accepted, deliberate leak: it reveals only *"this number belongs to a dealer"*, which is already public on every one of that dealer's listings. `otp/verify` returns an identical generic error for wrong-code and expired-code.

**India / DLT:** transactional SMS requires DLT registration of the entity, a sender header, and each template — typically 3–10 working days, and it cannot be rushed. Start it before writing code. Because auth is now *entirely* OTP, DLT approval is on the critical path for launch, not a nice-to-have. `OTP_CHANNEL_FALLBACK=email` lets you ship sign-in over email if SMS approval is late.

**Rate limits (a spend control as much as a security control — every SMS costs real money):** 3 `otp/start` per phone/hour · 5 per email/hour · 10 per IP/hour · 30 verify attempts per IP/hour · a hard per-day platform SMS cap with an alert at 80%.

## 8.2 Sessions — opaque cookies, not JWT

| Concern | JWT | **Opaque session** |
|---|---|---|
| Suspend a dealer *now* | Needs a denylist — i.e. a database | `UPDATE sessions SET revoked_at = now()` |
| Permission changes take effect | Up to 15 min stale | Immediately |
| Implementation | Access + refresh rotation, reuse detection | ~250 lines |

```
Name      dd_session
Value     32 bytes CSPRNG, base64url   (only SHA-256 hash stored)
HttpOnly  true       Secure  true       SameSite  Lax
Domain    .dealers-drive.com             Max-Age   30 days (sliding)
```
Plus a double-submit CSRF token on every state-changing request. Session rotates on login and on any privilege change.

**Admins:** email + password, 12-hour sessions, harder rate limits, separate `/v1/auth/admin/login` flow. *(r3: implemented without the mandatory TOTP — the `totpSecret` and `totpEnabledAt` columns exist and are unused. Adding 2FA is a second verification step on an existing flow, not a redesign.)*

## 8.3 Permissions

```ts
export const PERMISSIONS = {
  'vehicle:read':    ['OWNER','MANAGER','SALES'],
  'vehicle:write':   ['OWNER','MANAGER'],
  'vehicle:delete':  ['OWNER','MANAGER'],
  'listing:submit':  ['OWNER','MANAGER'],
  'listing:renew':   ['OWNER','MANAGER'],            // ← r2
  'enquiry:read':    ['OWNER','MANAGER','SALES'],
  'enquiry:update':  ['OWNER','MANAGER','SALES'],    // ← r2 mark contacted / close / spam
  'photo:request':   ['OWNER','MANAGER'],
  'dealer:update':   ['OWNER'],
  'document:upload': ['OWNER'],                      // ← r2 KYC uploads
  'billing:read':    ['OWNER','MANAGER'],            // ← r2 see balance + history
  'billing:purchase':['OWNER'],                      // ← r2 spend money. OWNER only.
  'member:manage':   ['OWNER'],
  'admin:dealer:approve':   ['MODERATOR','SUPER_ADMIN'],
  'admin:document:review':  ['MODERATOR','SUPER_ADMIN'],   // ← r2
  'admin:listing:moderate': ['MODERATOR','SUPER_ADMIN'],
  'admin:media:upload':     ['MODERATOR','SUPER_ADMIN'],
  'admin:credit:grant':     ['SUPER_ADMIN'],               // ← r2 "Admin grant" ledger rows
  'admin:payment:read':     ['SUPPORT','MODERATOR','SUPER_ADMIN'],  // ← r2
  'admin:payment:refund':   ['SUPER_ADMIN'],               // ← r2
  'admin:config:write':     ['SUPER_ADMIN'],
} as const;
```

**The rule that prevents most authorization bugs:** the middleware checks *capability*; the service re-checks *ownership* **inside the transaction** that performs the write. Both, always — the guard is never the only check, and there is no TOCTOU gap.

---

# 9. API design

**REST + JSON.** One first-party client, heavy CDN caching needs, one developer. GraphQL costs a week and complicates caching and rate limiting; tRPC over-couples web to API and makes a future mobile client harder.

## 9.1 Routes

Base URL: **`https://api.dealers-drive.com`**. Full request/response JSON for every route below is in the companion document **`API-SPEC.md`**.

```
PUBLIC  (no auth, CDN-cacheable, IP rate-limited)
  GET    /v1/home                        homepage bundle: featured, body-type   ← r2
                                         counts, dealer strip, active total
  GET    /v1/vehicles                    list + filter + sort + paginate
  GET    /v1/vehicles/facets             facet counts for the filter panel
  POST   /v1/vehicles/batch              hydrate saved-car ids from localStorage ← r2
  GET    /v1/vehicles/:idOrSlug          detail payload
  GET    /v1/vehicles/:id/similar
  POST   /v1/vehicles/:id/reveal-contact rate limited, logged, captcha after 3
  GET    /v1/dealers                     directory
  GET    /v1/dealers/:slug
  GET    /v1/dealers/:slug/vehicles
  GET    /v1/dealers/:slug/facets        dealer-scoped filter counts           ← r2
  GET    /v1/cities                      active cities + live listing counts    ← r2
                                         (the header city dropdown)
  GET    /v1/catalog/bundle              makes+models+variants+rto+colors, 1h
  GET    /v1/config/public
  POST   /v1/enquiries                   guest lead, no account

AUTH                                                                        ← r2 rewritten
  POST   /v1/auth/otp/start              { phone|email, purpose }
  POST   /v1/auth/otp/verify             { phone|email, code, purpose }
  POST   /v1/auth/otp/resend
  POST   /v1/auth/logout
  GET    /v1/auth/me                     session + dealer + credit balance
  POST   /v1/auth/admin/login  |  /v1/auth/admin/2fa/verify

DEALER  (session + membership; dealerId ALWAYS from session, NEVER from the body)
  GET    /v1/dealer                      my dealer
  PATCH  /v1/dealer                      onboarding steps 1–3 write here
  GET    /v1/dealer/completeness         what's still missing (drives the stepper)
  POST   /v1/dealer/submit               DRAFT → PENDING_APPROVAL (onboarding step 4)
  GET    /v1/dealer/documents            KYC document rows + status              ← r2
  POST   /v1/dealer/documents/presign    { type } → direct-to-R2 PUT             ← r2
  POST   /v1/dealer/documents/:type/commit                                       ← r2
  DELETE /v1/dealer/documents/:type                                              ← r2
  GET    /v1/dealer/vehicles             cursor paginated, ?status=
  POST   /v1/dealer/vehicles             create draft
  GET    /v1/dealer/vehicles/:id
  PATCH  /v1/dealer/vehicles/:id         "Save draft" on every wizard step
  DELETE /v1/dealer/vehicles/:id         soft delete
  POST   /v1/dealer/vehicles/:id/submit  → Listing PENDING_REVIEW + credit HOLD
  POST   /v1/dealer/vehicles/:id/mark-sold
  POST   /v1/dealer/listings/:id/renew   EXPIRED → PENDING_REVIEW, new credit    ← r2
  POST   /v1/dealer/media/presign
  POST   /v1/dealer/media/:id/commit
  DELETE /v1/dealer/media/:id
  PUT    /v1/dealer/vehicles/:id/media/order
  GET    /v1/dealer/enquiries            ?status=NEW&cursor=                     ← r2
  GET    /v1/dealer/enquiries/counts     the four tab counts                     ← r2
  PATCH  /v1/dealer/enquiries/:id        mark contacted / close / spam / reopen  ← r2
  GET    /v1/dealer/billing/summary      balance + held + "1 credit = 90 days"   ← r2
  GET    /v1/dealer/billing/packs        the four purchasable packs              ← r2
  POST   /v1/dealer/billing/orders       → Razorpay order, opens Checkout        ← r2
  POST   /v1/dealer/billing/orders/:id/verify   client-side confirm handshake    ← r2
  GET    /v1/dealer/billing/ledger       credit history, cursor paginated        ← r2
  GET    /v1/dealer/billing/invoices     payment history table                   ← r2
  GET    /v1/dealer/billing/invoices/:id/pdf    302 → signed R2 URL              ← r2
  POST   /v1/dealer/photo-requests                                               🟡
  GET    /v1/dealer/photo-requests                                               🟡
  GET    /v1/dealer/dashboard            stats + 7-day view series + recent 4    ← r2

ADMIN
  GET    /v1/admin/metrics/overview      the six operations stat boxes           ← r2
  GET    /v1/admin/dealers?status=
  GET    /v1/admin/dealers/:id
  POST   /v1/admin/dealers/:id/approve | reject | suspend | reinstate
  GET    /v1/admin/dealers/:id/documents                                         ← r2
  POST   /v1/admin/documents/:id/verify | reject                                 ← r2
  POST   /v1/admin/dealers/:id/credits/grant   "Admin grant" ledger rows         ← r2
  GET    /v1/admin/listings?status=PENDING_REVIEW
  GET    /v1/admin/listings/:id          the full review-listing payload         ← r2
  POST   /v1/admin/listings/:id/approve
  POST   /v1/admin/listings/:id/reject           reason ≥ 6 chars, required
  POST   /v1/admin/listings/:id/request-changes  third moderation action         ← r2
  POST   /v1/admin/listings/:id/takedown
  GET    /v1/admin/payments              the Payments console section            ← r2
  GET    /v1/admin/payments/:id                                                  ← r2
  POST   /v1/admin/payments/:id/refund                                           ← r2
  GET    /v1/admin/photo-requests  |  PATCH /v1/admin/photo-requests/:id         🟡
  POST   /v1/admin/vehicles/:id/media    upload on a dealer's behalf
  GET    /v1/admin/audit-logs
  GET    /v1/admin/config  |  PUT /v1/admin/config/:key                          ← r2 UI

WEBHOOKS  (no session; HMAC signature verified; idempotent on gatewayEventId)
  POST   /v1/webhooks/razorpay                                                   ← r2

SYSTEM
  GET    /health/live  |  /health/ready
```

## 9.2 Conventions

**Versioning:** URL path `/v1`. Additive evolution preferred; `/v2` only for genuinely breaking changes.

**Pagination:**
| Endpoint type | Style | Why |
|---|---|---|
| Public vehicle search | Offset (`?page=2&limit=24`), capped at page 40 | SEO needs stable, linkable pages |
| Dealer inventory, admin lists | Cursor (opaque base64 over `createdAt,id`) | Stable under concurrent inserts, O(1) at depth |

**Filtering:** explicit whitelisted params only. Unknown params → **400**, never silently ignored (silent ignoring hides frontend bugs for months).

```
GET /v1/vehicles
  ?city=mumbai&make=toyota&model=fortuner
  &priceMin=1500000&priceMax=3500000
  &yearMin=2019&kmMax=60000
  &fuel=diesel,petrol            # CSV = OR within a facet
  &transmission=automatic&bodyType=suv
  &owners=1&seats=7&airbagsMin=6
  &color=white,silver            # colour family
  &rtoState=MH&rto=MH-01
  &dealer=sharma-motors
  &q=fortuner+4x2
  &sort=price_asc                # relevance|price_asc|price_desc|year_desc|km_asc|newest
  &page=1&limit=24
```

**Rate limits:**
| Endpoint | Limit | Key |
|---|---|---|
| `/v1/auth/otp/start` | 3 / hour (phone), 5 / hour (email), 10 / hour / IP | destination + IP |
| `/v1/auth/otp/resend` | 1 / 60s, 5 / hour | destination |
| `/v1/auth/otp/verify` | 30 / hour | IP |
| `/v1/enquiries` | 5 / hour (captcha after 2) | IP |
| `/v1/vehicles/:id/reveal-contact` | 10 / hour, 20 / day | IP |
| `GET /v1/vehicles*` | 120 / min | IP |
| `POST /v1/vehicles/batch` | 60 / min, max 100 ids per call | IP |
| Dealer writes | 60 / min | dealerId |
| `POST /v1/dealer/billing/orders` | 10 / hour | dealerId |
| `POST /v1/webhooks/razorpay` | unlimited, but signature-gated + idempotent | — |

---

# 10. Listing lifecycle & admin approval

**Every listing is reviewed by a human before it is visible.** This is a permanent product decision, not a config flag.

```
        ┌──────────┐  dealer edits
        │  DRAFT   │◀───────────────────────────┐
        └────┬─────┘                            │
             │ submit                           │
             │ guards: dealer ACTIVE · profile complete · vehicle
             │ complete · ≥6 images · creditBalance ≥ 1     ← r2
             │ effect: CREDIT HOLD (ledger −1, HOLD_SUBMIT)
             ▼                                  │
     ┌────────────────┐                         │
     │ PENDING_REVIEW │                         │
     └──┬──────┬──────┴──────┐                  │
  admin │      │ admin       │ admin            │
approve │      │ reject      │ request changes  │
        │      │ (reason)    │ (note)           │
        ▼      ▼             ▼                  │
 ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
 │ APPROVED │ │ REJECTED │ │ CHANGES_REQUESTED│ │
 │ +90 days │ │ credit   │ │  credit STAYS    │ │
 │ credit   │ │ RELEASED │ │  held            │ │
 │ CONSUMED │ └────┬─────┘ └────────┬─────────┘ │
 └────┬─────┘      │                │           │
      │            └────────────────┴───────────┘
      │                    dealer fixes → resubmit → PENDING_REVIEW
      │
 ┌────┼─────┬──────────┬──────────┐
 ▼    ▼     ▼          ▼          ▼
SOLD EXPIRED REMOVED  (admin takedown)
      │
      └─▶ renew (a fresh credit) ─▶ PENDING_REVIEW
```

**Transition rules**
- `Listing.status` appears in **no** dealer-writable DTO. Zod schemas are `.strict()`, so a dealer posting `{"status":"APPROVED"}` gets a 400, not a silent success. This is the primary defence.
- Transitions go through `transition(listing, event, actor)` which validates source state **and** actor authority. Assignment is never used.
- **Every transition that touches a credit does so in the same database transaction as the status change**, with `SELECT … FOR UPDATE` on the dealer row. A listing that is APPROVED without a matching `CONSUME_APPROVE` ledger row, or a REJECTED listing still holding a credit, is a data-integrity bug that the nightly reconciliation alerts on.
- Approval publishes `ListingApproved` → index into `listing_search` → revalidate pages → email dealer. All via the outbox (§19), all asynchronous, none able to roll back the approval.
- Rejection requires a free-text reason of **≥ 6 characters** — the reject dialog's confirm button stays disabled below that. The reason is stored and shown **verbatim** as a red banner at the top of the dealer's inventory with an `Edit & resubmit` action. A dealer must never have to hunt for why their car was rejected.
- **`REQUEST_CHANGES` (r2)** is the third moderation action in the review screen. It differs from rejection in exactly two ways: the credit stays held, and the dealer's banner is amber rather than red. Use it for "reshoot the odometer photo", reserve rejection for "this listing should not exist".

**Expiry (r2).** The billing screen states the contract plainly: *"One credit publishes one vehicle for 90 days."* On approval, `expiresAt = approvedAt + 90 days`. A nightly job moves `APPROVED` listings past `expiresAt` to `EXPIRED`, removes them from `listing_search`, and revalidates the affected pages. The dealer is emailed at T−7 days and T−1 day (idempotent via the `expiryWarned*` flags). Renewal costs a fresh credit and re-enters `PENDING_REVIEW` — never straight to `APPROVED`, because 90-day-old photos and a 90-day-old price both deserve a second look.

**Automatic flags** shown on the moderation card (advisory, never auto-rejecting): fewer than 6 images · price far outside the band for that model/year · a phone number or URL in the description · implausible km for the year · duplicate image hash against another dealer.

**Photo minimum is 6, not 5 (r2).** The wizard's step 3 says *"Minimum 6 photos. The first is the primary image buyers see in results."* and lays out four named slots (Primary / Rear / Interior / Odometer) plus a drop tile. The submit guard, the Zod schema, the advisory flag and the copy must all agree on 6 — this is exactly the kind of number that drifts between three files and produces a submit button that fails with no visible reason.

**Throughput:** at 30 dealers × 3 cars/week that's ~90 reviews/week. The queue is a **card view with keyboard shortcuts** (A approve, R reject, S skip, arrows to navigate) with claim-on-open for 5 minutes. Moderating 90 listings a week with a mouse is misery, and you will stop doing it. Publish a "reviewed within 24 hours" SLA and alert when the queue exceeds 50 pending.

---

# 11. Search architecture

Postgres is sufficient to roughly **200,000 active listings** (≈ 20,000 dealers) at p95 under 150ms. You will not outgrow it in this phase.

## 11.1 The denormalized read model

Never query `vehicles` joined to five tables on every request. Maintain `listing_search`, updated by event subscribers:

```sql
CREATE TABLE listing_search (
  listing_id      uuid PRIMARY KEY,
  vehicle_id      uuid NOT NULL,
  dealer_id       uuid NOT NULL,
  dealer_name     text NOT NULL,
  dealer_slug     text NOT NULL,
  make_slug text, model_slug text, variant_slug text,
  make_name text, model_name text, variant_name text,
  year int, price_paise bigint, km int,
  fuel text, transmission text, body_type text, owner_number int,
  seats int, airbags int,
  color_slug text, color_family text,
  rto_code text, rto_state text,
  city_slug text, city_name text, lat float8, lng float8,
  features text[],
  primary_image_key text, primary_blurhash text,
  approved_at timestamptz,
  search_doc tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(make_name,'')),  'A') ||
    setweight(to_tsvector('simple', coalesce(model_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(variant_name,'')),'B') ||
    setweight(to_tsvector('simple', coalesce(city_name,'')),  'C') ||
    setweight(to_tsvector('simple', coalesce(dealer_name,'')),'D')
  ) STORED
);

CREATE INDEX ON listing_search USING GIN (search_doc);
CREATE INDEX ON listing_search USING GIN (features);
CREATE INDEX ON listing_search (city_slug, price_paise);
CREATE INDEX ON listing_search (make_slug, model_slug, year);
CREATE INDEX ON listing_search (price_paise, approved_at DESC);
CREATE INDEX ON listing_search (color_family);
CREATE INDEX ON listing_search (rto_state, rto_code);
CREATE INDEX ON listing_search (seats);
CREATE INDEX ON listing_search (airbags);
CREATE INDEX ON listing_search USING GIN (
  (make_name || ' ' || model_name) gin_trgm_ops);   -- typo tolerance
```

Only `APPROVED` listings from `ACTIVE` dealers ever enter this table. That single rule is the whole visibility model, and it has its own test. **`PENDING_REVIEW`, `CHANGES_REQUESTED`, `REJECTED`, `EXPIRED`, `SOLD` and `REMOVED` are all invisible to buyers** — they never appear in search, on the homepage, on a portfolio, in a facet count, in the city dropdown's counts, or in a saved-cars hydration response. A buyer who saved a car that later expired sees it drop out of their saved list; `POST /v1/vehicles/batch` returns it in an `unavailable` array rather than 404-ing the whole request.

**Every count in the product is derived from this table** — cars available, per-city counts, body-type tile counts, filter facet counts, dealer inventory counts, "from ₹x". None is ever stored or hard-coded (DESIGN-SPEC §4.11).

## 11.2 The seam

```ts
interface SearchPort {
  search(q: VehicleQuery): Promise<Page<VehicleSummary>>;
  facets(q: VehicleQuery): Promise<FacetCounts>;
  suggest(term: string): Promise<Suggestion[]>;
  index(listingId: string): Promise<void>;
  remove(listingId: string): Promise<void>;
}
```

`PostgresSearchAdapter` implements it now. `TypesenseSearchAdapter` implements it later. **No Postgres concept may leak through this interface** — that's what makes the migration a one-line provider change. Write it on day one even with a single implementation.

**Facet counts** come from a single `GROUPING SETS` query, not thirteen round trips, cached 60s. Options with count 0 are **disabled but visible** — hiding them makes users think the filter is broken.

**Free text** uses `websearch_to_tsquery` with a `similarity()` trigram fallback. "fortunar" must find Fortuners.

**Migration trigger:** >100k listings, or p95 search over 300ms after index tuning, or typo tolerance measurably costing conversions → Typesense Cloud (~$50–250/mo, near-zero ops). Not Elasticsearch — that needs a dedicated engineer to tune.

---

# 12. Media architecture

Images are simultaneously your biggest conversion lever, your largest infrastructure cost, and your largest upload attack surface.

## 12.1 Pipeline

```
1. Dealer selects images (max 20, 10MB each)
2. CLIENT-SIDE pre-compression: longest edge → 2400px, quality 0.85
   An 8MB phone photo leaves the device at ~600KB. This alone cuts
   upload failures and bandwidth by ~85%.
3. POST /v1/dealer/media/presign
   validates mime allowlist, size cap, per-dealer quota, rate limit
   → Media row (PENDING, dealerId FROM SESSION)
   → presigned PUT, 5-min expiry, content-type AND content-length
     conditions baked into the signature
4. Browser PUTs DIRECTLY to R2. The API never touches image bytes.
   Key: dealers/{dealerId}/{ownerType}/{ownerId}/{mediaId}/original.jpg
5. POST /v1/dealer/media/:id/commit
   HEAD the object, verify size + content-type match the presign
   → enqueue media.process
6. Worker (sharp):
   verify magic bytes against declared mime  → mismatch = FAILED + alert
   FULLY RE-DECODE  ← the security step; never transform in place
   auto-orient from EXIF, then STRIP ALL EXIF
       (GPS coordinates of a dealer's yard are PII)
   derivatives: 320/640/1024/1600px × {webp, avif}, never upscale
   blurhash/LQIP placeholder
   quality flags: too small (<800px), too dark, extreme aspect ratio
   → status READY
7. Delivery: img.dealers-drive.com (Cloudflare) → R2 origin
   Cache-Control: public, max-age=31536000, immutable
   (content-addressed URLs — new upload = new id = new URL = no invalidation)
```

## 12.2 Details that matter

| Concern | Handling |
|---|---|
| Orphaned uploads | Nightly job: delete `PENDING` older than 24h and `ORPHAN` older than 30d, from database and storage. Weekly reconciliation lists storage keys with no `Media` row. |
| Ordering | `VehicleMedia.position`. Reorder sends the **full ordered array** (idempotent, no partial-swap bugs). Drag on desktop, up/down buttons on mobile — touch drag is unreliable and dealers are often one-handed. |
| Primary image | `Vehicle.primaryMediaId`, denormalized so cards need no join. |
| Upload security | Never trust `Content-Type`. Magic-byte check plus **mandatory re-encode** — the only reliable defence against polyglot files. Served from a **separate domain** so a stored payload cannot execute in your origin. |
| HEIC | iPhone photos arrive as HEIC. Convert client-side where supported, server-side otherwise. |
| Cost | R2's **zero egress** is the decisive factor: at 1M sessions × 15 images × 150KB ≈ 2.2 TB/month, S3+CloudFront costs ~$190/mo and R2 costs $0. |

---

# 13. Photo request service

> **🟡 Status after r2: backend in scope, no UI designed.** The 20 screens contain no photo-request surface — not in the add-vehicle wizard's empty-photos state, not on inventory, not in the dealer sidebar, and not in the admin console's five nav items. Either the screens are missing or the feature is out of the MVP. **This is the one open product decision in this document and it needs an answer before sprint planning** (§27, row 20). Until then: build the endpoints and the admin list, ship no dealer-facing entry point.

Dealers take bad photos. This is the highest-friction point in onboarding, and solving it is a genuine differentiator — and a future revenue line.

**Deliberately manual.** No scheduling engine, no photographer app, no payment.

```
Dealer  POST /v1/dealer/photo-requests
        { vehicleId?, vehicleCount, address, contactName,
          contactPhone, preferredDate?, notes? }
        → REQUESTED   (entry points: the empty-photos state in the wizard,
                       and the inventory page)

Admin   /admin/photo-requests — list by status, dealer, city, date
        PATCH → SCHEDULED (with a date)  → dealer emailed
        shoot happens
        POST /v1/admin/vehicles/:id/media  ← admin uploads onto the
             dealer's vehicle through the normal media pipeline
             (Media.uploadedByAdmin = true, audit-logged with admin identity,
              shown in the dealer UI as "added by Dealers-Drive")
        PATCH → COMPLETED → dealer emailed with a link to review
```

Behind a config flag so you can switch it off if volume overwhelms you. Capped per dealer per week from config. Record what you *would* have charged in `adminNote` — that's your month-3 pricing data.

Also ship a short **"how to photograph a car"** guide page: 8 bullets, example angles, free. It will reduce the number of shoots you personally have to do.

---

# 14. Leads & contact

**Without this the platform is a catalog, not a marketplace, and dealers get nothing.**

## 14.1 Phone reveal — anti-scraping

Dealer phone numbers must **never** appear in initial HTML or in any public API response body. Verify by curling a VDP and grepping.

```
POST /v1/vehicles/:id/reveal-contact
  → returns the number, writes a PhoneReveal row
  → rate limited: 10/hour and 20/day per IP
  → captcha after the third reveal from an anonymous IP
  → >20/day from one IP: blocked and flagged
```

One click for a legitimate user — no modal, no login wall. This single measure stops ~95% of competitor scraping, and your dealers' phone numbers are exactly what a competitor wants.

## 14.2 Enquiry form

Inline on the VDP, **not a modal** — modals lose leads. No account required.

```
POST /v1/enquiries { vehicleId?, dealerSlug?, name, phone, email?, message?, source }
  honeypot field · per-IP and per-phone rate limits
  duplicate suppression (same phone + vehicle within 24h returns the existing row,
    with the SAME reference, and does not re-notify the dealer)
  phone normalized to E.164
  → 201 { reference: "DD-EN-40912", dealer: { name, slug }, vehicle: {...}|null }
```

**`vehicleId` is optional (r2).** The dealer portfolio's `Enquire with dealer` button sends a lead with `dealerSlug` and no vehicle. Exactly one of `vehicleId` / `dealerSlug` must be present; the schema enforces it with a refinement, and the dealer's inbox renders the vehicle-less card without the "On <vehicle>" line.

**The reference is shown to the buyer.** The success screen reads *"Your enquiry reference is DD-EN-40912."* — it is the only handle a buyer without an account has on their own enquiry, so it must be short, speakable over a phone, and stable.

## 14.3 Enquiry lifecycle (r2 — new)

The dealer inbox is a worklist, not a log. Four counted tabs, and every card carries three actions.

```
        POST /v1/enquiries  or  a phone reveal
                     │
                     ▼
                 ┌───────┐   PATCH {status:"SPAM"}    ┌──────┐
                 │  NEW  │ ─────────────────────────▶ │ SPAM │
                 └───┬───┘                            └──┬───┘
     "Mark contacted"│                                   │ reopen
                     ▼                                   │
              ┌────────────┐                             │
              │ CONTACTED  │◀────────────────────────────┘
              └─────┬──────┘
             "Close"│
                    ▼
              ┌──────────┐
              │  CLOSED  │  (reopen → CONTACTED)
              └──────────┘
```

- `PATCH /v1/dealer/enquiries/:id { status, closeReason? }` — the only mutation. Transitions are validated; `CLOSED → NEW` is not a legal move.
- `contactedAt` is stamped on the first `NEW → CONTACTED` and never overwritten. It is the input to `Dealer.medianResponseMins`, which the public portfolio displays as *"Response time · < 2 hrs"* — so a dealer who never touches the inbox degrades their own public stat. That feedback loop is intentional.
- Tab counts come from `GET /v1/dealer/enquiries/counts`, a single grouped query, not four list calls.
- `SPAM` enquiries are excluded from `Listing.enquiryCount`, from the dashboard's "New enquiries" stat, and from the response-time median.

## 14.4 A phone reveal is a lead (r2)

`POST /v1/vehicles/:id/reveal-contact` writes **two** rows in one transaction: a `PhoneReveal` (rate limiting, abuse analysis, never shown to dealers) and an `Enquiry` with `source = CALL_BUTTON`, `message = null`, `name = "Caller"` when the buyer gave none. §14.5 already asserted that reveals count as leads; the inbox makes it visible — one of the four cards on the enquiries screen carries a `Call button` source chip.

Deduplication is per `(phone-or-ip, vehicleId)` within 24 hours, so a buyer who taps *Call dealer* three times produces one lead, not three.

## 14.5 The 30-second rule

`EnquiryCreated` → **highest-priority queue** → dealer email with buyer name, tappable phone, vehicle thumbnail and a direct link. Target p95 under 30 seconds; alert if it exceeds 60.

**This is the single most important message the system sends.** Speed-to-contact is the metric dealers judge you on, and it's the one they'll compare against every other portal.

Both reveals **and** enquiries count as leads in dealer stats — for many dealers the reveal is the better signal.

---

# 15. Frontend architecture

> **Server by default. Client only for interactivity that cannot be expressed as a URL.**

RSC is not a stylistic preference here — it's how you get sub-1s LCP on pages Google will crawl without shipping a filter engine to every phone.

## 15.1 Server vs client

| Concern | Rendering | Why |
|---|---|---|
| Homepage | RSC + ISR 5 min | SEO, near-static |
| `/cars` | RSC + ISR 60s + SWR | SEO-critical; filters live in the URL so every state is server-renderable |
| Filter panel | **Client**, writes to URL via `router.replace` | Instant feedback + shareable, indexable URLs |
| Vehicle detail | RSC + ISR 5 min | SEO-critical |
| Image gallery | **Client** | Swipe, zoom, lightbox, keyboard |
| Enquiry form | Server Action + client validation | Progressive enhancement; works without JS |
| Dealer page | RSC + ISR 10 min | SEO |
| Dealer dashboard | RSC shell + client tables | Auth'd, `no-store`, no SEO value |
| Vehicle wizard | **Client** (react-hook-form + Zod) + Server Action submit | Complex multi-step form with uploads |
| Image uploader | **Client** | Direct-to-R2 with progress |
| Admin | Client-heavy | Dense tables, bulk actions, no SEO |
| Auth / OTP pages | Server Actions | Cookies must be set server-side; the OTP cells and the resend countdown are a small client island |
| Billing screen | RSC shell + client Checkout island | The pack grid and history render server-side; only the Razorpay Checkout handshake is client |
| Enquiry inbox | RSC shell + client tabs | Tab counts arrive with the shell; switching tabs is a client fetch, not a navigation |

## 15.2 State management — you need much less than you think

| State | Solution | Not this |
|---|---|---|
| Public server data | RSC `fetch` + Next cache | Redux, React Query |
| Dashboard mutable data | TanStack Query in client components | Redux |
| Search / filter state | **URL search params** | Any store — URL state is free SEO, free sharing, free back-button |
| Forms | react-hook-form + Zod | — |
| Ephemeral UI | `useState` | — |
| Session | RSC context from cookie, passed down | Client auth store |
| Saved cars, recently viewed | `localStorage` (ids only) + a small Zustand store, hydrated via `POST /v1/vehicles/batch` | Server state (no buyer accounts) |
| Dealer credit balance | TanStack Query, invalidated after submit / purchase / approval | A store — it changes server-side and must be re-read |

**No Redux. No global store.** If you're reaching for one, the state probably belongs in the URL.

## 15.3 The build-once rule for the frontend

**Ban `NEXT_PUBLIC_*` environment variables entirely.**

They are inlined at build time, which would force a separate image per environment and break build-once-promote-many (§20). Instead: read `process.env` in a server component at runtime and pass config down to client components as props or through a context provider.

```tsx
// app/layout.tsx — server component, reads env at RUNTIME
export default async function RootLayout({ children }) {
  const publicConfig = {
    mediaBaseUrl: process.env.MEDIA_BASE_URL!,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY!,
    environment: process.env.APP_ENV!,        // "dev" | "production"
  };
  return (
    <html><body>
      <ConfigProvider value={publicConfig}>{children}</ConfigProvider>
    </body></html>
  );
}
```

One image, promoted unchanged from dev to production. This is why the rule exists.

## 15.4 Performance budget (enforced in CI with Lighthouse CI)

| Metric | Target |
|---|---|
| LCP (mobile, listing page) | < 2.0s |
| INP (filter interactions) | < 200ms |
| CLS | < 0.05 |
| JS shipped, public pages | < 120KB gzipped |
| Above-the-fold images | 1, `priority`, AVIF, blurhash placeholder |

---

# 16. Design system

## 16.1 Thesis

Every used-car marketplace looks like a discount retailer — loud yellow, red urgency badges, sale ribbons. That's right for a company selling its own cars at a margin. It's wrong here, because the promise is different:

> **Dealers-Drive is infrastructure. The dealer is the merchant; we are the rails.**

So the identity reads **civic and engineered**, not promotional. Closer to a transit system or a payments company than a showroom banner. The dealer's brand is the colour on the page; ours is the frame around it.

## 16.2 The signature element — the plate

One memorable device, drawn from the subject's own world: the **registration plate**. A bordered badge with a coloured band on the left and wide, tabular characters in the field. Instantly automotive without drawing a car.

It appears in exactly four places, and nowhere else:
1. The logo (a plate containing the DD monogram)
2. The year badge on every vehicle card
3. The verified-dealer chip
4. The price block on the detail page

Everything else is quiet: flat surfaces, one border colour, generous whitespace, no gradients, one elevation step. **Spend the boldness in one place.**

## 16.3 Tokens

```css
/* ── COLOUR ─────────────────────────────────────────────────────── */
--dd-ink-900:      #0A0E1A;   /* asphalt night — headings, dark surfaces */
--dd-ink-700:      #1B2233;
--dd-ink-500:      #3D4759;   /* body text */
--dd-ink-300:      #6B7688;   /* secondary */
--dd-ink-100:      #A8B1C0;   /* disabled */

--dd-cobalt-700:   #142BA8;   /* pressed */
--dd-cobalt-600:   #1B39D6;   /* PRIMARY — buttons, links, the plate band */
--dd-cobalt-500:   #3554EE;   /* hover */
--dd-cobalt-100:   #E4E9FE;   /* tinted backgrounds, selected chips */

--dd-plate:        #F2B705;   /* SIGNATURE AMBER — plate accents ONLY */
--dd-plate-ink:    #4A3600;

--dd-verified:     #0FA968;
--dd-warn:         #C97A00;
--dd-danger:       #D42B21;

--dd-surface:      #FFFFFF;
--dd-surface-sub:  #F4F6F9;   /* page background — cool, not cream */
--dd-surface-sunk: #EBEFF5;   /* skeletons, wells */
--dd-border:       #DDE3EC;   /* the ONE border colour */
--dd-border-strong:#C3CCDA;

--dd-dark-bg:      #070A12;   /* dashboard dark mode */
--dd-dark-surface: #101725;
--dd-dark-border:  #212B3E;

/* ── TYPE ───────────────────────────────────────────────────────── */
--font-display: 'Cabinet Grotesk', 'Inter', system-ui;   /* squared terminals */
--font-ui:      'Inter', system-ui;                      /* dense data UI */
--font-plate:   'Archivo', 'Inter';                      /* wide, uppercase */

/* scale — 1.200 minor third, tightened at display sizes
   display  clamp(2.25rem,4vw,3.5rem) /1.05  700  -0.03em  display
   h1       2.0rem    /1.15  700  -0.02em   display
   h2       1.5rem    /1.25  650  -0.015em  display
   h3       1.25rem   /1.3   600  -0.01em   ui
   body-lg  1.0625rem /1.6   400   0        ui
   body     0.9375rem /1.55  400   0        ui
   sm       0.8125rem /1.45  400   0        ui
   label    0.75rem   /1.3   600   0.06em   ui     UPPERCASE
   plate    0.875rem  /1     700   0.08em   plate  UPPERCASE tabular   */

/* PRICES ALWAYS font-variant-numeric: tabular-nums.
   A column of misaligned prices is the fastest way to look untrustworthy. */

/* ── SPACING (4px base) ─────────────────────────────────────────── */
--space-1:4  -2:8  -3:12  -4:16  -5:20  -6:24  -8:32  -10:40
--space-12:48 -16:64 -20:80 -24:96      (px)

/* ── RADIUS ─────────────────────────────────────────────────────── */
--radius-sm:4  --radius-md:8  --radius-lg:12  --radius-xl:16
--radius-plate:6  --radius-full:9999

/* ── ELEVATION — two steps, that's all ──────────────────────────── */
--shadow-1: 0 1px 2px rgb(10 14 26 / .06), 0 1px 3px rgb(10 14 26 / .04);
--shadow-2: 0 8px 24px rgb(10 14 26 / .10);   /* modals, dropdowns only */
/* Cards use --dd-border, NOT shadows. Borders read engineered;
   shadows read consumer-app default. */

/* ── MOTION ─────────────────────────────────────────────────────── */
--ease: cubic-bezier(.2,.8,.2,1);
--dur-fast:120ms  --dur-base:200ms  --dur-slow:320ms
/* prefers-reduced-motion: reduce → all 0ms */
```

**Grid:** 12 columns · 24px gutter · 1280px max content · page padding 16/24/32px.
**Breakpoints:** `sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1536`.

## 16.4 Components

```
components/
├── ui/          PRIMITIVES. No business logic, no API imports, no domain types.
│                Button Input Select Checkbox Radio Switch Card Badge Plate
│                Dialog Sheet Popover Tooltip Tabs Skeleton Toast Pagination
│                Table RangeSlider
├── layout/      Header Footer PageShell DealerShell AdminShell Breadcrumb
├── vehicle/     VehicleCard VehicleGrid Gallery SpecTable PriceBlock
│                ConditionBadge VehicleCardSkeleton
├── dealer/      DealerBadge DealerHeader DealerCard
├── search/      FilterPanel FacetGroup PriceRange ColorSwatchGrid
│                SortSelect ActiveChips
└── forms/       VehicleForm EnquiryForm ImageUploader PhotoRequestForm
                 field wrappers
```

**The discipline that makes `ui/` promotable to `packages/ui` later:** anything in it must be importable with zero knowledge of Dealers-Drive. If a component in `ui/` imports a `Vehicle` type, it belongs in `vehicle/` instead. Enforce with ESLint.

| Component | Key spec |
|---|---|
| **VehicleCard** | 4:3 image, blurhash placeholder, year **Plate** top-left. Title (2-line clamp), spec row (`42,000 km · Diesel · Automatic · 1st owner`), price in tabular numerals, then a **1px divider** and the **dealer strip** — logo, brand name, location. The divider matters: it visually says "this car belongs to that dealer." **The dealer strip appears on every card, without exception. That is the product.** |
| **DealerBadge** | 20/28/40px logo, monogram fallback on a pastel deterministically derived from the dealer id. |
| **FilterPanel** | Desktop: sticky 280px rail. Mobile: bottom sheet with a live "Apply (128 cars)" count. Groups ordered most-used first — budget, make/model, year, km, fuel, transmission, body, owners, colour, seats, airbags, RTO, dealer. Collapse colour/seats/airbags/RTO by default; thirteen expanded groups is a wall. Count-0 options disabled but visible. |
| **PriceRange** | Dual-thumb slider **plus** two numeric inputs. Slider alone is unusable across ₹50k–₹1cr; inputs alone feel clumsy. Both. |
| **Plate** | The signature. Configurable band colour, size and content slot. |
| **Empty states** | Every list has one: line-art illustration, one sentence naming what's missing, one primary action. |
| **Skeletons** | Match real layout dimensions exactly, or you trade one CLS for another. |

## 16.5 Brand

**Mark: "The Plate."** A rounded rectangle with a solid cobalt band on the left edge and the DD monogram in the field, plus a small amber square on the band. Unmistakably automotive, no cliché (no wheels, no speed lines), works at 16px, and extends into a system rather than sitting inertly in a corner.

```svg
<svg viewBox="0 0 128 64" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="Dealers-Drive">
  <rect x="1.5" y="1.5" width="125" height="61" rx="8"
        fill="#FFFFFF" stroke="#0A0E1A" stroke-width="3"/>
  <path d="M1.5 9.5A8 8 0 0 1 9.5 1.5H30v61H9.5a8 8 0 0 1-8-8Z" fill="#1B39D6"/>
  <rect x="12" y="46" width="6" height="6" rx="1" fill="#F2B705"/>
  <text x="76" y="45" text-anchor="middle" font-family="Archivo, Inter, sans-serif"
        font-size="34" font-weight="700" letter-spacing="1" fill="#0A0E1A">DD</text>
</svg>
```

**Wordmark:** "Dealers-Drive" in Cabinet Grotesk SemiBold, −2% tracking, hyphen set in cobalt.
**Favicon (16px):** plate silhouette + band only, drop the DD.
**Dark variant:** white outline, transparent field, cobalt band, white DD. Never invert the amber.
**Don'ts:** no gradients, no shadows, no stretching, no rotating the plate, no recolouring the band.

**Voice:** plain verbs, sentence case, numbers over adjectives — "340 verified dealers," not "India's most trusted."

---

# 17. SEO

Organic search is how buyers find "used Fortuner in Mumbai," and organic traffic is how you convince dealers your listings are worth paying for. Budget real engineering time.

## 17.1 URLs

```
/                                    Homepage
/cars                                All inventory
/car/{year}-{make}-{model}-{variant}-{city}-{6charId}     Detail page
/dealers                             Directory
/dealers/in/{city}
/dealers/{slug}                      Dealer storefront
```

🟡 **Facet landing pages** (`/cars/in/mumbai/toyota/fortuner`) are deferred to month 3, when you have the inventory depth to justify them. Build `lib/url.ts` now with canonical facet ordering (city → make → model → year) so adding them later is routing, not a rewrite.

## 17.2 Indexing policy — one resolver, used everywhere

Index bloat is what destroys marketplaces: 13 facets × 20 values = millions of thin near-duplicate pages, and Google burns your crawl budget on them instead of your real pages.

| URL | Index? | Canonical |
|---|---|---|
| `/`, `/cars`, `/dealers`, `/dealers/in/{city}` | ✅ index, follow | self |
| `/cars?page=2..40` | ✅ index, follow | self |
| Any URL with **filter query params** | ❌ `noindex,follow` | clean `/cars` path |
| Any URL with tracking params | — | clean path |
| `/car/{slug}` — live | ✅ index | self |
| `/car/{slug}` — sold >30 days | ❌ `noindex,follow` | self |
| `/dealers/{slug}` | ✅ if ACTIVE **and** ≥1 live listing | self |
| `/dealer/*`, `/admin/*`, `/api/*` | ❌ robots.txt disallow + noindex | — |

Implement as a **single function** — given a route and its result count, return `{index, follow, canonical}` — called by every `generateMetadata`. One place, so the policy cannot drift between routes.

## 17.3 Structured data

`Vehicle` + `Offer` + `AutoDealer` on the detail page (this produces the rich results), `AutoDealer` on dealer pages, `BreadcrumbList` everywhere, `ItemList` on listing pages, `Organization` + `WebSite` with `SearchAction` on the homepage.

**Never emit structured data that contradicts the visible page.** No fake ratings, no prices differing from the displayed price — that's a manual-action risk.

## 17.4 The rest

| Item | Approach |
|---|---|
| Titles | Distinct, under 60 chars, lead with intent: "2021 Toyota Fortuner 4x2 AT — ₹28.5 Lakh \| Mumbai" |
| Descriptions | Generated from **real attributes**, varied across a few sentence patterns. Never one template with slots — that's the fastest route to a thin-content penalty. |
| Sitemaps | Index + sharded children (static, dealers, vehicles at 50k per shard), regenerated hourly, **accurate `lastmod`** (lying gets your sitemap deprioritised). Only indexable URLs. |
| Sold cars | Keep the page, mark it sold, show similar vehicles, `noindex` after 30 days. **Never 404 a URL Google has indexed.** |
| Duplicate content | The same model listed by 50 dealers = 50 similar pages. Mitigate with genuinely unique data — this car's photos, km, owner count, dealer — and require dealer descriptions of at least 100 characters. |
| Internal linking | Every detail page links to its dealer page and 6 similar vehicles. This is how crawl equity reaches deep pages. |
| Images | Descriptive `alt`: "2021 Toyota Fortuner 4x2 AT front view — Sharma Motors, Mumbai" |

---

# 18. Caching

Layers, cheapest and closest to the user first. Layers 0–3 cover ~95% of traffic. **No Redis in this phase.**

```
L0  Browser        immutable assets, images        1 year
L1  Cloudflare CDN HTML for public pages, images   60s – 1 year
L2  Next.js ISR    RSC payloads, fetch cache       60s – 1 hr + on-demand
L3  In-process LRU catalog, platform config        5 min, version-checked ≤10s
L4  CachePort      rate-limit windows, config version  — (postgres · memory)
L5  PostgreSQL     listing_search denormalized     —
```

| Content | Layer | TTL | Invalidation |
|---|---|---|---|
| Homepage | CDN + ISR | 5 min | time |
| `/cars` | CDN + ISR | 60s + `stale-while-revalidate=300` | time |
| Vehicle detail | ISR | 5 min | **on-demand** on `ListingApproved`, `ListingRemoved`, `VehicleSold`, price change |
| Dealer page | ISR | 10 min | on-demand on dealer update |
| Search results with filters | **not CDN-cached** (too many permutations) | — | facet counts cached 60s at L3 |
| Catalog bundle | L3 + CDN | 1 hr | admin write |
| Images / derivatives | CDN | 1 year `immutable` | never — content-addressed URLs |
| Dealer dashboard, admin | **never** — `no-store` | — | — |

**Preference order for invalidation:** time-based with SWR (default) → content-addressed immutability → event-driven on-demand revalidation (only where staleness is user-visible and embarrassing). If you can't name the event that invalidates an entry, use a short TTL instead.

⚠️ **Audit every cached route for accidental personalization.** A cached page containing one user's data served to another is the single most dangerous bug in this build. Add a test asserting no response carrying `Set-Cookie` is cacheable.

## 18.1 L4 — the `CachePort`, and why it is not Redis

Cross-instance rate limiting is no longer a future need; it was a live defect. A fixed window counted in a `Map` counts one process's requests, so behind N tasks every configured limit permits N times what it says — and nothing errors. For the phone-reveal limit that is a **spend control failing open**: each reveal costs an SMS (§9.2).

The port (`apps/api/src/platform/cache/cache.port.ts`) holds two things, and only two:

| What | Why it cannot be process-local |
|---|---|
| Rate-limit windows | N tasks each counting to 5 permit 5N |
| The platform-config version | The writer drops *its* cache; the other N−1 tasks serve stale values until their TTL expires |

Two adapters ship:

- **`memory`** — a `Map`. Correct for exactly one process: `pnpm dev` and the test suite. `env.ts` **refuses it in production**, because the failure is silent rather than loud.
- **`postgres`** — the database the API already has. `increment` is a single `INSERT … ON CONFLICT DO UPDATE` with two `CASE` expressions, so it is atomic without a transaction or a row lock: whichever concurrent request wins the conflict evaluates `reset_at <= now()` against the row as it exists at that instant, and a stale window resets to 1 exactly once.

**Why not Redis.** Redis is a second datastore to provision, secure, monitor and pay for, in a VPC that currently contains one — and what is being stored is a counter that may be lost without consequence beyond a window resetting early. Postgres is already there, already backed up, already on the readiness check, and already the thing the request cannot proceed without. The cost is one small write per rate-limited request, which at 120/min/IP is nothing next to the query the request is about to run anyway.

**Redis trigger (unchanged in kind, changed in urgency):** when a counter write per request stops being free — session lookups > 2k/s, or the counter table showing up in the slow log. The port mentions no SQL, no table, no key prefix and no connection, so `createRedisCache()` is a new file and one line in `factory.ts`.

**Two properties that are deliberate:**

- **The limiter fails open.** If the backend is unreachable the request proceeds and a warning is logged. A limiter that cannot count is a limiter with no opinion, and turning a database blip into a site-wide 429 converts a degraded dependency into an outage.
- **The cache never holds the truth.** It holds counters and a version number. `PlatformConfig` values live in the table; the cache only says *when* the table last changed. A cache that could disagree with the database would be a second source of truth.

Expired windows are reclaimed by `cache.sweep-counters`, scheduled hourly — expired rows are already treated as absent, so this is space, not correctness. Hourly rather than nightly because a busy day writes one row per rate-limited request, and a full day of them makes the sweep itself the largest delete the database sees.

---

# 19. Jobs & events

## 19.1 pg-boss on the existing database

Real queue semantics — retries, exponential backoff, scheduling, dead-lettering, priorities — with **zero new infrastructure**, and transactional enqueue, which is what the outbox pattern needs.

| Job | Trigger | Priority |
|---|---|---|
| `media.process` | media commit | High |
| `media.gc-orphans` | cron daily 03:00 | Low |
| `search.index-listing` | `ListingApproved`, `VehicleUpdated` | High |
| `search.remove-listing` | `ListingRejected/Removed`, `DealerSuspended` | High |
| `notification.enquiry-to-dealer` | `EnquiryCreated` | **Highest — <30s** |
| `notification.listing-reviewed` | `ListingApproved/Rejected` | High |
| `email.send` | various | High |
| `cache.revalidate-page` | listing/dealer events | Med |
| `counters.reconcile` | cron nightly | Low |
| `audit.partition-maintain` | cron monthly | Low |
| `outbox.publish` | every 2s | — |

**Deployment:** one image, two process types — `web` (HTTP) and `worker` (`WORKER=true`). Same code, different entrypoint, so a slow image job never blocks an HTTP request. `WORKER_INLINE=true` locally so `pnpm dev` stays one command.

**Every handler must be idempotent.** Assume it will run twice. Payloads carry ids, never PII — re-fetch inside the handler.

## 19.2 Events — in-process bus + transactional outbox, from day one

Adopt event-driven **design** now (cheap, valuable); defer event-driven **infrastructure** (Kafka) indefinitely.

```
service writes domain change + outbox row   ← SAME TRANSACTION
              ↓
outbox publisher (every 2s, SKIP LOCKED)
              ↓
in-process EventBus  ──────▶  [later: SNS/SQS or Kafka — swap the sink only]
              ↓
subscribers, each running as its own job
```

Without the outbox, "save the listing, then send the email" has two failure modes: an email for a listing that rolled back, or a listing saved with no email. The outbox makes the event durable in the same transaction as the state change. **One table, ~60 lines.** Retrofitting it after 40 side-effecting flows costs weeks.

**Envelope (fix this now — changing it later is painful):**
```ts
type DomainEvent<T = unknown> = {
  id: string; type: string; version: 1; occurredAt: string;
  aggregateType: string; aggregateId: string;
  dealerId?: string;
  actor: { type: 'DEALER' | 'ADMIN' | 'SYSTEM'; id?: string };
  traceId: string;
  payload: T;
};
```

**Catalog:** `UserRegistered · UserVerified · DealerApplied · DealerApproved · DealerRejected · DealerSuspended · VehicleCreated · VehicleUpdated · VehicleSold · ListingSubmitted · ListingApproved · ListingRejected · ListingRemoved · MediaUploaded · MediaProcessed · EnquiryCreated · PhoneRevealed · PhotoRequested · PhotoRequestScheduled · PhotoRequestCompleted`

**Rules:** subscribers are idempotent · a subscriber never throws into the publisher · a failing subscriber never rolls back the originating transaction · per-aggregate ordering only, no global ordering guarantee.

---

# 20. Environments, CI/CD & deployment

> **This section is the design. [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) is what
> was built**, and it is the one to follow — it records what changed against
> this section after the code was inspected, and why:
>
> - **The host runs on ECS Fargate in ap-south-1, not Render**, with images in
>   ECR rather than GHCR. §C2 there compares the options and prices them.
> - **The database is RDS, not Neon**, and preview environments per PR are not
>   built. Three environments, not four.
> - **`next build` had to stop calling the API before build-once/promote-many
>   was possible at all.** The ISR routes prerendered marketplace data — and a
>   statically generated `robots.txt` would have shipped `Disallow: /` to
>   production. Both are fixed; §B there has the detail.
> - **The web Dockerfile does not use `output: 'standalone'`.** The runtime
>   stage installs production dependencies and runs `next start`, which is what
>   the repository already had and what is verified working.
> - Migrations run as a one-off ECS task from a **migrator image built at the
>   same commit**, so `DATABASE_URL` never leaves AWS and no workflow holds it.

## 20.1 The governing principle

> **Build once. Promote the same artifact. Never rebuild for production.**

An image built for dev and an image rebuilt for production are two different artifacts, however identical the source. Different base-image digests, different transitive dependency resolutions, different build-time environment. Rebuilding means production runs bytes that were never tested.

So: **one build per commit**, tagged with the git SHA, pushed once. Dev deploys it automatically. Production deploys **the same immutable digest**, by manual approval. Rollback is redeploying an older SHA — no rebuild, seconds not minutes.

This is why `NEXT_PUBLIC_*` is banned (§15.3). Those variables are inlined at build time; using them would force a separate image per environment and break the whole model.

## 20.2 Environments

| Env | URL | Trigger | Database | Storage | Email/SMS | Purpose |
|---|---|---|---|---|---|---|
| **local** | localhost:3000 / :4000 | `pnpm dev` | Docker Postgres | MinIO | Mailpit / console | Offline development |
| **preview** | `pr-{n}.dev.dealers-drive.com` | PR opened | Neon branch per PR | dev bucket, `pr-{n}/` prefix | Mailpit-style sink | Review a PR with real data shape |
| **dev** | `dev.dealers-drive.com` | **auto on merge to `main`** | Neon `dev` branch | `dd-media-dev` | Resend test / MSG91 test | Integration + dealer demos |
| **production** | `dealers-drive.com` | **manual promotion of a SHA** | Neon `main` | `dd-media-prod` | Resend live / MSG91 live | Real dealers, real buyers |

Preview environments are optional at the start — if PR-level Neon branching feels like too much on day 2, ship with local + dev + production and add preview in week 4.

**Environment identity is runtime, not build-time.** Every service gets `APP_ENV=dev|production`. The dev site carries a visible amber banner reading `DEV — not real data`, driven by that variable. You will thank yourself the first time you nearly email 40 real dealers from dev.

## 20.3 The pipeline

```
┌── PR OPENED ─────────────────────────────────────────────────────────┐
│ ci.yml   (no image is built or pushed)                               │
│   lint · typecheck · unit tests                                      │
│   integration tests against a Postgres service container             │
│   build (correctness check only, output discarded)                   │
│   Lighthouse CI budget check                                         │
│   pnpm audit + semgrep + gitleaks (CodeQL needs paid Code Security │
│   on a private repo — see DEPLOYMENT.md §E)                        │
│   → optional preview deploy                                          │
└──────────────────────────────────────────────────────────────────────┘
                                 │ merge to main
                                 ▼
┌── release.yml — THE ONLY PLACE IMAGES ARE BUILT ─────────────────────┐
│ 1. build  ghcr.io/{owner}/dd-api:sha-{SHA}   (+ :dev-latest)         │
│ 2. build  ghcr.io/{owner}/dd-web:sha-{SHA}   (+ :dev-latest)         │
│ 3. push both, capture immutable digests                              │
│ 4. deploy to DEV:                                                    │
│      a. run migrations:  docker run <api@digest> pnpm db:migrate      │
│      b. deploy api  → wait for /health/ready                         │
│      c. deploy worker (same image, WORKER=true)                      │
│      d. deploy web  → wait healthy                                   │
│      e. smoke test: /health/ready · GET /v1/vehicles · homepage 200  │
│ 5. record a GitHub Deployment against the `dev` environment          │
│ 6. on failure → auto-rollback dev to the previous SHA                │
└──────────────────────────────────────────────────────────────────────┘
                                 │  human decides
                                 ▼
┌── promote.yml — workflow_dispatch { sha } ───────────────────────────┐
│ GitHub Environment `production` → REQUIRED REVIEWER (you)            │
│ 1. verify sha-{SHA} images exist in the registry (fail fast if not)  │
│ 2. verify that SHA is currently deployed to dev and healthy          │
│ 3. run migrations against PRODUCTION using the SAME image digest     │
│ 4. deploy api → worker → web, same digests, health-gated             │
│ 5. smoke test production                                             │
│ 6. record a GitHub Deployment against `production`                   │
│ 7. on failure → redeploy the previous production SHA automatically   │
│                                                                       │
│ NO BUILD STEP EXISTS IN THIS WORKFLOW. That is the point.            │
└──────────────────────────────────────────────────────────────────────┘
```

**Rollback** = run `promote.yml` with an older SHA. Because migrations follow expand/contract (§20.6), the previous image is always compatible with the current schema. Target: under two minutes.

## 20.4 Workflows

### `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: dd_test }
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 5s --health-retries 10
        ports: ['5432:5432']
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/dd_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck        # turbo runs only affected packages
      - run: pnpm --filter api db:migrate:deploy
      - run: pnpm turbo test
      - run: pnpm turbo build
      - run: pnpm audit --audit-level=high
```

### `.github/workflows/release.yml` — build once, deploy dev

```yaml
name: Release
on:
  push:
    branches: [main]

concurrency:
  group: release            # never two releases at once
  cancel-in-progress: false

permissions:
  contents: read
  packages: write
  deployments: write

env:
  REGISTRY: ghcr.io
  IMAGE_API: ghcr.io/${{ github.repository_owner }}/dd-api
  IMAGE_WEB: ghcr.io/${{ github.repository_owner }}/dd-web

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      sha:        ${{ github.sha }}
      api_digest: ${{ steps.api.outputs.digest }}
      web_digest: ${{ steps.web.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: api
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_API }}:sha-${{ github.sha }}
            ${{ env.IMAGE_API }}:dev-latest
          cache-from: type=gha,scope=api
          cache-to:   type=gha,scope=api,mode=max
          provenance: true                      # supply-chain attestation

      - id: web
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_WEB }}:sha-${{ github.sha }}
            ${{ env.IMAGE_WEB }}:dev-latest
          cache-from: type=gha,scope=web
          cache-to:   type=gha,scope=web,mode=max
          provenance: true

  deploy-dev:
    needs: build
    uses: ./.github/workflows/_deploy.yml
    with:
      environment: dev
      sha: ${{ needs.build.outputs.sha }}
    secrets: inherit
```

### `.github/workflows/_deploy.yml` — reusable, identical for both environments

```yaml
name: Deploy
on:
  workflow_call:
    inputs:
      environment: { required: true,  type: string }
      sha:         { required: true,  type: string }

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}   # production has a required reviewer
    env:
      IMAGE_API: ghcr.io/${{ github.repository_owner }}/dd-api:sha-${{ inputs.sha }}
      IMAGE_WEB: ghcr.io/${{ github.repository_owner }}/dd-web:sha-${{ inputs.sha }}
    steps:
      - uses: actions/checkout@v4

      # ── 0. the images must already exist. never build here. ──────────
      - name: Verify images exist
        run: |
          docker manifest inspect "$IMAGE_API" > /dev/null
          docker manifest inspect "$IMAGE_WEB" > /dev/null

      # ── 1. migrations, run from the SAME image being deployed ────────
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          docker run --rm -e DATABASE_URL="$DATABASE_URL" \
            "$IMAGE_API" pnpm --filter api db:migrate:deploy

      # ── 2. deploy: api → worker → web ────────────────────────────────
      - name: Deploy API
        run: |
          curl -sf -X POST "https://api.render.com/v1/services/${{ secrets.RENDER_API_SERVICE_ID }}/deploys" \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
            -H 'Content-Type: application/json' \
            -d "{\"imageUrl\":\"$IMAGE_API\"}"

      - name: Deploy Worker
        run: |
          curl -sf -X POST "https://api.render.com/v1/services/${{ secrets.RENDER_WORKER_SERVICE_ID }}/deploys" \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
            -H 'Content-Type: application/json' \
            -d "{\"imageUrl\":\"$IMAGE_API\"}"

      - name: Deploy Web
        run: |
          curl -sf -X POST "https://api.render.com/v1/services/${{ secrets.RENDER_WEB_SERVICE_ID }}/deploys" \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
            -H 'Content-Type: application/json' \
            -d "{\"imageUrl\":\"$IMAGE_WEB\"}"

      # ── 3. smoke test ────────────────────────────────────────────────
      - name: Smoke test
        run: ./scripts/smoke.sh "${{ vars.API_BASE_URL }}" "${{ vars.WEB_BASE_URL }}"

      - name: Record deployment
        uses: bobheadxi/deployments@v1
        with: { step: finish, env: ${{ inputs.environment }}, status: ${{ job.status }} }
```

### `.github/workflows/promote.yml` — the manual production trigger

```yaml
name: Promote to Production
on:
  workflow_dispatch:
    inputs:
      sha:
        description: 'Commit SHA to promote (must already be deployed to dev)'
        required: true
        type: string

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - name: Verify this SHA is live and healthy on dev
        run: |
          DEPLOYED=$(curl -sf "${{ vars.DEV_API_BASE_URL }}/health/ready" | jq -r .sha)
          if [ "$DEPLOYED" != "${{ inputs.sha }}" ]; then
            echo "::error::${{ inputs.sha }} is not the SHA currently running on dev ($DEPLOYED)."
            exit 1
          fi

  promote:
    needs: preflight
    uses: ./.github/workflows/_deploy.yml
    with:
      environment: production        # ← GitHub requires your approval here
      sha: ${{ inputs.sha }}
    secrets: inherit
```

**The manual gate is a GitHub Environment protection rule**, not a script: Settings → Environments → `production` → *Required reviewers: you*. Running the workflow pauses and waits for your approval in the GitHub UI or the mobile app. Add a wait timer of 0 and a deployment branch rule limiting it to `main`.

**`/health/ready` must return the running SHA** — inject `GIT_SHA` as a build arg and expose it. The promote preflight depends on it, and it's the fastest way to answer "what's actually deployed right now?"

## 20.5 Dockerfiles

Both are multi-stage, pnpm-workspace-aware, non-root.

```dockerfile
# apps/api/Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter api exec prisma generate \
 && pnpm --filter api build \
 && pnpm deploy --filter api --prod /out

FROM base AS runner
ENV NODE_ENV=production
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:4000/health/ready || exit 1
CMD ["node", "dist/server.js"]
```

The **worker uses the identical image** with `WORKER=true` and `CMD ["node","dist/worker.js"]` overridden at the service level — same bytes, different entrypoint.

```dockerfile
# apps/web/Dockerfile — Next.js standalone
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NOTE: no NEXT_PUBLIC_* here. Nothing environment-specific is baked in (§15.3).
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

Requires `output: 'standalone'` in `next.config.ts`.

## 20.6 Migrations — expand/contract is mandatory

The pipeline runs migrations *before* deploying the new image, and rollback redeploys an *older* image against the *newer* schema. Both only work if every migration is backward-compatible with the previous release.

```
EXPAND    (release N)    Add a nullable column / new table / CREATE INDEX CONCURRENTLY.
                         Old code ignores it. Safe.
MIGRATE   (release N)    New code writes both old and new. Backfill via a job.
CONTRACT  (release N+2)  Once nothing reads the old column, drop it.
```

Non-negotiable rules: never `ALTER COLUMN ... NOT NULL` on a populated table without a default and a backfill · always `CREATE INDEX CONCURRENTLY` in production · always set `lock_timeout` and `statement_timeout` in migrations so a lock can never take the site down · a rename is two releases, never one.

**Dev is your migration rehearsal.** Every migration runs against dev on merge and against production only on promotion, so you always see it work once before it touches real dealers.

## 20.7 Configuration & secrets

| Layer | Holds | Where |
|---|---|---|
| **Build-time** | Nothing environment-specific. `GIT_SHA` only. | Docker build arg |
| **CI secrets** | Registry token, Render API key, per-env `DATABASE_URL` for migrations | GitHub **Environment** secrets (`dev`, `production`) — scoped so a dev workflow cannot read production secrets |
| **Runtime** | Everything else | The hosting platform's env vars per service |

```
APP_ENV=dev|production
GIT_SHA=<injected>
DATABASE_URL=
SESSION_COOKIE_DOMAIN=
API_BASE_URL=  WEB_BASE_URL=  MEDIA_BASE_URL=
R2_ACCOUNT_ID=  R2_ACCESS_KEY_ID=  R2_SECRET_ACCESS_KEY=  R2_BUCKET=
RESEND_API_KEY=  MAIL_FROM=
SMS_PROVIDER=msg91|console  MSG91_AUTH_KEY=  MSG91_SENDER_ID=
REQUIRE_PHONE_VERIFICATION=true|false
SENTRY_DSN=  INTERNAL_API_TOKEN=  REVALIDATE_SECRET=
TURNSTILE_SITE_KEY=  TURNSTILE_SECRET_KEY=
```

`config/env.ts` validates all of these with Zod **at boot** and exits with a readable error if any are missing. A container that starts and then fails on the first request at 2am is much worse than one that refuses to start.

Every environment has **its own credentials for everything** — separate R2 buckets, separate Resend keys, separate MSG91 sender IDs, separate Sentry projects. Dev must be incapable of touching production data or emailing a real dealer.

`.env.example` is committed with every key and no values.

**The *shape* of the secrets is code; the values never are.** `deploy/terraform/ssm.tf` declares that each parameter exists and that the execution role may read it — scoped to `/dealers-drive/<env>/*`, so a dev task definition cannot resolve a production secret even if someone pastes the wrong ARN into it. Each parameter is created with a literal `PLACEHOLDER` and then carries `ignore_changes = [value]`, so `terraform apply` can never overwrite a real secret, and no secret ever has to live in a tfvars file to stop it doing so. The values are written once, by hand, with `aws ssm put-parameter`.

That is what makes "no secret is in git" and "the infrastructure is in git" both true at the same time. A parameter left at `PLACEHOLDER` fails loudly at the first deploy, because `env.ts` refuses to boot in production on a missing or still-local-default secret.

## 20.8 Branching

Trunk-based. `main` is always deployable.

```
feature/dealer-otp ──PR──▶ main ──auto──▶ dev ──manual──▶ production
```

Short-lived branches, squash merge, no `develop` branch, no release branches, no gitflow. The dev environment *is* your integration branch. For a solo developer, anything more elaborate is ceremony that slows you down without reducing risk.

**Branch protection on `main`:** require the CI check to pass, require the branch to be up to date, no force pushes.

## 20.9 What "done" looks like

- A merged PR reaches `dev.dealers-drive.com` automatically in **under 8 minutes**, with migrations applied and a smoke test passed.
- Promoting to production is: open Actions → Promote → paste the SHA → approve. **Under 4 minutes, no build.**
- Rolling back production is the same flow with an older SHA. **Under 2 minutes.**
- `curl https://dealers-drive.com/api/health` (or the API's `/health/ready`) tells you exactly which SHA is live.
- No image is ever built twice.

## 20.10 Shutdown — fail readiness first, then close

A rolling deploy that produces a burst of 502s is not a broken new version; it is almost always a task that closed its listener before the load balancer stopped routing to it. The order is the whole mechanism, and it is easy to get backwards.

```
SIGTERM
  │
  ├─ 0ms      set the drain flag.  /health/ready → 503 immediately
  │           /health/live stays 200 — a liveness probe that fails during a
  │           graceful drain gets the container KILLED mid-drain
  │
  ├─ …        SHUTDOWN_DRAIN_MS (5s deployed, 0 local): do nothing on purpose.
  │           This is the target group's chance to notice and stop sending work
  │
  ├─ 5s       server.close() — stop accepting, let in-flight requests finish
  │
  ├─ …        closeContainer(): outbox → pg-boss → prisma pool
  │
  └─ ≤20s     exit 0.  SHUTDOWN_TIMEOUT_MS bounds the whole thing
```

Three numbers, one mechanism, and changing any one means checking the other two:

| Setting | Value | Constraint |
|---|---|---|
| `SHUTDOWN_DRAIN_MS` | 5 000 | Long enough for the target group to deregister |
| `SHUTDOWN_TIMEOUT_MS` | 15 000 | Budget for the drain itself |
| ECS `stopTimeout` | 25 | **Must exceed drain + timeout**, or SIGKILL arrives mid-drain |
| ALB `deregistration_delay` | 30 | The balancer's half of the same handshake |

Keep-alive is set explicitly (`keepAliveTimeout = 61s`, `headersTimeout = 65s`) and deliberately exceeds the ALB's `idle_timeout` of 60s. If the balancer's idle timeout were the longer of the two it could send a request down a connection the task had already decided to close, and the client would see a 502 that no log explains.

---

# 21. Security

## 21.1 Threat model — ranked by likelihood × impact for *this* business

| Threat | Likelihood | Impact | Primary defence |
|---|---|---|---|
| Dealer accesses another dealer's inventory or leads | Medium | **Critical — business-ending** | §7 four layers |
| **Lead scraping** (competitors harvesting your dealers' numbers) | **Very high** | High — dealers churn | §14.1 reveal gating |
| Listing scraping (competitor copies inventory) | Very high | Medium | Bot management; accept that public data is public, protect *contact* data |
| Fake dealers / bait listings | High | High (trust) | Phone verification + mandatory admin review |
| Stolen dealer account | Medium | High | Rate limits, session list, login alerts |
| SMS pumping (OTP abuse to burn your credit) | **High** | Medium — direct cost | Per-phone, per-IP, per-hour limits |
| Stored XSS via dealer description or brand name | Medium | High | Sanitize server-side + CSP |
| Malicious file upload | Medium | High | §12 mandatory re-encode |
| SQL injection | Low (Prisma) | Critical | Parameterized everywhere; audit every `$queryRaw` |

## 21.2 Controls

| Category | Implementation |
|---|---|
| **Injection** | Prisma parameterized queries. Every `$queryRaw` uses tagged templates — **no string concatenation anywhere**. Zod on all input. |
| **XSS** | React auto-escaping. **Never** `dangerouslySetInnerHTML` on dealer content. Sanitize rich text server-side. Strict CSP (report-only first, then enforce). |
| **CSRF** | `SameSite=Lax` + double-submit token on every mutation. Server Actions have built-in protection. |
| **SSRF** | Dealers submit URLs (website, social). **Never fetch them server-side.** If you must, allowlist + block private IP ranges + no redirects. |
| **Auth attacks** | Argon2id. Login 5/15min. Generic error messages. OTP: 6 digits, 10-min TTL, 5 attempts, single use, 60s resend cooldown. Timing-safe comparison. Session rotation on privilege change. |
| **Authorization** | Middleware checks capability; service re-checks ownership inside the transaction. 404-not-403. |
| **File upload** | Mime allowlist, size cap, presign conditions, magic-byte verification, **mandatory re-encode**, EXIF strip, separate serving domain. |
| **Secrets** | Platform secret stores only. Zod-validated at boot. Never in the repo, logs, or error messages. Separate credentials per environment. |
| **Encryption** | TLS 1.3, HSTS with preload. Postgres encrypted at rest. Argon2 for passwords, SHA-256 for session and OTP tokens. |
| **PII** | Minimize: mask registration numbers, strip GPS EXIF, never store full PAN. Documented retention: leads 24 months, audit 7 years. `docs/DATA-INVENTORY.md` records what you store, where, why, and who can read it — you'll need it for DPDP and for the first dealer who asks. |
| **API abuse** | §9.2 rate limits. Cloudflare WAF. 1MB JSON body cap, 10MB upload cap. `limit ≤ 48`, `page ≤ 40`. |
| **Headers** | HSTS · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` · CSP |
| **Audit** | Every admin action, every state transition, every cross-tenant read → `audit_logs` with actor, before/after, IP, traceId. Immutable: the app role has INSERT and SELECT only, enforced by grant, not convention. |
| **Dependencies** | `pnpm audit` in CI, Dependabot on, lockfile committed. |

## 21.3 Attack these before launch

Attempt each; expect at least one to succeed the first time:
submit a listing for another dealer's vehicle · approve your own listing · read another dealer's enquiries · reveal 500 phone numbers from one IP · upload a polyglot file · brute-force an OTP · pass another dealer's `dealerId` in every field of every request · request 500 OTPs to burn SMS credit.

Book an external penetration test before you take real money.

---

# 22. Observability

| Capability | Now 🟢 | Growth 🟡 |
|---|---|---|
| Errors | **Sentry**, both apps, source maps, release tagged with the SHA | Alert routing |
| Logs | **pino** JSON → platform log drain | Loki / Better Stack, 30-day retention |
| Tracing | **traceId in every log line, error response and Sentry event**, adopted from the edge when the caller sent one — 90% of the value at 5% of the cost | OpenTelemetry |
| Metrics | Business metrics on an `/admin/health` page + platform dashboards | Prometheus + Grafana |
| Uptime | UptimeRobot on homepage, a detail page, `/health/ready` | Multi-region synthetics |
| Database | `pg_stat_statements` + weekly slow-query review | Automated alerts |

## 22.1 Instrument the business, not just the servers

```
FUNNEL     dealer signups · verification completion rate
           profile submitted → approved
           median time: signup → first live listing   ← THE activation metric

MARKETPLACE listings submitted / approved / rejected
           median time in the review queue           ← your SLA
           moderation queue depth
           live listings by city and make
           search → detail-page click-through
           detail-page → lead conversion              ← what dealers care about
           leads per live listing per week            ← your value proposition
           % of listings with zero leads in 30 days   ← churn predictor

HEALTH     p50/p95/p99 on /v1/vehicles, detail page, submit
           error rate by endpoint
           job queue depth + oldest pending job
           enquiry-email latency p95                  ← ALERT
           SMS spend per day                          ← ALERT
```

## 22.2 Alerts worth interrupting you (keep this list short)

API 5xx > 2% for 5 min · enquiry email p95 > 60s · job queue depth > 500 or oldest job > 15 min · moderation queue > 50 pending · database connections > 80% · database disk > 80% · SMS spend > 2× daily average · site down (synthetic).

Everything else goes to a channel you check each morning. **Alert fatigue is a reliability risk** — a solo developer with 40 noisy alerts will ignore the one that matters.

Every alert must link to a `docs/RUNBOOK.md` entry. An alert with no runbook entry either gets an entry or gets deleted.

### What is actually wired today

Five CloudWatch alarms, in `deploy/terraform/alarms.tf`, all pointing at one SNS topic:

| Alarm | Fires when | Why it is worth waking someone |
|---|---|---|
| `api-no-healthy-targets` | `HealthyHostCount < 1` for 2 min | Unambiguous. Every `/v1` request is failing. |
| `web-no-healthy-targets` | same, web target group | The marketplace is not rendering. |
| `api-5xx` | target 5xx over threshold in 5 min | The application is erroring, not the balancer. |
| `api-running-below-desired` | running tasks < minimum for 10 min | Tasks are not staying up — a crash loop the circuit breaker has already failed to fix. |
| `api-latency-p95` | p95 > 2s for two 5-min periods | p95, not average: an average hides the tail users feel. |

**Deliberately not alarmed**, and the reasons matter more than the list:

- **CPU or memory crossing a threshold.** That is autoscaling's job. An alarm on it fires every time the system works correctly.
- **4xx rates.** Clients being clients.
- **Individual task restarts.** ECS replaces a task and the service is fine; `api-running-below-desired` is the version of this that means something.

Every one of them uses `treat_missing_data = "notBreaching"`. A rolling deploy briefly reports no data, and an alarm that pages on every deploy is an alarm nobody reads within a week.

---

# 23. Testing

Deliberately not a pyramid. For a CRUD-and-trust product, invert toward **integration tests against a real Postgres**. Your bugs will not be in a pricing function; they'll be in "did the guard actually scope by dealer" and "did the transaction roll back."

```
        ╱────────╲       E2E (Playwright)        4 journeys      ~5%
       ╱──────────╲      critical paths only
      ╱────────────╲
     ╱              ╲    INTEGRATION (API + real DB)  ~100    ~60%
    ╱────────────────╲   ← highest-value tests
   ╱──────────────────╲
  ╱────────────────────╲ UNIT (pure logic)             ~70    ~30%
 ╱──────────────────────╲ Component (RTL)              ~10     ~5%
```

**Tier 1 — write these before launch, no exceptions:**

| Test | Type |
|---|---|
| Dealer A cannot read/update/delete Dealer B's vehicle → **404** | Integration |
| Dealer A cannot see Dealer B's enquiries, media or photo requests | Integration |
| `dealerId` / `status` / `slug` in a request body is rejected or ignored | Integration |
| A dealer cannot set a listing to APPROVED by any route | Integration |
| Submitting with fewer than 5 images → 422, no Listing created | Integration |
| Approval indexes the listing; rejection removes it | Integration |
| Suspended dealer's listings disappear from public search | Integration |
| OTP: expiry, 5-attempt lockout, single use, resend cooldown | Integration |
| Login blocked until both email and phone are verified | Integration |
| A revoked session is rejected on the very next request | Integration |
| No public endpoint response contains a dealer phone number | Integration |
| Listing state machine: every invalid transition throws | Unit |
| Slug generation, price formatting, facet→query mapping | Unit |
| **E2E 1** Buyer: home → filter → detail → reveal → enquiry → dealer emailed | E2E |
| **E2E 2** Dealer: register → verify both → profile → admin approves → add vehicle + photos → submit → admin approves → live on /cars | E2E |
| **E2E 3** Admin rejects → dealer sees the reason in their inventory | E2E |
| **E2E 4** Two dealer contexts in parallel; B cannot reach A's vehicle by URL | E2E |

No mocking of Prisma — real database, real middleware, real HTTP. E2E must run in under 5 minutes or it will get skipped. **Sabotage check:** deleting `resolveDealer` from a router must turn at least three tests red.

**Not now:** contract tests (one consumer, same repo, shared Zod *is* the contract) · load tests (nothing to load yet) · visual regression (the design will change weekly) · coverage targets (a coverage number is not a quality metric).

---

# 24. Deferred work & triggers

Nothing below is built now — except the struck-through rows, which are kept with their original trigger so the reasoning that moved them is visible rather than deleted. Each has a named trigger, and each attaches to a seam that already exists.

| Deferred | Trigger | Where it attaches | Effort |
|---|---|---|---|
| ~~Payments~~ | ~~After the first cohort proves willingness to pay~~ | **Moved into MVP scope in r2 — see §26.** | ~8 days |
| ~~Listing expiry & renewal~~ | ~~With payments~~ | **Moved into MVP scope in r2 — see §10.** | ~2 days |
| ~~KYC document review~~ | ~~100+ dealers~~ | **Moved into MVP scope in r2 — see §26.6.** | ~3 days |
| **Subscriptions / auto-renew** | Dealers ask to stop manually topping up | `Order` gains a `recurring` flag; Razorpay Subscriptions replaces Orders | ~4 days |
| **Refunds & credit expiry** | The first refund request, or unused credits become a liability | `Payment` refund path + a `REVERSAL` ledger reason both already exist | ~2 days |
| **Bulk CSV import** | A 30+ car dealer refuses to onboard without it (expect this) | The vehicle create service is already written to be callable in a loop inside one transaction | ~3 days |
| **SEO facet landing pages** | Month 3, when inventory depth justifies them | `lib/url.ts` already does canonical facet ordering | ~4 days |
| **WhatsApp lead alerts** | Immediately after launch if dealer response time is poor | `notifications` module — a new channel adapter | ~2 days |
| **Buyer accounts + favorites** | Buyers ask, or you want saved-search emails | `localStorage` favorites already hold vehicle ids to merge | ~4 days |
| **Dealer staff sub-accounts** | A dealer asks twice | `DealerMember` and the permission model already exist | ~2 days |
| **Redis** | ~~cross-instance rate limits~~ — **that arrived and was met with Postgres instead (§18.1).** Remaining triggers: sessions > 2k/s, facets > 100ms, or a counter write per request showing up in the slow log | `CachePort` with `memory` + `postgres` adapters; the port names no SQL, table or connection | ~0.5 day |
| **Typesense** | >100k listings, or search p95 > 300ms, or typo tolerance costs conversions | `SearchPort` exists | ~5 days |
| **Read replica** | Primary CPU > 60% sustained | Public reads already use a separate repository | ~0.5 day |
| **BullMQ** | Job throughput > 50/s | Handlers unchanged | ~1 day |
| ~~**AWS ECS Fargate**~~ | ~~PaaS bill > $1,500/mo~~ | **Built — `deploy/terraform/` is the runtime, and §20 is the pipeline.** | — |
| **`packages/ui`** | A second app needs the components | `git mv` + a package.json | ~0.5 day |
| **Service extraction** | Team > 12, or one module needs a different scaling profile | Facades are already the boundary; extract `search` first | — |
| **Kafka** | >3 services sharing a durable event log | Swap the outbox publisher's sink | — |
| **Kubernetes** | >8 services **and** >6 engineers. Probably never. | — | — |

**🔴 Never (for this domain):** MongoDB · GraphQL for a single first-party client · CQRS/event sourcing · schema-per-tenant · microservices before an organisational need.

---

# 25. Decision record

| # | Decision | Chosen | Why | Revisit when |
|---|---|---|---|---|
| 1 | Database | **PostgreSQL only** | Ownership and lifecycle are relational; JSONB covers variable specs; two databases means dual-write drift and no cross-table transactions | A genuinely non-transactional, document-shaped, high-write subsystem appears. Try JSONB first. |
| 2 | API style | **REST + JSON** | One first-party client; CDN caching of public listings is critical; GraphQL complicates caching and rate limiting; tRPC over-couples web to API | A public partner API or 3+ divergent clients |
| 3 | API framework | **Express 5** | Fast to start, no magic, async errors propagate natively. Discipline comes from §5.5, not the framework | Never, if §5.5 is enforced |
| 4 | Backend shape | **Modular monolith** | One developer. Transactional consistency for free. Extraction later is mechanical if facades and events are respected | Team > 12 |
| 5 | Repository layout | **Monorepo, 3 deploy artifacts** | Atomic contract changes, direct type sharing. Independence comes from path filters, not repos | Separate teams with separate on-call (~15 engineers) |
| 6 | Buyer accounts | **None** | No validation value; removes ~6 days and a whole permission branch | Saved-search emails become valuable |
| 7 | Listing approval | **Always human-reviewed** | Trust at low volume; every bad listing is a large fraction of your inventory | Volume makes it impossible — then add a trusted-dealer fast path, never blanket auto-approval |
| 8 | Auth | **Opaque session cookies in Postgres** | Instant revocation (critical for suspending a dealer), immediate permission changes, no vendor lock-in on your most business-critical table | Mobile app → add JWTs alongside, never instead |
| 9 | Dealer auth | **Passwordless phone OTP** ← *changed in r2* | The UI has no password field on any screen. Phone possession is what makes a dealer real; a password adds a reset flow, a breach surface and a support burden for zero security gain over an OTP | A dealer-side mobile app wants biometric unlock → add a device token, still no password |
| 9a | Email verification | **Captured at signup, verified in the background, never blocking** ← *r2* | Blocking onboarding on an email round-trip loses dealers at the exact moment they are most willing | Email becomes a login channel used by >20% of dealers |
| 10 | Payments | **Razorpay, prepaid credit packs, in MVP** ← *changed in r2* | The billing screen, the sidebar credit card, the credit ledger and the invoice table are all fully designed. Shipping the console without them would ship a dead nav item | Subscriptions, when topping up becomes the friction |
| 10a | Credit accounting | **Append-only ledger with materialised `balanceAfter`** ← *r2* | A dealer disputing a charge must get an answer in one query, and the invariant must be checkable by a job rather than by reading code | Never |
| 10b | Credit timing | **Hold on submit, consume on approve, release on reject** ← *r2* | Matches the UI (the balance drops when the admin approves) and matches dealer expectations from every ad platform they already use | Never |
| 11 | Multi-tenancy | **Shared schema + `dealer_id` + RLS** | The core product is a cross-tenant search; physical isolation makes it impossible | Only a contractual data-residency requirement |
| 12 | Search | **Postgres + `listing_search`**, behind `SearchPort` | Sufficient to ~200k listings ≈ 20k dealers. Zero cost, zero ops | >100k listings or p95 > 300ms → Typesense |
| 13 | Jobs | **pg-boss** | Real queue semantics on infrastructure you already run; transactional enqueue enables the outbox | >50 jobs/s → BullMQ |
| 14 | Object storage | **Cloudflare R2 + Images** | **Zero egress** on an image-heavy product; S3-compatible so migration is a config change | Full AWS consolidation |
| 15 | Cache | **CDN + ISR + in-process LRU. No Redis.** | CDN covers ~95% of read traffic; Postgres handles session lookups at this scale | §24 trigger |
| 16 | Events | **In-process bus + transactional outbox, day one** | One table and ~60 lines; guarantees side effects; the sink swaps to a broker with no domain changes | >3 services |
| 17 | Frontend rendering | **RSC + ISR + selective client islands** | SEO is the growth engine; cached crawlable HTML with sub-second LCP | Never — correct at every scale |
| 18 | `NEXT_PUBLIC_*` | **Banned** | Build-time inlining would break build-once-promote-many (§20.1) | Never |
| 19 | Deployment | **Build once per commit, promote the same digest** | Production runs the exact bytes tested on dev; rollback is a redeploy, not a rebuild | Never |
| 20 | Production trigger | **Manual, via GitHub Environment approval** | A human decides when real dealers see a change | Continuous deployment once you have real automated confidence — not in this phase |
| 21 | Orchestration | **PaaS containers → ECS Fargate later** | Kubernetes is a full-time job you don't have | >8 services and >6 engineers |
| 22 | IaC | **Deferred; documented in Markdown** | MVP infrastructure is a handful of dashboard settings | The AWS migration |
| 23 | Component library | **Local `components/`** | You'll redesign these 5–10× in six months; versioning is pure friction | A second app exists |
| 24 | Type sharing | **`packages/contracts` with Zod** | One definition serves as runtime validation, form validation and static types | A mobile or partner client → add generated clients |

---

# 26. Credits, payments & billing

**New in r2.** Previously deferred to month 3. The UI ships it: a full Billing & credits screen, a credit card pinned to the bottom of every dealer sidebar, a live count in the console top bar, a "Credits after publish" line in the add-vehicle summary, an "Available credits" dashboard stat, and Payments + Revenue boxes in the admin console. The purchase confirmation toast names the gateway: *"25 credits added — payment captured via Razorpay."*

## 26.1 The unit

**One credit publishes one vehicle for 90 days.** That sentence is on the billing screen and it is the entire commercial model. No tiers, no subscriptions, no per-lead pricing, no featured-listing upsell.

| Pack | Credits | Price | Per listing | Badge |
|---|---|---|---|---|
| `pack-10` | 10 | ₹4,500 | ₹450 | — |
| `pack-25` | 25 | ₹10,000 | ₹400 | Most popular *(accent border)* |
| `pack-50` | 50 | ₹17,500 | ₹350 | — |
| `pack-100` | 100 | ₹30,000 | ₹300 | Best value |

Packs live in `CreditPack` rows, not in code. Prices are `BigInt` paise. The per-listing rate is derived by division and never stored.

## 26.2 The ledger is the truth

`CreditTransaction` is append-only. No `UPDATE`, no `DELETE`, no correction-in-place — a mistake is fixed with a `REVERSAL` row that references the original. `Dealer.creditBalance` is a read cache of the newest row's `balanceAfter` and is treated as untrusted by every write path.

Every mutation follows the same shape:

```ts
await db.$transaction(async (tx) => {
  const dealer = await tx.$queryRaw`
    SELECT credit_balance FROM dealers WHERE id = ${dealerId} FOR UPDATE`;
  if (dealer.creditBalance + delta < 0) throw new InsufficientCreditsError();
  const balanceAfter = dealer.creditBalance + delta;
  await tx.creditTransaction.create({ data: { dealerId, delta, balanceAfter, reason, label, ... } });
  await tx.dealer.update({ where: { id: dealerId }, data: { creditBalance: balanceAfter } });
  //  ... and the state change this credit pays for, in the SAME transaction
});
```

The `FOR UPDATE` is what makes two concurrent submits from the same dealer serialise instead of both reading a balance of 1 and both succeeding.

## 26.3 Reasons

| Reason | Delta | Written when |
|---|---|---|
| `PURCHASE` | +n | Razorpay webhook `payment.captured` |
| `ADMIN_GRANT` | +n | Admin grants credits (the ledger's "Admin grant — onboarding bonus") |
| `HOLD_SUBMIT` | −1 | Dealer submits a vehicle for approval |
| `RELEASE_REJECT` | +1 | Admin rejects the listing |
| `RELEASE_EXPIRED_UNREVIEWED` | +1 | A listing sat in `PENDING_REVIEW` past the review SLA and was auto-released |
| `CONSUME_APPROVE` | 0 | Admin approves — the hold settles. **Delta 0, and it is still a row**, because the dealer needs to see *"Listing published — 2022 Tata Nexon XZ+"* in their history. |
| `ADMIN_ADJUSTMENT` | ± | Support correction, reason mandatory, `SUPER_ADMIN` only |
| `REVERSAL` | ± | Undo of a prior row, references it by id |

> The `CONSUME_APPROVE` delta-0 row is the one piece of this design that looks wrong at first glance. It is deliberate: the debit already happened at hold time, but the dealer's mental model is *"I published a car and it cost me a credit."* The history has to show that event on the day it happened, at the balance it happened at. A ledger that is arithmetically perfect and unreadable to its owner has failed at its job.

## 26.4 Purchase flow

```
1. Dealer clicks Buy on a pack
2. POST /v1/dealer/billing/orders { packId, idempotencyKey }
     server prices the pack SERVER-SIDE (never trust a client amount)
     computes 18% GST, creates Order(PENDING) + a Razorpay order
   → { orderId, gatewayOrderId, amountPaise, razorpayKeyId }
3. Razorpay Checkout opens client-side with that order id
4. TWO independent confirmation paths, and the webhook is authoritative:
     a) Browser success handler → POST /v1/dealer/billing/orders/:id/verify
          verifies the razorpay_signature HMAC, then returns the CURRENT
          balance. It never credits — it only reads and reports.
     b) Webhook payment.captured → the ONLY thing that writes credits
          insert WebhookEvent (unique on gatewayEventId) → dedupe
          → Payment(CAPTURED) + Order(PAID)
          → CreditTransaction(PURCHASE, +n)
          → Invoice(DD-INV-YYYY-NNNN) → job: render PDF → R2
          → job: email the dealer the invoice
5. If the browser confirms before the webhook lands, the UI polls
   /v1/dealer/billing/summary for up to 20s and shows the toast on change.
```

**Why the webhook, and only the webhook, credits:** the browser can be closed, throttled, or lying. Razorpay retries webhooks for 24 hours. Crediting from the client-side handler is the single most common way Indian marketplaces end up giving away inventory for free.

**Idempotency at three layers:** the client sends an `Idempotency-Key` on order creation; `WebhookEvent.gatewayEventId` is unique; `CreditTransaction.idempotencyKey` is unique. Any one of the three would mostly work. All three is what lets you sleep.

## 26.5 Invoices

Numbered `DD-INV-{FY}-{NNNN}` from a Postgres sequence per financial year. Rendered by a Puppeteer job from an HTML template into R2 under a private prefix; `GET /v1/dealer/billing/invoices/:id/pdf` returns a **302 to a 5-minute signed URL**, scoped to the dealer's own invoices. A failed payment still produces an `Invoice` row with status `FAILED` and no PDF, so the payment-history table can show the attempt.

GST: 18% on a marketplace service. `placeOfSupply` decides CGST+SGST (intra-state, Tamil Nadu) vs IGST. Get this reviewed by a CA before the first real rupee — it is cheap to fix now and expensive to fix after 500 invoices have been issued.

## 26.6 KYC documents

Onboarding step 3 collects **GSTIN** and **PAN** as text plus three uploads: **GST certificate**, **PAN card**, **address proof** (PDF or JPG, max 5 MB each). Each row shows its own state — `Required` / `Uploading — 62%` / `gst-cert.pdf · uploaded` — so `DealerDocument.status` drives the UI directly.

Documents go through the same presign → direct-PUT → commit pipeline as vehicle photos (§12), with three differences: a separate private R2 prefix, **no public delivery route and no CDN**, and no derivative generation. An admin reads them through a short-lived signed URL, and every read is audit-logged. The onboarding review screen promises buyers never see them; that promise is enforced by there being no route that could serve them publicly, not by a flag.

Dealer approval requires all three documents `VERIFIED`. The admin dealer console gains a document panel with per-document Verify / Reject.

## 26.7 Admin billing surfaces

The admin sidebar has **Payments** and **Configuration** items that the previous revision had no backend for.

- **Payments** — every `Payment` across all dealers, filterable by status and date, with the 30-day totals that feed the dashboard's "Payments (30d)" ₹4.2 L and "Revenue (30d)" ₹3.6 L boxes. *(The two differ: payments = gross captured; revenue = recognised net of GST.)*
- **Configuration** — `PlatformConfig` key/value editing: pack pricing, the 90-day listing life, the 6-photo minimum, rejection-reason presets, the photo-request flag and cap, and OTP/SMS limits. `SUPER_ADMIN` only, every write audit-logged.

## 26.8 What must not go wrong

| Failure | Guard |
|---|---|
| Double credit from a retried webhook | `WebhookEvent.gatewayEventId` unique + dedupe before any side effect |
| Two concurrent submits spend one credit twice | `SELECT … FOR UPDATE` on the dealer row inside the transaction |
| Client posts its own amount | Amount is computed server-side from `CreditPack`; the request carries only `packId` |
| Approved listing with no credit consumed | Nightly reconciliation: every `APPROVED` listing has exactly one `CONSUME_APPROVE` row |
| Rejected listing still holding a credit | Same job asserts `Dealer.creditsHeld` equals the live held-listing count |
| Ledger drift | Same job re-walks the last 30 days asserting `balanceAfter[n] = balanceAfter[n−1] + delta[n]` |
| Negative balance | A `CHECK (credit_balance >= 0)` constraint, plus the in-transaction check |

Alert on any breach. These are not "log a warning" conditions — they are "wake someone up" conditions, because every one of them is either money lost or a dealer's trust lost.

---

# 27. UI conformance matrix

Every divergence found when this document was checked against `Dealers-Drive.dc.html`, `DESIGN-SPEC.md` and `screens/`, with the resolution taken. **Resolution `A`** = the architecture was wrong and has been corrected here. **`U`** = the UI is missing something the architecture needs. **`?`** = open, needs a product decision.

| # | Area | The UI does this | r1 architecture said | Res. | Fixed in |
|---|---|---|---|---|---|
| 1 | Credits | Full Billing & credits screen; sidebar credit card on every dealer page; credit count in the top bar | Payments deferred to month 3; a single `listingAllowance` integer | **A** | §1.2, §6, §26 |
| 2 | Payments | "payment captured via Razorpay"; four packs with prices; invoice table with PDF | No gateway, no orders, no invoices | **A** | §2, §6, §26.4–26.5 |
| 3 | Credit timing | Balance decrements when the **admin approves** | No credit model at all | **A** | §3.1, §10, §26.3 |
| 4 | Listing expiry | Inventory `Expires` column; `Expired` status badge; "publishes one vehicle for 90 days" | Expiry deferred; no `EXPIRED` status | **A** | §6, §10 |
| 5 | Dealer auth | Phone → 6-digit OTP. **No password field anywhere.** | `register {email, phone, password}`; login with password | **A** | §6, §8.1 |
| 6 | Email verification | Sign-up captures a work email; OTP verify goes straight to onboarding | 403 until **both** email and phone are verified | **A** | §8.1 |
| 7 | OTP attempts | "That OTP is incorrect or expired. **Two attempts remaining.**" | max 5 attempts | **A** | §6, §8.1 |
| 8 | Enquiry lifecycle | Tabs New (12) / Contacted (34) / Closed (81) / Spam (3); Mark contacted, Close | `Enquiry` had no status and no mutation route | **A** | §6, §9.1, §14.3 |
| 9 | Enquiry reference | "Your enquiry reference is **DD-EN-40912**" | uuid only | **A** | §6, §14.2 |
| 10 | Enquiry sources | Three chips: Listing page · **Call button** · Dealer page | `"vdp" \| "dealer_page"` free string | **A** | §6, §14.4 |
| 11 | Dealer-level enquiry | Portfolio "Enquire with dealer" — no vehicle | `Enquiry.vehicleId` NOT NULL | **A** | §6, §14.2 |
| 12 | Dashboard chart | 7-bar Mon–Sun "Views this week" + weekly total | One cumulative `viewCount` | **A** | §6 `ListingViewDaily` |
| 13 | KYC | GSTIN + PAN + 3 document uploads with per-row status | "KYC document review — deferred" | **A** | §6, §26.6 |
| 14 | Dealer fields | Contact full name, role, landline, tagline | Not modelled | **A** | §6 |
| 15 | Photo minimum | "**Minimum 6 photos.**" | "≥5 images" in the guard and the flag | **A** | §3.1, §10 |
| 16 | Moderation actions | Approve · Reject · **Request changes** | approve / reject / takedown only | **A** | §6, §9.1, §10 |
| 17 | Admin console | Nav: Dashboard · Listings · Dealers · **Payments** · **Configuration** | No payments admin; config had no UI | **A** | §9.1, §26.7 |
| 18 | Saved cars | Header badge + list page hydrated from `localStorage` ids | No batch-fetch route | **A** | §9.1 `POST /v1/vehicles/batch` |
| 19 | Live counts | City dropdown counts, body-type tile counts, homepage totals | `facets` only; no city or home route | **A** | §9.1 `/v1/cities`, `/v1/home` |
| 20 | Dealer facets | Portfolio sidebar has per-dealer counts, zero rows dimmed | No dealer-scoped facet route | **A** | §9.1 `/v1/dealers/:slug/facets` |
| 21 | Vehicle fields | Insurance validity; Negotiable (Slightly / Fixed) | Not modelled | **A** | §6 |
| 22 | Response time | Portfolio stat "Response time · < 2 hrs" | Not modelled | **A** | §6 `medianResponseMins` |
| 23 | Domain | `ops@dealers-drive.in` in the admin bar | `dealersdrive.com` throughout | **A** | Standardised on `dealers-drive.com` |
| 24 | Photo requests | **No screen exists** in any of the 20 captures | A full §13 feature | **?** | §13 — see below |
| 25 | Filters | UI exposes Budget, Fuel, Body type, Transmission, Dealer, City, free text | API advertises 13 filters | **U** | No change — the API keeps all 13; the MVP UI exposes a subset, which is fine and lets the filter panel grow without a backend change |
| 26 | Sort | Recommended · Price ↑ · Price ↓ · Newest first · KM ↑ | `relevance\|price_asc\|price_desc\|year_desc\|km_asc\|newest` | **U** | Map "Newest first" → `year_desc`; `newest` (by `approvedAt`) is exposed but unused by the current UI |
| 27 | Vehicle vs listing status | One badge per row: Active / Pending review / Rejected / Draft / Sold / Expired | Two independent enums | **U** | Keep both; the API returns a single derived `displayStatus` (below) and never asks the frontend to combine them |

**`displayStatus` — the derived field the UI actually renders:**

```ts
function displayStatus(v: Vehicle, l: Listing | null): DisplayStatus {
  if (!l)                              return 'DRAFT';           // never submitted
  if (v.status === 'SOLD')             return 'SOLD';
  switch (l.status) {
    case 'PENDING_REVIEW':             return 'PENDING';         // "Pending review"
    case 'CHANGES_REQUESTED':          return 'CHANGES_REQUESTED';
    case 'REJECTED':                   return 'REJECTED';
    case 'EXPIRED':                    return 'EXPIRED';
    case 'REMOVED':                    return 'REMOVED';
    case 'APPROVED':                   return 'ACTIVE';          // "Active"
  }
}
```

Computed once, in the API, in the DTO mapper. The frontend receives a string and colours a badge. If two clients ever have to derive this independently they will disagree, and the disagreement will be about whether a dealer's car is live.

**The one open question (row 24).** §13's photo-request service has a database model, an admin flow and dealer endpoints, and **no user interface anywhere in the design**. Three options, in order of preference:

1. **Ship the backend, add one entry point** — a `Request a photo shoot` secondary button in the add-vehicle wizard's photo step, where the need is felt. ~half a day of design, and it preserves the differentiator.
2. **Defer the whole feature** to §24 with the trigger *"three dealers upload fewer than 6 usable photos"*. Saves ~4 days.
3. Ship the backend dark and fulfil requests over WhatsApp until the UI exists.

Decide before sprint planning. Building the endpoints with no way to reach them is the only outcome with no upside.

---

## Appendix — the six things that would be expensive to change later

Everything else in this document can be swapped behind an interface. These are structural, and getting them right now is what buys you the option to change your mind about everything else:

1. **Tenant context comes from the session, never the request.** (§7)
2. **The transactional outbox with a versioned event envelope.** (§19.2)
3. **The curated catalog** — dealers never free-type make, model, variant, colour or RTO. (§6.2)
4. **`Listing` separate from `Vehicle`.** (§6.1)
5. **Ports for search, storage, cache, mail and SMS**, each with one real adapter today. (§5.1)
6. **The credit ledger as an append-only table with a materialised balance.** (§26.2) — retrofitting auditability onto a counter after a dealer disputes a charge means reconstructing history you never recorded.
