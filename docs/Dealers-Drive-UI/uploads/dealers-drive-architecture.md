# Dealers-Drive — Technical Architecture & Product Blueprint

**Prepared for:** Founder / Solo Engineer
**Prepared by:** CTO / Principal Architect advisory
**Date:** August 2026
**Status:** Recommended architecture — implementable as-is

> **Note on freshness:** pricing, service tiers and SDK details below reflect my knowledge as of mid-2026. Verify current pricing pages before committing spend. Anything labelled _Inference_ is my professional judgement, not verified public fact.

---

## Table of contents

| #   | Section                                                               |
| --- | --------------------------------------------------------------------- |
| 0   | Executive recommendation (read this first)                            |
| 1   | Where I disagree with your assumptions                                |
| 2   | Recommended technology stack                                          |
| 3   | Logical architecture                                                  |
| 4   | Deployment architecture                                               |
| 5   | Repository strategy (monorepo decision)                               |
| 6   | Backend architecture                                                  |
| 7   | Database architecture                                                 |
| 8   | Multi-tenancy                                                         |
| 9   | Authentication & authorization                                        |
| 10  | API design                                                            |
| 11  | Search architecture                                                   |
| 12  | Image & media architecture                                            |
| 13  | Payments & monetization architecture                                  |
| 14  | Caching                                                               |
| 15  | Background jobs                                                       |
| 16  | Events & the outbox                                                   |
| 17  | Frontend architecture                                                 |
| 18  | UI component library decision (+ what is actually known about Cars24) |
| 19  | Shared types & API contracts                                          |
| 20  | SEO architecture                                                      |
| 21  | Security architecture                                                 |
| 22  | Observability                                                         |
| 23  | DevOps & environments                                                 |
| 24  | Testing strategy                                                      |
| 25  | Design system & Figma structure                                       |
| 26  | Branding & logo direction                                             |
| 27  | Scaling roadmap: MVP → massive scale                                  |
| 28  | Cost model                                                            |
| 29  | ADR decision table                                                    |
| 30  | Build now / prepare / do not build                                    |
| 31  | Solo-developer implementation roadmap                                 |
| 32  | Risks & architectural mistakes to avoid                               |
| 33  | Business evolution (Phases 1–7)                                       |
| 34  | Your first week                                                       |

---

# 0. Executive recommendation

**One paragraph:** Build Dealers-Drive as a **Turborepo monorepo** containing a **Next.js 15 App Router** web app and a **NestJS (Fastify) modular-monolith REST API**, both independently deployable, sharing a **PostgreSQL 16** database via **Prisma**, with **Cloudflare R2** for media, **Razorpay** for payments, **pg-boss** (Postgres-backed) for background jobs, and **Postgres full-text + trigram search** for the first 100k listings. No Redis, no MongoDB, no Elasticsearch, no Kafka, no Kubernetes, no microservices on day one. Every one of those is deliberately deferred behind a named trigger, and the code is structured so each can be dropped in later without a rewrite.

**The five decisions that matter most, and my verdict:**

| Decision          | Verdict                                        | One-line reason                                                                                                                                            |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database          | **PostgreSQL only**                            | Your domain is money + ownership + lifecycle. That is relational. JSONB covers the variable-spec problem MongoDB was supposed to solve.                    |
| API style         | **REST + OpenAPI** (no GraphQL)                | One first-party client, heavy CDN caching needs, solo dev. GraphQL costs you weeks and buys you nothing yet.                                               |
| Repos             | **Monorepo** (`dealers-drive/`), not two repos | You asked for two repos. For a solo dev sharing types across a fast-moving contract, two repos is a self-inflicted tax. Still two independent deployments. |
| Backend shape     | **Modular monolith**                           | Your instinct is right. I'll tell you _exactly_ how to draw the module boundaries so extraction is cheap later.                                            |
| Component library | **Local `components/` folder** in the web app  | A separate `dealers-drive-ui` repo at your stage is pure overhead. Trigger for extraction defined in §18.                                                  |

**The one architectural idea that is genuinely load-bearing for your business model:** the **listing-credit ledger** (§13). Dealers buy listing credits; publishing a vehicle atomically consumes one. The dealer API _physically cannot_ set a listing to `ACTIVE`. This is the difference between a marketplace that can be defrauded and one that cannot.

**Timeline:** a competent solo developer, working full-time, ships this MVP to production in **16–20 weeks**. Infrastructure cost at launch: **$45–110/month**.

---

# 1. Where I disagree with your assumptions

You asked to be challenged. Here is where I'd push back, in order of how much money and time it will save you.

### 1.1 "Two repositories: `dealers-drive-web` and `dealers-drive-api`" — ❌ Change this

Your underlying requirement is **independent deployability**. You have conflated that with **repository separation**. They are unrelated. Vercel and every modern CI system deploy per-directory from a monorepo with path filters.

What two repos actually costs a solo developer:

- Every API contract change becomes a two-PR, two-review, two-deploy dance. You will change the contract ~40 times in the first three months.
- Shared TypeScript types require publishing a private npm package, versioning it, and bumping it. That is 15 minutes of ceremony per contract change, several times a day.
- Local development requires two clones, two branch states, two `.env` files that drift.
- Atomic changes are impossible. "Add `emiPerMonth` to the vehicle response and render it" becomes two PRs that can deploy out of order.

**Recommendation: single repo `dealers-drive/`, two deploy targets.** Revisit if you ever have separate teams with separate release cadences and separate on-call — realistically 15+ engineers. Migration monorepo → multi-repo is trivial (`git subtree split`); the reverse is also easy. This is a low-regret decision either way, but the monorepo is strictly faster _now_.

### 1.2 "PostgreSQL + MongoDB if there's a legitimate reason" — ❌ There isn't one

The usual argument is "vehicle specs vary by make/model, so use a document store." Postgres `JSONB` with GIN indexes handles that natively, inside the same transaction as your money. Running two databases means two backup strategies, two failure modes, two consistency models, no cross-database joins for reporting, and dual-write bugs — the single most common source of data corruption in early-stage marketplaces. **Postgres only.** Details and schema in §7.

### 1.3 "Vehicle" and "Listing" are not the same thing — model both

Almost every dealer marketplace conflates these and regrets it. A **Vehicle** is a physical asset a dealer owns (VIN, registration, km, photos). A **Listing** is a _paid publication window_ for that vehicle (activated at time T, expires at T+90d, cost 1 credit). One vehicle can be listed, expire, be re-listed, be sold. Your entire revenue model attaches to Listing, not Vehicle. Separating them costs you one extra table now and saves a painful migration in month 8.

### 1.4 Don't build three separate frontend apps

You have three audiences (customer, dealer, admin). The instinct is three Next.js apps. **Don't.** Use one Next.js app with three route groups: `(public)`, `(dealer)`, `(admin)`. One deploy, one auth flow, one component set. Split the admin app out later when its bundle or its access model justifies it (§17.6).

### 1.5 Your MVP scope is too large — cut it

From your list, defer to post-launch: **Reviews, Dealer Staff sub-accounts, Subscriptions, Premium analytics, Dispute handling, Featured listings, SMS.** None of them validate the core question, which is: _will independent dealers pay to list vehicles here, and will customers generate leads?_ Everything that doesn't answer that is a distraction. The Sprint plan in §31 reflects this.

### 1.6 "Preferably AWS" — ⚠️ Not on day one

AWS is the right _destination_. It is the wrong _starting point_ for a solo developer. You would spend 2–3 weeks on VPCs, security groups, IAM, ECS task definitions, ALBs, and RDS parameter groups before shipping a single feature. Start on managed PaaS (Vercel + Render/Fly + Neon), keep everything Dockerized and IaC-ready, and migrate to AWS ECS Fargate + RDS when you have real traffic or a compliance reason. The migration is roughly one week of work at that point. Full reasoning in §23.

### 1.7 One thing you didn't ask about that will hurt you: the vehicle taxonomy

Make / Model / Variant / Year is the hardest "boring" problem in this domain. If dealers free-type "Maruti Suzuki Swift VXi" vs "Swift VXI" vs "MARUTI SWIFT vxi", your search, your filters, and your SEO all die at once. **You need a curated, seeded catalog with dealer input constrained to dropdowns.** Treat this as a first-class module, not an afterthought. This is section §7.4 and it belongs in Sprint 2.

---

# 2. Recommended technology stack

## 2.1 The stack (MVP)

| Layer            | Choice                                           | Why this, not the alternative                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web framework    | **Next.js 15, App Router**                       | Your constraint. Also correct: SEO is existential here and RSC + ISR gives you server-rendered, cacheable listing pages for free.                                                                                                      |
| Language         | **TypeScript, strict, everywhere**               | Single language across web/API/scripts. Types are your API contract (§19).                                                                                                                                                             |
| UI styling       | **Tailwind CSS v4 + CVA**                        | Token-driven, no runtime cost, trivially themable per the design system in §25.                                                                                                                                                        |
| UI primitives    | **Radix UI primitives**, styled by you           | Accessibility for free (focus traps, ARIA, keyboard nav) without inheriting someone else's visual identity.                                                                                                                            |
| API framework    | **NestJS on Fastify adapter**                    | Gives a solo dev enforced module boundaries, DI, guards, interceptors, class-validator DTOs, and auto-generated OpenAPI. That structure is what makes later service extraction cheap. Express is faster to start and worse in month 6. |
| ORM              | **Prisma 6**                                     | Best-in-class migrations and DX. Escape hatch to raw SQL (`$queryRaw`) for the search query, which you _will_ need.                                                                                                                    |
| Database         | **PostgreSQL 16**                                | §7.                                                                                                                                                                                                                                    |
| Job queue        | **pg-boss** (Postgres-backed)                    | Real queue semantics — retries, backoff, scheduling, dead-letter — with **zero new infrastructure**. Swap to BullMQ+Redis at ~50 jobs/sec.                                                                                             |
| Object storage   | **Cloudflare R2**                                | S3-compatible API, **zero egress fees**. For an image-heavy marketplace, egress is your #2 cost driver. §12.                                                                                                                           |
| Image delivery   | **Cloudflare Images / Image Resizing**           | On-the-fly WebP/AVIF, per-width variants, edge cache.                                                                                                                                                                                  |
| Payments         | **Razorpay** (India) behind a provider interface | §13. Stripe if you're not India-first.                                                                                                                                                                                                 |
| Email            | **Resend** (or AWS SES)                          | Transactional only at MVP.                                                                                                                                                                                                             |
| Auth             | **Custom, cookie sessions in Postgres**          | §9. ~250 lines. Avoids vendor lock-in on your most business-critical table.                                                                                                                                                            |
| Error tracking   | **Sentry** (free tier)                           | Non-negotiable from day one.                                                                                                                                                                                                           |
| Analytics        | **PostHog Cloud** (free tier) + GA4              | Product analytics + the marketing data you'll be asked for.                                                                                                                                                                            |
| Hosting (web)    | **Vercel**                                       | Next.js ISR/RSC works properly here with no configuration.                                                                                                                                                                             |
| Hosting (API)    | **Render** or **Fly.io**                         | Dockerfile in, HTTPS service out.                                                                                                                                                                                                      |
| Database hosting | **Neon** (or Supabase)                           | Managed Postgres, branching for preview environments, generous free/hobby tier.                                                                                                                                                        |
| CI               | **GitHub Actions**                               | §23.                                                                                                                                                                                                                                   |
| Monorepo tooling | **Turborepo + pnpm workspaces**                  | Task caching, path-filtered CI.                                                                                                                                                                                                        |

## 2.2 What is deliberately NOT in the MVP

| Technology                             | Verdict                    | Trigger to introduce                                                                                          |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Redis                                  | 🟡 Prepare                 | Session count > ~50k active, or p95 search latency > 300ms after Postgres tuning, or job throughput > 50/sec. |
| Elasticsearch / OpenSearch / Typesense | 🟡 Prepare                 | > 100,000 active listings **or** typo-tolerance/relevance becomes a conversion problem.                       |
| MongoDB                                | 🔴 Never (for this domain) | —                                                                                                             |
| Kafka                                  | 🔴 Not yet                 | > 3 independently deployed services that need a durable shared event log. Realistically Series B.             |
| Kubernetes                             | 🔴 Not yet                 | > 8 services and > 6 engineers. Fargate covers you to enormous scale.                                         |
| Microservices                          | 🔴 Not yet                 | Team > 12, or one module has a genuinely different scaling profile (search, image processing).                |
| GraphQL                                | 🔴 Not yet                 | Third-party API consumers or >3 divergent client types.                                                       |
| Terraform                              | 🟡 Prepare                 | The day you move to AWS. Not before — PaaS config is 5 dashboard clicks.                                      |
| Feature flag service                   | 🟡 Prepare                 | Use a `platform_config` table now; buy LaunchDarkly/PostHog flags at ~10 engineers.                           |

---

# 3. Logical architecture

```
                          ┌───────────────────────────────────────────┐
                          │              ACTORS                       │
                          │  Customer   Dealer   Dealer Staff   Admin │
                          └───────────────────────────────────────────┘
                                            │
                                    HTTPS / cookies
                                            │
        ┌───────────────────────────────────▼────────────────────────────────────┐
        │                    dealers-drive-web  (Next.js 15, App Router)         │
        │                                                                        │
        │   (public)            (dealer)              (admin)                    │
        │   ├ /                 ├ /dealer             ├ /admin                   │
        │   ├ /cars/...         ├ /dealer/inventory   ├ /admin/dealers           │
        │   ├ /car/[slug]       ├ /dealer/vehicles    ├ /admin/listings          │
        │   ├ /dealers/[slug]   ├ /dealer/billing     ├ /admin/payments          │
        │   └ /saved            └ /dealer/analytics   └ /admin/config            │
        │                                                                        │
        │   RSC (server fetch) ── Route Handlers (BFF: auth cookie, uploads)     │
        │   Server Actions (mutations)   Client Components (filters, gallery)    │
        └───────────────────────────────────┬────────────────────────────────────┘
                                            │  REST/JSON over HTTPS
                                            │  (server-to-server, internal token
                                            │   + forwarded user session)
        ┌───────────────────────────────────▼────────────────────────────────────┐
        │              dealers-drive-api  (NestJS / Fastify — modular monolith)  │
        │                                                                        │
        │  ┌── HTTP layer ──────────────────────────────────────────────────┐   │
        │  │ Guards (auth, RBAC, tenant)  Interceptors (logging, tracing)   │   │
        │  │ Pipes (Zod/class-validator)  Filters (RFC-9457 errors)         │   │
        │  │ RateLimit  Idempotency  RequestContext(dealerId,userId,traceId)│   │
        │  └────────────────────────────────────────────────────────────────┘   │
        │                                                                        │
        │  ┌── CORE DOMAIN MODULES (each: controller│service│repo│events) ──┐    │
        │  │ identity  dealers  catalog  vehicles  listings  media          │    │
        │  │ search    billing  inquiries favorites notifications  admin    │    │
        │  └────────────────────────────────────────────────────────────────┘    │
        │                                                                        │
        │  ┌── PLATFORM MODULES ───────────────────────────────────────────┐    │
        │  │ events(in-proc bus + outbox)  jobs(pg-boss)  audit  config    │    │
        │  │ storage(R2)  payments(Razorpay adapter)  mail  telemetry      │    │
        │  └────────────────────────────────────────────────────────────────┘    │
        └───────────────────────────────────┬────────────────────────────────────┘
                                            │
        ┌───────────────┬───────────────────┼──────────────────┬────────────────┐
        ▼               ▼                   ▼                  ▼                ▼
  ┌───────────┐  ┌────────────┐     ┌──────────────┐   ┌────────────┐  ┌─────────────┐
  │PostgreSQL │  │ pg-boss    │     │ Cloudflare   │   │  Razorpay  │  │  Resend     │
  │ (primary) │  │ (same DB,  │     │ R2 + Images  │   │  (payments │  │  (email)    │
  │ + JSONB   │  │  own       │     │ (media+CDN)  │   │  +webhooks)│  │             │
  │ + FTS/GIN │  │  schema)   │     │              │   │            │  │             │
  └───────────┘  └────────────┘     └──────────────┘   └────────────┘  └─────────────┘

  Observability plane (cross-cutting): Sentry (errors) · pino→ Better Stack (logs)
                                       PostHog (product) · UptimeRobot (synthetics)
```

**Reading the diagram:**

- The browser talks to **Next.js only**. The API is not publicly exposed to the browser for authenticated dealer/admin traffic — Next.js server components and route handlers proxy to it. This gives you one origin, httpOnly cookies with no CORS gymnastics, and a natural place to put per-page caching.
- Public read endpoints (`GET /v1/vehicles`) _are_ safe to expose directly and you should allow the browser to hit them for client-side filter interactions, since they're cacheable and unauthenticated.
- Every arrow leaving the API to a third party goes through an **adapter interface** in a platform module. That is what makes Razorpay→Stripe or R2→S3 a one-file change.

## 3.1 Actor flows

```
CUSTOMER FLOW
Browser ─▶ Next.js RSC ─▶ GET /v1/vehicles?facets ─▶ vehicles+search module
                                                          │
                                            Postgres (listing_search table)
       ◀── ISR-cached HTML (60s) ◀── JSON ◀──────────────┘
Images ─▶ Cloudflare CDN edge ─▶ R2 (origin)     [never touches the API]

DEALER FLOW
Browser ─▶ Next.js (dealer) route group ─▶ Server Action ─▶ POST /v1/dealer/vehicles
                                                       │  (session cookie → dealer_id
                                                       │   resolved server-side, NEVER
                                                       │   read from request body)
                                            vehicles module ─▶ tenant guard ─▶ Postgres
Image upload: Browser ─▶ POST /v1/dealer/media/presign ─▶ {url, fields}
              Browser ──── PUT direct to R2 ────▶ (bypasses API entirely)
              Browser ─▶ POST /v1/dealer/media/:id/commit ─▶ job: derivatives

ADMIN FLOW
Browser ─▶ Next.js (admin) ─▶ /v1/admin/* ─▶ admin module ─▶ domain services
                                                    │
                                             audit_logs (every write)

PAYMENT FLOW (server-authoritative)
Dealer ─▶ POST /v1/dealer/billing/orders ─▶ Razorpay order created, payment row = PENDING
Dealer ─▶ Razorpay Checkout (browser) ─▶ pays
Razorpay ─▶ POST /v1/webhooks/razorpay ─▶ verify HMAC ─▶ webhook_events (dedupe)
                                              │
                                    TX: payment=CAPTURED
                                        credit_ledger += N
                                        invoice created
                                        outbox: PaymentSucceeded
```

---

# 4. Deployment architecture

## 4.1 Stage 1 — MVP (launch → ~1,000 dealers)

```
   Cloudflare DNS + WAF (free tier)
            │
   ┌────────┴─────────┐
   ▼                  ▼
┌──────────────┐  ┌──────────────────┐        ┌─────────────────────┐
│   Vercel     │  │  Render / Fly.io │        │  Cloudflare R2      │
│ Next.js app  │─▶│  API container   │        │  + Images + CDN     │
│ Edge network │  │  1–2 instances   │        │  (media origin)     │
│ ISR cache    │  │  0.5–1 vCPU      │        └─────────────────────┘
└──────────────┘  │                  │
                  │  same image runs │        ┌─────────────────────┐
                  │  as worker proc  │───────▶│  Neon PostgreSQL    │
                  │  (pg-boss)       │        │  primary + branches │
                  └──────────────────┘        └─────────────────────┘

Environments: preview (per-PR, Neon branch) · staging (1 instance) · production
Total: ~$45–110/month
```

## 4.2 Stage 2 — Growth (1k–10k dealers, ~1–3M MAU)

```
   Cloudflare (WAF, bot mgmt, rate limiting at edge)
            │
   ┌────────┴──────────────────────────────┐
   ▼                                       ▼
Vercel (Pro)                    AWS ap-south-1 (or stay on Render)
Next.js                         ┌──────────────────────────────────┐
                                │ ALB                              │
                                │  ├ ECS Fargate: api      (2–6)   │
                                │  ├ ECS Fargate: worker   (2–4)   │
                                │  └ ECS Fargate: image-proc (1–3) │
                                │ RDS Postgres (Multi-AZ)          │
                                │  └ 1 read replica (analytics)    │
                                │ ElastiCache Redis (cache+BullMQ) │
                                │ Typesense Cloud (search)         │
                                │ S3 or R2 (media) + CDN           │
                                └──────────────────────────────────┘
```

## 4.3 Stage 3 — Scale (10k–100k dealers, 50M MAU)

```
Cloudflare  ─▶  Vercel Enterprise / self-hosted Next on ECS+CloudFront
                     │
              ┌──────┴──────┐
              ▼             ▼
        API gateway    Public read API (separate autoscaling group,
        (ALB/APIGW)     aggressively CDN-cached, read-replica only)
              │
   ┌──────────┼───────────┬──────────────┬───────────────┐
   ▼          ▼           ▼              ▼               ▼
 core-api  search-svc  media-svc     billing-svc     notification-svc
 (Fargate) (extracted) (extracted)   (extracted)     (extracted)
   │          │           │              │               │
   ▼          ▼           ▼              ▼               ▼
 RDS       OpenSearch   S3/R2         RDS (own       SQS/SNS
 writer    cluster      + Lambda      schema)        + SES/SMS
 + 3 read  (3 data      resize
 replicas   nodes)
   │
   ▼
 Aurora / partitioned tables + ClickHouse or Redshift for analytics
 Debezium → Kafka → analytics + search indexers (CDC, not dual-write)
```

Every arrow in Stage 3 exists because a specific Stage-2 metric turned red. None of it should be built speculatively. Triggers are tabulated in §27.

---

# 5. Repository strategy

## 5.1 The decision

**Recommendation: Option 2 — a single monorepo with independently deployable apps.**

```
dealers-drive/
├── apps/
│   ├── web/          → deploys to Vercel
│   └── api/          → deploys to Render/Fly (Docker)
├── packages/
│   ├── contracts/    → Zod schemas + inferred TS types (the API contract)
│   ├── config/       → eslint, tsconfig, tailwind preset
│   └── ui/           → [EMPTY until §18 trigger fires; do not create yet]
```

## 5.2 Comparison

| Criterion                   | Opt 1: web + api repos           | **Opt 2: monorepo**                                       | Opt 3: web + api + ui repos |
| --------------------------- | -------------------------------- | --------------------------------------------------------- | --------------------------- |
| Developer experience (solo) | Poor — context switching, drift  | **Excellent** — one clone, one branch                     | Worst                       |
| Atomic contract changes     | Impossible                       | **One PR**                                                | Impossible                  |
| Type sharing                | Private npm package + versioning | **Direct workspace import**                               | Two packages to version     |
| Deployment independence     | Yes                              | **Yes** (path-filtered CI)                                | Yes                         |
| CI cost/time                | 2 pipelines, no shared cache     | **1 pipeline, Turborepo cache, only affected apps build** | 3 pipelines                 |
| Onboarding a 2nd engineer   | 2 setups                         | **1 setup**                                               | 3 setups                    |
| Code ownership at 20+ eng   | Cleaner                          | CODEOWNERS per directory                                  | Cleanest                    |
| Complexity cost             | Low but recurring tax            | **Small one-time setup (~2 hours)**                       | High                        |
| Startup velocity            | Slower                           | **Fastest**                                               | Slowest                     |
| Migration out later         | n/a                              | `git subtree split` — ~1 hour                             | n/a                         |

**Why not Option 1, which you asked for:** the only real argument for it is "the backend team and frontend team release independently." You are one person. When that argument becomes true you'll have the budget and the hour it takes to split. Until then, Option 1 charges you a tax on every single feature.

**Path-filtered deployment (this is the whole trick):**

```yaml
# .github/workflows/deploy-api.yml
on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'packages/contracts/**', 'pnpm-lock.yaml']
```

Vercel does this natively via the "Ignored Build Step" setting: `npx turbo-ignore`. Independence: achieved. Repos required: one.

## 5.3 Full repository structure

```
dealers-drive/
├── .github/workflows/
│   ├── ci.yml                    # lint, typecheck, test — path filtered
│   ├── deploy-api.yml
│   └── deploy-web.yml
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx                      # homepage
│   │   │   │   │   ├── cars/
│   │   │   │   │   │   ├── page.tsx                  # /cars
│   │   │   │   │   │   ├── in/[city]/page.tsx        # /cars/in/mumbai
│   │   │   │   │   │   ├── in/[city]/[make]/page.tsx
│   │   │   │   │   │   ├── [make]/page.tsx
│   │   │   │   │   │   ├── [make]/[model]/page.tsx
│   │   │   │   │   │   └── [make]/[model]/[year]/page.tsx
│   │   │   │   │   ├── car/[slug]/                   # VDP
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── opengraph-image.tsx
│   │   │   │   │   │   └── loading.tsx
│   │   │   │   │   ├── dealers/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── [slug]/page.tsx
│   │   │   │   │   └── saved/page.tsx
│   │   │   │   ├── (dealer)/dealer/
│   │   │   │   │   ├── layout.tsx                    # auth gate + shell
│   │   │   │   │   ├── page.tsx                      # dashboard
│   │   │   │   │   ├── onboarding/page.tsx
│   │   │   │   │   ├── inventory/page.tsx
│   │   │   │   │   ├── vehicles/new/page.tsx
│   │   │   │   │   ├── vehicles/[id]/edit/page.tsx
│   │   │   │   │   ├── inquiries/page.tsx
│   │   │   │   │   └── billing/page.tsx
│   │   │   │   ├── (admin)/admin/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── dealers/page.tsx
│   │   │   │   │   ├── dealers/[id]/page.tsx
│   │   │   │   │   ├── listings/page.tsx
│   │   │   │   │   ├── payments/page.tsx
│   │   │   │   │   └── config/page.tsx
│   │   │   │   ├── (auth)/login|register|verify/
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/[...action]/route.ts     # cookie set/clear
│   │   │   │   │   └── revalidate/route.ts           # webhook from API
│   │   │   │   ├── sitemap.ts                        # index
│   │   │   │   ├── sitemaps/[type]/[page]/route.ts   # sharded
│   │   │   │   ├── robots.ts
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   └── not-found.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/          # Button, Input, Select, Dialog, Sheet, Badge…
│   │   │   │   ├── layout/      # Header, Footer, DealerShell, AdminShell
│   │   │   │   ├── vehicle/     # VehicleCard, Gallery, SpecTable, PriceBlock
│   │   │   │   ├── dealer/      # DealerBadge, DealerHeader, DealerCard
│   │   │   │   ├── search/      # FilterPanel, FacetGroup, SortSelect, Chips
│   │   │   │   └── forms/       # VehicleForm, InquiryForm, field wrappers
│   │   │   ├── features/        # co-located feature logic (hooks + actions)
│   │   │   │   ├── vehicles/{actions.ts,hooks.ts,schema.ts}
│   │   │   │   ├── search/{url-state.ts,facets.ts}
│   │   │   │   ├── billing/
│   │   │   │   └── auth/
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts   # typed fetch wrapper
│   │   │   │   ├── session.ts      # cookie read/verify (server only)
│   │   │   │   ├── seo.ts          # metadata + JSON-LD builders
│   │   │   │   ├── url.ts          # facet ⇄ URL canonicalization
│   │   │   │   └── format.ts       # ₹, km, EMI
│   │   │   └── styles/globals.css
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── tailwind.config.ts
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── modules/            # ← see §6
│       │   ├── platform/           # ← see §6
│       │   └── common/             # guards, filters, decorators, pipes
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed/{catalog.ts,cities.ts,admin.ts}
│       ├── test/
│       ├── Dockerfile
│       └── nest-cli.json
├── packages/
│   ├── contracts/src/{vehicle,dealer,listing,billing,common}.ts
│   └── config/{eslint,tsconfig,tailwind}/
├── docs/adr/0001-postgres-only.md …
├── docker-compose.yml              # local postgres + mailpit + minio
├── turbo.json
└── pnpm-workspace.yaml
```

---

# 6. Backend architecture

## 6.1 Modular monolith — and why your instinct is right

Your assumption is correct, and here is the argument you should be able to make to an investor or a future VP Eng:

Microservices solve an **organizational** problem (many teams needing independent release cadence), at the cost of a **distributed systems** problem (network partitions, eventual consistency, distributed transactions, service discovery, N deploy pipelines). You have one team of one. You would pay 100% of the cost for 0% of the benefit.

Concretely, in a microservices MVP, "publish a vehicle" becomes: vehicles-svc → billing-svc (consume credit) → listings-svc (activate) → search-svc (index). That is a distributed transaction requiring sagas and compensating actions. In a modular monolith it is one `prisma.$transaction()` and it is correct by construction.

**But** a modular monolith is only valuable if the modules are _actually_ modular. The failure mode is a "distributed ball of mud in one process." Three rules make it real:

1. **No module imports another module's repository, Prisma model, or internal service.** Cross-module access goes through the target module's exported `*.facade.ts` only. Enforce with ESLint `no-restricted-imports` — this is 20 lines of config and it is the single highest-leverage thing in this document.
2. **Cross-module side effects go through the event bus, not direct calls.** `listings` doesn't call `search.reindex()`; it emits `ListingActivated` and search subscribes.
3. **Every module owns its tables.** No other module writes them.

If you follow those three rules, extracting `search` or `media` into its own service later is a mechanical refactor: change the facade to an HTTP client, change the in-process bus to a broker. **Days, not months.**

## 6.2 Module organization

I've restructured your proposed domain list. Your list has 18 items; several are not modules, they are _tables_ or _cross-cutting platform concerns_, and treating them as modules creates artificial boundaries.

| Your item                    | My placement                                   | Why                                                                                             |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Authentication, Users        | → **`identity`**                               | One module. Sessions, credentials, and user records are one aggregate.                          |
| Dealers, Dealer Verification | → **`dealers`**                                | Verification is a state machine on the dealer aggregate, not a separate domain.                 |
| Vehicles, Inventory          | → **`vehicles`**                               | "Inventory" is a view over vehicles filtered by dealer. Not a module.                           |
| Vehicle Images               | → **`media`** (generic)                        | Make it polymorphic from day one — you'll need dealer logos, KYC docs, invoice PDFs.            |
| Listings, Subscriptions      | → **`listings`** + **`billing`**               | Listing lifecycle ≠ money. Split at the credit boundary.                                        |
| Payments                     | → **`billing`**                                | Payments, credits, invoices, plans: one bounded context, one ledger.                            |
| Search                       | → **`search`**                                 | Yes, real module. Deliberately isolated so it can be extracted first.                           |
| Favorites, Inquiries         | → **`engagement`**                             | Two small tables, one module. Splitting them is over-modularization.                            |
| Notifications                | → **`notifications`**                          | Real module (channel abstraction, templates, preferences).                                      |
| Reviews                      | → **`engagement`**, post-MVP                   | Not MVP.                                                                                        |
| Admin                        | → **`admin`**                                  | A _facade_ module: orchestrates other modules' facades, owns nothing but moderation queue.      |
| Analytics                    | → **platform/telemetry** + a reporting service | Not a domain module at MVP. Read from replica later.                                            |
| Audit Logs                   | → **platform/audit**                           | Cross-cutting concern, consumed via interceptor + events.                                       |
| —                            | + **`catalog`** (NEW)                          | Make/model/variant/year/body/fuel taxonomy + cities. You omitted this and it's critical (§1.7). |

### Recommended structure

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/           auth.guard.ts  roles.guard.ts  tenant.guard.ts
│   ├── decorators/       @CurrentUser  @RequirePermission  @Idempotent
│   ├── filters/          problem-details.filter.ts     (RFC 9457)
│   ├── interceptors/     logging  tracing  transform  audit
│   ├── pipes/            zod-validation.pipe.ts
│   └── request-context/  AsyncLocalStorage: {traceId,userId,dealerId,ip}
│
├── platform/                       # technical capabilities, no business rules
│   ├── database/       prisma.service.ts  transaction.manager.ts
│   ├── events/         event-bus.ts  outbox.service.ts  outbox.publisher.ts
│   ├── jobs/           queue.service.ts (pg-boss)  scheduler.ts
│   ├── storage/        storage.port.ts  r2.adapter.ts        ← swappable
│   ├── payments/       payment-gateway.port.ts  razorpay.adapter.ts ← swappable
│   ├── mail/           mailer.port.ts  resend.adapter.ts
│   ├── cache/          cache.port.ts  memory.adapter.ts      ← redis later
│   ├── audit/          audit.service.ts
│   ├── config/         env validation (zod) + platform_config table
│   └── telemetry/      logger (pino)  metrics  sentry
│
└── modules/
    ├── identity/       users, sessions, credentials, OTP, password reset
    ├── dealers/        dealer profile, KYC docs, verification state machine,
    │                   dealer_members (staff), slugs
    ├── catalog/        makes, models, variants, body/fuel/transmission,
    │                   cities & locality, feature taxonomy   [mostly read-only]
    ├── vehicles/       vehicle CRUD, spec JSONB, image ordering, ownership
    ├── listings/       listing lifecycle state machine, expiry, publish/unpublish
    ├── media/          presign, commit, derivatives, GC of orphans
    ├── search/         query builder, facet counts, denormalized index table,
    │                   reindex subscribers                  [extract first]
    ├── billing/        orders, payments, webhooks, credit ledger, invoices,
    │                   plans, pricing config
    ├── engagement/     inquiries (leads), favorites, (reviews later)
    ├── notifications/  templates, channel dispatch, preferences
    └── admin/          moderation queue, approvals, overrides, platform reports
```

### Inside a module (`vehicles` as the canonical example)

```
modules/vehicles/
├── vehicles.module.ts
├── api/
│   ├── dealer-vehicles.controller.ts     # /v1/dealer/vehicles
│   ├── public-vehicles.controller.ts     # /v1/vehicles
│   └── dto/                              # request/response, from @dd/contracts
├── domain/
│   ├── vehicle.entity.ts                 # invariants, not a Prisma model
│   ├── vehicle.events.ts                 # VehicleCreated, VehicleUpdated…
│   └── vehicle.policy.ts                 # canEdit(user, vehicle)
├── application/
│   ├── vehicles.service.ts               # orchestration + transactions
│   └── commands/                         # create, update, archive
├── infrastructure/
│   └── vehicles.repository.ts            # the ONLY place Prisma is touched
├── subscribers/
│   └── on-listing-expired.subscriber.ts
└── vehicles.facade.ts                    # ← the ONLY public export
```

**ESLint boundary enforcement (put this in on day one):**

```js
// .eslintrc — inside apps/api
'no-restricted-imports': ['error', { patterns: [{
  group: ['**/modules/*/application/**', '**/modules/*/infrastructure/**',
          '**/modules/*/domain/**'],
  message: 'Cross-module access must go through <module>.facade.ts',
}]}]
```

## 6.3 A concrete service showing the pattern

This is the "publish a vehicle" flow. It is the most important 30 lines in your backend, because it is where money, ownership, and lifecycle intersect.

```ts
// modules/listings/application/publish-listing.command.ts
@Injectable()
export class PublishListingCommand {
  constructor(
    private readonly tx: TransactionManager,
    private readonly listings: ListingsRepository,
    private readonly vehicles: VehiclesFacade, // facade, not repository
    private readonly billing: BillingFacade, // facade, not repository
    private readonly outbox: OutboxService,
  ) {}

  async execute(input: { vehicleId: string; ctx: RequestContext }) {
    const { dealerId, userId } = input.ctx; // ← from session, NEVER from body

    return this.tx.run(async (trx) => {
      const vehicle = await this.vehicles.getOwnedBy(input.vehicleId, dealerId, trx);
      if (!vehicle) throw new NotFoundError('vehicle'); // 404, not 403 —
      // don't leak existence
      if (!vehicle.isComplete())
        throw new DomainError('VEHICLE_INCOMPLETE', { missing: vehicle.missingFields() });
      if (vehicle.imageCount < 3) throw new DomainError('MIN_IMAGES_REQUIRED');

      // Atomically consume one listing credit. Throws if balance < 1.
      const credit = await this.billing.consumeListingCredit(
        { dealerId, reason: 'LISTING_PUBLISH', refId: input.vehicleId },
        trx,
      );

      const listing = await this.listings.create(
        {
          vehicleId: vehicle.id,
          dealerId,
          status: 'PENDING_REVIEW', // ← admin gate, MVP: auto-approve
          creditLedgerId: credit.id,
          expiresAt: addDays(new Date(), 90),
        },
        trx,
      );

      await this.outbox.publish(
        'ListingCreated',
        {
          listingId: listing.id,
          vehicleId: vehicle.id,
          dealerId,
        },
        trx,
      ); // ← same transaction = no lost events

      return listing;
    });
  }
}
```

Note what is **not** here: no HTTP call to a payment service, no `search.index()` call, no email send. Those all happen off the back of the outbox event, asynchronously, and cannot roll back your money.

---

# 7. Database architecture

## 7.1 The verdict: PostgreSQL only

Let me evaluate this per-entity rather than in the abstract, because that's the only way to make the call honestly.

| Entity                       | Dominant access pattern                               | Needs ACID w/ others?        | Relational?               | Verdict                                                                  |
| ---------------------------- | ----------------------------------------------------- | ---------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| Users, Sessions              | Point lookup by email/token                           | Yes (with dealer membership) | Yes                       | **Postgres**                                                             |
| Dealers                      | Point lookup + admin list/filter                      | Yes (with payments)          | Strongly                  | **Postgres**                                                             |
| Dealer members / staff       | Join on user + dealer                                 | Yes                          | Strongly                  | **Postgres**                                                             |
| Catalog (make/model/variant) | Read-heavy, tiny, hierarchical                        | No                           | Strongly                  | **Postgres** (cache in memory)                                           |
| Vehicles                     | Filtered range queries + faceting; **variable specs** | Yes (with listings/credits)  | Mostly, + JSONB for specs | **Postgres + JSONB**                                                     |
| Listings                     | State machine, expiry sweeps                          | **Critically yes**           | Strongly                  | **Postgres**                                                             |
| Payments                     | Financial, must be exactly-once                       | **Absolutely**               | Strongly                  | **Postgres**                                                             |
| Credit ledger                | Append-only, balance must be correct                  | **Absolutely**               | Strongly                  | **Postgres**                                                             |
| Invoices                     | Immutable records, sequential numbering               | Yes                          | Strongly                  | **Postgres**                                                             |
| Inquiries (leads)            | Insert-heavy, read by dealer                          | Mildly                       | Yes                       | **Postgres**                                                             |
| Favorites                    | Join table, high write                                | No                           | Yes                       | **Postgres**                                                             |
| Reviews                      | Moderated content                                     | Yes                          | Yes                       | **Postgres**                                                             |
| Audit logs                   | Append-only, high volume, rarely read                 | No                           | Semi                      | **Postgres** (partitioned by month) → later object storage or ClickHouse |
| Search index                 | Complex multi-facet ranked queries                    | No                           | Denormalized              | **Postgres now → Typesense/OpenSearch later**                            |
| Analytics events             | Enormous volume, aggregate reads                      | No                           | Columnar                  | **PostHog now → ClickHouse later**                                       |

**Result: 13 of 15 are unambiguously Postgres.** The two that aren't (search index, analytics events) are _specialised engines_, not MongoDB.

### The "but vehicle specs are variable" argument, addressed directly

This is the only genuine argument for MongoDB, and Postgres answers it completely:

```sql
-- Variable specs live in JSONB with a GIN index
ALTER TABLE vehicles ADD COLUMN specs JSONB NOT NULL DEFAULT '{}';
CREATE INDEX idx_vehicles_specs ON vehicles USING GIN (specs jsonb_path_ops);

-- Query it like a document store:
SELECT * FROM vehicles WHERE specs @> '{"sunroof": true, "airbags": 6}';
SELECT * FROM vehicles WHERE (specs->>'bootSpaceLitres')::int > 400;
```

You get schemaless flexibility, indexed queries, _and_ the ability to join it to `payments` inside a transaction. MongoDB gives you the first two and takes away the third. That is a strictly worse trade for a marketplace whose core loop is "money in → listing live."

### What running two databases would actually cost you

- Two backup/restore/PITR procedures to test (and you _will_ need to test them).
- No foreign keys between vehicles and dealers → orphaned inventory when a dealer is deleted.
- No transactional consistency between "credit consumed" and "listing created."
- Dual-write drift: the classic bug is the Mongo write succeeding and the Postgres write failing, leaving a listing that is live but unpaid.
- Reporting requires application-level joins or an ETL pipeline you have to build and operate.
- 2× the operational surface for a solo developer.

**Final answer: PostgreSQL 16, single database, single schema. No MongoDB.** Revisit only if you build a genuinely document-shaped, high-write, non-transactional subsystem (e.g. dealer CRM activity feeds at Phase 3) — and even then, Postgres JSONB is the first thing to try.

## 7.2 Core schema (abridged Prisma / SQL)

```prisma
// ─── IDENTITY ────────────────────────────────────────────────────────────
model User {
  id            String    @id @default(uuid()) @db.Uuid
  email         String?   @unique
  phone         String?   @unique          // India: phone is the real identifier
  passwordHash  String?
  emailVerifiedAt DateTime?
  phoneVerifiedAt DateTime?
  status        UserStatus @default(ACTIVE)   // ACTIVE SUSPENDED DELETED
  isPlatformAdmin Boolean  @default(false)
  adminRole     AdminRole?                    // SUPPORT MODERATOR SUPER_ADMIN
  createdAt     DateTime  @default(now())
  sessions      Session[]
  memberships   DealerMember[]
  @@index([createdAt])
}

model Session {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @db.Uuid
  tokenHash  String   @unique              // SHA-256 of the opaque cookie value
  expiresAt  DateTime
  revokedAt  DateTime?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())
  @@index([userId, revokedAt])
  @@index([expiresAt])
}

// ─── DEALERS (the tenant) ────────────────────────────────────────────────
model Dealer {
  id            String   @id @default(uuid()) @db.Uuid
  slug          String   @unique             // "sharma-motors-andheri"
  brandName     String                       // shown on every vehicle card
  legalName     String
  gstin         String?
  panMasked     String?
  logoMediaId   String?  @db.Uuid
  about         String?
  status        DealerStatus @default(DRAFT)
  // DRAFT → PENDING_PAYMENT → PENDING_VERIFICATION → ACTIVE
  //       → SUSPENDED → REJECTED → CLOSED
  cityId        String?  @db.Uuid
  addressLine   String?
  pincode       String?
  lat           Float?
  lng           Float?
  contactPhone  String?
  contactEmail  String?
  onboardingPaidAt DateTime?
  verifiedAt    DateTime?
  suspendedAt   DateTime?
  suspensionReason String?
  ratingAvg     Decimal? @db.Decimal(3,2)    // denormalized
  activeListings Int     @default(0)         // denormalized counter
  createdAt     DateTime @default(now())
  members       DealerMember[]
  vehicles      Vehicle[]
  documents     DealerDocument[]
  @@index([status, cityId])
}

model DealerMember {
  id          String   @id @default(uuid()) @db.Uuid
  dealerId    String   @db.Uuid
  userId      String   @db.Uuid
  role        DealerRole                    // OWNER | MANAGER | SALES
  permissions String[]                      // grants beyond the role
  status      MemberStatus @default(ACTIVE)
  invitedAt   DateTime?
  @@unique([dealerId, userId])
  @@index([userId])
}

model DealerDocument {                       // KYC
  id         String @id @default(uuid()) @db.Uuid
  dealerId   String @db.Uuid
  type       DocType     // GST_CERT | PAN | TRADE_LICENSE | ADDRESS_PROOF
  mediaId    String @db.Uuid
  status     DocStatus  @default(PENDING)    // PENDING APPROVED REJECTED
  reviewedBy String? @db.Uuid
  reviewNote String?
  @@index([dealerId, status])
}

// ─── CATALOG (curated taxonomy — §1.7) ───────────────────────────────────
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

// ─── VEHICLES (the asset) ────────────────────────────────────────────────
model Vehicle {
  id             String  @id @default(uuid()) @db.Uuid
  dealerId       String  @db.Uuid              // ← tenant key on EVERY row
  makeId         String  @db.Uuid
  modelId        String  @db.Uuid
  variantId      String? @db.Uuid
  year           Int
  pricePaise     BigInt                        // ALWAYS integer minor units
  kmDriven       Int
  fuel           FuelType
  transmission   Transmission
  bodyType       BodyType
  ownerNumber    Int                           // 1st, 2nd, 3rd owner
  color          String?
  registrationState String?
  regNumberMasked String?                      // "MH01••4321" — never full
  insuranceValidTill DateTime?
  cityId         String  @db.Uuid
  lat            Float?
  lng            Float?
  description    String?
  features       String[]                      // taxonomy-constrained
  specs          Json    @default("{}")        // ← JSONB, variable specs
  condition      Condition @default(GOOD)
  status         VehicleStatus @default(DRAFT) // DRAFT READY ARCHIVED SOLD
  primaryMediaId String? @db.Uuid
  slug           String  @unique               // 2021-toyota-fortuner-…-a1b2c3
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?                     // soft delete
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

model Media {                                   // polymorphic
  id         String @id @default(uuid()) @db.Uuid
  dealerId   String? @db.Uuid                   // tenant key (null = platform)
  ownerType  MediaOwner   // VEHICLE | DEALER_LOGO | KYC_DOC | INVOICE
  storageKey String @unique                     // r2 object key
  mimeType   String
  bytes      Int
  width      Int?
  height     Int?
  checksum   String?
  status     MediaStatus @default(PENDING)      // PENDING READY FAILED ORPHAN
  createdAt  DateTime @default(now())
  @@index([status, createdAt])                  // orphan GC sweep
}

// ─── LISTINGS (the paid publication window — §1.3) ───────────────────────
model Listing {
  id             String @id @default(uuid()) @db.Uuid
  vehicleId      String @db.Uuid
  dealerId       String @db.Uuid
  status         ListingStatus @default(PENDING_REVIEW)
  // PENDING_REVIEW → ACTIVE → (PAUSED | EXPIRED | SOLD | REJECTED | REMOVED)
  creditLedgerId String? @db.Uuid            // which credit paid for this
  activatedAt    DateTime?
  expiresAt      DateTime?
  soldAt         DateTime?
  rejectionReason String?
  boostLevel     Int @default(0)             // featured listings later
  viewCount      Int @default(0)             // batched increments
  inquiryCount   Int @default(0)
  @@index([status, expiresAt])               // expiry sweeper
  @@index([dealerId, status])
  @@unique([vehicleId, status], map: "uniq_active_listing_per_vehicle")
  //  ^ partial unique index in raw SQL: WHERE status = 'ACTIVE'
}

// ─── BILLING ─────────────────────────────────────────────────────────────
model Payment {
  id               String @id @default(uuid()) @db.Uuid
  dealerId         String @db.Uuid
  provider         String                    // "razorpay"
  providerOrderId  String @unique
  providerPaymentId String? @unique
  purpose          PaymentPurpose            // ONBOARDING | LISTING_CREDITS | BOOST
  quantity         Int    @default(1)         // e.g. 20 credits
  amountPaise      BigInt
  taxPaise         BigInt @default(0)
  currency         String @default("INR")
  status           PaymentStatus @default(CREATED)
  // CREATED → ATTEMPTED → CAPTURED | FAILED → REFUNDED | PARTIALLY_REFUNDED
  idempotencyKey   String @unique
  failureReason    String?
  rawProviderPayload Json?
  createdAt        DateTime @default(now())
  capturedAt       DateTime?
  @@index([dealerId, createdAt])
  @@index([status, createdAt])
}

model CreditLedger {                          // APPEND-ONLY. Never UPDATE.
  id           String @id @default(uuid()) @db.Uuid
  dealerId     String @db.Uuid
  delta        Int                            // +20 purchase, -1 publish
  balanceAfter Int                            // running balance, computed in TX
  reason       CreditReason  // PURCHASE | PUBLISH | EXPIRY_REFUND | ADMIN_GRANT
  refType      String?
  refId        String? @db.Uuid
  note         String?
  createdAt    DateTime @default(now())
  @@index([dealerId, createdAt])
}

model Invoice {
  id         String @id @default(uuid()) @db.Uuid
  dealerId   String @db.Uuid
  number     String @unique                   // DD/2026-27/000142 — sequential
  paymentId  String @unique @db.Uuid
  subtotalPaise BigInt
  taxPaise   BigInt
  totalPaise BigInt
  pdfMediaId String? @db.Uuid
  issuedAt   DateTime @default(now())
}

model WebhookEvent {                          // idempotency + replay
  id              String @id @default(uuid()) @db.Uuid
  provider        String
  providerEventId String
  eventType       String
  payload         Json
  signatureValid  Boolean
  status          WebhookStatus @default(RECEIVED)  // RECEIVED PROCESSED FAILED
  attempts        Int @default(0)
  lastError       String?
  receivedAt      DateTime @default(now())
  processedAt     DateTime?
  @@unique([provider, providerEventId])       // ← the dedupe guarantee
}

// ─── ENGAGEMENT ──────────────────────────────────────────────────────────
model Inquiry {
  id        String @id @default(uuid()) @db.Uuid
  vehicleId String @db.Uuid
  listingId String? @db.Uuid
  dealerId  String @db.Uuid                   // denormalized for tenant filter
  userId    String? @db.Uuid                  // null = guest lead
  name      String
  phone     String
  email     String?
  message   String?
  source    String                            // "vdp" | "dealer_page" | "call"
  status    InquiryStatus @default(NEW)        // NEW CONTACTED CLOSED SPAM
  createdAt DateTime @default(now())
  @@index([dealerId, status, createdAt])
  @@index([vehicleId])
}

model Favorite {
  userId    String @db.Uuid
  vehicleId String @db.Uuid
  createdAt DateTime @default(now())
  @@id([userId, vehicleId])
  @@index([vehicleId])
}

// ─── PLATFORM ────────────────────────────────────────────────────────────
model AuditLog {
  id         BigInt @id @default(autoincrement())
  actorType  String              // USER | DEALER_MEMBER | ADMIN | SYSTEM
  actorId    String? @db.Uuid
  dealerId   String? @db.Uuid
  action     String              // "listing.activated"
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ip         String?
  traceId    String?
  createdAt  DateTime @default(now())
  @@index([entityType, entityId, createdAt])
  @@index([dealerId, createdAt])
}   // PARTITION BY RANGE (createdAt) — monthly, from day one

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

model PlatformConfig {              // pricing, flags, toggles — no redeploys
  key       String @id             // "listing_credit_price_paise"
  value     Json
  updatedBy String? @db.Uuid
  updatedAt DateTime @updatedAt
}
```

## 7.3 Non-obvious modelling decisions (and why)

| Decision                                                      | Rationale                                                                                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All money as `BigInt` paise/cents**                         | Floating-point money is a bug, not a style choice. Never `Float`, never `Decimal` for currency arithmetic in the app layer.                                                                         |
| **`CreditLedger` is append-only with `balanceAfter`**         | You can reconstruct any dealer's balance at any point in time, reconcile against payments, and prove correctness to an auditor. A mutable `credits_remaining` integer column cannot do any of that. |
| **`Listing` separate from `Vehicle`**                         | §1.3. Revenue attaches to publication windows, not assets.                                                                                                                                          |
| **Partial unique index on active listings**                   | `CREATE UNIQUE INDEX ON listings (vehicle_id) WHERE status = 'ACTIVE';` — the database, not application code, guarantees one live listing per vehicle.                                              |
| **Soft delete (`deletedAt`) on vehicles, hard delete never**  | Dealers delete vehicles by accident; buyers bookmark URLs; SEO needs 410 vs 404 distinction; disputes need history.                                                                                 |
| **Denormalized counters (`activeListings`, `ratingAvg`)**     | Avoids `COUNT(*)` on every dealer page. Updated via event subscribers, reconciled nightly by a job.                                                                                                 |
| **`dealerId` on `Inquiry` and `Media` even though derivable** | Tenant filtering must be a single indexed predicate, never a join. This is the multi-tenancy safety net (§8).                                                                                       |
| **`regNumberMasked`**                                         | Full registration numbers are PII and enable vehicle-history scraping. Store masked; keep the full value encrypted in a separate column only if a business process needs it.                        |
| **`slug` on vehicle includes a short id**                     | `2021-toyota-fortuner-4x2-at-mumbai-a1b2c3` — human/SEO readable, collision-free, and lets you look up by the short id alone.                                                                       |
| **Audit log partitioned monthly from day one**                | Retrofitting partitioning on a 500M-row table is a maintenance window. Doing it now is 10 lines.                                                                                                    |

## 7.4 The catalog problem (do not skip this)

Constrain dealer input to your taxonomy:

- Dealer picks **Make → Model → Variant** from dropdowns sourced from `catalog`. Free text is not allowed for these fields.
- `features` is a fixed taxonomy (`SUNROOF`, `ABS`, `REVERSE_CAMERA`…), rendered as checkboxes.
- `specs` JSONB holds only variant-derived or optional data, never anything you filter on at scale.
- Provide an admin flow: "Model not listed → request addition." Admin adds it centrally. This keeps the catalog clean while unblocking dealers.
- Seed the catalog before you onboard dealer #1. For India, ~40 makes / ~450 models / ~3,000 variants covers >98% of the used market.

**If you get this wrong, no search engine on earth will save your filters.**

## 7.5 Search index table (Postgres phase)

Rather than querying `vehicles` joined to 5 tables on every request, maintain a **denormalized read model** updated by event subscribers:

```sql
CREATE TABLE listing_search (
  listing_id      uuid PRIMARY KEY,
  vehicle_id      uuid NOT NULL,
  dealer_id       uuid NOT NULL,
  dealer_name     text NOT NULL,
  dealer_slug     text NOT NULL,
  dealer_verified boolean NOT NULL,
  make_slug text, model_slug text, variant_slug text,
  make_name text, model_name text, variant_name text,
  year int, price_paise bigint, km int,
  fuel text, transmission text, body_type text, owner_number int,
  city_slug text, city_name text, lat float8, lng float8,
  features text[], condition text,
  primary_image_key text,
  boost_level int NOT NULL DEFAULT 0,
  published_at timestamptz, expires_at timestamptz,
  search_doc tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(make_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(model_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(variant_name,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city_name,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(dealer_name,'')), 'D')
  ) STORED
);

CREATE INDEX ON listing_search USING GIN (search_doc);
CREATE INDEX ON listing_search USING GIN (features);
CREATE INDEX ON listing_search (city_slug, price_paise);
CREATE INDEX ON listing_search (make_slug, model_slug, year);
CREATE INDEX ON listing_search (price_paise, published_at DESC);
CREATE INDEX ON listing_search USING GIN (
  (make_name || ' ' || model_name) gin_trgm_ops);  -- typo tolerance
```

This table is your **seam**. When you move to Typesense/OpenSearch, you change the _writer_ (same subscribers) and the _reader_ (one repository class). The rest of the application never knows.

---

# 8. Multi-tenancy

## 8.1 The verdict

**Shared database, shared schema, `dealer_id` discriminator column — at every stage from MVP to 100,000+ dealers.**

| Strategy                                  | Verdict                        | Reasoning                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared DB / shared schema**             | ✅ **Recommended, all stages** | One migration, one connection pool, one backup. Cross-tenant queries (the entire public marketplace!) are trivial. Scales to millions of tenants — this is what Shopify, Stripe and Salesforce do. |
| Schema per dealer                         | ❌ Never                       | 100k schemas = 100k × N tables. `pg_dump` becomes impossible. Migrations take days. And your _primary product_ — a marketplace search across all dealers — would require 100k UNIONs.              |
| Database per dealer                       | ❌ Never                       | Same as above, worse. Only justified for enterprise SaaS with contractual data-residency requirements and <500 tenants.                                                                            |
| Hybrid (shared + isolated for enterprise) | 🟡 Consider at Phase 4+        | If you ever sign an OEM or a 500-branch chain with a data-residency clause. Not before.                                                                                                            |

**The decisive argument:** your product is _inherently cross-tenant_. A customer searching "Fortuner in Mumbai under ₹30L" must scan every dealer's inventory. Physical tenant isolation makes your core feature architecturally impossible. This isn't a scaling question — it's a product-shape question.

Scaling per stage:

| Dealers   | Approach                                                                                    | What changes                  |
| --------- | ------------------------------------------------------------------------------------------- | ----------------------------- |
| MVP–1,000 | Shared schema, single Postgres                                                              | Nothing                       |
| 10,000    | Same + read replicas + Redis                                                                | Add replicas for public reads |
| 100,000   | Same + partition hot tables by `created_at`; consider sharding `audit_logs`, `inquiries`    | Still one logical schema      |
| 100,000+  | Same + move analytics to a columnar store; possibly shard by region if you go multi-country | Tenant model unchanged        |

## 8.2 Isolation: defense in depth (four layers)

Application bugs are inevitable. Design so that a single missed `WHERE dealer_id = ?` cannot leak data.

**Layer 1 — Session-derived tenant context, never client-supplied.**

```ts
// common/request-context/tenant.guard.ts
// dealerId comes from the session's DealerMember record. If a request body
// contains dealerId, it is IGNORED. This is the single most important rule.
const ctx = { userId, dealerId: membership.dealerId, role: membership.role };
```

**Layer 2 — Repository-enforced scoping.** Tenant-owned repositories take `dealerId` as a _required first argument_ — it is structurally impossible to write an unscoped query without a type error:

```ts
class VehiclesRepository {
  findMany(dealerId: string, filter: VehicleFilter) { … }   // ← required
  // there is no findMany(filter) overload. Public reads use a different,
  // explicitly-named repository: PublicListingsRepository.
}
```

**Layer 3 — PostgreSQL Row-Level Security** as the backstop. Cheap to add now, impossible to retrofit calmly after an incident:

```sql
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vehicles
  USING (dealer_id = current_setting('app.dealer_id', true)::uuid);
-- The API sets: SET LOCAL app.dealer_id = '<uuid>'  at transaction start.
-- Public/admin reads use a separate DB role with BYPASSRLS.
```

Use **two database roles**: `app_tenant` (RLS enforced, used for all dealer-scoped work) and `app_platform` (BYPASSRLS, used for public marketplace reads, admin, and jobs). This makes "which code path can see all tenants" an explicit, auditable choice.

**Layer 4 — Test + audit.** One integration test per tenant-owned resource: _"Dealer A requests Dealer B's vehicle by id → 404."_ Not 403 — **404**, so you don't leak existence. Plus every cross-tenant admin read is written to `audit_logs`.

---

# 9. Authentication & authorization

## 9.1 Authentication: opaque session cookies, stored in Postgres

**Recommendation: server-side sessions with opaque tokens in httpOnly cookies. Not JWT.**

Why not JWT for a web-only MVP:

| Concern                                     | JWT                                                          | **Opaque session**                                   |
| ------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| Instant revocation (suspend a dealer _now_) | Needs a denylist — i.e. a database — which defeats the point | **Native: `UPDATE sessions SET revoked_at = now()`** |
| Implementation complexity                   | Access + refresh rotation, reuse detection, clock skew       | ~250 lines total                                     |
| Permission changes take effect              | On next refresh (up to 15 min stale)                         | **Immediately**                                      |
| Statelessness benefit                       | Real — but only matters at high scale                        | You are not there                                    |
| Storage cost                                | Zero                                                         | One indexed row lookup (~0.2ms), later a Redis GET   |

Add JWTs **only** when you have a mobile app or third-party API consumers, and even then issue them alongside sessions, not instead of them.

**Cookie configuration (all three are load-bearing):**

```
Name:     dd_session
Value:    32 bytes CSPRNG, base64url  (only SHA-256 hash stored in DB)
HttpOnly: true          → XSS cannot read it
Secure:   true
SameSite: Lax           → CSRF protection for top-level navigations
Domain:   .dealersdrive.com
Path:     /
Max-Age:  30 days (sliding: refresh if <7 days remain)
```

Plus a **double-submit CSRF token** for all state-changing requests, because `SameSite=Lax` still permits top-level POST in some browsers.

**Flows to support at MVP:**

| Flow             | Actor        | Method                                                                   |
| ---------------- | ------------ | ------------------------------------------------------------------------ |
| Register / login | Customer     | Phone + OTP (India-appropriate; lower friction than passwords)           |
| Register / login | Dealer       | Email + password + mandatory email verification, phone OTP at onboarding |
| Login            | Admin        | Email + password + **TOTP 2FA mandatory**                                |
| Social login     | Customer     | Google OAuth — add in Sprint 7, not before                               |
| Password reset   | Dealer/Admin | Single-use token, 30 min TTL, invalidates all sessions on use            |

Guest inquiries must work **without an account**. Forcing registration before a lead is submitted will cost you 40–60% of your leads. Capture name + phone, create a shadow user, offer account claim by OTP afterwards.

## 9.2 Authorization: RBAC + resource policies

Two orthogonal axes. Don't collapse them.

```
Axis 1 — WHO ARE YOU (principal type)
  ANONYMOUS · CUSTOMER · DEALER_MEMBER(role) · PLATFORM_ADMIN(role)

Axis 2 — WHAT CAN YOU DO TO THIS SPECIFIC RESOURCE
  resource policy: does this vehicle belong to your dealer?
```

**Permission catalog (start small; this is the whole MVP set):**

```ts
export const PERMISSIONS = {
  // dealer scope
  'vehicle:read': ['OWNER', 'MANAGER', 'SALES'],
  'vehicle:create': ['OWNER', 'MANAGER'],
  'vehicle:update': ['OWNER', 'MANAGER'],
  'vehicle:delete': ['OWNER', 'MANAGER'],
  'listing:publish': ['OWNER', 'MANAGER'], // spends money → not SALES
  'listing:unpublish': ['OWNER', 'MANAGER'],
  'inquiry:read': ['OWNER', 'MANAGER', 'SALES'],
  'inquiry:update': ['OWNER', 'MANAGER', 'SALES'],
  'billing:read': ['OWNER'],
  'billing:purchase': ['OWNER'], // only the owner spends money
  'dealer:update': ['OWNER'],
  'member:manage': ['OWNER'],
  'analytics:read': ['OWNER', 'MANAGER'],
  // platform scope
  'admin:dealer:approve': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:dealer:suspend': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:listing:moderate': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:payment:refund': ['SUPER_ADMIN'],
  'admin:config:write': ['SUPER_ADMIN'],
  'admin:impersonate': ['SUPER_ADMIN'], // always audit-logged
} as const;
```

Applied declaratively:

```ts
@Controller('v1/dealer/vehicles')
@UseGuards(AuthGuard, DealerContextGuard, PermissionGuard)
export class DealerVehiclesController {
  @Patch(':id')
  @RequirePermission('vehicle:update')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @Ctx() ctx) {
    // service re-verifies ownership; the guard is not the only check
    return this.vehicles.update(id, dto, ctx);
  }
}
```

**The rule that prevents 90% of authorization bugs:** the guard checks _capability_; the service checks _ownership_. Both, always. Ownership checks live inside the transaction that performs the write, so there is no TOCTOU gap.

**Admin impersonation** ("view as dealer" for support) is enormously useful and enormously dangerous. If you build it: separate short-lived impersonation session, red banner in the UI, no write permissions unless `SUPER_ADMIN`, every action audit-logged with both the real and effective actor. Defer to post-MVP.

---

# 10. API design

## 10.1 REST + OpenAPI — the reasoning

| Criterion                               | REST                                        | GraphQL                                              | Verdict                                                       |
| --------------------------------------- | ------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| CDN/HTTP caching of public listings     | Native, free, enormous                      | Requires persisted queries + custom cache layer      | **REST wins decisively** — your listing pages are the traffic |
| Solo-dev velocity                       | Immediate                                   | 1–2 weeks of schema/resolver/dataloader setup        | REST                                                          |
| Over-fetching problem                   | Real, solved by 3–4 purpose-built endpoints | Solved elegantly                                     | GraphQL — but you have _one_ client                           |
| N+1 risk                                | Explicit and visible                        | Hidden behind resolvers; needs DataLoader everywhere | REST                                                          |
| Rate limiting / abuse control           | Per-endpoint, trivial                       | Query cost analysis required                         | REST                                                          |
| Tooling (OpenAPI → types → clients)     | Excellent, mature                           | Excellent                                            | Tie                                                           |
| Observability (which endpoint is slow?) | Trivial                                     | Requires per-resolver tracing                        | REST                                                          |

**Recommendation: REST with OpenAPI 3.1, auto-generated from NestJS decorators + Zod schemas.** Revisit GraphQL if you ever expose a public partner API with heterogeneous consumers (Phase 6, advertising marketplace) — and even then, consider it an _additional_ gateway over the REST services rather than a replacement.

**Do not add tRPC either**, despite the monorepo. It couples your frontend to your backend's internal shape and makes the future mobile app and partner integrations harder. The typed contract in `packages/contracts` gives you 90% of tRPC's DX with none of the coupling.

## 10.2 Route structure

Namespaced by audience, because auth requirements and cache behavior differ fundamentally.

```
PUBLIC  (unauthenticated, CDN-cacheable, heavily rate-limited by IP)
  GET    /v1/vehicles                       list + filter + sort + paginate
  GET    /v1/vehicles/facets                facet counts for the filter panel
  GET    /v1/vehicles/:idOrSlug             VDP payload (vehicle + dealer + media)
  GET    /v1/vehicles/:id/similar
  GET    /v1/dealers                        directory
  GET    /v1/dealers/:slug
  GET    /v1/dealers/:slug/vehicles
  GET    /v1/catalog/makes
  GET    /v1/catalog/makes/:slug/models
  GET    /v1/catalog/models/:slug/variants
  GET    /v1/catalog/cities
  GET    /v1/config/public                  price ranges, feature flags, banners
  POST   /v1/inquiries                      guest lead (strict rate limit + captcha)

AUTH    (session cookie)
  POST   /v1/auth/register
  POST   /v1/auth/login
  POST   /v1/auth/otp/request
  POST   /v1/auth/otp/verify
  POST   /v1/auth/logout
  POST   /v1/auth/password/forgot
  POST   /v1/auth/password/reset
  GET    /v1/auth/me                        user + memberships + permissions
  POST   /v1/auth/2fa/enrol | verify        (admins)

CUSTOMER (session, role=CUSTOMER)
  GET    /v1/me/favorites
  PUT    /v1/me/favorites/:vehicleId
  DELETE /v1/me/favorites/:vehicleId
  GET    /v1/me/inquiries

DEALER  (session + dealer membership; dealerId ALWAYS from session)
  POST   /v1/dealer/apply                   create dealer profile (DRAFT)
  GET    /v1/dealer                         my dealer
  PATCH  /v1/dealer
  POST   /v1/dealer/documents               KYC upload commit
  GET    /v1/dealer/vehicles                my inventory
  POST   /v1/dealer/vehicles
  GET    /v1/dealer/vehicles/:id
  PATCH  /v1/dealer/vehicles/:id
  DELETE /v1/dealer/vehicles/:id            → soft delete
  POST   /v1/dealer/vehicles/:id/publish    → consumes 1 credit (§6.3)
  POST   /v1/dealer/vehicles/:id/unpublish
  POST   /v1/dealer/vehicles/:id/mark-sold
  POST   /v1/dealer/media/presign           → {uploadUrl, mediaId, expiresIn}
  POST   /v1/dealer/media/:id/commit
  DELETE /v1/dealer/media/:id
  PUT    /v1/dealer/vehicles/:id/media/order
  GET    /v1/dealer/inquiries
  PATCH  /v1/dealer/inquiries/:id
  GET    /v1/dealer/billing/summary         credit balance + history
  POST   /v1/dealer/billing/orders          create Razorpay order (Idempotency-Key)
  GET    /v1/dealer/billing/payments
  GET    /v1/dealer/billing/invoices/:id
  GET    /v1/dealer/analytics/overview
  GET    /v1/dealer/members                 (post-MVP)
  POST   /v1/dealer/members/invite          (post-MVP)

ADMIN   (session + isPlatformAdmin)
  GET    /v1/admin/dealers?status=PENDING_VERIFICATION
  POST   /v1/admin/dealers/:id/approve
  POST   /v1/admin/dealers/:id/reject
  POST   /v1/admin/dealers/:id/suspend
  GET    /v1/admin/listings?status=PENDING_REVIEW
  POST   /v1/admin/listings/:id/approve | reject | takedown
  GET    /v1/admin/payments
  POST   /v1/admin/payments/:id/refund
  POST   /v1/admin/dealers/:id/credits      manual grant (audited)
  GET    /v1/admin/config  |  PUT /v1/admin/config/:key
  GET    /v1/admin/metrics/overview
  GET    /v1/admin/audit-logs

SYSTEM
  POST   /v1/webhooks/razorpay              signature-verified, no session
  GET    /health/live  |  /health/ready
  GET    /v1/openapi.json
```

## 10.3 Conventions

**Versioning.** URL path (`/v1`). Header-based versioning is more "correct" and worse for debugging, caching, and logs. Add `/v2` only for genuinely breaking changes; prefer additive evolution. Never remove a field without a deprecation header (`Sunset: <date>`) and 90 days notice once you have external consumers.

**Pagination — use both, deliberately:**

| Endpoint type                 | Pagination                                              | Why                                                                                                      |
| ----------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Public vehicle search         | **Offset/page** (`?page=2&limit=24`), capped at page 40 | SEO needs stable, linkable, numbered pages. Deep pages are worthless anyway — cap them and canonicalize. |
| Dealer inventory, admin lists | **Cursor** (`?cursor=<opaque>&limit=50`)                | Stable under concurrent inserts, O(1) regardless of depth.                                               |
| Infinite scroll (mobile web)  | **Cursor**                                              | Same.                                                                                                    |

```json
{
  "data": [ … ],
  "meta": { "page": 2, "limit": 24, "total": 1841, "totalPages": 77 },
  "links": { "self": "…", "next": "…", "prev": "…" }
}
```

**Filtering** — explicit, whitelisted query params. Never a generic query DSL (that's an injection and a DoS vector):

```
GET /v1/vehicles
  ?city=mumbai
  &make=toyota&model=fortuner
  &priceMin=1500000&priceMax=3500000
  &yearMin=2019&kmMax=60000
  &fuel=diesel,petrol            # CSV = OR within a facet
  &transmission=automatic
  &bodyType=suv
  &owners=1
  &features=sunroof,reverse_camera   # AND across features
  &dealer=sharma-motors
  &sort=price_asc                # relevance|price_asc|price_desc|year_desc
                                 # |km_asc|newest
  &page=1&limit=24
```

Validate with Zod. Unknown params → `400`, not silently ignored (silent ignoring hides frontend bugs for months).

**Errors — RFC 9457 Problem Details, one shape everywhere:**

```json
{
  "type": "https://dealersdrive.com/errors/insufficient-credits",
  "title": "Insufficient listing credits",
  "status": 402,
  "detail": "Publishing requires 1 credit; your balance is 0.",
  "code": "INSUFFICIENT_CREDITS",
  "traceId": "01J9X2K8M4",
  "errors": [{ "field": "price", "code": "TOO_LOW", "message": "Price must be at least ₹10,000" }]
}
```

`code` is the machine-readable contract — the frontend switches on it, never on `detail`. `traceId` appears in your logs, in Sentry, and in the UI's error toast, so a dealer support ticket becomes a one-query investigation.

**Idempotency.** Mandatory `Idempotency-Key` header on `POST /v1/dealer/billing/orders` and `POST /v1/dealer/vehicles/:id/publish`. Store key → response in an `idempotency_keys` table (24h TTL). A retried request returns the original response, does not double-charge, does not double-consume a credit.

**Rate limiting** (per stage — MVP uses an in-memory/Postgres token bucket; Redis later):

| Endpoint                        | Limit      | Key                     |
| ------------------------------- | ---------- | ----------------------- |
| `POST /v1/auth/login`           | 5 / 15 min | IP + email              |
| `POST /v1/auth/otp/request`     | 3 / hour   | phone                   |
| `POST /v1/inquiries`            | 5 / hour   | IP (+ hCaptcha after 2) |
| `GET /v1/vehicles*`             | 120 / min  | IP                      |
| Dealer write endpoints          | 60 / min   | dealerId                |
| `POST /v1/dealer/media/presign` | 100 / hour | dealerId                |
| Admin endpoints                 | 300 / min  | userId                  |

Return `429` with `Retry-After`. Put Cloudflare in front for L7 volumetric protection so this layer only handles application-level abuse.

---

# 11. Search architecture

## 11.1 Yes, PostgreSQL is sufficient — for longer than you think

With the `listing_search` denormalized table (§7.5) and correct indexing, Postgres comfortably serves:

- **Up to ~200,000 active listings** at p95 < 150ms for multi-facet filtered queries.
- Facet counts up to ~100k listings using a single `GROUP BY GROUPING SETS` query or 6 parallel `COUNT(*) FILTER` aggregates.
- Prefix/typo-tolerant autocomplete via `pg_trgm` up to ~50k distinct make/model strings.

For calibration: at 10 vehicles per dealer, 200k listings means **20,000 dealers**. Postgres search alone will carry you to a Series A.

**The query shape:**

```sql
SELECT listing_id, vehicle_id, dealer_name, make_name, model_name, year,
       price_paise, km, city_name, primary_image_key
FROM listing_search
WHERE expires_at > now()
  AND ($1::text IS NULL OR city_slug = $1)
  AND ($2::text IS NULL OR make_slug = $2)
  AND ($3::bigint IS NULL OR price_paise >= $3)
  AND ($4::bigint IS NULL OR price_paise <= $4)
  AND ($5::text[] IS NULL OR fuel = ANY($5))
  AND ($6::text[] IS NULL OR features @> $6)
ORDER BY boost_level DESC, published_at DESC
LIMIT 24 OFFSET $7;
```

Write this with `$queryRaw` and a small, well-tested query builder. Do **not** try to express it through Prisma's fluent API — you'll fight the query planner.

**Free-text search** (the "Fortuner 2021 diesel Mumbai" box) uses `search_doc @@ websearch_to_tsquery(...)` with a `similarity()` fallback for typos, ranked by `ts_rank_cd`. Good enough that users won't complain.

## 11.2 The migration path

```
┌─ STAGE 1 · MVP ─────────────────────────────── 0 – 50k listings ─┐
│ Postgres: listing_search table, GIN + btree indexes              │
│ Facets: COUNT(*) FILTER aggregates, cached 60s                   │
│ Autocomplete: pg_trgm on a small materialized suggestions table  │
│ Cost: ₹0 extra.  Effort: 2 days.                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓  TRIGGER: p95 search > 300ms after
                              ↓  index tuning, OR typo-tolerance is
                              ↓  costing conversions, OR >100k listings
┌─ STAGE 2 · GROWTH ────────────────────── 50k – 1M listings ──────┐
│ Typesense Cloud  (recommended) or Meilisearch                    │
│ Why Typesense over Elasticsearch: typo tolerance and faceting     │
│ work correctly out of the box, ops burden is near zero, ~$50–     │
│ 250/mo. Elasticsearch needs a dedicated engineer to tune.        │
│ Why not Algolia: excellent product, but pricing is per-search     │
│ and becomes punishing at marketplace volumes.                    │
│ Sync: subscribers on ListingActivated/Updated/Expired →           │
│       job → upsert document. Postgres remains source of truth.   │
│ Fallback: keep the Postgres path behind a feature flag for 30    │
│ days so you can revert instantly.                                │
└──────────────────────────────────────────────────────────────────┘
                              ↓  TRIGGER: >1M listings, or you need
                              ↓  geo-ranking + personalization +
                              ↓  custom relevance scoring
┌─ STAGE 3 · LARGE ─────────────────────── 1M – 10M listings ──────┐
│ OpenSearch (AWS managed) or self-hosted Elasticsearch            │
│ 3 data nodes, index-per-region, aliases for zero-downtime        │
│ reindex, custom similarity + learning-to-rank                    │
│ CDC via Debezium → Kafka → indexer (no dual-write)               │
│ Separate "search-svc" — the FIRST module you extract             │
└──────────────────────────────────────────────────────────────────┘
                              ↓  TRIGGER: 10M+ listings, sub-50ms
                              ↓  requirement, ML ranking
┌─ STAGE 4 · MASSIVE ─────────────────────────── 10M+ listings ────┐
│ OpenSearch multi-cluster + vector search for "similar cars"      │
│ Dedicated ranking service (features: CTR, dealer quality, price   │
│ competitiveness, recency, geo distance)                          │
│ Query result caching at edge; pre-computed popular facet pages   │
└──────────────────────────────────────────────────────────────────┘
```

**The seam that makes this cheap:** define `SearchPort` in `modules/search/domain/` with `search()`, `facets()`, `suggest()`, `index()`, `remove()`. `PostgresSearchAdapter` implements it now. `TypesenseSearchAdapter` implements it later. One line changes in the module provider. This is the single most valuable interface in your codebase — write it on day one even though you only have one implementation.

---

# 12. Image & media architecture

Vehicle photos are simultaneously your **biggest conversion lever**, your **second-largest infrastructure cost**, and your **largest attack surface for uploads**. Treat this as a first-class subsystem.

## 12.1 Recommendation: Cloudflare R2 + Cloudflare Images

| Option                     | Storage       | Egress                  | Transform                      | Verdict                                                       |
| -------------------------- | ------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------- |
| **Cloudflare R2 + Images** | ~$0.015/GB/mo | **$0 — zero egress**    | Built-in resize/format at edge | ✅ **MVP + Growth**                                           |
| AWS S3 + CloudFront        | ~$0.023/GB/mo | ~$0.085/GB (first 10TB) | Lambda@Edge (you build it)     | 🟡 Later, if you consolidate on AWS                           |
| Cloudinary                 | Bundled       | Bundled                 | Best-in-class                  | 🟡 Great DX, gets expensive fast (~$250+/mo at modest volume) |
| imgix / Imgproxy           | —             | —                       | Excellent                      | 🟡 Add over R2 if Cloudflare Images limits bite               |

**The decisive number:** an image-heavy marketplace at 1M monthly sessions × 15 images × 150KB ≈ **2.2 TB/month of egress**. On S3+CloudFront that's ~$190/mo; on R2 it is **$0**. At 10× that scale the difference is $1,900/mo vs $0. R2 is S3-API-compatible, so migration in either direction is a config change plus an `rclone sync`.

## 12.2 Upload pipeline

```
1. Dealer selects images in the browser (max 20, 10MB each)
        │
2. Client-side pre-compression (browser-image-compression):
   resize longest edge → 2400px, quality 0.85
   ⇒ 8MB phone photo becomes ~600KB before it ever leaves the device.
     This alone cuts your upload failures and bandwidth by ~85%.
        │
3. POST /v1/dealer/media/presign
   { filename, contentType, bytes, ownerType: "VEHICLE" }
   API validates: mime allowlist (jpeg|png|webp|heic), size cap,
   per-dealer quota, rate limit
   → creates Media row (status=PENDING, dealerId from SESSION)
   → returns presigned PUT URL, 5-minute expiry, content-type &
     content-length conditions BAKED INTO the signature
        │
4. Browser PUTs directly to R2. The API never touches image bytes.
   Key: dealers/{dealerId}/vehicles/{vehicleId}/{mediaId}/original.jpg
        │
5. POST /v1/dealer/media/:id/commit
   → API HEADs the object: verify it exists, size & content-type match
   → enqueue job: media.process
        │
6. Worker (sharp):
   - re-decode the image (strips any polyglot/malicious payload)
   - strip EXIF (GPS location of the dealer's yard is PII!)
   - auto-orient
   - generate derivatives: 320w, 640w, 1024w, 1600w × { webp, avif }
   - generate a 20px blurhash/LQIP placeholder → stored on the Media row
   - detect: too-dark, too-small, duplicate (perceptual hash) → flag
   - Media.status = READY, dimensions recorded
        │
7. Frontend renders next/image with a custom loader pointing at the
   Cloudflare Images URL. srcset picks the right width per viewport.
```

## 12.3 The details people get wrong

| Concern                                        | Solution                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orphaned images** (uploaded, never attached) | Nightly job: delete `Media` rows with `status=PENDING AND createdAt < now() - 24h`, plus the R2 object. Also a weekly reconciliation listing R2 keys not present in `media`.                                                                                                                                                                                      |
| **Deleted vehicles**                           | Soft-delete the vehicle → job marks media `ORPHAN` → hard-delete from R2 after 30 days. Never delete synchronously; you'll want undo.                                                                                                                                                                                                                             |
| **Image ordering**                             | `VehicleMedia.position` integer, reordered by drag-and-drop, `PUT /vehicles/:id/media/order` sends the full ordered array (idempotent, no partial-swap bugs).                                                                                                                                                                                                     |
| **Primary image**                              | `Vehicle.primaryMediaId` — denormalized so listing cards need no join.                                                                                                                                                                                                                                                                                            |
| **Upload security**                            | Never trust `Content-Type`. Verify magic bytes server-side in the worker. **Always re-encode** — this is the only reliable defence against polyglot files and ImageTragick-class exploits. Serve media from a **separate domain** (`img.dealersdrive.com`) with `Content-Disposition: attachment` fallback so a stored HTML payload can't execute in your origin. |
| **Content moderation**                         | MVP: minimum 3 images + admin spot-check queue. Growth: perceptual-hash dedupe (catches dealers stealing each other's photos — this _will_ happen), then an ML NSFW/irrelevance classifier.                                                                                                                                                                       |
| **Watermarking**                               | Optional dealer-branded watermark on derivatives. Popular with dealers, cheap to add in the worker, do it in Phase 2.                                                                                                                                                                                                                                             |
| **CDN caching**                                | Derivatives are immutable and content-addressed (`.../{mediaId}/1024.webp`) → `Cache-Control: public, max-age=31536000, immutable`. Never invalidate; new upload = new id = new URL.                                                                                                                                                                              |

---

# 13. Payments & monetization architecture

## 13.1 Provider

**Razorpay** if India-first (UPI, netbanking, RuPay, auto-generated GST invoices, e-mandate for future subscriptions). **Stripe** if not. Either way, hide it behind a port:

```ts
export interface PaymentGatewayPort {
  createOrder(i: CreateOrderInput): Promise<GatewayOrder>;
  verifyWebhookSignature(raw: Buffer, sig: string): boolean;
  parseWebhook(raw: Buffer): GatewayEvent;
  fetchPayment(id: string): Promise<GatewayPayment>;
  refund(paymentId: string, amountPaise: bigint, key: string): Promise<GatewayRefund>;
}
```

Two implementations of this interface later (Razorpay + Stripe for international dealers) costs you two days. Not having the interface costs you two weeks.

## 13.2 The credit model — the most important design decision here

**Do not charge per-listing at publish time.** That flow is: dealer clicks publish → checkout modal → payment → webhook → listing goes live 3 seconds later (or 3 minutes later, if the webhook is slow). It is high-friction, and it couples your listing UX to an external system's latency.

**Instead: dealers buy listing credits in packs, and publishing consumes one atomically.**

```
Dealer buys 25 listing credits for ₹X  ─┐
                                        ├─▶ credit_ledger: +25, balanceAfter=25
Dealer publishes a vehicle            ──┴─▶ credit_ledger: −1, balanceAfter=24
                                            listing.status = ACTIVE
                                            (same DB transaction)
```

Benefits: publishing is instant and offline-capable; you get **prepaid revenue** (cash flow!); volume discounts are trivial (10 credits ₹X, 50 credits ₹0.8X); refunds on rejected listings are a `+1` ledger entry, not a payment gateway refund; and the accounting is auditable.

**Revenue objects in the MVP:**

| Product               | Mechanism                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Dealer onboarding fee | One-time `Payment(purpose=ONBOARDING)`. Gates `DealerStatus: PENDING_PAYMENT → PENDING_VERIFICATION`. |
| Listing fee           | Credit packs. `Payment(purpose=LISTING_CREDITS, quantity=N)`.                                         |

**Deferred but architecturally accommodated (no schema change needed):**

| Product                      | How it slots in                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Monthly subscription         | New `Plan` + `Subscription` tables; a subscription grants N credits/month via a scheduled job writing to the same ledger. |
| Featured / promoted listings | `Payment(purpose=BOOST)` → sets `Listing.boostLevel`; search already sorts by it.                                         |
| Lead-generation fees         | Charge per qualified `Inquiry`; the ledger supports negative-balance/postpaid with a credit limit.                        |
| Dealer advertising           | New purpose + a placement table.                                                                                          |

## 13.3 The payment flow, in full

```
① CREATE ORDER
   POST /v1/dealer/billing/orders
   Headers: Idempotency-Key: <uuid>
   Body:    { purpose: "LISTING_CREDITS", packId: "pack_25" }

   Server:
     - price looked up from platform_config / packs table. The CLIENT NEVER
       SENDS AN AMOUNT. (If it does, you will be charged ₹1 for 25 credits.)
     - Payment row created: status=CREATED, amountPaise, idempotencyKey
     - razorpay.orders.create({ amount, receipt: payment.id, notes: {…} })
   → { orderId, amountPaise, currency, keyId }

② CHECKOUT (browser) → Razorpay JS → user pays via UPI/card

③ CLIENT CALLBACK  (a UX signal ONLY — never a source of truth)
   POST /v1/dealer/billing/orders/:id/ack
   → verifies signature, optimistically marks ATTEMPTED, shows a spinner.
     Grants NOTHING.

④ WEBHOOK — the ONLY thing that grants value
   POST /v1/webhooks/razorpay
     a. Read the RAW body (before any JSON parsing middleware)
     b. Verify HMAC-SHA256 against RAZORPAY_WEBHOOK_SECRET
        → invalid: log, return 400, alert if repeated
     c. INSERT INTO webhook_events (provider, provider_event_id, …)
        ON CONFLICT DO NOTHING            ← idempotency guarantee
        → 0 rows affected means already processed: return 200 immediately
     d. Enqueue job, RETURN 200 IN <500ms  (never process inline; Razorpay
        retries aggressively on timeouts and you'll create duplicates)

⑤ WORKER: process payment.captured
   BEGIN;
     SELECT * FROM payments WHERE provider_order_id = $1 FOR UPDATE;
     -- state machine guard: only CREATED|ATTEMPTED → CAPTURED
     UPDATE payments SET status='CAPTURED', captured_at=now(),
            provider_payment_id=$2, raw_provider_payload=$3;
     -- grant value
     INSERT INTO credit_ledger (dealer_id, delta, balance_after, reason, ref_id)
       VALUES ($dealer, +25, (SELECT balance…) + 25, 'PURCHASE', payment.id);
     INSERT INTO invoices (…) VALUES (…);        -- sequential number
     INSERT INTO outbox_events ('PaymentSucceeded', …);
   COMMIT;
   -- outbox → email receipt, invoice PDF generation, analytics

⑥ FRONTEND polls GET /v1/dealer/billing/summary (or SSE) → balance updates
```

## 13.4 "How do we ensure a dealer cannot manipulate listing/payment status?"

This is the right question to ask, and here is the complete answer:

1. **No API surface exists to set these fields.** `Listing.status`, `Payment.status`, `CreditLedger.*`, and `Dealer.status` are absent from every dealer-facing DTO. The Zod schemas _strip_ unknown keys (`.strict()` → reject). A dealer POSTing `{"status":"ACTIVE"}` gets a 400, not a silent success. This is the primary defence; everything else is depth.
2. **State transitions go through a state machine**, not assignment. `transition(listing, 'ACTIVATE', actor)` validates that the source state and the actor's authority permit it. Invalid transitions throw.
3. **Value is granted only by verified webhooks**, never by client callbacks. Even the client callback in step ③ grants nothing.
4. **Amounts are server-computed.** The client sends a `packId`; the server looks up the price. Client-supplied amounts are never trusted, ever.
5. **Credit consumption is transactional** with listing creation and enforced by a check constraint: `CHECK (balance_after >= 0)`. A race between two concurrent publishes cannot produce a negative balance — the second transaction fails.
6. **Row-level locking** (`SELECT … FOR UPDATE` on the dealer's latest ledger row) serializes credit operations per dealer.
7. **Everything is audit-logged** with actor, before/after, IP, traceId.
8. **Nightly reconciliation job**: sum of `credit_ledger.delta` per dealer must equal the latest `balance_after`; sum of `PURCHASE` credits must reconcile against `CAPTURED` payments; Razorpay settlement report is compared against local `payments`. Any mismatch → alert to Slack. This catches both bugs and fraud.

## 13.5 Failure modes to design for now

| Failure                                             | Handling                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Webhook never arrives                               | Reconciliation job every 15 min: for `payments` in `CREATED/ATTEMPTED` older than 10 min, call `gateway.fetchPayment()` and settle. This is not optional — webhooks _do_ get lost.                                             |
| Webhook arrives twice                               | `webhook_events` unique constraint on `(provider, providerEventId)`.                                                                                                                                                           |
| Webhook arrives before the client callback          | Fine — webhook is authoritative, callback is idempotent.                                                                                                                                                                       |
| Payment captured but worker crashes mid-transaction | Transaction rolls back; the job retries; `webhook_events.status` stays `RECEIVED`; the outbox pattern guarantees the follow-on effects fire exactly once.                                                                      |
| Refund requested                                    | Admin-only endpoint. Refunds `Payment` via gateway **and** writes a compensating negative ledger entry. If the dealer already spent the credits, balance can go negative — allow it, flag the account, don't try to be clever. |
| Listing rejected by moderation                      | `+1` credit refund to the ledger, automatic, event-driven. Dealers must never lose money to your moderation queue.                                                                                                             |
| Chargeback                                          | Webhook `payment.disputed` → suspend dealer's ability to publish, alert admin.                                                                                                                                                 |

---

# 14. Caching architecture

Cache in **layers**, cheapest and closest to the user first. At MVP, you need only layers 1–3 — and they cover ~95% of your traffic.

```
L0  Browser cache        immutable assets, images       1 year
L1  Cloudflare CDN       HTML for public pages, images  60s–1yr
L2  Next.js ISR/Data     RSC payloads, fetch() cache    60s–1hr + on-demand revalidate
L3  API in-process LRU   catalog, platform config       5 min
L4  Redis                sessions, facets, rate limits  [GROWTH ONLY]
L5  PostgreSQL           listing_search denormalized    n/a
```

## 14.1 What to cache, and how

| Content                                                   | Layer                                         | TTL                               | Invalidation                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Homepage                                                  | CDN + ISR                                     | 5 min                             | Time-based                                                                                                                      |
| `/cars` and facet landing pages (`/cars/toyota/fortuner`) | CDN + ISR                                     | 60s, `stale-while-revalidate=300` | Time-based. These are your SEO pages — always serve _something_ fast, even if 60s stale.                                        |
| Vehicle detail page (VDP)                                 | ISR                                           | 5 min                             | **On-demand**: `ListingUpdated`/`ListingSold` event → job → `POST /api/revalidate` to Next.js → `revalidatePath('/car/[slug]')` |
| Dealer page                                               | ISR                                           | 10 min                            | On-demand on dealer update                                                                                                      |
| Search results with filters                               | **Not cached at CDN** (too many permutations) | —                                 | Cache _facet counts_ at L3/L4 for 60s; the result rows hit Postgres                                                             |
| Catalog (makes/models/cities)                             | L3 in-process + CDN                           | 1 hr / on deploy                  | Rarely changes; refresh on admin write                                                                                          |
| Platform config                                           | L3 in-process                                 | 60s                               | Poll                                                                                                                            |
| Session lookup                                            | Postgres (→ Redis at growth)                  | —                                 | Row-level                                                                                                                       |
| Images/derivatives                                        | CDN                                           | 1 year, `immutable`               | Never — content-addressed URLs                                                                                                  |
| Dealer dashboard, admin                                   | **Never cached**                              | `no-store`                        | —                                                                                                                               |
| `/v1/vehicles` public API                                 | CDN 60s via `Cache-Control` + `Vary`          | 60s                               | Time-based                                                                                                                      |

## 14.2 Cache-invalidation strategy

Three mechanisms, in order of preference:

1. **Time-based with SWR** — the default. `stale-while-revalidate` means a user never waits for a cache miss. Use this everywhere you can tolerate 60 seconds of staleness (which is almost everywhere on the public site).
2. **Content-addressed immutability** — for images and static assets. The best invalidation is not needing invalidation.
3. **Event-driven on-demand revalidation** — for the handful of cases where staleness is user-visible and embarrassing: a sold car still showing as available, a price change, a dealer suspension. Wire this to the outbox: `ListingUpdated → job → revalidatePath`.

**The rule:** if you can't name the event that invalidates a cache entry, use a short TTL instead. Complex invalidation logic is a bug factory.

## 14.3 When Redis earns its place

Introduce Redis when **any** of these become true — not before:

- Session lookups exceed ~2,000/sec, or session table contention appears in `pg_stat_statements`.
- You need cross-instance rate limiting (more than 2 API instances).
- Facet-count computation exceeds 100ms and is called on every search.
- Job throughput exceeds ~50/sec (switch pg-boss → BullMQ).
- You want a distributed lock for a job that must not run twice.

**Cost of adding it later:** low — you'll already have a `CachePort` with a `MemoryAdapter`; write `RedisAdapter`, change one provider binding. Half a day.

---

# 15. Background jobs

## 15.1 Recommendation: pg-boss on your existing Postgres

Not BullMQ, not SQS, not Celery, not Temporal. `pg-boss` gives you real queue semantics — exactly-once-ish delivery, retries with exponential backoff, scheduled/cron jobs, job priorities, dead-letter queues, throttling — using tables in your existing database. **Zero new infrastructure. Zero new cost. Same transaction as your domain writes** (which is exactly what the outbox pattern needs).

At MVP scale (tens of jobs per minute) this is not a compromise; it is the correct choice.

## 15.2 Job catalog

| Job                              | Trigger                    | Priority    | Notes                                                                    |
| -------------------------------- | -------------------------- | ----------- | ------------------------------------------------------------------------ |
| `media.process`                  | media commit               | High        | sharp derivatives, EXIF strip, blurhash. Concurrency 4.                  |
| `media.gc-orphans`               | Cron, daily 03:00          | Low         | Deletes PENDING >24h and ORPHAN >30d                                     |
| `search.index-listing`           | `ListingActivated/Updated` | High        | Upsert into `listing_search`                                             |
| `search.remove-listing`          | `ListingExpired/Removed`   | High        |                                                                          |
| `listing.expire-sweep`           | Cron, hourly               | Med         | `WHERE status=ACTIVE AND expires_at<now()` → EXPIRED + event             |
| `listing.expiring-soon`          | Cron, daily 09:00          | Low         | Email dealers 7 days before expiry (this drives renewals = revenue)      |
| `payment.reconcile`              | Cron, every 15 min         | High        | Poll gateway for stuck payments (§13.5)                                  |
| `payment.settlement-check`       | Cron, daily                | Med         | Compare gateway settlement report with local ledger                      |
| `invoice.generate-pdf`           | `PaymentSucceeded`         | Med         | Render + upload to R2                                                    |
| `email.send`                     | Various events             | High        | Retry 5×, exponential backoff                                            |
| `notification.inquiry-to-dealer` | `InquiryCreated`           | **Highest** | Lead speed-to-contact drives conversion. Email + (later) SMS + WhatsApp. |
| `cache.revalidate-page`          | `Listing*` events          | Med         | Calls Next.js revalidation endpoint                                      |
| `counters.reconcile`             | Cron, nightly              | Low         | Recompute `activeListings`, `ratingAvg`, `viewCount`                     |
| `analytics.rollup-daily`         | Cron, 02:00                | Low         | Dealer dashboard aggregates into a summary table                         |
| `outbox.publish`                 | Every 2s                   | —           | Drains `outbox_events` → in-process bus (§16)                            |
| `audit.partition-maintain`       | Cron, monthly              | Low         | Create next month's partition, detach old                                |

## 15.3 Deployment shape

**MVP:** one container image, two process types — `web` (HTTP) and `worker` (pg-boss). Same code, different entrypoint. Deploy the worker as a separate service with 1 instance so a slow image job never blocks an HTTP request.

**Growth:** split the worker into `worker-default` and `worker-media` (CPU-heavy, different instance size, independent autoscaling).

**Scale:** move media processing to Lambda/Cloud Run (bursty, CPU-heavy, embarrassingly parallel), keep pg-boss or migrate to SQS + a consumer fleet.

**Local dev:** run both in one process (`WORKER_INLINE=true`) so `pnpm dev` is one command.

---

# 16. Events & the outbox

## 16.1 Should you use events from day one? Yes — but _in-process_.

The distinction that matters is **event-driven design** (cheap, valuable now) vs **event-driven infrastructure** (Kafka, expensive, valuable later). Adopt the first, defer the second.

```
DAY ONE                                 LATER (no rewrite)
─────────────────────────               ──────────────────────────
service writes domain change            same
  + outbox row  (SAME TX)                 same
        ↓                                     ↓
outbox publisher (every 2s)             outbox publisher
        ↓                                     ↓
in-process EventBus                     ──▶  SNS/SQS or Kafka
        ↓                                     ↓
subscribers in the same process         subscribers in other services
```

**Why the outbox from day one, even in a monolith:** without it, "save the listing, then send the email" has two failure modes — email sent for a listing that rolled back, or listing saved with no email. The outbox makes the event durable in the _same transaction_ as the state change, so the effect is guaranteed at-least-once. This costs one table and ~60 lines. Retrofitting it after you've built 40 side-effecting flows costs weeks.

## 16.2 Event catalog

```
identity     UserRegistered  UserVerified  UserSuspended
dealers      DealerApplied  DealerOnboardingPaid  DealerSubmittedDocuments
             DealerApproved  DealerRejected  DealerSuspended  DealerProfileUpdated
vehicles     VehicleCreated  VehicleUpdated  VehicleArchived  VehicleMediaAttached
listings     ListingCreated  ListingActivated  ListingUpdated  ListingPaused
             ListingExpired  ListingSold  ListingRejected  ListingTakenDown
billing      PaymentInitiated  PaymentSucceeded  PaymentFailed  PaymentRefunded
             CreditsGranted  CreditConsumed  InvoiceIssued
engagement   InquiryCreated  InquiryStatusChanged  VehicleFavorited
media        MediaUploaded  MediaProcessed  MediaProcessingFailed
```

**Envelope (fix this now; changing it later is painful):**

```ts
type DomainEvent<T = unknown> = {
  id: string; // uuid
  type: string; // "listing.activated"  (dot-cased, past tense)
  version: 1; // schema version — you WILL need this
  occurredAt: string; // ISO
  aggregateType: string; // "Listing"
  aggregateId: string;
  dealerId?: string; // tenant context for downstream filtering
  actor: { type: 'USER' | 'ADMIN' | 'SYSTEM'; id?: string };
  traceId: string; // correlation across the whole causal chain
  payload: T;
};
```

## 16.3 What subscribes to what (MVP)

| Event              | Subscribers                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `ListingActivated` | search.index · dealer.incrementCounter · cache.revalidate · notifications.listingLive · analytics |
| `ListingExpired`   | search.remove · dealer.decrementCounter · notifications.expiryNotice · cache.revalidate           |
| `PaymentSucceeded` | billing.grantCredits (inline, in-TX) · invoice.generatePdf · notifications.receipt · analytics    |
| `InquiryCreated`   | notifications.emailDealer · listing.incrementInquiryCount · analytics                             |
| `DealerApproved`   | notifications.welcome · search.markDealerVerified · cache.revalidate                              |
| `DealerSuspended`  | listings.pauseAll · search.removeDealer · notifications.suspension · sessions.revokeAll           |

**Rules:** subscribers must be idempotent (they will be retried); subscribers must never throw synchronously into the publisher; a failing subscriber must not roll back the originating transaction. Each subscriber runs as its own job.

---

# 17. Frontend architecture

## 17.1 The core principle

> **Server by default. Client only for interactivity that cannot be expressed as a URL.**

React Server Components are not a stylistic preference here — they are how you get sub-1s LCP on listing pages that Google will crawl, without shipping a filter engine to every phone.

## 17.2 Server vs client, decided

| Concern                       | Rendering                                                     | Why                                                                                                |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Homepage                      | **RSC + ISR (5 min)**                                         | SEO, near-static                                                                                   |
| `/cars` + facet landing pages | **RSC, ISR 60s + SWR**                                        | SEO-critical, high traffic, filters live in the URL so every state is server-renderable            |
| Filter panel                  | **Client component**, writes to URL via `useRouter().replace` | Instant feedback + shareable/indexable URLs. Debounce 300ms. Use `useOptimistic` for chip toggles. |
| Vehicle detail page           | **RSC + ISR 5 min**                                           | SEO-critical; specs and dealer info are server-fetched                                             |
| Image gallery on VDP          | **Client**                                                    | Swipe, zoom, lightbox, keyboard nav                                                                |
| EMI calculator                | **Client**                                                    | Pure interaction, no data                                                                          |
| Inquiry form                  | **Server Action** + client validation                         | Progressive enhancement; works without JS                                                          |
| Favorite button               | **Client + Server Action + `useOptimistic`**                  | Instant toggle, server-authoritative                                                               |
| Dealer page                   | **RSC + ISR 10 min**                                          | SEO                                                                                                |
| Dealer dashboard              | **RSC shell + client tables**                                 | Auth'd, `no-store`, no SEO value                                                                   |
| Vehicle add/edit form         | **Client** (react-hook-form + Zod) + Server Action submit     | Complex multi-step form with image upload; needs rich client state                                 |
| Image uploader                | **Client**                                                    | Direct-to-R2 with progress bars                                                                    |
| Admin dashboard               | **Client-heavy**                                              | Dense tables, bulk actions, filters — no SEO                                                       |
| Auth pages                    | **Server Actions**                                            | Cookies must be set server-side                                                                    |

## 17.3 State management — you need much less than you think

| State type                       | Solution                                                                        | Not this                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Server data (public)             | **RSC `fetch` + Next cache**                                                    | Redux, React Query                                                |
| Server data (dashboard, mutable) | **TanStack Query** in client components                                         | Redux                                                             |
| Search/filter state              | **URL search params** (`nuqs` or hand-rolled)                                   | Any store — URL state is free SEO, free sharing, free back-button |
| Form state                       | **react-hook-form + Zod**                                                       | —                                                                 |
| Ephemeral UI (modal open, tab)   | **`useState`**                                                                  | —                                                                 |
| Session/user                     | **RSC context from cookie**, passed down; a thin client provider for the header | —                                                                 |
| Compare list, recently viewed    | **`localStorage` + a small Zustand store**                                      | —                                                                 |

**You do not need Redux. You do not need a global store.** If you find yourself reaching for one, the state probably belongs in the URL.

## 17.4 API integration pattern

```ts
// lib/api-client.ts — one place, typed by @dd/contracts
import type { paths } from '@dd/contracts';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & {
    cache?: RequestCache;
    revalidate?: number;
    tags?: string[];
  },
): Promise<T> {
  const res = await fetch(`${process.env.API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-request-id': getTraceId(),
      // internal service token: proves the request came from the web app
      'x-internal-token': process.env.INTERNAL_API_TOKEN!,
      // forward the end-user session for authorization
      ...(await forwardSessionCookie()),
      ...init?.headers,
    },
    next: { revalidate: init?.revalidate, tags: init?.tags },
  });
  if (!res.ok) throw await ApiError.from(res); // → typed Problem Details
  return res.json();
}
```

Notes: server components call this directly (server-to-server, fast, no CORS). Client components either call Server Actions or hit the public API directly for cacheable reads. **Never expose `INTERNAL_API_TOKEN` to the browser** — the Route Handlers in `app/api/` are the boundary.

## 17.5 Performance budget (enforce in CI with Lighthouse CI)

| Metric                     | Target                                    | Why                                                           |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| LCP (mobile, listing page) | < 2.0s                                    | Ranking factor + bounce rate                                  |
| INP                        | < 200ms                                   | Filter interactions must feel instant                         |
| CLS                        | < 0.05                                    | Reserve image aspect ratios — car photos are the main culprit |
| JS shipped, public pages   | < 120KB gzipped                           | RSC makes this achievable                                     |
| Images above the fold      | 1, `priority`, AVIF, blurhash placeholder |                                                               |

## 17.6 When to split the frontend

Keep one app until **any** of: admin bundle exceeds ~40% of total JS; you need a different auth model for admin (SSO/IP allowlist); a separate team owns admin; or admin deploys need a different cadence. Then extract `apps/admin` — a Vite SPA is fine, admin has no SEO needs. Realistically month 12+.

---

# 18. UI component library decision

## 18.1 What is actually known about Cars24 and peers

You asked me to distinguish verified fact from inference. Here is the honest split.

### ✅ Verified / publicly observable

- Cars24, CarDekho, Spinny, Cargurus, Carvana and AutoTrader all serve **server-rendered, crawlable HTML** for listing and detail pages with clean, hierarchical URLs. This is trivially verifiable with `curl` and "view source" on any of their pages.
- They use **image CDNs with on-the-fly transformation** (visible in `srcset` URLs containing width/quality/format parameters).
- They publish **`Vehicle`/`Car`/`Product` + `Offer` JSON-LD** structured data on detail pages — visible in page source, testable in Google's Rich Results Test.
- Several (Cars24, CarDekho) have **public engineering blogs on Medium** describing broad practices; whether any given post reflects current production architecture is not verifiable.
- Their **sitemaps are sharded** across many files (visible at `/robots.txt` → sitemap index).

### 🔶 Reasonable architectural inference (NOT verified)

- Companies at that scale almost certainly run a **dedicated search cluster** (Elasticsearch/OpenSearch/Solr), not raw Postgres queries, for listing search.
- They very likely operate a **design system as an internal package** consumed by multiple applications (consumer web, dealer/partner app, internal ops tooling) — because they demonstrably have multiple distinct apps sharing a visual language.
- They likely run **multiple backend services**, not a single monolith, given team sizes in the hundreds.

### ⚠️ Explicitly unknown

Their repository layout, monorepo vs polyrepo choice, internal component library structure, database topology, and service boundaries are **not public**. Anyone who tells you otherwise is guessing. And critically: **their architecture is a solution to their organizational problem (hundreds of engineers), not yours (one).** Copying it would be the single most expensive mistake available to you.

### 💡 My recommendation, derived from your constraints, not theirs

## 18.2 The decision: Option A, with a defined path to Option B

**Keep components inside `apps/web/src/components/` for now. Do not create `dealers-drive-ui`.**

| Option                                                | Assessment                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — local `components/`**                           | ✅ **Recommended.** Zero versioning overhead. Refactoring is a rename. You will redesign these components 5–10 times in the first six months; every redesign in a published package costs a version bump, a publish, and a consumer update.                   |
| B — separate `dealers-drive-ui` repo                  | ❌ Now. Solves a problem you do not have (sharing across repos/teams). Costs: npm registry setup, semver discipline, changelogs, a Storybook deploy, dual PRs for every visual tweak, and a broken local dev loop unless you configure `pnpm link` correctly. |
| C — separate FE/BE repos + UI repo only if justified  | 🟡 Right _instinct_, wrong _repo topology_ (see §5 — monorepo instead).                                                                                                                                                                                       |
| **D — local now, `packages/ui` when a trigger fires** | ✅ **This is what I'm actually recommending.** In a monorepo, promoting `components/ui` to `packages/ui` is a `git mv` plus a `package.json`. No publishing, no versioning — workspace protocol (`"@dd/ui": "workspace:*"`) resolves it directly.             |

**Triggers to promote to `packages/ui`:**

1. A second app exists that needs the same components (a split-out admin app, a marketing site, a dealer-facing native web view).
2. Two or more engineers are working on components in parallel and stepping on each other.
3. You want an independently deployed Storybook as a design/engineering contract.

**Until then, structure the folder as if it were already a package** — that's what makes promotion free:

```
components/
├── ui/          # PRIMITIVES. No business logic. No API imports. No app types.
│   ├── button.tsx      input.tsx      select.tsx      checkbox.tsx
│   ├── dialog.tsx      sheet.tsx      popover.tsx     tooltip.tsx
│   ├── badge.tsx       card.tsx       tabs.tsx        skeleton.tsx
│   ├── toast.tsx       pagination.tsx table.tsx       range-slider.tsx
│   └── index.ts
├── layout/      # Header, Footer, PageShell, DealerShell, AdminShell
├── vehicle/     # VehicleCard, VehicleGrid, Gallery, SpecTable, PriceBlock,
│                #   EmiWidget, ConditionBadge, VehicleCardSkeleton
├── dealer/      # DealerBadge (on every card!), DealerHeader, DealerCard
├── search/      # FilterPanel, FacetGroup, PriceRange, SortSelect, ActiveChips
└── forms/       # VehicleForm, InquiryForm, ImageUploader, field wrappers
```

**The discipline that makes this work:** anything in `ui/` must be importable with zero knowledge of Dealers-Drive. If a component in `ui/` imports a `Vehicle` type, it belongs in `vehicle/` instead. Enforce with an ESLint rule.

Add **Storybook** in the web app once you have ~15 primitives. It pays for itself as a visual regression harness and as the artifact you hand to a designer.

---

# 19. Shared types & API contracts

## 19.1 Recommendation

**A single `packages/contracts` workspace containing Zod schemas, with TypeScript types inferred from them.** Zod schemas are simultaneously your runtime validator (backend), your form validator (frontend), and your type source. One definition, three uses, no drift.

```ts
// packages/contracts/src/vehicle.ts
import { z } from 'zod';

export const FuelType = z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'LPG']);
export const Transmission = z.enum(['MANUAL', 'AUTOMATIC', 'AMT', 'CVT', 'DCT']);

export const CreateVehicleInput = z
  .object({
    makeId: z.string().uuid(),
    modelId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    year: z
      .number()
      .int()
      .min(1990)
      .max(new Date().getFullYear() + 1),
    pricePaise: z.coerce.bigint().positive(),
    kmDriven: z.number().int().min(0).max(1_000_000),
    fuel: FuelType,
    transmission: Transmission,
    ownerNumber: z.number().int().min(1).max(10),
    cityId: z.string().uuid(),
    description: z.string().max(4000).optional(),
    features: z.array(z.string()).max(60).default([]),
    specs: z.record(z.unknown()).default({}),
  })
  .strict(); // ← rejects dealerId, status, etc.

export type CreateVehicleInput = z.infer<typeof CreateVehicleInput>;

export const VehicleSummary = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  year: z.number(),
  pricePaise: z.string(), // bigint over JSON
  kmDriven: z.number(),
  fuel: FuelType,
  transmission: Transmission,
  city: z.object({ slug: z.string(), name: z.string() }),
  dealer: z.object({
    slug: z.string(),
    brandName: z.string(),
    logoUrl: z.string().nullable(),
    verified: z.boolean(),
  }),
  primaryImage: z.object({ key: z.string(), blurhash: z.string().nullable() }).nullable(),
  emiPerMonthPaise: z.string().nullable(),
});
export type VehicleSummary = z.infer<typeof VehicleSummary>;
```

Backend: `@UsePipes(new ZodValidationPipe(CreateVehicleInput))`.
Frontend: `useForm({ resolver: zodResolver(CreateVehicleInput) })` — identical rules, no duplication.

**Also generate OpenAPI** from the NestJS decorators (`@nestjs/swagger` + `zod-to-openapi`). This is not redundant — it gives you interactive docs at `/docs`, a contract artifact for future partners and mobile clients, and a diff you can inspect in PRs to catch accidental breaking changes.

## 19.2 If you insist on separate repositories

(Included because you may still choose two repos.) Publish `@dealers-drive/contracts` to **GitHub Packages** (private, free with your GitHub plan):

1. Contracts live in the API repo under `packages/contracts`.
2. CI publishes on merge to main, version bumped by Changesets.
3. Web repo depends on `"@dealers-drive/contracts": "^1.4.0"`, updated by Renovate.
4. A breaking change is a major bump; the web repo pins until it migrates.

This works, and it is a genuine tax: expect ~15 minutes of ceremony per contract change, and expect version skew bugs. It is exactly the tax the monorepo avoids.

**Do not generate a full API client** (e.g. `openapi-typescript-codegen`) at MVP. A 40-line typed `fetch` wrapper is more readable, more debuggable, and doesn't fight you on auth, caching, or Next.js `fetch` options. Revisit if you get a mobile app.

---

# 20. SEO architecture

SEO is not a section of this document. For a used-car marketplace it is **the growth engine** — organic search is how customers find "used Fortuner in Mumbai," and organic traffic is how you convince dealers your listings are worth paying for. Budget real engineering time.

## 20.1 URL architecture

```
/                                          Homepage
/cars                                      National inventory
/cars/in/mumbai                            City inventory          ← high value
/cars/in/mumbai/toyota                     City + make             ← high value
/cars/in/mumbai/toyota/fortuner            City + make + model     ← highest value
/cars/toyota                               Make (national)
/cars/toyota/fortuner                      Model (national)
/cars/toyota/fortuner/2023                 Model + year
/cars/suv                                  Body type
/cars/under-10-lakh                        Price band (curated, not generated)
/car/2021-toyota-fortuner-4x2-at-mumbai-a1b2c3     VDP
/dealers                                   Dealer directory
/dealers/in/mumbai
/dealers/sharma-motors-andheri             Dealer storefront
/dealers/sharma-motors-andheri/inventory
```

**Rules:**

- Facet order is **fixed and canonical**: `city → make → model → year`. Any other ordering 301-redirects to the canonical form. Without this rule you generate infinite duplicate URLs.
- Only **whitelisted facet combinations** get their own indexable path. Everything else lives in query strings.
- `/car/{slug}` is a permanent URL. When a car sells, keep the page, mark it "Sold," show similar vehicles, and `noindex` it after 30 days. Never 404 a URL Google has indexed — you lose the link equity and the user.

## 20.2 Indexing policy (this is where marketplaces get destroyed)

The failure mode is **index bloat**: 8 facets × 20 values each = millions of thin, near-duplicate pages, Google burns your crawl budget on them, and your genuinely valuable pages stop getting crawled.

| URL pattern                                                        | Index?                                                     | Canonical                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| `/cars`, `/cars/in/{city}`, `/cars/{make}`, `/cars/{make}/{model}` | ✅ index, follow                                           | self                                               |
| `/cars/in/{city}/{make}/{model}`                                   | ✅ index **if ≥ 3 active listings**, else `noindex,follow` | self                                               |
| `/cars/{make}/{model}/{year}`                                      | ✅ index if ≥ 3 listings                                   | self                                               |
| `/cars/...?page=2..N`                                              | ✅ index, follow                                           | **self** (not page 1 — that's the modern guidance) |
| `/cars/...?page=41+`                                               | `noindex,follow`                                           | page 1                                             |
| Any URL with filter query params (`?priceMax=`, `?fuel=`)          | ❌ `noindex,follow`                                        | clean path                                         |
| Any URL with tracking params (`?utm_*`, `?ref=`)                   | —                                                          | clean path                                         |
| `/car/{slug}` — active                                             | ✅ index                                                   | self                                               |
| `/car/{slug}` — sold >30 days                                      | ❌ `noindex,follow`                                        | self                                               |
| `/dealers/{slug}`                                                  | ✅ index if dealer ACTIVE and has ≥1 listing               | self                                               |
| `/dealer/*` dashboard, `/admin/*`, `/api/*`                        | ❌ `Disallow` in robots.txt + `noindex`                    | —                                                  |

**The "≥3 listings" threshold is not arbitrary** — an empty facet page is a thin-content page, and enough of them will suppress your whole domain.

## 20.3 Metadata & structured data

```tsx
// app/(public)/car/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const v = await getVehicle(params.slug);
  if (!v) return { title: 'Vehicle not found' };
  const title = `${v.year} ${v.make} ${v.model} ${v.variant ?? ''} — ₹${lakh(v.price)} | ${v.city}`;
  return {
    title,
    description:
      `${v.year} ${v.make} ${v.model}, ${fmtKm(v.km)} km, ${v.fuel}, ` +
      `${v.ownerNumber} owner. Available at ${v.dealer.brandName}, ${v.city}. ` +
      `View photos, specs and contact the dealer on Dealers-Drive.`,
    alternates: { canonical: `https://dealersdrive.com/car/${v.slug}` },
    openGraph: { title, images: [ogImage(v)], type: 'website' },
    robots: v.isSold && v.soldDaysAgo > 30 ? { index: false, follow: true } : undefined,
  };
}
```

**JSON-LD on the VDP** (`Vehicle` + `Offer` + `AutoDealer` — this is what produces rich results):

```json
{
  "@context": "https://schema.org",
  "@type": "Vehicle",
  "name": "2021 Toyota Fortuner 4x2 AT",
  "brand": { "@type": "Brand", "name": "Toyota" },
  "model": "Fortuner",
  "vehicleModelDate": "2021",
  "mileageFromOdometer": { "@type": "QuantitativeValue", "value": 42000, "unitCode": "KMT" },
  "fuelType": "Diesel",
  "vehicleTransmission": "Automatic",
  "numberOfPreviousOwners": 1,
  "bodyType": "SUV",
  "color": "White",
  "itemCondition": "https://schema.org/UsedCondition",
  "image": ["https://img.dealersdrive.com/…/1600.webp"],
  "offers": {
    "@type": "Offer",
    "price": "2850000",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock",
    "url": "https://dealersdrive.com/car/2021-toyota-fortuner-…",
    "seller": {
      "@type": "AutoDealer",
      "name": "Sharma Motors",
      "url": "https://dealersdrive.com/dealers/sharma-motors-andheri",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Andheri",
        "addressRegion": "Maharashtra",
        "postalCode": "400053",
        "addressCountry": "IN"
      }
    }
  }
}
```

Also: `AutoDealer` + `AggregateRating` on dealer pages · `BreadcrumbList` on all listing pages · `ItemList` on listing pages · `Organization` + `WebSite` with `SearchAction` on the homepage · `FAQPage` on model landing pages.

## 20.4 Sitemaps

At 10k+ URLs a single sitemap won't do. Build a **sitemap index** with sharded children, generated on demand and cached:

```
/sitemap.xml                     ← index
  /sitemaps/static/1.xml         ← ~50 URLs
  /sitemaps/makes/1.xml          ← make + model + city facet pages
  /sitemaps/dealers/1.xml        ← 10k dealers per file
  /sitemaps/vehicles/1.xml … N   ← 50k active listings per file, by updatedAt DESC
```

`lastmod` must be accurate — Google uses it for crawl scheduling, and lying about it gets your sitemap deprioritized. Regenerate vehicle shards hourly via a job; cache at the CDN for 1 hour.

## 20.5 The rest of the checklist

| Item                             | Implementation                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate content across dealers | Same car model listed by 50 dealers = 50 near-identical pages. Mitigate: require unique dealer descriptions (min 100 chars), surface unique data (this specific car's photos, km, owner count, dealer), and rely on the VDP's genuinely unique attributes. Do **not** auto-generate descriptions from a template — that's the fastest route to a thin-content penalty. |
| Location SEO                     | City pages with real local content: dealer count, average price in that city, popular models locally, nearby localities. This is where you beat national competitors.                                                                                                                                                                                                  |
| Internal linking                 | Every VDP links to: its model page, its city page, its dealer page, and 6 similar vehicles. This is how crawl equity flows to deep pages.                                                                                                                                                                                                                              |
| Core Web Vitals                  | §17.5. Ranking factor and a conversion factor.                                                                                                                                                                                                                                                                                                                         |
| `hreflang`                       | Not needed unless multi-country. Prepare the URL structure (`/in/`, `/ae/`) mentally; don't build it.                                                                                                                                                                                                                                                                  |
| Image SEO                        | Descriptive filenames, `alt` = "2021 Toyota Fortuner 4x2 AT front view — Sharma Motors, Mumbai", image sitemap entries.                                                                                                                                                                                                                                                |
| Crawl budget                     | Block `/api/`, filtered query URLs, and dealer/admin routes in `robots.txt`. Monitor "Crawled – currently not indexed" in Search Console weekly.                                                                                                                                                                                                                       |
| Programmatic pages               | Curated price bands ("under ₹5 lakh"), body types, and "best {model} deals in {city}" — but only where you have inventory. Generate from a whitelist, never from a cross-product of all facets.                                                                                                                                                                        |

---

# 21. Security architecture

## 21.1 Threat model — what actually attacks a dealer marketplace

Generic OWASP checklists miss the threats specific to your business. Rank them by likelihood × impact:

| Threat                                                                 | Likelihood    | Impact                     | Primary defence                                   |
| ---------------------------------------------------------------------- | ------------- | -------------------------- | ------------------------------------------------- |
| **Dealer accesses another dealer's inventory/leads**                   | Medium        | Critical (business-ending) | §8 four-layer isolation                           |
| **Payment/credit manipulation**                                        | Medium        | Critical                   | §13.4 server-authoritative                        |
| **Lead scraping** (competitors harvesting your dealers' phone numbers) | **Very high** | High — dealers churn       | Below                                             |
| **Listing scraping** (competitor copies your inventory)                | **Very high** | Medium                     | Below                                             |
| **Fake dealer accounts / listing fraud**                               | High          | High (trust)               | KYC + moderation                                  |
| **Stolen dealer account** (credential reuse)                           | Medium        | High                       | 2FA offer, login alerts, session list             |
| **Stored XSS via dealer description/name**                             | Medium        | High                       | Sanitize + CSP                                    |
| **Malicious file upload**                                              | Medium        | High                       | §12.3 re-encode                                   |
| **Webhook forgery**                                                    | Low           | Critical                   | HMAC verification                                 |
| **Inquiry spam / SMS pumping**                                         | High          | Medium (cost)              | Rate limit + captcha                              |
| **SQL injection**                                                      | Low (Prisma)  | Critical                   | Parameterized everywhere; audit `$queryRaw` sites |

### Anti-scraping (most marketplaces underinvest here)

Your dealers pay you for leads. If a competitor scrapes every dealer phone number off your site, you have built a lead-gen product for them.

- **Never render raw phone numbers in the initial HTML.** Show "Show number" → an authenticated-or-rate-limited endpoint that logs the reveal and increments a per-IP counter. This alone stops 95% of scraping.
- Cloudflare Bot Management on `/cars` and `/car/*`.
- Behavioural rate limiting: >200 VDPs in 10 minutes from one IP is not a human.
- Honeypot listings with tracked phone numbers to detect and prove scraping.
- Accept that public listing _data_ will be scraped. Protect the _contact_ data.

## 21.2 Controls by category

| Category          | MVP (🟢 build now)                                                                                                                                                                                                                    | Growth (🟡)                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Injection**     | Prisma parameterized queries; every `$queryRaw` uses tagged templates, never string concat; Zod validation on all input                                                                                                               | Automated SAST in CI (CodeQL)                                               |
| **XSS**           | React auto-escaping; **never** `dangerouslySetInnerHTML` on dealer content; sanitize rich text with DOMPurify server-side; strict CSP                                                                                                 | CSP reporting endpoint, nonce-based CSP                                     |
| **CSRF**          | `SameSite=Lax` cookies + double-submit token on all mutations; Server Actions have built-in protection                                                                                                                                | —                                                                           |
| **SSRF**          | Dealers can submit URLs (website, social). Never fetch them server-side. If you must (link preview), use an allowlist + block private IP ranges + no redirects                                                                        | Dedicated egress proxy                                                      |
| **Auth attacks**  | Argon2id password hashing; rate limit login 5/15min; account lockout with exponential backoff; generic error messages ("invalid credentials"); OTP: 6 digits, 5 min TTL, 3 attempts, single use; session rotation on privilege change | 2FA for dealers, breach-password check (HIBP k-anonymity)                   |
| **Authorization** | §9.2 guard + service double-check; RLS backstop; the 404-not-403 rule                                                                                                                                                                 | Automated IDOR test suite                                                   |
| **File upload**   | mime allowlist, size cap, presigned conditions, magic-byte check, **mandatory re-encode**, EXIF strip, separate serving domain                                                                                                        | ClamAV on KYC docs, NSFW classifier                                         |
| **Secrets**       | Platform secret store (Vercel/Render env, encrypted at rest); zod-validated at boot; **never** in the repo; `.env.example` documents keys only; separate keys per environment                                                         | AWS Secrets Manager, 90-day rotation                                        |
| **Encryption**    | TLS 1.3 everywhere, HSTS with preload; Postgres encrypted at rest (managed default); bcrypt/Argon2 for passwords; SHA-256 for session tokens                                                                                          | Column-level encryption (`pgcrypto`) for PAN/GSTIN/full reg numbers         |
| **PII**           | Minimize: mask registration numbers, don't store full PAN, strip GPS EXIF; delete/anonymize on request; document a retention policy (leads 24 months, audit 7 years)                                                                  | DPDP Act (India) compliance review, consent management, DPA with processors |
| **Webhooks**      | HMAC verification on raw body **before** parsing; timestamp tolerance ±5 min; replay protection via `webhook_events` unique key; IP allowlist if provider publishes one                                                               | Signed internal webhooks too                                                |
| **API abuse**     | §10.3 rate limits; Cloudflare WAF; request size limits (1MB JSON, 10MB upload); query complexity caps (max 40 pages, max 100 limit)                                                                                                   | Per-dealer quotas, anomaly alerting                                         |
| **Headers**       | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, CSP                                                                | Report-only → enforce CSP                                                   |
| **Audit**         | Every admin action, every money movement, every state transition, every cross-tenant read → `audit_logs` with actor, before/after, IP, traceId. Immutable (no UPDATE/DELETE grant)                                                    | Ship to an append-only store; alerting on anomalous admin activity          |
| **Dependencies**  | `pnpm audit` in CI, Dependabot on, lockfile committed                                                                                                                                                                                 | Renovate + SBOM                                                             |

## 21.3 Security work you should do in Sprint 8, not Sprint 1

- Third-party penetration test before public launch (~$2–5k, worth it).
- Write down an incident response runbook: who is called, how to revoke all sessions, how to rotate every secret, how to notify dealers.
- Practise a database restore from backup. An untested backup is not a backup.

---

# 22. Observability

## 22.1 What you actually need at each stage

| Capability            | MVP 🟢                                                                                                   | Growth 🟡                                            | Scale 🔴                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| Error tracking        | **Sentry** (free tier) — web + api, source maps, release tagging                                         | Sentry Team, alert routing                           | Same                                     |
| Structured logs       | **pino** JSON → platform log drain (Render/Vercel) or Better Stack (~$25/mo)                             | Loki or Datadog Logs, 30-day retention               | Centralized, sampled, 90-day             |
| Metrics               | Platform CPU/mem/req dashboards + a handful of **business** metrics in a Postgres view                   | Prometheus + Grafana, or Datadog                     | Same + SLOs                              |
| Tracing               | **traceId propagated in logs and error reports** (poor-man's tracing — 90% of the value, 5% of the cost) | OpenTelemetry → Tempo/Datadog APM                    | Full distributed tracing across services |
| Uptime                | **UptimeRobot / Better Stack** on `/health/ready` and the homepage (free)                                | Multi-region synthetics on critical journeys         | Same                                     |
| DB monitoring         | `pg_stat_statements` + provider dashboard; weekly slow-query review                                      | Automated slow-query alerts, connection-pool metrics | Query plan regression detection          |
| RUM / Core Web Vitals | **Vercel Analytics** or PostHog web vitals                                                               | Full RUM                                             | Same                                     |
| Product analytics     | **PostHog** (free tier)                                                                                  | PostHog scale / Amplitude                            | Warehouse + dbt                          |

**Skip Datadog at MVP.** It is excellent and it will cost more than your entire infrastructure. Sentry + platform logs + PostHog costs $0–50/month and covers you to ~1M MAU.

## 22.2 Instrument the business, not just the servers

Server metrics tell you the box is healthy. Business metrics tell you the _product_ is healthy. Put these on one page from week one:

```
FUNNEL
  new dealer applications / day
  applications → payment conversion %          ← is your onboarding fee too high?
  payment → verification-approved %
  vehicles created → published %               ← where dealers give up
  median time: dealer signup → first live listing   ← THE activation metric

MARKETPLACE
  active listings (total, by city, by make)
  listings expiring in next 7 days             ← renewal revenue at risk
  search → VDP click-through rate
  VDP → inquiry conversion rate                ← the number dealers care about
  inquiries per active listing per week        ← your entire value proposition
  % of listings with zero inquiries in 30 days ← churn predictor

MONEY
  credits sold / consumed / outstanding liability
  revenue by product (onboarding vs listings)
  payment success rate by method               ← UPI vs card failures
  stuck payments (>10 min in ATTEMPTED)        ← ALERT

HEALTH
  p50/p95/p99 latency: /v1/vehicles, VDP, publish
  error rate by endpoint
  job queue depth + oldest pending job         ← ALERT if > 5 min
  webhook processing lag                       ← ALERT
  media processing failures
```

## 22.3 Alerts worth waking up for (keep this list short)

`API 5xx rate > 2% for 5 min` · `Payment webhook lag > 5 min` · `Job queue depth > 1000 or oldest job > 15 min` · `Database connections > 80%` · `Database disk > 80%` · `Any payment stuck in ATTEMPTED > 30 min` · `Credit ledger reconciliation mismatch` · `Site down (synthetic)`.

Everything else goes to a Slack channel you check in the morning. **Alert fatigue is a security and reliability risk**; a solo developer with 40 noisy alerts will ignore the one that matters.

---

# 23. DevOps & infrastructure

## 23.1 Why not AWS on day one

You said "preferably AWS." Here is the honest trade:

|                                    | Managed PaaS (Vercel + Render + Neon)      | AWS from day one                                                |
| ---------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Time to first production deploy    | **~2 hours**                               | 2–3 weeks (VPC, subnets, SGs, IAM, ECS, ALB, RDS, ACM, Route53) |
| Preview environments per PR        | **Built in**                               | Build it yourself                                               |
| Cost at MVP                        | **$45–110/mo**                             | $150–300/mo (NAT Gateway alone is ~$35/mo)                      |
| Ops burden                         | Near zero                                  | Real, ongoing                                                   |
| Ceiling                            | ~10k dealers / few million MAU comfortably | Effectively unlimited                                           |
| Migration cost when you outgrow it | ~1 week (everything is already Dockerized) | n/a                                                             |

**Recommendation:** start on PaaS, containerize everything, keep all cloud-specific code behind adapters, and migrate to AWS (`ap-south-1` if India) when you hit the trigger: >$1,500/mo PaaS bill, or a data-residency/compliance requirement, or you need VPC-private database networking.

## 23.2 Environments

| Env            | Web              | API                                  | Database                                             | Purpose                                      |
| -------------- | ---------------- | ------------------------------------ | ---------------------------------------------------- | -------------------------------------------- |
| **Local**      | `pnpm dev`       | `pnpm dev`                           | Docker Postgres + MinIO + Mailpit                    | Full offline dev                             |
| **Preview**    | Vercel per-PR    | Render PR env (or shared dev API)    | **Neon branch** (instant copy-on-write from staging) | Review every PR with real data shape         |
| **Staging**    | Vercel `staging` | Render staging                       | Neon staging branch, anonymized prod subset          | Pre-release verification; Razorpay test mode |
| **Production** | Vercel prod      | Render prod (2 instances) + 1 worker | Neon/RDS prod, PITR on                               | Live                                         |

Neon's database branching is genuinely transformative for a solo developer — every PR gets a real database with realistic data in ~2 seconds, at near-zero cost.

## 23.3 CI/CD pipeline

```
git push → GitHub
    │
    ├─ ci.yml  (on every PR, path-filtered via turbo)
    │    1. pnpm install --frozen-lockfile   (cached)
    │    2. turbo lint typecheck             (only affected packages)
    │    3. turbo test:unit
    │    4. Postgres service container → prisma migrate deploy → test:integration
    │    5. turbo build
    │    6. Playwright E2E against the preview deployment (critical paths only)
    │    7. Lighthouse CI budget check on /cars and a VDP
    │    8. pnpm audit --audit-level=high  +  CodeQL
    │
    ├─ deploy-web.yml  (main, paths: apps/web, packages/*)
    │    → Vercel production (skips build via turbo-ignore if unaffected)
    │
    └─ deploy-api.yml  (main, paths: apps/api, packages/contracts)
         1. docker build --platform linux/amd64
         2. push to registry (GHCR)
         3. RUN MIGRATIONS FIRST (expand phase only — see below)
         4. deploy to Render/ECS with health-check gating
         5. smoke test /health/ready + one authenticated read
         6. auto-rollback if health check fails for 2 min
```

Target: **under 6 minutes from merge to production.** If it's slower, you'll batch changes, and batched changes are riskier changes.

## 23.4 Database migrations — the expand/contract discipline

This is the operational practice that most often bites early-stage teams. **Never write a migration that breaks the currently-running code**, because for 60 seconds during deploy, old and new code run simultaneously.

```
EXPAND    (deploy 1)  Add nullable column / new table / new index CONCURRENTLY.
                      Old code ignores it. Safe.
MIGRATE   (deploy 1+) New code writes BOTH old and new. Backfill via a job.
CONTRACT  (deploy 2+) Once no code reads the old column, drop it.
```

Rules: never `ALTER COLUMN … NOT NULL` on a large table without a default and a backfill; always `CREATE INDEX CONCURRENTLY` in production; always set `lock_timeout` and `statement_timeout` in migrations so a lock never takes the site down; renames are two deploys, never one.

## 23.5 Deployment strategy per stage

| Stage  | Strategy                                                 | Rationale                                                                         |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| MVP    | **Rolling with health checks** (Render/Fargate default)  | Sufficient. Add a 30s drain period so in-flight requests finish.                  |
| Growth | **Blue/green** for the API                               | Instant rollback; worth the complexity once downtime costs money.                 |
| Scale  | **Canary** (5% → 25% → 100%) with automated metric gates | Only valuable when you have enough traffic for 5% to be statistically meaningful. |

**Rollback plan for the MVP:** re-deploy the previous image tag (one click / one command), and — critically — make sure the previous image is compatible with the current schema. Expand/contract guarantees this.

## 23.6 Infrastructure as Code

🔴 **Do not write Terraform at MVP.** Your infrastructure is five dashboard settings; codifying it costs a week and saves nothing. **Do** write down every environment variable, every service setting, and every DNS record in `docs/infrastructure.md`. Adopt Terraform (or Pulumi/CDK) on the day you move to AWS — at that point it's genuinely essential.

## 23.7 Backups & disaster recovery

- Managed Postgres PITR: **7 days minimum at MVP, 30 days at growth.**
- Weekly automated logical dump (`pg_dump`) to R2, in a **different provider** than your database. Provider-level failure is a real risk.
- R2 media: enable versioning + a lifecycle rule; consider cross-region replication at growth.
- **Test the restore quarterly.** Write down the RTO you actually achieved. Target: RPO < 5 min, RTO < 1 hour at MVP.

---

# 24. Testing strategy

## 24.1 The shape (deliberately not a pyramid)

For a solo developer on a CRUD-and-money product, the classic pyramid over-invests in unit tests of code that is mostly orchestration. Invert it toward **integration tests against a real Postgres**:

```
        ╱─────────────╲     E2E (Playwright)          ~10 tests   ~5%
       ╱───────────────╲    Critical journeys only
      ╱─────────────────╲
     ╱                   ╲  INTEGRATION (API + real DB)  ~120 tests  ~60%
    ╱─────────────────────╲ ← YOUR HIGHEST-VALUE TESTS
   ╱───────────────────────╲
  ╱─────────────────────────╲ UNIT (pure logic)          ~80 tests   ~30%
 ╱───────────────────────────╲ Component (RTL)           ~15 tests    ~5%
```

**Why integration-heavy:** your bugs will not be in a pricing function. They will be in "did the guard actually scope by dealer," "did the transaction roll back," "did the webhook dedupe." Those only surface against a real database. Use Testcontainers (or a CI Postgres service) — never mock Prisma.

## 24.2 What to test, by priority

**Tier 1 — write these before launch, no exceptions:**

| Test                                                                                                                                       | Type                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Dealer A cannot read/update/delete Dealer B's vehicle → **404**                                                                            | Integration                 |
| Dealer A cannot see Dealer B's inquiries or billing                                                                                        | Integration                 |
| Publishing with 0 credits → 402, no listing created, no credit consumed                                                                    | Integration                 |
| Publishing with 1 credit → listing ACTIVE, balance 0, ledger entry, outbox event — all in one TX                                           | Integration                 |
| Two concurrent publishes with 1 credit → exactly one succeeds                                                                              | Integration (concurrency)   |
| Duplicate webhook (same event id) → credits granted exactly once                                                                           | Integration                 |
| Webhook with invalid signature → 400, nothing granted                                                                                      | Integration                 |
| Client-supplied `status`/`dealerId`/`amount` in request body is rejected/ignored                                                           | Integration                 |
| Payment reconciliation settles a payment whose webhook never arrived                                                                       | Integration                 |
| Suspended dealer's listings disappear from public search                                                                                   | Integration                 |
| Credit ledger `balanceAfter` never goes negative                                                                                           | Integration + DB constraint |
| Full journey: register → apply → pay → approve → add vehicle → upload → publish → appears in search → customer inquires → dealer sees lead | **E2E**                     |
| Search returns correct results for a known fixture set (each filter, each sort)                                                            | Integration                 |
| Price/EMI/formatting math                                                                                                                  | Unit                        |
| Slug generation, canonical URL builder, facet→query mapping                                                                                | Unit                        |
| Listing state machine: every invalid transition throws                                                                                     | Unit                        |

**Tier 2 — add in the first month post-launch:** VDP renders correct JSON-LD; sitemap generation; image derivative generation; email templates render; rate limiter behaviour.

**Do not build at MVP:** contract tests (you have one consumer, in the same repo, sharing types — Zod _is_ your contract test); load tests (nothing to load); visual regression (your design will change weekly); 80% coverage targets (a coverage number is not a quality metric).

**Load testing** becomes valuable in Sprint 9 and before any major traffic event: a k6 script hitting `/cars` and a VDP at 100 → 1,000 RPS to find where Postgres actually breaks. Do it once, record the number, and you'll know exactly when to add Redis.

---

# 25. Design system & Figma

## 25.1 Design thesis

Every Indian used-car marketplace looks like a discount retailer: loud yellow, red urgency badges, "MEGA SALE" ribbons. That styling works for a company selling _its own_ cars at a margin. It is wrong for Dealers-Drive, because your actual promise is different:

> **Dealers-Drive is infrastructure. The dealer is the merchant; we are the rails.**

So the visual identity should read as **civic and engineered** rather than promotional — closer to a well-designed transit system or a payments company than to a showroom banner. Confident, quiet, data-dense, and trustworthy. The dealer's brand is the colour on the page; ours is the frame around it.

### The signature element: **the plate**

The one memorable device, drawn from the subject's own world: the **registration plate**. A plate is a bordered, fixed-proportion badge with a coloured band on the left and monospaced-feeling characters in the field. It is instantly, universally automotive without being a car silhouette.

The plate motif appears in exactly four places, and nowhere else:

1. The **logo** (a plate containing the DD monogram).
2. The **year badge** on every vehicle card (`2021` in a plate).
3. The **verified-dealer chip** on dealer branding.
4. The **price block** on the VDP (a plate-framed figure).

Everything else in the UI is quiet: flat surfaces, one weight of border, generous whitespace, no gradients, no drop shadows beyond a single subtle elevation step. **Spend the boldness in one place.**

## 25.2 Tokens

```css
/* ── COLOR ──────────────────────────────────────────────────────────── */
--dd-ink-900: #0a0e1a; /* asphalt night — headings, dark surfaces  */
--dd-ink-700: #1b2233;
--dd-ink-500: #3d4759; /* body text                                */
--dd-ink-300: #6b7688; /* secondary text                           */
--dd-ink-100: #a8b1c0; /* disabled                                 */

--dd-cobalt-700: #142ba8; /* pressed                                  */
--dd-cobalt-600: #1b39d6; /* PRIMARY — buttons, links, the plate band */
--dd-cobalt-500: #3554ee; /* hover                                    */
--dd-cobalt-100: #e4e9fe; /* tinted backgrounds, selected chips       */

--dd-plate: #f2b705; /* SIGNATURE AMBER — plate accents ONLY     */
--dd-plate-ink: #4a3600; /* text on amber                            */

--dd-verified: #0fa968; /* verified dealer, success                 */
--dd-warn: #c97a00;
--dd-danger: #d42b21;

--dd-surface: #ffffff;
--dd-surface-sub: #f4f6f9; /* page background, cool not cream          */
--dd-surface-sunk: #ebeff5; /* skeletons, wells                         */
--dd-border: #dde3ec; /* the ONE border colour                    */
--dd-border-strong: #c3ccda;

/* Dark mode (dealer dashboard + admin get it first) */
--dd-dark-bg: #070a12;
--dd-dark-surface: #101725;
--dd-dark-border: #212b3e;

/* ── TYPOGRAPHY ─────────────────────────────────────────────────────── */
--font-display: 'Cabinet Grotesk', 'Inter', system-ui; /* squared terminals,
                                                           engineered feel */
--font-ui: 'Inter', system-ui; /* dense data UI   */
--font-plate: 'Archivo', 'Inter'; /* wide, uppercase,
                                                           tabular numerals */

/* Type scale — 1.200 minor third, tightened at display sizes */
--text-display:
  clamp(2.25rem, 4vw, 3.5rem) / 1.05 700 -0.03em display --text-h1: 2rem / 1.15 700 -0.02em display
    --text-h2: 1.5rem / 1.25 650 -0.015em display --text-h3: 1.25rem / 1.3 600 -0.01em ui
    --text-body-lg: 1.0625rem/1.6 400 0 ui --text-body: 0.9375rem/1.55 400 0 ui
    --text-sm: 0.8125rem/1.45 400 0 ui --text-label: 0.75rem / 1.3 600 0.06em ui UPPERCASE
    --text-plate: 0.875rem / 1 700 0.08em plate UPPERCASE tabular
    /* PRICES ALWAYS use font-variant-numeric: tabular-nums. Non-negotiable —
   a column of misaligned prices is the fastest way to look untrustworthy. */ /* ── SPACING (4px base) ─────────────────────────────────────────────── */
    --space-1: 4px --space-2: 8px --space-3: 12px --space-4: 16px --space-5: 20px --space-6: 24px
    --space-8: 32px --space-10: 40px --space-12: 48px --space-16: 64px --space-20: 80px
    --space-24: 96px /* ── RADIUS ─────────────────────────────────────────────────────────── */
    --radius-sm: 4px /* chips, small badges           */ --radius-md: 8px
    /* inputs, buttons               */ --radius-lg: 12px /* cards                         */
    --radius-xl: 16px /* modals, hero search panel     */ --radius-plate: 6px
    /* the plate motif — fixed        */ --radius-full: 9999px /* avatars, filter pills ONLY     */
    /* ── ELEVATION (restrained: two steps, that's all) ──────────────────── */ --shadow-1: 0 1px
    2px rgb(10 14 26 / 0.06),
  0 1px 3px rgb(10 14 26 / 0.04);
--shadow-2: 0 8px 24px rgb(10 14 26 / 0.1); /* modals, dropdowns only  */
/* Cards use --dd-border, NOT shadows. Borders read as engineered;
   shadows read as consumer-app default.                                */

/* ── MOTION ─────────────────────────────────────────────────────────── */
--ease: cubic-bezier(0.2, 0.8, 0.2, 1);
--dur-fast: 120ms /* hover, focus       */ --dur-base: 200ms /* panels, accordions */
  --dur-slow: 320ms /* sheets, modals     */
  /* @media (prefers-reduced-motion: reduce) → all durations 0ms          */;
```

**Layout grid:** 12 columns · gutter 24px · max content width 1280px · page padding 16px (mobile) / 24px (tablet) / 32px (desktop).
**Breakpoints:** `sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1536`.

## 25.3 Component specifications

| Component               | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**              | Heights 32/40/48. Variants: `primary` (cobalt fill, white), `secondary` (white fill, `--dd-border`, ink text), `ghost`, `danger`. Radius `md`. Focus: 2px cobalt ring, 2px offset. Loading state replaces the label with a spinner and **preserves width** (no layout shift).                                                                                                                                                                                                         |
| **Input / Select**      | Height 44 (touch-friendly). 1px border, radius `md`. Label above, always visible (never placeholder-as-label). Error: danger border + message below with an icon. Prefix slots for `₹` and suffix for `km`.                                                                                                                                                                                                                                                                           |
| **Vehicle card**        | 4:3 image, `object-cover`, blurhash placeholder, aspect-ratio reserved. **Year plate** top-left over the image. Favorite heart top-right. Below: title (`{year} {make} {model} {variant}`, 2-line clamp), spec row (`42,000 km · Diesel · Automatic · 1st owner`) in `--text-sm` `ink-300`, price in `h3` tabular, then a **1px divider** and the **dealer strip**: 20px logo + brand name + verified tick. The divider matters — it visually says "this car belongs to that dealer." |
| **Dealer badge**        | 20/28/40px logo (fallback: monogram on a generated pastel derived from the dealer id), brand name, optional verified tick in `--dd-verified`. Appears on **every** vehicle card, without exception.                                                                                                                                                                                                                                                                                   |
| **Filter panel**        | Desktop: sticky left rail, 280px, own scroll. Mobile: bottom sheet with an "Apply (128 cars)" button showing the live result count. Each facet group: label, collapsible, "show more" past 6 options, live counts per option, disabled at count 0 (never hidden — hiding options makes users think the filter is broken).                                                                                                                                                             |
| **Active filter chips** | Horizontal scroll row above results. Each removable. "Clear all" at the end.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Price range**         | Dual-thumb slider **plus** two numeric inputs. Slider alone is unusable for a ₹50k–₹1cr range; inputs alone feel clumsy. Both.                                                                                                                                                                                                                                                                                                                                                        |
| **Gallery**             | Desktop: large frame + thumbnail strip, keyboard arrows, click to open a full-screen lightbox with zoom. Mobile: swipeable with a `3/18` counter. First image `priority`, rest lazy.                                                                                                                                                                                                                                                                                                  |
| **Spec table**          | Two columns, zebra `--dd-surface-sub`, label `ink-300` / value `ink-700`. Grouped: Overview · Engine & transmission · Dimensions · Features.                                                                                                                                                                                                                                                                                                                                          |
| **Table (dashboard)**   | Sticky header, 48px rows, zebra optional, per-column sort, row-hover, bulk-select checkbox column, sticky action column on the right. Empty state with an illustration and a primary CTA.                                                                                                                                                                                                                                                                                             |
| **Modal / Sheet**       | Modal on desktop (max 560px, radius `xl`, `--shadow-2`), bottom sheet on mobile. Focus trap, `Esc` to close, scroll lock, backdrop `rgb(10 14 26 / .5)`.                                                                                                                                                                                                                                                                                                                              |
| **Toast**               | Bottom-right desktop, top mobile. 4s auto-dismiss, action slot for "Undo".                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Empty states**        | Every list has one. Line-art illustration + one sentence naming what's missing + one primary action. "No vehicles yet. Add your first vehicle to start receiving enquiries."                                                                                                                                                                                                                                                                                                          |
| **Skeletons**           | Every async surface. Match the real layout's dimensions exactly, or you get layout shift.                                                                                                                                                                                                                                                                                                                                                                                             |

## 25.4 Screen-by-screen layout direction

### Homepage

```
┌───────────────────────────────────────────────────────────────┐
│ HEADER  [DD plate logo]  Buy  Dealers  Sell │ 📍Mumbai  Sign in│
├───────────────────────────────────────────────────────────────┤
│  HERO — ink-900 background, no photo montage                  │
│  "Every dealer's inventory. One place."                       │
│  sub: 12,480 cars from 340 verified dealers across 18 cities  │
│                                                               │
│  ┌─ Search panel (white, radius-xl, elevated over the ink) ─┐ │
│  │ [ City ▾ ][ Make ▾ ][ Model ▾ ][ Budget ▾ ] [ Search → ] │ │
│  │ Popular: Swift · Creta · Fortuner · Nexon · City         │ │
│  └──────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│ TRUST STRIP  Verified dealers · Real photos · Direct contact  │
│              · No commission on your purchase                 │
├───────────────────────────────────────────────────────────────┤
│ BROWSE BY BRAND    [12 logo tiles, greyscale → colour on hover]│
├───────────────────────────────────────────────────────────────┤
│ BROWSE BY BODY TYPE  [SUV] [Hatchback] [Sedan] [MUV] [Luxury] │
│                      line illustrations, not photos            │
├───────────────────────────────────────────────────────────────┤
│ RECENTLY LISTED IN MUMBAI          [horizontal card carousel] │
├───────────────────────────────────────────────────────────────┤
│ FEATURED DEALERS   [dealer cards: logo, name, city, N cars,   │
│                     rating, "View inventory →"]                │
├───────────────────────────────────────────────────────────────┤
│ FOR DEALERS — inverted ink band                               │
│ "List your inventory where buyers are already looking."       │
│ [ Become a dealer ]                                           │
├───────────────────────────────────────────────────────────────┤
│ SEO FOOTER  Cars by city × brand × budget — real internal     │
│             links, three columns, small type                  │
└───────────────────────────────────────────────────────────────┘
```

### Listing page (`/cars/...`)

```
Breadcrumb: Home / Used cars / Mumbai / Toyota / Fortuner
H1: Used Toyota Fortuner in Mumbai        128 cars   [Sort: Relevance ▾]
┌─ Filters 280px ─┬─ Results grid (3 cols xl / 2 md / 1 sm) ─────────┐
│ 📍 City         │ [chips: Mumbai ×] [Diesel ×] [Clear all]         │
│ Budget (slider  │ ┌──────────┐┌──────────┐┌──────────┐             │
│   + inputs)     │ │ [2021]   ││          ││          │             │
│ Make / Model    │ │  photo   ││          ││          │             │
│ Year            │ │        ♡ ││          ││          │             │
│ Km driven       │ ├──────────┤│          ││          │             │
│ Fuel            │ │2021 Toyota Fortuner 4x2 AT                     │
│ Transmission    │ │42,000 km · Diesel · Automatic · 1st owner      │
│ Body type       │ │₹28,50,000        EMI from ₹52,400/mo           │
│ Owners          │ ├──────────┤ ← divider                           │
│ Features        │ │ 🏪 Sharma Motors ✓   Andheri, Mumbai           │
│ Dealer          │ └──────────┘                                     │
│                 │ … 24 per page … [1][2][3]…[6]                    │
└─────────────────┴──────────────────────────────────────────────────┘
Below the fold: SEO copy block + "Popular Fortuner searches" links
```

### Vehicle detail page

```
Breadcrumb
┌─ Gallery (60%) ──────────────────┬─ Sticky rail (40%) ───────────┐
│ ┌──────────────────────────────┐ │ 2021 Toyota Fortuner 4x2 AT   │
│ │        main image      3/18  │ │ Andheri, Mumbai               │
│ └──────────────────────────────┘ │ ┌───────────────────────────┐ │
│ [▪][▪][▪][▪][▪][+13]             │ │ ₹28,50,000    (plate)     │ │
│                                  │ │ EMI from ₹52,400/mo ⓘ     │ │
│ AT-A-GLANCE (4 tiles)            │ └───────────────────────────┘ │
│  42,000 km │ Diesel │ Auto │ 1st │ ┌─ DEALER CARD ─────────────┐ │
│                                  │ │ [logo] Sharma Motors ✓    │ │
│ OVERVIEW  description            │ │ 4.6 ★ (82) · 46 cars      │ │
│                                  │ │ Andheri West, Mumbai      │ │
│ SPECIFICATIONS  grouped table    │ │ [ Show number ]  ← gated  │ │
│                                  │ │ [ Send enquiry ]  primary │ │
│ FEATURES  chip grid              │ │ View all inventory →      │ │
│                                  │ └───────────────────────────┘ │
│ INSPECTION / CONDITION notes     │ Report this listing            │
└──────────────────────────────────┴───────────────────────────────┘
SIMILAR CARS  [carousel]        MORE FROM SHARMA MOTORS  [carousel]
Mobile: gallery full-bleed; a fixed bottom bar with price + [Enquire]
```

### Dealer page

```
┌ COVER BAND (dealer accent colour, derived from their logo) ─────┐
│  [logo 96px]  Sharma Motors ✓ Verified                          │
│  4.6 ★ (82 reviews) · 46 cars · Andheri West, Mumbai            │
│  Member since 2024      [ Show number ]  [ Message ]            │
└─────────────────────────────────────────────────────────────────┘
[ Inventory (46) | About | Reviews | Location ]
Inventory tab: the same filter+grid as the listing page, scoped to
this dealer. Reuse the components — do not build a second grid.
```

### Dealer dashboard

```
┌ Sidebar 240 ─┬──────────────────────────────────────────────────┐
│ ▪ Overview   │ Overview                                          │
│ ▪ Inventory  │ ┌──────┬──────┬──────┬──────┐                    │
│ ▪ Add vehicle│ │Active│Views │Enq.  │Credits│  ← 4 stat plates   │
│ ▪ Enquiries 3│ │  46  │ 12.4k│  38  │  12   │                   │
│ ▪ Billing    │ └──────┴──────┴──────┴──────┘                    │
│ ▪ Analytics  │ ⚠ 4 listings expire in 7 days   [ Renew ]         │
│ ▪ Settings   │ Recent enquiries (table)                          │
│              │ Top performing listings (table)                   │
│ [Credits: 12]│                                                   │
│ [Buy credits]│                                                   │
└──────────────┴───────────────────────────────────────────────────┘

Add vehicle — 4 steps, autosaved as DRAFT after each:
 1 Identify  Make → Model → Variant → Year        (dropdowns only)
 2 Details   Price, km, fuel, transmission, owners, colour, city
 3 Photos    Drag-drop, reorder, set primary (min 3)
 4 Review    Preview exactly as buyers see it → [ Publish · 1 credit ]
```

### Admin dashboard

```
Sidebar: Overview · Dealers · Listings · Payments · Moderation ·
         Enquiries · Config · Audit log
Dealers: table + status filter, bulk approve/reject, a detail drawer
         showing KYC docs side-by-side with the application form
Moderation queue: card view, keyboard shortcuts (A approve / R reject /
         S skip) — moderating 200 listings a day with a mouse is misery
Payments: reconciliation view — local ledger vs gateway, mismatches first
```

## 25.5 Figma file structure

```
Dealers-Drive Design System        (published library)
├── 00 Cover
├── 01 Foundations   colour styles · type styles · spacing · radius ·
│                    elevation · iconography (Lucide, 1.5px stroke) · grid
├── 02 Primitives    Button · Input · Select · Checkbox · Radio · Switch ·
│                    Chip · Badge · Plate · Tooltip · Avatar · Skeleton
├── 03 Patterns      VehicleCard · DealerBadge · FilterGroup · Gallery ·
│                    SpecTable · Pagination · Toast · Modal · EmptyState ·
│                    StatTile · DataTable
├── 04 Navigation    Header (logged out / customer / dealer / admin) ·
│                    Footer · Sidebar · Breadcrumb · MobileNav
└── 05 Icons

Dealers-Drive Product              (consumes the library)
├── 01 Customer Web   Home · Listing · VDP · Dealer · Saved · Auth
├── 02 Dealer         Onboarding flow · Dashboard · Inventory ·
│                     Add vehicle (4 steps) · Enquiries · Billing
├── 03 Admin          Dealers · Moderation · Payments · Config
├── 04 Responsive     Every key screen at 375 / 768 / 1440
├── 05 States         Loading · Empty · Error · Success for every screen
└── 06 Prototypes     Buyer journey · Dealer onboarding → first listing
```

**Figma practices that matter:** use **variables** (not just styles) for colour so light/dark is a mode toggle · build components with **variants** for state (default/hover/focus/disabled/loading) and **boolean props** for optional slots · use **auto-layout everywhere** so components mirror flexbox and hand off cleanly · name layers to match code component names (`VehicleCard/Image`, `VehicleCard/DealerStrip`) so the engineering translation is mechanical.

**Do the mobile designs first.** In India, 75–85% of used-car marketplace traffic is mobile. A desktop-first design will get retrofitted badly.

---

# 26. Branding & logo

## 26.1 Positioning

|                     |                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **What we are**     | The platform independent dealers run their business on, and where buyers find every dealer's inventory in one place.                       |
| **Personality**     | Engineered · Even-handed · Local · Unpretentious · Precise                                                                                 |
| **Not**             | Discount retailer · Startup-cute · Luxury concierge · Aggregator-of-aggregators                                                            |
| **Tagline options** | "Every dealer. One drive." · "The dealer's marketplace." · "Where dealers list. Where buyers look." · "Independent dealers, one platform." |
| **Voice**           | Plain verbs. Sentence case. Numbers over adjectives — "340 verified dealers," not "India's most trusted."                                  |

## 26.2 Four directions

### Direction 1 — **The Plate** ✅ Recommended

The mark is a registration plate: a rounded rectangle with a solid cobalt band on the left edge and the **DD** monogram in the field. The band is the ownable detail — it's lifted directly from European/Indian plate design, so it reads "vehicle" instantly without drawing a car.

- **Why it wins:** unmistakably automotive, zero cliché (no wheels, no speed lines, no chevrons), works at 16px, extends into a _system_ rather than sitting inertly in the corner — the same plate frames prices, year badges and verified chips throughout the product. Cheap to trademark; the geometry is distinctive.
- **Wordmark:** "Dealers-Drive" in Cabinet Grotesk SemiBold, -2% tracking. Hyphen retained and set in cobalt — it becomes a small brand tic that also visually splits the two words.
- **Icon/app:** plate alone, DD in the field.
- **Favicon (16px):** drop the DD, keep the plate silhouette + band. Reads as a solid mark at tiny sizes.

```svg
<!-- Dealers-Drive mark — "The Plate" -->
<svg viewBox="0 0 128 64" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="Dealers-Drive">
  <rect x="1.5" y="1.5" width="125" height="61" rx="8"
        fill="#FFFFFF" stroke="#0A0E1A" stroke-width="3"/>
  <path d="M1.5 9.5A8 8 0 0 1 9.5 1.5H30v61H9.5a8 8 0 0 1-8-8Z"
        fill="#1B39D6"/>
  <rect x="12" y="46" width="6" height="6" rx="1" fill="#F2B705"/>
  <text x="76" y="45" text-anchor="middle" font-family="Archivo, Inter, sans-serif"
        font-size="34" font-weight="700" letter-spacing="1" fill="#0A0E1A">DD</text>
</svg>
```

The small amber square on the band is the signature accent — the only amber in the mark, echoing the plate motif used throughout the UI.

### Direction 2 — **The Junction**

Four short strokes converging on a single point, forming an implied diamond — many dealers, one platform. Abstract, network-y, scales beautifully. **Risk:** could belong to a logistics or fintech company; it does not say "cars" without the wordmark.

### Direction 3 — **The Key Tag**

The mark is a dealer key fob/tag silhouette with a hole at the top, containing the DD monogram. Warm, specific to the trade, instantly recognisable to dealers themselves. **Risk:** slightly retail/physical; less "technology company" as you scale into financing and data.

### Direction 4 — **The Odometer**

A monogram where the two D's are set as rotating drums, one slightly offset vertically as if mid-rotation. Clever, literal to used cars (mileage), and animatable on page load. **Risk:** the joke gets old, and the offset reads as a rendering bug at small sizes.

## 26.3 Brand palette (brand ≠ product UI palette)

| Role           | Hex       | Use                                                   |
| -------------- | --------- | ----------------------------------------------------- |
| Ink            | `#0A0E1A` | Wordmark, plate outline, dark sections                |
| Cobalt         | `#1B39D6` | The band, primary actions, links                      |
| Plate Amber    | `#F2B705` | The accent square, badges — **never** as a large fill |
| Paper          | `#FFFFFF` | Plate field                                           |
| Cool Grey      | `#F4F6F9` | Backgrounds                                           |
| Verified Green | `#0FA968` | Verification only, never decorative                   |

**Light variant:** ink outline, white field, cobalt band.
**Dark variant:** white outline, transparent field, cobalt band, white DD. Never invert the amber.
**Monochrome:** required for print/embroidery — plate outline + 100% black band with knocked-out DD.

**Clear space** = the height of the amber square on all sides. **Minimum sizes:** 24px digital / 12mm print for the full mark; 16px for the favicon variant.

**Don'ts:** no gradients, no drop shadows, no stretching, no rotating the plate, no putting the mark on a photograph without a solid backing plate, no recolouring the band to match a partner's brand.

---

# 27. Scaling roadmap: MVP → massive scale

Every technology below is introduced only when a named metric turns red. **If the metric is green, do not build it.**

## Stage 1 — MVP (0–1,000 dealers · ~10k listings · <500k MAU)

```
Vercel(Next.js) → Render(API 1–2 × 0.5vCPU) + Render(worker 1) → Neon Postgres
                                                                → Cloudflare R2
```

| Component  | Why now                             | What happens without it                            |
| ---------- | ----------------------------------- | -------------------------------------------------- |
| Postgres   | Everything. Single source of truth. | —                                                  |
| pg-boss    | Async work without new infra        | Image processing blocks HTTP; emails fail silently |
| R2 + CDN   | Images are 90% of your bytes        | Slow pages, huge egress bills                      |
| Sentry     | You cannot fix what you cannot see  | Dealers report bugs by phone, if at all            |
| Cloudflare | Free WAF, DDoS, caching             | You get scraped and hammered                       |

**Validation targets:** 20 paying dealers · 500 live listings · 100 inquiries/month · p95 < 400ms.

## Stage 2 — Growth (1k–10k dealers · 100k–500k listings · 1–5M MAU)

| Introduce                        | Trigger metric                                                              | Problem solved                                               | Migration difficulty                                                      |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **Read replica**                 | Primary CPU > 60% sustained; public reads > 70% of queries                  | Isolates marketplace reads from dealer writes                | **Easy** — route `PublicListingsRepository` to a second connection string |
| **Redis**                        | Session lookups > 2k/s, or you need cross-instance rate limits              | Session cache, rate limiting, facet cache, distributed locks | **Easy** — `CachePort` already exists                                     |
| **Typesense/Meilisearch**        | > 100k listings, or p95 search > 300ms, or typo tolerance costs conversions | Relevance, typo tolerance, fast faceting                     | **Medium** — `SearchPort` exists; ~1 week including reindex tooling       |
| **BullMQ on Redis**              | Job throughput > 50/s, or pg-boss polling adds DB load                      | Higher-throughput queueing                                   | **Easy** — job handlers are unchanged                                     |
| **Separate media worker**        | Image jobs delay other jobs                                                 | CPU isolation                                                | Easy                                                                      |
| **Move API to AWS ECS Fargate**  | PaaS bill > $1,500/mo, or VPC-private DB required                           | Cost + network control                                       | **Medium** — already Dockerized; ~1 week                                  |
| **CloudFront / full CDN config** | Global traffic, or origin egress costs bite                                 | Latency, cost                                                | Easy                                                                      |
| **OpenTelemetry + Grafana**      | You can't answer "why was that request slow"                                | Distributed visibility                                       | Medium                                                                    |
| **Blue/green deploys**           | Downtime now costs revenue                                                  | Zero-downtime releases                                       | Easy on ECS                                                               |
| **Dedicated analytics replica**  | Dealer analytics queries slow the primary                                   | Isolation                                                    | Easy                                                                      |

## Stage 3 — Scale (10k–100k dealers · 1–5M listings · 5–25M MAU)

| Introduce                              | Trigger                                                 | Problem solved                      | Difficulty                                                           |
| -------------------------------------- | ------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| **Extract `search-svc`**               | Search is >40% of API CPU and needs independent scaling | Independent scaling + deploy        | **Medium** — the facade is already the boundary                      |
| **Extract `media-svc`**                | Image processing dominates cost; wants serverless burst | Bursty CPU on a different runtime   | Medium                                                               |
| **OpenSearch cluster**                 | > 1M listings, custom relevance/ML ranking needed       | Ranking quality at scale            | Medium-Hard                                                          |
| **Table partitioning**                 | `audit_logs`/`inquiries`/`listing_views` > 100M rows    | Vacuum, query time, retention       | Medium (easy if you partitioned audit logs from day one, as advised) |
| **Multiple read replicas + PgBouncer** | Read QPS > 10k                                          | Connection exhaustion, read scaling | Medium                                                               |
| **SNS/SQS or Kafka for the outbox**    | Cross-service events; >3 services                       | Durable inter-service eventing      | **Easy** — swap the outbox publisher's sink                          |
| **CDC (Debezium)**                     | Dual-write drift between DB and search/analytics        | Guaranteed consistency              | Hard                                                                 |
| **ClickHouse / Redshift**              | Analytics queries impact OLTP even on a replica         | Columnar analytics, dealer BI       | Medium                                                               |
| **Canary deploys**                     | Regressions cost real money                             | Safer releases                      | Medium                                                               |
| **Multi-AZ + automated failover**      | Downtime is unacceptable                                | Availability                        | Easy on RDS                                                          |

## Stage 4 — Massive (100k dealers · 10M vehicles · 50M MAU · 1M concurrent peak)

**Concretely, at your stated numbers:** 1M concurrent users at ~0.2 req/s/user ≈ **200,000 RPS**, of which ~95% is cacheable public content.

```
                     Cloudflare / CloudFront  (≥95% cache hit ratio on
                              │                public HTML + images —
                              │                this is what makes 200k RPS
                              │                affordable)
        ┌─────────────────────┴──────────────────────┐
        ▼                                            ▼
  Public Read Plane                            Write / Auth Plane
  ─────────────────                            ──────────────────
  Next.js edge/ISR (10k RPS origin)            core-api (Fargate, 50–200 tasks)
  read-api (stateless, 100+ tasks)             billing-svc  ← own DB
  → OpenSearch cluster (listings)              dealer-svc
  → Redis cluster (hot listings)               media-svc → Lambda fan-out
  → read replicas ×5                           notification-svc → SQS/SES
        │                                            │
        └───────────────► Kafka (CDC + domain events) ◄──────┘
                                 │
              ┌──────────────────┼───────────────────┐
              ▼                  ▼                   ▼
        search indexer     ClickHouse (analytics)  ML ranking / recsys
                                                   (feature store)
  Aurora PostgreSQL writer + partitioned hot tables
  Optional regional sharding ONLY if multi-country
```

**Key insights for this stage:**

- **Cache hit ratio is the whole ballgame.** At 95% CDN hit rate, 200k RPS becomes 10k RPS at origin, which is a routine workload. At 80% it becomes 40k RPS and your bill quadruples. Invest engineering in cacheability, not in more servers.
- **Reads and writes get separate planes.** Buyers browsing and dealers publishing have completely different scaling curves; at this size they should not share a deployment.
- **You still don't need to shard the primary database.** A well-tuned Aurora writer with partitioned hot tables handles 100k dealers' _writes_ comfortably — writes are a tiny fraction of your traffic. Shard only if you go multi-country with data residency requirements.
- **Do not build any of this before the trigger fires.** Companies die from premature Stage-4 architecture far more often than from being caught unprepared.

---

# 28. Cost model

Conceptual monthly figures; verify against current pricing. Assumes India/Asia region, 15 images per vehicle at ~120KB per delivered derivative.

## MVP (100 dealers · 1,000 listings · 50k MAU)

| Item                                      | Cost              |
| ----------------------------------------- | ----------------- |
| Vercel Pro                                | $20               |
| Render API (1 × 1GB) + worker (1 × 512MB) | $14               |
| Neon Postgres (launch tier)               | $19               |
| Cloudflare R2 (50GB storage, 0 egress)    | $1                |
| Cloudflare Images (200k transforms)       | $10               |
| Sentry / PostHog / UptimeRobot            | $0 (free tiers)   |
| Resend (10k emails)                       | $0–20             |
| Domain + email                            | $5                |
| **Total**                                 | **~$70–90/month** |

Razorpay takes ~2% of transaction value — a revenue share, not infrastructure cost.

## 1,000 dealers (10k listings · 500k MAU)

| Item                                         | Cost                |
| -------------------------------------------- | ------------------- |
| Vercel Pro (higher bandwidth/function usage) | $60–150             |
| API 2 × 2GB + 1 worker                       | $70                 |
| Postgres (4GB RAM, 100GB) + PITR             | $110                |
| R2 (500GB) + Images (3M transforms)          | $60                 |
| Email/SMS (SMS is the surprise — ~₹0.15/msg) | $80                 |
| Sentry Team + PostHog                        | $50                 |
| **Total**                                    | **~$430–520/month** |

## 10,000 dealers (150k listings · 5M MAU)

| Item                                                      | Cost                    |
| --------------------------------------------------------- | ----------------------- |
| Web hosting (Vercel Pro/Enterprise or self-hosted on ECS) | $400–900                |
| ECS Fargate: api 4 tasks + worker 2 + media 2             | $350                    |
| RDS Postgres Multi-AZ (8 vCPU) + 1 replica                | $700                    |
| ElastiCache Redis                                         | $120                    |
| Typesense Cloud                                           | $200                    |
| R2/S3 (6TB) + CDN                                         | $250                    |
| Email + SMS + WhatsApp                                    | $600                    |
| Observability (Datadog or Grafana Cloud)                  | $300                    |
| **Total**                                                 | **~$2,900–3,400/month** |

## 100,000 dealers (2M listings · 50M MAU)

| Item                                            | Cost                      |
| ----------------------------------------------- | ------------------------- |
| CDN + edge (the dominant line item)             | $8,000–20,000             |
| Compute (100–300 Fargate tasks across services) | $12,000                   |
| Aurora writer + 5 replicas                      | $9,000                    |
| OpenSearch cluster                              | $4,000                    |
| Redis cluster                                   | $1,500                    |
| Object storage (80TB)                           | $1,500                    |
| ClickHouse / warehouse                          | $3,000                    |
| Observability                                   | $4,000                    |
| Email/SMS/WhatsApp                              | $8,000                    |
| **Total**                                       | **~$50,000–65,000/month** |

## The five cost drivers, ranked

1. **Image egress and transformation.** Mitigations, in order of impact: R2's zero egress · aggressive CDN caching with immutable URLs · client-side pre-compression before upload · AVIF · correct `srcset` so phones never download a 1600px image · lazy-load everything below the fold. Getting this right is worth more than every other optimization combined.
2. **Database.** Mitigations: read replicas before vertical scaling · the denormalized `listing_search` table · connection pooling (PgBouncer) · aggressive `pg_stat_statements` review · partition and archive `audit_logs` and view events.
3. **Compute.** Mitigations: ISR/CDN caching means most requests never reach your API · autoscale on request count, not CPU · scale to a low floor overnight (used-car traffic has a pronounced daily curve).
4. **SMS/WhatsApp.** Genuinely surprising at scale. Mitigation: email-first, SMS only for OTP and hot leads, WhatsApp Business templates (cheaper per message in India than SMS for many categories).
5. **Observability.** Datadog's pricing scales with hosts _and_ custom metrics _and_ log volume. Mitigation: sample logs, cap custom metric cardinality (never put `dealer_id` in a metric label — that's 100,000 time series), and stay on Grafana Cloud/self-hosted longer than feels comfortable.

## How to avoid premature spend

- Ride free tiers deliberately: Cloudflare, Sentry, PostHog, UptimeRobot, GitHub Actions all have real free tiers that cover an MVP entirely.
- **Do not reserve capacity** until usage is stable for 3 months.
- Scale the database vertically (one click) before adding replicas; add replicas before sharding.
- Delete staging when unused; use Neon branches (they cost pennies and auto-suspend).
- Set a **billing alert at 2× expected spend** on every provider, today.
- Review the bill line-by-line monthly. At MVP scale, one misconfigured service can double your cost overnight and go unnoticed for months.

---

# 29. ADR decision table

| #   | Decision              | Options considered                                   | **Recommendation**                                                          | Why                                                                                                                                                                       | When to revisit                                                                                                      |
| --- | --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Primary database      | PostgreSQL · MongoDB · both                          | **PostgreSQL 16 only**                                                      | Money, ownership and lifecycle need ACID + FKs. JSONB covers variable specs. Two DBs = dual-write bugs + no cross-store transactions.                                     | Only if a genuinely non-transactional, document-shaped, high-write subsystem appears (Phase 3 CRM). Try JSONB first. |
| 2   | API style             | REST · GraphQL · both · tRPC                         | **REST + OpenAPI 3.1**                                                      | One first-party client; CDN caching of public listings is critical; GraphQL adds a week of setup and complicates caching and rate limiting. tRPC over-couples web to API. | Public partner API or 3+ divergent clients (Phase 6).                                                                |
| 3   | Backend shape         | Modular monolith · microservices · serverless        | **Modular monolith (NestJS)** with enforced boundaries                      | One engineer. Transactional consistency for free. Extraction later is mechanical if facades + events are respected.                                                       | Team > 12, or one module has a genuinely different scaling profile. Extract `search` first.                          |
| 4   | Repo layout           | 2 repos · monorepo · 3 repos                         | **Turborepo monorepo, 2 deploy targets**                                    | Atomic contract changes, direct type sharing, one CI cache. Independent deployment is achieved with path filters, not repos.                                              | Separate teams with separate release cadence + on-call (~15 engineers).                                              |
| 5   | Component library     | Local folder · separate repo · `packages/ui`         | **Local `components/` now**, promote to `packages/ui` when a 2nd app exists | You'll redesign components 5–10× in six months. Versioning that is pure friction. In a monorepo, promotion is a `git mv`.                                                 | A second app, or parallel component work by 2+ engineers.                                                            |
| 6   | Cache layer           | Redis now · CDN+ISR only                             | **CDN + Next ISR + in-process LRU. No Redis.**                              | Postgres handles session lookups at your scale; CDN covers 95% of read traffic.                                                                                           | Sessions > 2k/s, cross-instance rate limits, or facet computation > 100ms.                                           |
| 7   | Search                | Postgres FTS · Elasticsearch · Typesense · Algolia   | **Postgres (`listing_search` + GIN/trgm)**, behind a `SearchPort`           | Sufficient to ~200k listings ≈ 20k dealers. Zero cost, zero ops.                                                                                                          | > 100k listings, p95 > 300ms, or typo tolerance costs conversions → **Typesense**.                                   |
| 8   | Job queue             | pg-boss · BullMQ+Redis · SQS · Temporal              | **pg-boss**                                                                 | Real queue semantics on infrastructure you already run; transactional enqueue enables the outbox.                                                                         | > 50 jobs/s → BullMQ. Multi-service → SQS.                                                                           |
| 9   | Object storage        | S3+CloudFront · R2 · Cloudinary                      | **Cloudflare R2 + Cloudflare Images**                                       | **Zero egress fees** on an image-heavy product; S3-compatible so migration is a config change.                                                                            | If you consolidate fully on AWS, or Cloudflare Images' transform limits bite.                                        |
| 10  | CDN                   | Cloudflare · CloudFront · Fastly                     | **Cloudflare** (free tier)                                                  | WAF, bot management, DDoS, caching, DNS in one free product.                                                                                                              | Enterprise contract needs or deep AWS integration.                                                                   |
| 11  | Authentication        | JWT · sessions · Auth0/Clerk · NextAuth              | **Opaque session cookies in Postgres** (custom, ~250 LOC)                   | Instant revocation (critical for suspending dealers), immediate permission changes, no vendor lock-in on your most business-critical table.                               | Mobile app or partner API → add JWTs alongside. Never replace sessions for web.                                      |
| 12  | Payments              | Razorpay · Stripe · PayU · Cashfree                  | **Razorpay** behind a `PaymentGatewayPort`                                  | India-first: UPI, netbanking, RuPay, GST invoicing, e-mandate. The port makes a second provider a 2-day job.                                                              | International dealers → add Stripe as a second adapter.                                                              |
| 13  | Monetization mechanic | Pay-per-publish · **credit packs** · subscription    | **Prepaid listing credits**                                                 | Instant publish (no gateway latency in the UX), prepaid cash flow, trivial volume discounts, refunds are ledger entries.                                                  | Add subscriptions on top later — they simply grant credits monthly.                                                  |
| 14  | Multi-tenancy         | Shared schema · schema-per-dealer · DB-per-dealer    | **Shared DB, shared schema, `dealer_id` + RLS**                             | Your core product is a cross-tenant search. Physical isolation makes it architecturally impossible. Scales to 100k+ tenants.                                              | Only for a contractual data-residency requirement (hybrid isolation for one enterprise tenant).                      |
| 15  | Orchestration         | Kubernetes · ECS Fargate · PaaS                      | **PaaS (Render/Fly) → ECS Fargate at growth**                               | K8s is a full-time job. Fargate gets you to enormous scale with no cluster to operate.                                                                                    | > 8 services **and** > 6 engineers. Probably never.                                                                  |
| 16  | Events                | None · in-process bus + outbox · Kafka               | **In-process bus + transactional outbox from day one**                      | Costs one table and ~60 lines; guarantees side effects; the outbox sink swaps to a broker later with no domain changes.                                                   | > 3 services sharing events → SNS/SQS, then Kafka.                                                                   |
| 17  | Frontend rendering    | CSR SPA · SSR · **RSC + ISR**                        | **RSC + ISR + selective client components**                                 | SEO is the growth engine; ISR gives cached, crawlable HTML with sub-second LCP.                                                                                           | Never — this is correct at every scale.                                                                              |
| 18  | Type sharing          | Duplicate · OpenAPI codegen · **shared Zod package** | **`packages/contracts` with Zod**                                           | One definition serves as runtime validation (API), form validation (web), and static types.                                                                               | Add generated clients if a mobile/partner client appears.                                                            |
| 19  | IaC                   | Terraform now · later · never                        | **Later (at the AWS migration)**                                            | MVP infra is five dashboard settings; document them in Markdown instead.                                                                                                  | The day you move to AWS.                                                                                             |
| 20  | Admin UI              | Same Next.js app · separate app · Retool             | **Same app, `(admin)` route group**                                         | One deploy, one auth, shared components.                                                                                                                                  | Admin bundle > 40% of JS, or a different auth model, or a separate team.                                             |

---

# 30. Build now / prepare / do not build

| Component                                                      | Status              | Reasoning                                                                                   |
| -------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| PostgreSQL                                                     | 🟢 **Build now**    | The foundation of everything                                                                |
| Next.js App Router + RSC + ISR                                 | 🟢                  | SEO is the growth engine                                                                    |
| NestJS modular monolith                                        | 🟢                  | Structure that makes later extraction cheap                                                 |
| Prisma + migrations                                            | 🟢                  | Schema evolution discipline from day one                                                    |
| Turborepo monorepo                                             | 🟢                  | Two hours of setup, saves months                                                            |
| `packages/contracts` (Zod)                                     | 🟢                  | Prevents contract drift permanently                                                         |
| Cookie sessions + RBAC                                         | 🟢                  | Core to the product                                                                         |
| Row-Level Security                                             | 🟢                  | Trivial now, terrifying to retrofit after an incident                                       |
| Cloudflare R2 + Images                                         | 🟢                  | Images are the product                                                                      |
| Presigned direct uploads                                       | 🟢                  | Never proxy image bytes through your API                                                    |
| Razorpay + webhooks + idempotency                              | 🟢                  | Money must be correct on day one                                                            |
| Credit ledger (append-only)                                    | 🟢                  | The anti-fraud foundation                                                                   |
| pg-boss job queue                                              | 🟢                  | Zero-cost async                                                                             |
| Transactional outbox                                           | 🟢                  | 60 lines now, weeks later                                                                   |
| In-process event bus                                           | 🟢                  | Decoupling with no infrastructure                                                           |
| `listing_search` denormalized table                            | 🟢                  | Makes Postgres search viable to 200k listings                                               |
| Curated make/model/variant catalog                             | 🟢                  | Everything downstream depends on clean taxonomy                                             |
| Vehicle ≠ Listing separation                                   | 🟢                  | Your revenue model lives here                                                               |
| SEO: metadata, JSON-LD, sitemaps, canonicals                   | 🟢                  | This _is_ customer acquisition                                                              |
| Sentry + structured logs + traceId                             | 🟢                  | You cannot operate blind                                                                    |
| Audit logs (partitioned)                                       | 🟢                  | Disputes, fraud, compliance                                                                 |
| Rate limiting                                                  | 🟢                  | Cheap; abuse arrives early                                                                  |
| Integration test suite (tenant isolation + payments)           | 🟢                  | The tests that prevent business-ending bugs                                                 |
| CI/CD with preview environments                                | 🟢                  | Solo devs need a safety net most                                                            |
| Admin moderation console                                       | 🟢                  | Ungoverned marketplaces fill with fraud in weeks                                            |
| Phone-number reveal gating                                     | 🟢                  | Protects your dealers' leads from scrapers                                                  |
| `SearchPort` / `StoragePort` / `PaymentGatewayPort` interfaces | 🟢                  | The seams that make every later migration cheap                                             |
| `CachePort` with a memory adapter                              | 🟡 **Prepare**      | Interface now, Redis adapter later                                                          |
| Redis                                                          | 🟡                  | Trigger: §27 Stage 2                                                                        |
| Typesense / OpenSearch                                         | 🟡                  | Trigger: >100k listings                                                                     |
| Read replicas                                                  | 🟡                  | Trigger: primary CPU > 60%                                                                  |
| `packages/ui`                                                  | 🟡                  | Trigger: a second app                                                                       |
| OpenTelemetry tracing                                          | 🟡                  | traceId-in-logs covers you until multi-service                                              |
| Terraform                                                      | 🟡                  | Trigger: AWS migration                                                                      |
| Dealer staff sub-accounts                                      | 🟡                  | Schema supports it (`DealerMember`); build the UI when asked for                            |
| Subscriptions                                                  | 🟡                  | Ledger already supports it                                                                  |
| Reviews & ratings                                              | 🟡                  | Post-launch; needs moderation capacity first                                                |
| WhatsApp / SMS notifications                                   | 🟡                  | Email-first; add SMS for hot leads                                                          |
| Blue/green + canary                                            | 🟡                  | Rolling deploys are fine at MVP                                                             |
| Microservices                                                  | 🔴 **Do not build** | Distributed-systems cost, zero organizational benefit                                       |
| Kafka                                                          | 🔴                  | The outbox gives you the semantics; the broker is later                                     |
| Kubernetes                                                     | 🔴                  | A full-time job you don't have                                                              |
| MongoDB                                                        | 🔴                  | Solves nothing Postgres doesn't                                                             |
| GraphQL                                                        | 🔴                  | One client                                                                                  |
| CQRS / event sourcing                                          | 🔴                  | Enormous complexity, no current benefit                                                     |
| Service mesh, multi-region active-active                       | 🔴                  | Not in this decade for you                                                                  |
| Native mobile apps                                             | 🔴                  | Ship a fast mobile web experience first; it's 80% of the value at 10% of the cost           |
| ML recommendations / dynamic pricing                           | 🔴                  | Needs data you don't have yet. "Similar cars" = same model ± 2 years, ± 20% price.          |
| Custom analytics warehouse                                     | 🔴                  | PostHog + a Postgres replica covers years                                                   |
| Multi-currency / multi-country                                 | 🔴                  | Keep money as `BigInt` minor units + a `currency` column; that's all the preparation needed |

---

# 31. Solo-developer implementation roadmap

Ten two-week sprints. **Sprints 1–7 are the launchable MVP** (~14 weeks); 8–10 harden and launch. Assumes full-time work.

### Sprint 0 — Foundations (1 week)

Monorepo scaffold (Turborepo + pnpm) · Next.js + NestJS hello-world both deployed to production URLs on day 3 · Postgres via Neon + Docker Compose locally · Prisma with one migration · CI (lint/typecheck/test) · Sentry wired in both apps · design tokens in Tailwind config.
**Done when:** a commit to `main` reaches production automatically, and a deliberate error appears in Sentry.

### Sprint 1 — Identity & tenancy

Users, sessions, cookie auth · register/login/logout/verify email · password reset · `Dealer` + `DealerMember` + dealer application flow (creates `DRAFT`) · auth/RBAC/tenant guards · `RequestContext` · audit log skeleton · admin user seeded with 2FA.
**Done when:** the tenant-isolation integration tests pass (Dealer A → Dealer B's resource → 404).

### Sprint 2 — Catalog & vehicles

Seed makes/models/variants/cities (**budget 3 full days for real data sourcing and cleaning — this is not a small task**) · vehicle CRUD scoped by dealer · Zod contracts in `packages/contracts` · dealer inventory list · slug generation.
**Done when:** a dealer can create a vehicle and see it in their inventory list. No images yet.

### Sprint 3 — Media pipeline

Presigned R2 uploads · client-side pre-compression · commit endpoint · pg-boss + `media.process` worker (sharp: derivatives, EXIF strip, blurhash) · drag-to-reorder gallery · primary image · orphan GC job.
**Done when:** a dealer uploads 10 phone photos and they appear, correctly sized and ordered, in under 15 seconds.

### Sprint 4 — Public marketplace

`listing_search` table + subscribers · `GET /v1/vehicles` with all filters, sort, pagination · facet counts · `/cars` listing page (RSC + ISR) · filter panel with URL state · VehicleCard **with dealer branding** · VDP · dealer page · homepage · responsive down to 375px.
**Done when:** a stranger can find a specific car in under three clicks on a phone.

### Sprint 5 — Money

Credit packs + `platform_config` pricing · Razorpay order creation with idempotency · webhook endpoint with HMAC verification + `webhook_events` dedupe · credit ledger · onboarding-fee gate · publish/unpublish with atomic credit consumption · listing state machine · expiry sweeper · invoice generation · billing page.
**Done when:** every Tier-1 payment test in §24.2 passes, including the concurrency test.

### Sprint 6 — Leads & admin

Inquiry form (guest-capable) + rate limiting + captcha · "Show number" gating · dealer inquiry inbox · email notifications (dealer lead alert, receipt, expiry warning) · admin console: dealer approve/reject/suspend, listing moderation, payment view, config editor · favorites.
**Done when:** the full loop works end-to-end — dealer pays, publishes, buyer inquires, dealer is emailed within 30 seconds.

### Sprint 7 — SEO & polish

Facet landing pages with the canonical URL rules · dynamic metadata · JSON-LD (Vehicle/Offer/AutoDealer/Breadcrumb) · sharded sitemaps · robots.txt · OG images · Search Console + GA4 + PostHog · Core Web Vitals to target · loading/error/empty states everywhere · 404/410 handling for sold cars.
**Done when:** Lighthouse ≥ 90 on mobile for `/cars` and a VDP, and rich results validate.

### Sprint 8 — Hardening

Security headers + CSP · full rate-limit coverage · payment reconciliation job · counter reconciliation job · backup restore rehearsal · load test (k6) to find the real ceiling · alerting · runbook · Playwright E2E for the two critical journeys · dependency audit · **external penetration test booked**.
**Done when:** you have restored the database from a backup and written down the actual RTO.

### Sprint 9 — Private beta

Onboard 10 real dealers by hand. Sit with three of them while they add a car. **Watch where they get stuck without helping them.** Fix that. Expect: the vehicle form is too long, the photo upload confuses them, and they don't understand credits. Fix all three. Ship dealer-requested must-haves only.
**Done when:** a dealer completes signup → live listing with zero help from you.

### Sprint 10 — Launch

Marketing site copy · dealer onboarding docs · support email/WhatsApp · pricing page · terms/privacy (get these reviewed by a lawyer — you're handling payments and PII) · Search Console sitemap submission · soft launch in one city.
**Done when:** you have a paying dealer you did not personally know beforehand.

## Post-launch order of work (do not decide this now — let dealers decide it)

The first three months post-launch should be driven entirely by two questions: _why do dealers churn?_ and _why don't listings convert to inquiries?_ Likely answers, in rough priority: bulk CSV upload (dealers with 50+ cars will not hand-enter them) · WhatsApp lead alerts · dealer analytics · reviews · saved searches with email alerts · dealer staff accounts · subscriptions · featured listings.

---

# 32. Risks & architectural mistakes to avoid

## 32.1 Architectural

| Risk                                                       | Consequence                                                                         | Mitigation                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Skipping the module-boundary ESLint rule**               | The monolith becomes a ball of mud in ~4 months; extraction becomes a rewrite       | Add it in Sprint 0. 20 lines.                                      |
| **Letting `dealerId` come from the request body anywhere** | Cross-tenant data breach; business-ending                                           | Session-only, `.strict()` schemas, RLS backstop, integration tests |
| **Trusting client-supplied prices or payment status**      | Direct revenue theft                                                                | Server-side price lookup, webhook-only value grants                |
| **Building a second database "for flexibility"**           | Dual-write drift, no cross-store transactions, doubled ops                          | Postgres + JSONB                                                   |
| **Free-text make/model input**                             | Search, filters and SEO all degrade at once, unrecoverably without a data migration | Curated catalog, dropdowns only                                    |
| **Conflating Vehicle and Listing**                         | Painful migration in month 8 when you add renewals/boosts                           | Separate from day one                                              |
| **No outbox**                                              | Silent lost emails, un-indexed listings, phantom side effects                       | One table, day one                                                 |
| **Premature microservices**                                | 6–12 months of velocity gone                                                        | Modular monolith                                                   |
| **Premature Kubernetes**                                   | You become a platform engineer instead of a founder                                 | Fargate/PaaS                                                       |

## 32.2 Product & business

| Risk                                                         | Consequence                                                              | Mitigation                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cold-start (no cars → no buyers → no dealers)**            | The marketplace never ignites                                            | Launch **one city only**. Hand-onboard 30 dealers with free credits. Density beats coverage — 500 cars in one city beats 5,000 across twenty.                                                  |
| **Dealers won't pay upfront**                                | No revenue                                                               | Consider: free onboarding + first 10 listings free, charge on renewal. Prove lead value before charging. Your architecture supports this — it's a `platform_config` change, not a code change. |
| **Dealers list stale/sold cars**                             | Buyer trust collapses; the marketplace dies                              | 90-day expiry (already designed) · weekly "still available?" prompts · a buyer "report as sold" button · penalize dealers with high stale rates in search ranking                              |
| **Lead scraping by competitors**                             | Dealers churn to the competitor who now has their number                 | §21.1 phone gating from day one, not later                                                                                                                                                     |
| **Fake listings / bait pricing**                             | Regulatory and reputational damage                                       | KYC before publishing · price-anomaly flagging (>40% below model median → review queue) · buyer reporting                                                                                      |
| **No moderation capacity**                                   | Marketplace fills with junk in weeks                                     | Build the admin queue in Sprint 6, not "later"                                                                                                                                                 |
| **Dealers with 200 cars won't hand-enter them**              | Your best customers can't onboard                                        | CSV import is the #1 post-launch feature. Design the vehicle schema now assuming a bulk importer will target it.                                                                               |
| **Optimizing the buyer experience while ignoring dealer UX** | Dealers are the paying customer; if the dashboard is painful, they leave | Watch dealers use it (Sprint 9). Time "signup → first live listing" and treat it as your north-star activation metric.                                                                         |

## 32.3 Personal (the risk nobody writes down)

The most likely failure mode for this project is not architectural — it is **a solo developer spending four months building infrastructure for a business that has not been validated.** Every 🔴 item in §30 is a trap that feels like progress.

Protect against it with hard rules: ship something a real dealer can use by week 8, even if it's ugly · talk to five dealers before Sprint 4 and let their answers reorder your backlog · if a sprint slips twice, cut scope rather than extending · never build a feature no dealer has asked for twice.

---

# 33. Business evolution: how today's architecture supports Phases 1–7

| Phase                                                                | What it needs                                                                 | Already supported by                                                                                | What to add                                                                                                                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Dealer inventory marketplace**                                 | Everything in this document                                                   | —                                                                                                   | —                                                                                                                                                                                        |
| **2 — Dealer SaaS** (inventory tools, bulk import, pricing insights) | Multi-tenant model, RBAC, dealer staff                                        | `Dealer`, `DealerMember`, permissions, tenant guards **already built**                              | CSV importer module · pricing-insight queries against the analytics replica · dealer staff UI                                                                                            |
| **3 — Dealer CRM** (lead pipeline, follow-ups, tasks)                | An entity with a lifecycle attached to leads                                  | `Inquiry` already has `status` and dealer scoping; event bus already exists                         | `crm` module: contacts, activities, tasks, notes. This is the one place where a JSONB activity feed is genuinely appropriate — still in Postgres.                                        |
| **4 — Financing / insurance / warranty**                             | Partner integrations, application state machines, sensitive PII, strict audit | `PaymentGatewayPort` pattern generalizes to `PartnerPort` · audit logs · encryption approach        | `finance` module with per-partner adapters · **column-level encryption** for financial PII · likely a compliance review and possibly a separately-deployed service with its own database |
| **5 — Dealer analytics**                                             | Aggregations without touching OLTP                                            | Read replica pattern · event stream · `analytics.rollup-daily` job                                  | ClickHouse or a warehouse · dbt models · a dashboard app. The event catalog you defined in §16 becomes the analytics fact stream.                                                        |
| **6 — Advertising marketplace**                                      | Placement inventory, auctions, impression/click tracking at volume, billing   | `boostLevel` already in the listing model and search sort · credit ledger handles any billable unit | `ads` module: campaigns, placements, budgets · a high-volume impression pipeline (Kafka → ClickHouse) · **this is the phase where GraphQL for partner APIs becomes worth reconsidering** |
| **7 — Automotive ecosystem** (OEMs, service, parts, valuation, C2C)  | Genuinely multi-domain; multiple teams                                        | The module boundaries you enforced from Sprint 0                                                    | Real service extraction along existing facade lines · Kafka as the shared event backbone · possibly separate databases per bounded context                                               |

**The three decisions made today that keep all seven phases open:**

1. **Enforced module boundaries + facades.** Every future service extraction follows a line that already exists in the code.
2. **The transactional outbox + a versioned event envelope.** Every future consumer — analytics, ads, CRM, ML — subscribes to a stream that already exists and is already durable.
3. **A generic append-only ledger.** Listing credits, subscription grants, ad spend, lead fees, financing commissions — all of it is `delta + reason + refType/refId` in a table that is already correct and already reconciled nightly.

Nothing in the MVP prevents any of these. That is the actual test of an architecture, and this one passes it.

---

# 34. Your first week

Concrete, in order. Do not skip step 1 and do not spend more than a day on any single step.

**Day 1** — Create the monorepo. `pnpm dlx create-turbo`. Add `apps/web` (Next.js 15) and `apps/api` (NestJS + Fastify). Get both to "hello world."

**Day 2** — Deploy both to production URLs. Vercel for web, Render for API. Wire up GitHub Actions with lint + typecheck. **Do this before writing any features** — a deployment pipeline you build later is a deployment pipeline you build under pressure.

**Day 3** — Neon Postgres + Prisma. Write the schema from §7.2 (all of it — schema-first thinking is cheap now and expensive later). Run the first migration. Add `docker-compose.yml` for local Postgres + MinIO + Mailpit.

**Day 4** — Design tokens from §25.2 into `tailwind.config.ts`. Build five primitives: Button, Input, Select, Card, Badge/Plate. Add Sentry to both apps and trigger a test error in each.

**Day 5** — Auth: users, sessions, cookies, register/login/logout. The auth guard, the tenant guard, the `RequestContext`. Write the first two integration tests: "login works" and "Dealer A cannot read Dealer B's resource."

**Day 6** — Set up `packages/contracts`, write the first Zod schemas (`CreateVehicleInput`, `VehicleSummary`), and wire the validation pipe on the API and `zodResolver` on the web. Add the module-boundary ESLint rule.

**Day 7** — Start the catalog seed. Source make/model/variant data. This is dull, unglamorous work that everything else depends on — do it early, while you still have energy for it.

Then Sprint 1 begins.

---

## Final word

The architecture above is deliberately unimpressive in its component list: one database, one API, one web app, one queue, no cluster. That is the point. Everything sophisticated in it is _structural_ rather than _infrastructural_ — the module facades, the ports, the outbox, the ledger, the tenant guards, the search seam. Those cost you days now and save you quarters later. Everything else can be bought, swapped, or added the moment a metric tells you to.

Build the boring version well. Let the dealers tell you what to build next.
