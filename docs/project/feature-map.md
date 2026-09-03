# Feature Map

Derived from the repository at `f05acdc`, then re-sliced to reflect three
decisions taken during Phase 1 review (see the decision log below).

**97 features across 14 tiers.** Each is intended to be one reviewable PR.

**Confidence** means: how sure the audit is that this feature's boundary is
correct and that it can be delivered as one self-contained PR.

- **HIGH** — the feature owns its files; the boundary is visible in the tree.
- **MEDIUM** — real, but interleaved with a neighbour or sharing a file that
  several features write to.
- **LOW** — the boundary is a judgement call.

Component vocabulary: **Reused** (exists, unchanged) · **New** (first introduced
by this PR) · **Modified** (an existing shared component this PR changes) ·
**Feature-specific** (`features/`, not reusable as-is) · **Shared**
(`components/`, more than one consumer).

> **On "New".** Every component already exists in the repository. In the
> reconstructed history "New" means _first enters the tree in this PR_.

---

# Decision log — Phase 1 review

## D1 — The seeded database catalogue is removed

**Decision.** Vehicle make/model/variant will come from the RC lookup or manual
entry. The catalogue is not carried into the reconstruction.

**What that means concretely.**

| Removed                                                                                                                                                                                                           | Kept, relocated, or changed                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Make`, `Model`, `Variant` Prisma models                                                                                                                                                                          | `Vehicle` stores `make`, `model`, `variant` as **normalised strings** |
| `Color`, `Rto` reference tables                                                                                                                                                                                   | colour from RC or free text; `rtoCode` already derived from the plate |
| `apps/api/src/modules/catalog/**` (5 files)                                                                                                                                                                       | `GET /v1/cities` → **F026**; `GET /v1/config/public` → **F029**       |
| `GET /v1/catalog/bundle`, `GET /v1/catalog/models/:id/variants`                                                                                                                                                   | —                                                                     |
| `apps/api/prisma/seed/catalog/**` (~5,000 LOC)                                                                                                                                                                    | `prisma/seed/` keeps only dev bootstrap (**F097**)                    |
| `apps/web/src/app/api/catalog/models/[id]/variants/route.ts`                                                                                                                                                      | —                                                                     |
| `CatalogBundle` from contracts                                                                                                                                                                                    | `RcBasicsMatch` yields strings, not `Uuid`s                           |
| `City` — **not removed.** Cities are not vehicle-catalogue data. They drive the header city selector, the dealer directory, search filters and dealer profiles, so they become their own small feature, **F026**. |                                                                       |

**What survives, and why it must.** `apps/api/src/platform/rc/rc-aliases.ts`
stays. Its own header explains the reason a table is unavoidable: an RC records
the _manufacturing entity_, not the brand — a Chevrolet Beat's RC says
`GENERAL MOTORS INDIA PVT LTD`, and Chevrolet appears nowhere in the string.
`rc-aliases.ts` is a **committed constant, not a database table**, which is
precisely why it is compatible with this decision: it is reviewable in a diff
and needs no seed.

`rc-match.ts` survives but changes purpose. Today it is
_"VAHAN strings → catalogue ids"_. It becomes _VAHAN strings → normalised
strings_: strip corporate noise, apply `MAKER_ALIASES`, split model from trim,
emit a canonical `make` / `model` / `variant`. It gets smaller and keeps its
fixture-table tests.

**⚠️ The risk this creates, stated plainly.** `RcSpecs.makerModel` is documented
in the source as _"`SWIFT VXI` — model and trim run together, inconsistently."_
With a catalogue, that string was resolved to a known row. Without one, search
facets group on whatever string was stored, and `Maruti` / `Maruti Suzuki` /
`MARUTI SUZUKI INDIA LTD` become three separate facet buckets. Two things follow:

1. **Normalisation moves to write time** (F060) and is now load-bearing.
   Anything not normalised on the way in is unfixable at query time.
2. **Manual entry needs a guard rail** — at minimum a free-text field that
   suggests values already present in the database, so dealers converge on
   existing spellings rather than inventing new ones (F060).

This is a real product trade-off, not a blocker. It is called out again in the
risk register in `git-strategy.md`.

**Knock-on effects on the plan.**

- `Combobox` loses its stated justification. Its header comment says it exists
  because _"the catalogue has 41 makes and 344 models; a `<select>` of 344
  options is a technically-working control that nobody can use."_ With free-text
  make/model there may be nothing to filter. **Decide at F060**: drop it, or
  keep it for city / colour pick-lists and the suggest-existing-values control.
- `VEHICLE_WIZARD_STEPS.basics.fields` changes from
  `['makeId','modelId','variantId', …]` to `['make','model','variant', …]`.
- **The reconstruction is no longer byte-identical to `f05acdc`.** The
  verification gate in `git-strategy.md` §5 changes from _"the diff must be
  empty"_ to _"the diff must contain only the sanctioned D1 divergence"_.

## D2 — Much finer feature granularity

27 features became **97**. The driver was that several of the original features
were three or four PRs wearing one hat. Dealer onboarding is the clearest case:

```text
BEFORE                              AFTER
F006 Dealer onboarding &            F036 Dealer entity & tenant isolation
     document verification          F037 Onboarding shell & step routing
     (one ~1,200-line PR)           F038 Onboarding — account step
                                    F039 Onboarding — business details step
                                    F040 Dealer document model & types
                                    F041 Onboarding — document upload step
                                    F042 Onboarding — review & submit step
                                    F043 Onboarding completeness tracking
                                    F044 Admin document verification
                                    F045 Dealer approval, rejection & suspension
```

The same split was applied throughout: auth became 7 features, media 4, billing
5, vehicle intake 9, the public marketplace 15.

**Where a feature is still coarse, it says so** and names the seam it could be
cut along. Two features are deliberately _not_ split — F070 and F072 — because
splitting them produces multiple PRs fighting over one file for no reviewer
benefit. Both are flagged in place.

## D3 — CI/CD moves to Tier 3, immediately after the first dealer-facing feature

**Before:** F027, last tier. **After:** F021–F025, immediately after **F018 —
Dealer sign-in with Google OAuth**.

**Why F018 is the right anchor.** A pipeline that builds an empty skeleton
proves nothing — it cannot exercise a migration, a real Postgres, an OAuth
round trip, or a page that renders. F018 is the first commit at which a person
can open a browser, click a button and be signed in: route + API + database +
session + UI. That is the first thing CI can meaningfully assert about, and
every feature after it is protected from the moment it is written.

**Why not earlier.** Putting CI in the init commit means every subsequent PR
inherits a pipeline nobody has watched go green against real work.

**Split within the tier.** CI and CD are separated, because they earn their
place at different moments:

- **F021 Docker images** and **F022 CI pipeline** — needed immediately; these
  are what "CI/CD comes next" means in practice.
- **F023 Security scanning** — cheap, and cheapest to add before there is much
  code to scan.
- **F024 Release & promotion** and **F025 Deployment infrastructure** — still in
  Tier 3, so a deployable path exists early, but they are the last two and can
  slip a tier without blocking anything if the AWS account is not ready.

---

# Feature index

| ID   | Feature                                                 | Layer      | Conf.      |
| ---- | ------------------------------------------------------- | ---------- | ---------- |
|      | **TIER 1 — Platform foundations**                       |            |            |
| F001 | Contracts package foundation                            | Package    | HIGH       |
| F002 | API server bootstrap & mount table                      | API        | HIGH       |
| F003 | Error taxonomy & validation middleware                  | API        | HIGH       |
| F004 | Request context, logging & lifecycle                    | API        | HIGH       |
| F005 | Database connection & migration harness                 | API        | HIGH       |
| F006 | Health & readiness probes                               | Full-stack | HIGH       |
| F007 | Design tokens & base stylesheet                         | Web        | HIGH       |
| F008 | Web app shell & core libs                               | Web        | HIGH       |
| F009 | UI primitives — action & identity                       | Web        | HIGH       |
| F010 | UI primitives — status & feedback                       | Web        | HIGH       |
| F011 | UI primitives — structure                               | Web        | HIGH       |
| F012 | UI primitives — states                                  | Web        | HIGH       |
| F013 | Form primitives                                         | Web        | HIGH       |
|      | **TIER 2 — Identity & the first dealer-facing surface** |            |            |
| F014 | User & session data model                               | API        | HIGH       |
| F015 | Session service & cookies                               | API        | HIGH       |
| F016 | Auth guards & authorization model                       | API        | HIGH       |
| F017 | Auth shell UI                                           | Web        | HIGH       |
| F018 | **Dealer sign-in with Google OAuth**                    | Full-stack | HIGH       |
| F019 | Admin sign-in                                           | Full-stack | HIGH       |
| F020 | Sign-out & session revocation                           | Full-stack | HIGH       |
|      | **TIER 3 — CI/CD**                                      |            |            |
| F021 | Docker images                                           | Infra      | HIGH       |
| F022 | CI pipeline                                             | Infra      | HIGH       |
| F023 | Security scanning & dependency automation               | Infra      | HIGH       |
| F024 | Release & image promotion                               | Infra      | HIGH       |
| F025 | Deployment infrastructure                               | Infra      | HIGH       |
|      | **TIER 4 — Platform services**                          |            |            |
| F026 | City & location reference data                          | Full-stack | HIGH       |
| F027 | Rate limiting                                           | API        | HIGH       |
| F028 | Caching layer                                           | API        | HIGH       |
| F029 | Platform config & feature flags                         | Full-stack | HIGH       |
| F030 | Audit log                                               | API        | HIGH       |
| F031 | Events, outbox & background jobs                        | API        | HIGH       |
|      | **TIER 5 — Storage & media**                            |            |            |
| F032 | Storage port & adapters                                 | API        | HIGH       |
| F033 | Presigned upload & commit                               | Full-stack | HIGH       |
| F034 | Image derivative pipeline                               | API        | HIGH       |
| F035 | Media ordering & primary photo                          | Full-stack | HIGH       |
|      | **TIER 6 — Dealer onboarding**                          |            |            |
| F036 | Dealer entity & tenant isolation                        | API        | HIGH       |
| F037 | Onboarding shell & step routing                         | Web        | HIGH       |
| F038 | Onboarding — account step                               | Full-stack | HIGH       |
| F039 | Onboarding — business details step                      | Full-stack | HIGH       |
| F040 | Dealer document model & types                           | API        | HIGH       |
| F041 | Onboarding — document upload step                       | Full-stack | HIGH       |
| F042 | Onboarding — review & submit step                       | Full-stack | HIGH       |
| F043 | Onboarding completeness tracking                        | Full-stack | MEDIUM     |
| F044 | Admin document verification                             | Full-stack | HIGH       |
| F045 | Dealer approval, rejection & suspension                 | Full-stack | HIGH       |
|      | **TIER 7 — Consoles**                                   |            |            |
| F046 | Dealer profile management                               | Full-stack | HIGH       |
| F047 | Dealer console shell & navigation                       | Web        | HIGH       |
| F048 | Dealer dashboard                                        | Full-stack | HIGH       |
| F049 | Admin console shell & navigation                        | Web        | HIGH       |
|      | **TIER 8 — Billing & credits**                          |            |            |
| F050 | Credit ledger & balance                                 | API        | HIGH       |
| F051 | Credit packs & purchase orders                          | Full-stack | HIGH       |
| F052 | Payment verification                                    | API        | MEDIUM     |
| F053 | Invoices & PDF delivery                                 | Full-stack | HIGH       |
| F054 | Admin credit grants & payments view                     | Full-stack | HIGH       |
|      | **TIER 9 — Vehicle intake**                             |            |            |
| F055 | Vehicle data model                                      | API        | HIGH       |
| F056 | Plate input & normalisation                             | Full-stack | HIGH       |
| F057 | RC lookup port, mock adapter & caching                  | API        | HIGH       |
| F058 | Attestr RC adapter                                      | API        | HIGH       |
| F059 | RC lookup UI & registration step                        | Full-stack | HIGH       |
| F060 | Vehicle basics — RC-prefilled or manual                 | Full-stack | **MEDIUM** |
| F061 | Vehicle details                                         | Full-stack | HIGH       |
| F062 | Vehicle photo upload UI                                 | Web        | HIGH       |
| F063 | Vehicle wizard shell & step routing                     | Full-stack | MEDIUM     |
|      | **TIER 10 — Listing lifecycle**                         |            |            |
| F064 | Listing model & state machine                           | API        | HIGH       |
| F065 | Listing submission & resubmission                       | Full-stack | HIGH       |
| F066 | Dealer inventory list                                   | Full-stack | HIGH       |
| F067 | Mark sold, remove & renew                               | Full-stack | HIGH       |
| F068 | Vehicle history report                                  | Full-stack | HIGH       |
|      | **TIER 11 — Moderation**                                |            |            |
| F069 | Moderation queue                                        | Full-stack | HIGH       |
| F070 | Listing review & decisions                              | Full-stack | MEDIUM     |
| F071 | Listing takedown                                        | Full-stack | HIGH       |
| F072 | Admin platform config editor                            | Full-stack | HIGH       |
|      | **TIER 12 — Public marketplace**                        |            |            |
| F073 | Public shell — header & footer                          | Web        | HIGH       |
| F074 | City selector                                           | Web        | HIGH       |
| F075 | Vehicle card                                            | Web        | HIGH       |
| F076 | Search API & facets                                     | API        | **MEDIUM** |
| F077 | Search results page                                     | Full-stack | HIGH       |
| F078 | Filter panel                                            | Web        | HIGH       |
| F079 | Mobile filter sheet                                     | Web        | HIGH       |
| F080 | Search toolbar & sort                                   | Web        | HIGH       |
| F081 | Homepage & hero search                                  | Full-stack | HIGH       |
| F082 | Vehicle detail page                                     | Full-stack | HIGH       |
| F083 | Vehicle gallery & lightbox                              | Web        | HIGH       |
| F084 | Similar vehicles                                        | Full-stack | HIGH       |
| F085 | Dealer directory                                        | Full-stack | HIGH       |
| F086 | Dealer portfolio                                        | Full-stack | MEDIUM     |
| F087 | Saved cars                                              | Full-stack | HIGH       |
|      | **TIER 13 — Enquiries**                                 |            |            |
| F088 | Enquiry model & submission API                          | Full-stack | HIGH       |
| F089 | Public enquiry form                                     | Web        | HIGH       |
| F090 | Contact reveal                                          | Full-stack | HIGH       |
| F091 | Dealer enquiry inbox                                    | Full-stack | HIGH       |
| F092 | SMS notifications                                       | API        | HIGH       |
|      | **TIER 14 — Surface polish**                            |            |            |
| F093 | Error boundaries & error pages                          | Web        | HIGH       |
| F094 | Loading & not-found states                              | Web        | HIGH       |
| F095 | SEO & metadata                                          | Web        | HIGH       |
| F096 | API documentation — OpenAPI & Postman                   | API        | HIGH       |
| F097 | Seed data & developer bootstrap                         | API        | HIGH       |

---

# TIER 1 — Platform foundations

No user-visible surface. Everything here is a prerequisite for the first
dealer-facing feature and can be built in parallel.

### F001 — Contracts package foundation

The shared Zod vocabulary: the barrel, primitive schemas and enums. One place a request/response shape is defined; browser and server validate against the same schema.

- **Status** implemented · **Confidence** HIGH · **Depends on** —
- **Backend/Frontend** consumed by both, owned by neither
- **Files** `packages/contracts/src/{index,common,enums}.ts`, `tsconfig*.json`, `vitest.config.ts`
- **DB** none — enums mirror Prisma enums by hand
- **External** `zod@4`
- **Tests** `packages/contracts/tests/unit/{common,enums}.test.ts`
- ⚠️ **`tests/unit/index.test.ts` cannot land here.** It walks every export in
  the barrel and asserts package-wide invariants across all six modules — that
  more than 40 object schemas exist, that more than 15 input schemas exist,
  that every one is `.strict()`, that no dealer-facing schema declares
  `dealerId`. Those assertions are meaningless against two modules and would
  have to be watered down to pass. It lands with the feature that adds the
  **last** contracts module (`admin.ts`), where it can assert the whole surface
  — which is what it is for.
- **Components** none
- **Sandbox** none — but this package is the **type source for every sandbox fixture** (`component-sandbox.md` §8)

### F002 — API server bootstrap & mount table

Express 5 app, env parsing, the DI container skeleton, and `routes.ts` — the single mount point that documents the whole authorization model.

- **Status** implemented · **Confidence** HIGH · **Depends on** F001
- **Backend** `src/{index,server,routes,container}.ts`, `src/config/env.ts`, `src/types/express.d.ts`
- **API** mount points only; no routes yet
- **External** `express@5`, `helmet`, `cors`, `cookie-parser`, `dotenv`
- **Tests** `tests/unit/{server,routes,container}.test.ts`, `tests/unit/config/env.test.ts`
- **Components** none · **Sandbox** none
- ⚠️ `routes.ts` and `container.ts` are touched by **every** API feature after this. See the shared-file risk register.

### F003 — Error taxonomy & validation middleware

The error class hierarchy and the four middleware that turn a thrown error into an HTTP response.

- **Status** implemented · **Confidence** HIGH · **Depends on** F002, **F004**
- ⚠️ **Ordering corrected: F004 must land first.** `middleware/error-handler.ts`
  imports `platform/telemetry/logger.ts` and `middleware/request-context.ts`,
  both of which F004 owns, while nothing in F004 imports anything of F003's.
  The dependency runs F003 → F004, not the other way round. The F-numbers are
  kept as they are — renumbering would invalidate every cross-reference in
  these documents — so F004 simply merges before F003.
- **Backend** `src/platform/errors.ts`, `src/middleware/{error-handler,not-found,validate}.ts`
- **Tests** `tests/errors.test.ts`, `tests/unit/platform/errors.test.ts`, `tests/unit/middleware/{error-handler,not-found,validate}.test.ts`
- **Components** none · **Sandbox** none

### F004 — Request context, logging & lifecycle

Per-request context, structured pino logging with redaction, and graceful shutdown draining.

- **Status** implemented · **Confidence** HIGH · **Depends on** F002
- ⚠️ **Lands before F003**, which depends on this feature's logger and request
  context. See the note on F003.
- **Backend** `src/middleware/{request-context,request-logger}.ts`, `src/platform/telemetry/{logger,lifecycle}.ts`
- **External** `pino`, `nanoid`
- **Tests** `tests/unit/middleware/{request-context,request-logger}.test.ts`, `tests/unit/platform/telemetry/*.test.ts`
- **Components** none · **Sandbox** none

### F005 — Database connection & migration harness

Prisma client singleton, the tenant transaction wrapper, and a `schema.prisma` carrying only `datasource` + `generator`.

- **Status** implemented · **Confidence** HIGH · **Depends on** F002
- **Backend** `src/platform/db/{prisma,tenant-tx}.ts`, `prisma/schema.prisma` (datasource + generator only), `prisma.config.ts`
- **DB** the connection itself; **no models yet** — each feature adds its own
- **External** `@prisma/client`, `prisma`, Postgres 16
- **Tests** `tests/unit/platform/db/{prisma,tenant-tx}.test.ts`, `tests/global-setup.ts`
- ⚠️ **`tests/harness.ts` cannot land here.** It builds the whole app —
  `buildContainer`, `createApp`, a memory cache (F028) and a session resolver
  (F015) — so it arrives with the last of those, not with the database. Only
  `global-setup.ts`, which runs migrations, belongs to F005.
- **Components** none · **Sandbox** none
- ⚠️ `schema.prisma` is the **CRITICAL** shared file — ~25 later features append to it.

### F006 — Health & readiness probes

`/health/live` (is the process serving) and `/health/ready` (can it reach its dependencies), plus the web app's own probe. Outside `/v1` on purpose: infrastructure probes it, not clients.

- **Status** implemented · **Confidence** HIGH · **Depends on** F003, F005
- **Backend** `src/modules/health/health.routes.ts`
- ⚠️ **`health.docs.ts` lands at F096**, which brings `docs/schemas.ts` and
  `docs/spec.ts` that it imports.
- ⚠️ **`app/api/health/route.ts` lands after F008**, which brings `lib/config`.
- ✅ **The cache probe in `/health/ready` was restored at F028**, along with
  `drivers.cache` and the `is 503 when the cache is down` test.
  `health.routes.ts` is now byte-identical to the baseline.
- ⚠️ (historical) **The cache probe in `/health/ready` landed at F028.** The baseline probes
  `container.cache.ping()` and reports `drivers.cache`; the cache is built at
  F028. The gap is forced by the tier order, not chosen — F021 puts a
  HEALTHCHECK in both Dockerfiles at Tier 3, so `/health/ready` must answer
  before the Tier 4 cache exists. F028 must restore the probe, the
  `drivers.cache` field and the `is 503 when the cache is down` test.
- **API** `GET /health/live`, `GET /health/ready`, `GET /api/health`
- **Tests** `tests/unit/modules/health/health.routes.test.ts`, web `tests/unit/app/api/health.test.ts`
- **Components** none · **Sandbox** none
- Needed by **F021** — both Dockerfiles' `HEALTHCHECK` calls it.

### F007 — Design tokens & base stylesheet

`globals.css` `@theme` block (colour ramps, semantic colours, type, spacing, radius, shadow, motion) and `@layer base`. **Not** the component layer — that is F009–F013.

- **Status** implemented · **Confidence** HIGH · **Depends on** —
- **Frontend** `src/styles/globals.css` (`@theme` ~80 lines + `@layer base` ~80 lines), `postcss.config.mjs`
- **External** `tailwindcss@4`, `@tailwindcss/postcss`
- **Tests** none (visual)
- **Components** none · **Sandbox** the token sheet itself — a swatch page is **sandbox step S0** and is how the Tailwind v4 `@theme` pipeline is proven to render identically outside Next

### F008 — Web app shell & core libs

Root layout, fonts, and the four pure helpers every feature uses.

- **Status** implemented · **Confidence** HIGH · **Depends on** F007
- **Frontend** `app/layout.tsx`, `lib/{cn,config,api}.ts`, `next.config.ts`
- ⚠️ **`lib/url.ts` lands with the public search contracts.** It imports
  `SortOption` and `VehicleQuery` from `packages/contracts/src/public.ts`,
  which is not part of F001. It belongs with F076/F077.
- Also picks up `app/api/health/route.ts`, deferred from F006 because it
  imports `lib/config`.
- **External** `next@15`, `react@19`, `clsx`, `tailwind-merge`
- **Tests** `tests/unit/lib/{cn,config,api}.test.ts` ✅ (`url.test.ts` follows `url.ts`)
- **Components** none · **Sandbox** none

### F009 — UI primitives: action & identity

`Button`, `ButtonLink` and `Plate` — plus the `.btn` and `.dd-plate` CSS layers.

- **Status** implemented · **Confidence** HIGH · **Depends on** F007, F008
- **Frontend** `components/ui/button.tsx`, part of `components/ui/primitives.tsx`, `globals.css` `.btn*` + `.dd-plate`
- **Tests** `tests/unit/components/ui/button.test.tsx` ✅ — the only component test in the repo
- **Components — New (Primitive)** `Button` (5 variants × 5 sizes × block), `ButtonLink`, `Plate` (4 sizes)
- **Sandbox** `Button` — every variant × size × `loading` × `disabled` × `block`; `ButtonLink`; `Plate` — `year`/`logo`/`chip`/`marker`
- ⚠️ The reuse rule must be enforced from this PR onward. In the current codebase `<Button>` appears 29 times against **88** raw `className="btn …"` sites — a 75 % bypass rate.

### F010 — UI primitives: status & feedback

`StatusTag`, `Tag`, `Banner` and the `.tag*` CSS layer.

- **Status** implemented · **Confidence** HIGH · **Depends on** F009
- **Frontend** `components/ui/primitives.tsx`, `globals.css` `.tag*`
- **Tests** none
- **Components — New (Primitive)** `StatusTag` (5 tones), `Tag` (3 variants), `Banner` (3 tones × title? × children? × action?)
- **Sandbox** `StatusTag` — one scenario per `StatusTone`, **generated from the contracts enum** so a new tone appears as a missing scenario; `Banner` — all 24 combinations
- ⚠️ `Banner.tone` and `StatusTone` are two different unions. Documented as D-G in `component-map.md`; do not merge here.

### F011 — UI primitives: structure

`Blueprint`, `Corners`, `StatCard`, `ImageSlot`, `Avatar`, `LogoTile`, and the `.blueprint` / `.card` / `.image-slot` CSS.

- **Status** implemented · **Confidence** HIGH · **Depends on** F009
- **Frontend** `components/ui/primitives.tsx`, `globals.css`
- **Tests** none
- **Components — New (Primitive)** `Blueprint`, `Corners`, `StatCard`, `ImageSlot`, `Avatar`, `LogoTile`
- **Sandbox** `Blueprint` — **all four registration marks present** is the one defect DESIGN-SPEC §4.4 names; `Avatar`/`LogoTile` at 20/22/42/44 px with 1–3 letter initials; `StatCard` with a long value

### F012 — UI primitives: states

`EmptyState`, `ErrorState`, `SkeletonLines`, `Stepper` — DESIGN-SPEC §2.16 and §2.20.

- **Status** implemented · **Confidence** HIGH · **Depends on** F011
- **Frontend** `components/ui/primitives.tsx`, `globals.css` `.skeleton`
- **Tests** none
- **Components — New (Primitive)** `EmptyState`, `ErrorState`, `SkeletonLines`, `Stepper`
- **Sandbox** each with/without action; long message against the `max-w-[46ch]` clamp; `Stepper` at every position **and out of range**, which currently fills every bar

### F013 — Form primitives

`Field`, `errorId`, `invalidProps` and the `.field` / `.input` CSS. The accessibility contract every form in the product inherits.

- **Status** implemented · **Confidence** HIGH · **Depends on** F009
- **Frontend** `components/forms/field.tsx`, `globals.css` `.field`, `.input`
- **Tests** none directly
- **Components — New (Shared)** `Field`
- **Sandbox** `Field` — hint? × error? = 4; **plus a new `Input` primitive** (see below)
- 💡 **Create `Input` here.** `.input` is applied by hand at **70** call sites with no React wrapper (finding D-B). This is the PR to fix that, before 70 sites exist.

---

# TIER 2 — Identity & the first dealer-facing surface

### F014 — User & session data model

`User`, `Session`, `OAuthIdentity` and their enums. Schema and repository only.

- **Status** implemented · **Confidence** HIGH · **Depends on** F005
- **Backend** `prisma/schema.prisma` — `User`, `Session`, `OAuthIdentity`; enums `UserStatus`, `SessionScope`, `OAuthProvider`, `AdminRole`
- **Contracts** `packages/contracts/src/auth.ts`
- **Migration** `prisma/migrations/<ts>_identity/`
- ⚠️ **Migrations diverge from the baseline by design.** The baseline has 8
  migrations, the first of which creates all 27 models at once — unusable for a
  feature-by-feature reconstruction. Each feature generates its own instead, so
  the schema is deployable at every commit. The end state of the _database_ is
  identical; the migration history is not, and is better for it.
- ⚠️ **`memberships DealerMember[]` on `User` waits for F036**, which adds the
  `DealerMember` model.
- **Tests** `tests/tenant-isolation.test.ts` — cannot land here; it needs
  dealers, vehicles and listings. It belongs with F036.
- **Components** none · **Sandbox** none

### F015 — Session service & cookies

Session issue/read/revoke, the cookie adapter, the port, and the dev-session escape hatch behind `AUTH_MODE`.

- **Status** implemented · **Confidence** HIGH · **Depends on** F014
- **Backend** `modules/auth/{session.service,session.port,session.cookie,cookie-session.adapter,dev-session.adapter,password}.ts`
- **Frontend** `lib/session.ts`
- **External** `@node-rs/argon2`
- **Tests** `tests/unit/modules/auth/{session.port,dev-session.adapter,password}.test.ts`, web `tests/unit/lib/session.test.ts` ✅
- **Components** none · **Sandbox** none

### F016 — Auth guards & authorization model

`requireSignedIn`, `requireDealer`, `requireAdmin`, `requirePermission` — and the three mount prefixes that make the authorization model readable in one file.

- **Status** implemented · **Confidence** HIGH · **Depends on** F015
- **Backend** `src/middleware/auth.ts`, guard wiring in `routes.ts`
- **API** `/v1/…` public · `/v1/auth/…` mixed · `/v1/dealer/…` · `/v1/admin/…`
- **Tests** `tests/auth.test.ts`, `tests/auth-harness.ts`, `tests/unit/middleware/auth.test.ts`
- **Components** none · **Sandbox** none
- Router order in `routes.ts` **is** the security boundary — the public auth router must be mounted before the guarded one.

### F017 — Auth shell UI

The centred auth layout and heading shared by all three sign-in surfaces.

- **Status** implemented · **Confidence** HIGH · **Depends on** F011, F012
- **Frontend** `app/(auth)/layout.tsx`, `components/auth/auth-shell.tsx`
- **Tests** none
- **Components — New (Shared)** `AuthShell` (`eyebrow?`), `AuthHeading` (`title`, `children?`) · **Reused** `Plate`, `Blueprint`
- **Sandbox** `AuthShell` default + custom eyebrow; `AuthHeading` with and without subtitle

### F018 — Dealer sign-in with Google OAuth ⭐

**The first dealer-facing feature — the anchor for D3.** OAuth start/callback, state transaction, identity linking, dealer session issued. The first commit where a person can open a browser and be signed in.

- **Status** implemented · **Confidence** HIGH · **Depends on** F014, F015, F016, F017
- **Backend** `modules/auth/{google.provider,oauth.port,oauth-transaction,auth.routes,auth.service,auth.facade,auth.docs}.ts`
- **Frontend** `app/(auth)/dealer/login/page.tsx`, `components/auth/google-button.tsx`, `features/auth/actions.ts`
- **API** `GET /v1/auth/providers`, `GET /v1/auth/google/start`, `GET /v1/auth/google/callback`, `GET /v1/auth/me`
- **DB** `OAuthIdentity`, `User`, `Session`
- **External** **Google OAuth 2.0** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- **Tests** `tests/auth.test.ts`, `tests/unit/modules/auth/{google.provider,oauth-transaction,auth.facade}.test.ts`, web `tests/unit/features/auth/actions.test.ts` ✅
- **Components — New (Shared)** `GoogleSignInButton` · **Reused** `AuthShell`, `AuthHeading`, `Button`, `Banner`, `Plate`
- **Sandbox** `GoogleSignInButton` — default / disabled / custom label

### F019 — Admin sign-in

Email + password login for platform staff, on a separate route with a separate session scope.

- **Status** implemented · **Confidence** HIGH · **Depends on** F018
- **Backend** `modules/auth/auth.routes.ts` (admin paths), `password.ts`
- **Frontend** `app/(auth)/admin/login/page.tsx`, `features/auth/admin-login-form.tsx`
- **API** `POST /v1/auth/admin/login`
- **External** `@node-rs/argon2`
- **Tests** `tests/unit/modules/auth/password.test.ts`
- **Components — New (feature-specific)** `AdminLoginForm` · **Reused** `AuthShell`, `Field`, `Banner`, `Button`
- **Sandbox** `AdminLoginForm` — idle / server error / field errors / submitting

### F020 — Sign-out & session revocation

- **Status** implemented · **Confidence** HIGH · **Depends on** F018, F019
- **Backend** `modules/auth/auth.routes.ts` — logout paths
- **Frontend** `features/auth/sign-out.tsx`
- **API** `POST /v1/auth/logout`, `POST /v1/auth/admin/logout`
- **Components — New (feature-specific)** `SignOutButton` (`scope: 'dealer'|'admin'`)
- **Sandbox** `SignOutButton` — both scopes

---

# TIER 3 — CI/CD

**Placed here by decision D3**, immediately after F018. From this point every
feature lands behind a green pipeline.

### F021 — Docker images

Multi-stage, workspace-aware builds for both apps. The build needs nothing running — no API, no database, no network beyond the registry.

- **Status** implemented · **Confidence** HIGH · **Depends on** F006, F018
- **Files** `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`
- **External** Docker, `node:22-alpine`
- **Tests** the `docker` CI job builds both from a clean context
- **Components** none · **Sandbox** none
- The runner stage uses `pnpm install --frozen-lockfile --prod`, so devDependencies never ship — which is why the sandbox can never reach production.
- ✅ **Verified at F021.** Both images build from a clean context with
  `apps/sandbox` present in the workspace and absent from the Dockerfiles'
  partial manifest copies — `--frozen-lockfile` tolerates it. Each image
  contains only its own app and no Storybook. That was the open risk in
  `component-sandbox.md` §11 and `git-strategy.md` §4; it is closed.

### F022 — CI pipeline

`lint · typecheck · test · build` in one job against a real Postgres 16 service, plus the `docker` job. Runs on every PR to `main`. A fork PR must be able to run it in full holding no credential.

- **Status** implemented · **Confidence** HIGH · **Depends on** F021
- **Files** `.github/workflows/ci.yml`
- **External** GitHub Actions, `postgres:16-alpine`
- **Components** none · **Sandbox** none
- ✅ **The sandbox job was added at F022**, as required — the sandbox had
  already landed at S0. It typechecks and builds the stories, and is the only
  place that happens: the sandbox is deliberately outside `turbo run typecheck`
  and `turbo run build`.
- ⚠️ **The `terraform fmt / validate` job is deferred to F025**, which brings
  the `deploy/terraform` directory it works in. A job pointing at a missing
  directory fails on every PR.
- ⚠️ CI _running_ is not CI _blocking_. Branch protection with required status checks is a repository setting and must be enabled separately — see `git-strategy.md` §1.

### F023 — Security scanning & dependency automation

Secret scanning, SAST and automated dependency PRs.

- **Status** implemented · **Confidence** HIGH · **Depends on** F022
- **Files** `.github/workflows/security.yml`, `.github/dependabot.yml`, `.gitleaks.toml`, `.semgrepignore`
- **Components** none · **Sandbox** none
- There are currently **11 open Dependabot branches**. Triage them before reconstruction starts (`git-strategy.md` §1).

### F024 — Release & image promotion

Build-once-promote-many: an image is built on `main`, tagged with `GIT_SHA`, and promoted between environments without rebuilding. Nothing environment-specific is baked in.

- **Status** implemented · **Confidence** HIGH · **Depends on** F021, F022
- **Files** `.github/workflows/{release,promote,_deploy}.yml`, `deploy/release.sh`
- **Components** none · **Sandbox** none

### F025 — Deployment infrastructure

Terraform for AWS ECS Fargate behind an ALB (two services), plus the nginx and systemd alternative path.

- **Status** implemented · **Confidence** HIGH · **Depends on** F024
- **Files** `deploy/terraform/**`, `deploy/aws/**`, `deploy/nginx/dealers-drive.conf`, `deploy/systemd/*.service`, `deploy/bootstrap.sh`, `deploy/README.md`
- ⚠️ **`docs/DEPLOYMENT.md` does not come back.** Only `docs/project`,
  `docs/screens` and `docs/Dealers-Drive-UI` survive in this repository; the
  deployment narrative lives in `deploy/README.md`, which does come across.
  The original stays readable at the baseline.
- ✅ **Restores the `terraform fmt / validate` CI job** deferred at F022.
  `ci.yml` is now the baseline plus only the added `sandbox` job.
- ⚠️ **The baseline's Terraform is not `terraform fmt` clean.** `outputs.tf` and
  `envs/production.tfvars` fail `fmt -check` on the files as committed, so the
  baseline's own CI job would have failed the same way. Two whitespace-only
  hunks were applied at F025 to make the gate pass. `terraform validate`
  passes on the baseline files unchanged.
- **Tests** the `terraform` CI job (fmt + validate)
- **Components** none · **Sandbox** none
- The **last** item that can slip a tier without blocking anything, if the AWS account is not ready.

---

# TIER 4 — Platform services

### F026 — City & location reference data

**Survives decision D1.** Cities are not vehicle-catalogue data — they drive the header city selector, the dealer directory, search filters and dealer profiles.

- **Status** implemented (currently inside the catalog module) · **Confidence** HIGH · **Depends on** F005
- **Backend** a small `modules/locations/` extracted from `modules/catalog/`
- **API** `GET /v1/cities`
- **DB** `City` — and `Rto`, **only if** RTO names are still wanted for display; `rtoCode` itself is derived from the plate and needs no table
- **Tests** adapted from `tests/unit/modules/catalog/*`
- **Components — Reused** `Combobox` _or_ a plain `<select>` — a city list is short enough that the combobox may be unnecessary once the 344-model list is gone (D1)
- **Sandbox** city picker — short list / long list / none selected

### F027 — Rate limiting

⚠️ **Pulled forward with F028, ahead of Tier 2** — `auth.routes.ts` (F018)
takes a `RateLimiter`. `tests/rate-limit.test.ts` is an integration test that
drives `harness.ts` against vehicle routes; it lands with those, not here.
Only `tests/unit/middleware/rate-limit.test.ts` belongs to F027.

IP-limited public reads, and per-principal limits on the metered paths. Phone reveals cost an SMS each, so the limiter is a cost control, not just abuse defence.

- **Status** implemented · **Confidence** HIGH · **Depends on** F003, F028
- **Backend** `src/middleware/rate-limit.ts`, `lib/client-ip.ts` (web)
- **Tests** `tests/rate-limit.test.ts`, `tests/unit/middleware/rate-limit.test.ts`, web `tests/unit/lib/client-ip.test.ts` ✅
- **Components** none · **Sandbox** rate-limited **states** appear in `EnquiryForm` (F089) and `RevealContactButton` (F090)

### F028 — Caching layer

⚠️ **Pulled forward, ahead of Tier 2.** `modules/auth/auth.routes.ts` (F018)
takes a `RateLimiter`, which is built on `CachePort`. The Tier 2 auth stack
cannot compile — let alone be covered by `tests/auth.test.ts` — until this
feature and F027 exist. Discovered while implementing F015: F015 and F016
together reach only 86.84 % line coverage because the code that covers them is
the integration suite, which needs F018, which needs this. See the note on
F015.

A cache port with in-memory and Postgres adapters, plus counters and version keys.

- **Status** implemented · **Confidence** HIGH · **Depends on** F005
- **Backend** `src/platform/cache/{cache.port,factory,memory.adapter,postgres.adapter}.ts`
- **DB** `CacheCounter`, `CacheVersion`
- **Tests** `tests/cache.test.ts`, `tests/unit/platform/cache/*.test.ts` (4 files)
- **Components** none · **Sandbox** none

### F029 — Platform config & feature flags

Runtime-editable settings and `feature.*` flags, version-polled so a flip propagates without a redeploy. Every flag must be safe in both positions at all times.

- **Status** implemented · **Confidence** HIGH · **Depends on** F028
- **Backend** `src/platform/config/platform-config.ts`
- **Frontend** `lib/config.ts`
- **API** `GET /v1/config/public` _(relocated here from the deleted catalog module — D1)_
- **DB** `PlatformConfig`, `CacheVersion`
- **Tests** `tests/unit/platform/config/platform-config.test.ts`, web `tests/unit/lib/config.test.ts` ✅
- **Components** none · **Sandbox** none — the admin editor UI is **F072**

### F030 — Audit log

⚠️ **Pulled forward with F027 and F028, ahead of Tier 2** — `auth.service.ts`
(F018) takes an `AuditService`, and every sign-in and sign-out is recorded.

Append-only record of every privileged action. Required by F044, F045, F070, F071, F072.

- **Status** implemented · **Confidence** HIGH · **Depends on** F005
- **Backend** `src/platform/audit/audit.service.ts`
- **DB** `AuditLog`
- **Tests** `tests/unit/platform/audit/audit.service.test.ts`
- **Components** none · **Sandbox** none

### F031 — Events, outbox & background jobs

⚠️ **Pulled forward, ahead of Tier 2** — `dealers.service.ts` (F036/F040)
calls `enqueueOutbox`, and F018's `auth.service.ts` needs `DealersService`.
This is the first of the four features the F015 blocker note names.

Transactional outbox, an event bus, and the pg-boss queue.

- **Status** implemented · **Confidence** HIGH · **Depends on** F005
- **Backend** `src/platform/events/{bus,outbox-publisher}.ts`, `src/platform/jobs/queue.ts`
- **DB** `OutboxEvent`
- **External** `pg-boss`
- **Tests** `tests/unit/platform/events/*.test.ts`, `tests/unit/platform/jobs/queue.test.ts`
- **Components** none · **Sandbox** none
- ⚠️ **`jobs/handlers.ts` does not land here, and the entry was wrong to say it
  did.** Its `HandlerDeps` names `SearchRepository`, `MediaService`,
  `MailerPort`, `SmsPort` and `VehiclesRepository` by direct import: the file
  cannot compile until F033, F076, F092 and F055 exist, and every one of its
  subscribers belongs to a feature further down the list. It arrives with the
  last of them, carrying `registerSchedules` and
  `tests/unit/platform/jobs/handlers.test.ts` with it. `queue.ts`,
  `bus.ts` and `outbox-publisher.ts` have no such dependency and are complete
  here.
- The pg-boss branch of `createQueue()` is exercised by nothing in the unit
  suite — `JOBS_ENABLED=false` under test, by design, so the queue a test sees
  is always `createInlineQueue()`. That is the baseline's arrangement, not a
  gap this feature introduced.

---

# TIER 5 — Storage & media

### F032 — Storage port & adapters

One narrow port; a local filesystem adapter for development and an S3/R2 adapter for everything else.

- **Status** implemented · **Confidence** HIGH · **Depends on** F002
- **Backend** `src/platform/storage/{storage.port,factory,local.adapter,s3.adapter}.ts`, `scripts/verify-s3.ts`
- **External** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, MinIO locally
- **Tests** `tests/unit/platform/storage/*.test.ts` (3 files)
- **Components** none · **Sandbox** none

### F033 — Presigned upload & commit

Presign → client uploads directly → commit. Bytes never pass through the API.

- **Status** implemented · **Confidence** HIGH · **Depends on** F032
- **Backend** `modules/media/{media.routes,media.service,media.facade,media.docs}.ts`, `src/platform/media/urls.ts`
- **Frontend** `app/api/dealer/media/presign/route.ts`, `app/api/dealer/media/[id]/route.ts`
- **API** `POST /v1/dealer/media/presign`, `POST /v1/dealer/media/:id/commit`, `GET|DELETE /v1/dealer/media/:id`, `PUT /uploads`
- **DB** `Media`; enums `MediaOwner`, `MediaStatus`
- **Tests** `tests/unit/modules/media/*.test.ts` (3), `tests/unit/platform/media/urls.test.ts`
- **Components** none yet — the uploader UIs are **F041** and **F062**
- **Sandbox** none directly; provides the MSW handlers those two features' scenarios need

### F034 — Image derivative pipeline

`sharp` derivatives at 320/640/1024/1600, blurhash placeholders, and the `srcset` the front end consumes. The pipeline produces optimal bytes, which is why the app uses a plain `<img>` rather than `next/image`.

- **Status** implemented · **Confidence** HIGH · **Depends on** F033
- **Backend** `modules/media/media.service.ts` (derivatives), `src/platform/media/urls.ts`
- **External** `sharp`, `blurhash`
- **Tests** `tests/unit/modules/media/media.service.test.ts`
- **Components** none · **Sandbox** the fixture images under `apps/sandbox/public/mock/` come from this pipeline's output shape

### F035 — Media ordering & primary photo

Reordering, and the rule that position 0 is the primary photo — marked with a `Plate size="marker"`.

- **Status** implemented · **Confidence** HIGH · **Depends on** F034
- **Backend** `modules/media/media.routes.ts` — order path
- **API** `PUT /v1/dealer/vehicles/:id/media/order`
- **DB** `VehicleMedia`
- **Components — Reused** `Plate` (`size="marker"` — one of the four sanctioned plate placements)
- **Sandbox** `Plate` marker variant in context

---

# TIER 6 — Dealer onboarding

The original single feature, split ten ways (decision D2). F038 → F042 are the
four wizard steps plus the shell, each independently reviewable.

### F036 — Dealer entity & tenant isolation

The `Dealer` aggregate, membership, and the tenancy rule that every dealer-scoped query is bound to `dealerId`.

- **Status** implemented · **Confidence** HIGH · **Depends on** F014, F016
- **Backend** `modules/dealers/{dealers.repository,dealers.facade}.ts`, `src/platform/db/tenant-tx.ts`
- **DB** `Dealer`, `DealerMember`; enums `DealerStatus`, `DealerRole`, `MemberStatus`
- **Contracts** `packages/contracts/src/dealer.ts` (dealer identity portion)
- **Tests** `tests/tenant-isolation.test.ts`, `tests/unit/modules/dealers/dealers.repository.test.ts`
- **Components** none · **Sandbox** none

### F037 — Onboarding shell & step routing

The wizard frame: which step is current, how a step is reached, and the progress indicator. No step content.

- **Status** implemented · **Confidence** HIGH · **Depends on** F017, F012, F036
- **Frontend** `app/(auth)/dealer/onboarding/page.tsx`, the shell portion of `features/auth/onboarding-wizard.tsx`
- **Contracts** `ONBOARDING_STEPS = ['Account','Business','Documents','Review']`
- **Components — New (feature-specific)** `OnboardingWizard` shell · **Reused** `AuthShell`, `Stepper`
- **Sandbox** `OnboardingWizard` shell at each of the 4 steps; `Stepper` at each position

### F038 — Onboarding — account step

Step 1: the signed-in person's name and contact, confirming who is registering.

- **Status** implemented · **Confidence** HIGH · **Depends on** F037
- **Backend** `POST /v1/auth/onboarding` (account fields)
- **Frontend** account step of `features/auth/onboarding-wizard.tsx`, `features/auth/actions.ts`
- **DB** `User`, `DealerMember`
- **Components — Reused** `Field`, `Input`, `Button`, `Banner`
- **Sandbox** step 1 — empty / prefilled from the Google profile / field errors / submitting

### F039 — Onboarding — business details step

Step 2: trading name, city, address, GSTIN, years in business.

- **Status** implemented · **Confidence** HIGH · **Depends on** F038, F026
- **Backend** `POST /v1/auth/onboarding` (business fields), `modules/dealers/dealers.service.ts`
- **Frontend** business step of `features/auth/onboarding-wizard.tsx`
- **DB** `Dealer`
- **Components — Reused** `Field`, `Input`, city picker (F026), `Button`, `Banner`
- **Sandbox** step 2 — empty / populated / per-field validation errors

### F040 — Dealer document model & types

The document aggregate and the closed set of KYC document types, with their status machine. Schema and service only — no UI.

- **Status** implemented · **Confidence** HIGH · **Depends on** F036
- **Backend** `modules/dealers/dealers.service.ts` (document paths)
- **API** `GET /v1/dealer/documents`
- **DB** `DealerDocument`; enums `DealerDocType`, `DocStatus`
- **Tests** `tests/unit/modules/dealers/dealers.service.test.ts`
- **Components** none · **Sandbox** none

### F041 — Onboarding — document upload step

Step 3: upload each required KYC document through the presign/commit pipeline. 5 MB cap; PDF, JPEG, PNG only — validated client-side for the message and server-side for real.

- **Status** implemented · **Confidence** HIGH · **Depends on** F033, F040
- **Backend** `POST|DELETE /v1/dealer/documents/*`
- **Frontend** `features/auth/document-uploader.tsx`, `app/api/dealer/documents/presign/route.ts`, `app/api/dealer/documents/[type]/commit/route.ts`
- **External** S3/R2 presigned PUT
- **Components — New (feature-specific)** `DocumentUploader` · **Reused** `StatusTag`, `Banner`, `Button`
- **Sandbox** `DocumentUploader` — empty / uploading / uploaded / verified / rejected / oversize / wrong MIME. **P0** — 7 states, currently no test and no way to see them without a real S3.

### F042 — Onboarding — review & submit step

Step 4: read-only summary of everything entered, then submit for verification. Moves the dealer to `PENDING_REVIEW`.

- **Status** implemented · **Confidence** HIGH · **Depends on** F039, F041, F043
- **Backend** `POST /v1/dealer/submit`
- **Frontend** review step of `features/auth/onboarding-wizard.tsx`
- **DB** `Dealer.status`
- **Components — Reused** `Blueprint`, `StatusTag`, `Button`, `Banner`
- **Sandbox** step 4 — complete / blocked by missing items / submitting / submitted

### F043 — Onboarding completeness tracking

The single derived answer to "what is still missing", used by the wizard to gate `Continue` and by the API to refuse a premature submit.

- **Status** implemented · **Confidence** **MEDIUM** · **Depends on** F039, F041
- **Backend** `modules/dealers/dealers.service.ts` — completeness derivation
- **API** `GET /v1/dealer/completeness`
- **Contracts** `CompletenessBlocker`, `CompletenessResponse`
- **Components — Reused** `Banner`, `StatusTag`
- **Sandbox** blocker list — none / one / many
- ⚠️ **MEDIUM** because completeness is derived from fields owned by F039 and F041, so it cannot be written before both — but the wizard cannot gate correctly without it. Land it with F042 if the split proves awkward.

### F044 — Admin document verification

The platform side of F041: an admin verifies or rejects each document, with a reason, and every decision is audited.

- **Status** implemented · **Confidence** HIGH · **Depends on** F040, F030, F049
- **Backend** `modules/admin/{admin.routes,admin.service}.ts` — document paths
- **API** `POST /v1/admin/documents/:id/verify`, `POST /v1/admin/documents/:id/reject`
- **DB** `DealerDocument.status`, `AuditLog`
- **Tests** `tests/unit/modules/admin/admin.service.test.ts`
- **Components — Reused** `StatusTag`, `Button`, `Banner`, `Field`
- **Sandbox** document review row — pending / verified / rejected-with-reason

### F045 — Dealer approval, rejection & suspension

The dealer status machine on the admin side: approve, reject, suspend, reinstate — each audited, each with a reason where it affects the dealer.

- **Status** implemented · **Confidence** HIGH · **Depends on** F044
- **Backend** `modules/admin/{admin.routes,admin.service}.ts` — dealer paths
- **Frontend** `app/(admin)/admin/dealers/page.tsx`, `app/(admin)/admin/dealers/[id]/page.tsx`, `features/admin/dealer-actions.tsx`
- **API** `GET /v1/admin/dealers`, `GET /v1/admin/dealers/:id`, `POST .../approve`, `.../reject`, `.../suspend`, `.../reinstate`
- **DB** `Dealer.status`, `AuditLog`
- **Components — New (feature-specific)** `DealerAdminActions` · **Reused** `StatusTag`, `Button`, `Banner`, `Field`, raw `.table`
- **Sandbox** `DealerAdminActions` — one scenario per `DealerStatus` × suspend form × pending × error. **P0.**
- 💡 **Create `Table` here.** `.table` is hand-rolled in 5 pages (finding D-B); this is the first of them in the reconstruction.

---

# TIER 7 — Consoles

### F046 — Dealer profile management

The editable business identity after onboarding: trading name, tagline, city, services, contact, cover photo.

- **Status** implemented · **Confidence** HIGH · **Depends on** F036, F039, F045
- **Backend** `modules/dealers/{dealers.routes,dealers.service}.ts`
- **Frontend** `app/(dealer)/dealer/profile/page.tsx`, `features/dealer/{profile-form,profile-actions}.tsx`
- **API** `GET /v1/dealer/`, `PATCH /v1/dealer/`
- **DB** `Dealer`
- **Tests** `tests/unit/modules/dealers/{dealers.routes,dealers.service,dealers.facade}.test.ts`
- **Components — New (feature-specific)** `DealerProfileForm` · **Reused** `Field`, `Input`, `Card`, `Banner`, `Button`
- **Sandbox** `DealerProfileForm` — empty / populated / field errors / saved / server error. Uses `useActionState`, so the scenario needs a stubbed action.

### F047 — Dealer console shell & navigation

The authenticated dealer chrome: sidebar on desktop, bottom tab bar below 768.

- **Status** implemented · **Confidence** HIGH · **Depends on** F020, F045
- **Frontend** `app/(dealer)/dealer/layout.tsx`, `components/dealer/console-nav.tsx`
- **Components — New (Shared)** `ConsoleNav`, `ConsoleTabBar`, `DEALER_NAV` · **Reused** `Plate`, `SignOutButton`
- **Sandbox** each with every route active, driven by a **pathname control**; `ConsoleTabBar` at the 375 and 768 viewports — it is `md:hidden` and cannot be seen otherwise

### F048 — Dealer dashboard

The console landing page: stat cards, recent activity, and the next action.

- **Status** implemented · **Confidence** HIGH · **Depends on** F047
- **Backend** `modules/dealers/dealers.routes.ts` — dashboard path
- **Frontend** `app/(dealer)/dealer/page.tsx`
- **API** `GET /v1/dealer/dashboard`
- **DB** reads `Listing`, `Enquiry`, `ListingViewDaily`, `Dealer`
- **Components — Reused** `StatCard`, `EmptyState`, `Banner`, `Button`
- **Sandbox** `StatCard` — every delta tone, no delta, long value
- ⚠️ `StatCard` currently has **one** consumer; the billing page renders the same block from raw markup. Reuse it in F051 rather than repeating that.

### F049 — Admin console shell & navigation

The dark admin chrome and its sidebar.

- **Status** implemented · **Confidence** HIGH · **Depends on** F019, F020
- **Frontend** `app/(admin)/admin/layout.tsx`, `components/admin/admin-nav.tsx`
- **Components — New (Shared)** `AdminNav` · **Reused** `Plate`, `SignOutButton`
- **Sandbox** `AdminNav` — every route active, via the pathname control

---

# TIER 8 — Billing & credits

### F050 — Credit ledger & balance

The append-only credit ledger and the derived balance. Credits gate RC lookups, reports and listing submissions, so this must exist before any of them.

- **Status** implemented · **Confidence** HIGH · **Depends on** F036
- **Backend** `modules/billing/credits.service.ts`
- **API** `GET /v1/dealer/billing/summary`, `GET /v1/dealer/billing/ledger`
- **DB** `CreditTransaction`; enum `CreditReason`
- **Tests** `tests/credits.test.ts`, `tests/unit/modules/billing/credits.service.test.ts`
- **Components — Reused** `StatCard`, `Table`
- **Sandbox** balance card — zero / low / healthy; ledger table — empty / one page / many

### F051 — Credit packs & purchase orders

The pack catalogue and order creation.

- **Status** implemented · **Confidence** HIGH · **Depends on** F050
- **Backend** `modules/billing/{billing.routes,billing.service,billing.facade,billing.docs}.ts`
- **Frontend** `app/(dealer)/dealer/billing/page.tsx`, `features/billing/{credit-packs,actions}.tsx`
- **API** `GET /v1/dealer/billing/packs`, `POST /v1/dealer/billing/orders`
- **DB** `CreditPack`, `Order`; enum `OrderStatus`
- **Tests** `tests/unit/modules/billing/{billing.routes,billing.service,billing.facade}.test.ts`
- **Components — New (feature-specific)** `CreditPacks` · **Reused** `Blueprint`, `StatCard`, `Button`, `Banner`
- **Sandbox** `CreditPacks` — pack list / buying / success with invoice / failure

### F052 — Payment verification

Order verification and the payment provider port. The current provider is `development.provider.ts` — no real gateway is wired.

- **Status** **partially implemented** · **Confidence** MEDIUM · **Depends on** F051
- **Backend** `src/platform/payments/{payment.port,development.provider}.ts`, `modules/billing/billing.routes.ts` — verify path
- **API** `POST /v1/dealer/billing/orders/:id/verify`
- **DB** `Payment`, `WebhookEvent`; enum `PaymentStatus`
- **Tests** `tests/unit/platform/payments/development.provider.test.ts`
- **Components** none · **Sandbox** none
- ⚠️ The only genuinely incomplete feature in the repository. A real gateway adapter is future work; the port is shaped for it.

### F053 — Invoices & PDF delivery

- **Status** implemented · **Confidence** HIGH · **Depends on** F052
- **Backend** `modules/billing/billing.routes.ts` — invoice paths
- **Frontend** `app/api/dealer/invoices/[id]/route.ts`
- **API** `GET /v1/dealer/billing/invoices`, `GET /v1/dealer/billing/invoices/:id/pdf`
- **DB** `Invoice`; enum `InvoiceStatus`
- **Components — Reused** `Table`, `StatusTag`, `Button`

### F054 — Admin credit grants & payments view

- **Status** implemented · **Confidence** HIGH · **Depends on** F050, F049, F030
- **Backend** `modules/admin/admin.routes.ts` — credits + payments paths
- **Frontend** `app/(admin)/admin/payments/page.tsx`, grant form in `features/admin/dealer-actions.tsx`
- **API** `POST /v1/admin/dealers/:id/credits/grant`, `GET /v1/admin/payments`
- **DB** `CreditTransaction`, `Payment`, `AuditLog`
- **Components — Modified** `DealerAdminActions` (+ grant form) · **Reused** `Table`, `Field`, `Button`
- **Sandbox** grant form — default / custom amount / reason / pending / error

---

# TIER 9 — Vehicle intake

**Reshaped by decision D1.** There is no catalogue lookup; make/model/variant
arrive from the RC or are typed.

### F055 — Vehicle data model

The `Vehicle` aggregate. **Post-D1:** `make`, `model`, `variant` are normalised **strings**, not foreign keys.

- **Status** implemented, **schema changes under D1** · **Confidence** HIGH · **Depends on** F036
- **Backend** `modules/vehicles/{vehicles.repository,vehicles.facade}.ts`
- **DB** `Vehicle`; enums `FuelType`, `Transmission`, `BodyType`, `InsuranceType`, `PriceNegotiability`, `VehicleStatus`
- **Removed under D1** `makeId`, `modelId`, `variantId`, `colorId` FKs → `make`, `model`, `variant`, `color` strings
- **Tests** `tests/unit/modules/vehicles/vehicles.repository.test.ts`
- **Components** none · **Sandbox** none

### F056 — Plate input & normalisation

The number-plate field and the shared normaliser. `TN 09 BX 1234`, `TN-09-BX-1234` and `tn09bx1234` are all accepted; the value is normalised on the way out. The same `REGISTRATION_NUMBER` schema validates in the browser and in the API.

- **Status** implemented · **Confidence** HIGH · **Depends on** F013, F001
- **Frontend** `components/forms/plate-input.tsx` — `PlateInput`, `validatePlate`, `normalisePlate`
- **Contracts** `REGISTRATION_NUMBER`
- **Tests** `tests/unit/features/vehicle/plate-input.test.ts` ✅
- **Components — New (Shared)** `PlateInput`
- **Sandbox** empty / valid / invalid / disabled / autofocus / all three separator styles
- ✅ **The model component.** Pure props, no context, validation exported and tested separately, schema shared with the API. Use it as the sandbox's worked example.

### F057 — RC lookup port, mock adapter & caching

The port, the mock adapter, plate hashing, and the two-tier cache. The port is also **the privacy boundary**: owner name, address, phone, chassis and engine numbers are dropped by adapters _before_ the domain object is constructed, so personal data never enters the system.

- **Status** implemented · **Confidence** HIGH · **Depends on** F028, F050
- **Backend** `src/platform/rc/{rc.port,factory,mock.adapter,plate-hash}.ts`
- **DB** `RcLookup`
- **Tests** `tests/unit/platform/rc/mock.adapter.test.ts`
- **Components** none · **Sandbox** the mock adapter is what lets sandbox scenarios show RC states with no provider
- `RcSpecs` (immutable, 30-day cache) and `RcRecords` (mutable claims, 24-hour cache) are separate types so the cache physically cannot hold a challan for a month.

### F058 — Attestr RC adapter

The real provider, plus `rc-aliases.ts` and `rc-match.ts`.

- **Status** implemented, **rc-match changes under D1** · **Confidence** HIGH · **Depends on** F057
- **Backend** `src/platform/rc/{attestr.adapter,rc-aliases,rc-match}.ts`
- **External** **Attestr** — `ATTESTR_BASE_URL`, `ATTESTR_AUTH_TOKEN`, `RC_LOOKUP_TIMEOUT_MS`; **billed per call**
- **Tests** `tests/unit/platform/rc/{attestr.adapter,rc-match}.test.ts` — a fixture table of real maker strings
- **Components** none · **Sandbox** none
- **D1 change.** `rc-match.ts` stops resolving to catalogue ids and instead emits normalised strings. `rc-aliases.ts` is **kept unchanged** — it is a committed constant, not a table, and it is the only thing that gets from `GENERAL MOTORS INDIA PVT LTD` to _Chevrolet_.

### F059 — RC lookup UI & registration step

Type a plate, see what came back, and continue — or fall through to manual entry when the lookup fails.

- **Status** implemented · **Confidence** HIGH · **Depends on** F056, F057
- **Frontend** `app/(dealer)/dealer/vehicles/new/page.tsx`, `features/vehicle/{registration-step,rc-summary}.tsx`, `features/vehicle/actions.ts`
- **API** `POST /v1/dealer/vehicles/lookup`
- **Components — New (feature-specific)** `RegistrationStep`, `RcSummary` · **Reused** `PlateInput`, `Plate`, `Button`, `Banner`, `StatusTag`
- **Sandbox** `RegistrationStep` — idle / looking up / found / not found / provider unavailable / rate limited / manual fallback. `RcSummary` — full match / partial / cached / advisories present. **P0.**

### F060 — Vehicle basics — RC-prefilled or manual ⚠️

Make, model, variant, year, fuel, transmission, body type — prefilled from the RC where available, typed where not.

- **Status** implemented, **materially reshaped by D1** · **Confidence** **MEDIUM** · **Depends on** F055, F059
- **Frontend** `features/vehicle/{basics-fields,basics-step}.tsx`
- **Contracts** `VEHICLE_WIZARD_STEPS.basics.fields` changes from `['makeId','modelId','variantId', …]` to `['make','model','variant', …]`
- **Tests** `tests/unit/features/vehicle/basics-fields.test.ts` ✅ (validation)
- **Components — New (feature-specific)** `BasicsFields`, `BasicsStep` · **Reused** `Field`, `Input`, `Button`, `Banner`
- **Sandbox** empty / prefilled from RC / partially prefilled / all-errors / disabled
- ⚠️ **This is where D1's risk lands.** Without a catalogue, make/model are free text, and `RcSpecs.makerModel` is documented as _"model and trim run together, inconsistently."_ Two things must be decided in this PR:
  1. **Write-time normalisation** — `rc-match`'s normaliser must run on manual input too, or facets (F076) fragment into `Maruti` / `Maruti Suzuki` / `MARUTI SUZUKI INDIA LTD`.
  2. **Whether `Combobox` survives.** Its stated reason to exist was the 344-model list. The strongest remaining case for it is a _suggest-existing-values_ control that offers make/model strings already in the database, which is also the cheapest guard against fragmentation. Recommended.

### F061 — Vehicle details

KMs, owners, colour, RTO, insurance, location, seats, airbags, features. Eight required fields, several RC-prefilled.

- **Status** implemented, **minor D1 change** · **Confidence** HIGH · **Depends on** F060, F026
- **Frontend** `features/vehicle/details-fields.tsx` — `DetailsFields`, `detailsFrom`, `validateDetails`, `detailsPatch`
- **D1 change** `colorId: Uuid` → `color: string`; `rtoCode` unaffected (already derived from the plate)
- **Tests** `tests/unit/features/vehicle/details-fields.test.ts` ✅
- **Components — New (feature-specific)** `DetailsFields` · **Reused** `Field`, `Input`, city picker
- **Sandbox** empty / RC-prefilled / all-errors / disabled

### F062 — Vehicle photo upload UI

Drag, drop, reorder, delete, and the minimum-photo gate.

- **Status** implemented · **Confidence** HIGH · **Depends on** F033, F034, F035, F029
- **Frontend** `features/vehicle/photo-uploader.tsx` (472 lines)
- **Components — New (feature-specific)** `PhotoUploader` · **Reused** `ImageSlot`, `Plate` (`marker`), `Banner`, `Button`
- **Sandbox** empty / below minimum / at minimum / uploading / upload error / reordering / primary marker / delete confirm. **P0 — the highest-state component in the dealer console and currently untested.** Scenarios synthesise `File` objects from data URIs; no storage needed.

### F063 — Vehicle wizard shell & step routing

The frame that sequences F059 → F060 → F061 → F062 → review, gated by the API's completeness answer so the front end can never be more permissive than the back end.

- **Status** implemented · **Confidence** MEDIUM · **Depends on** F060, F061, F062
- **Backend** `modules/vehicles/{vehicles.routes,vehicles.service,vehicles.docs}.ts` — CRUD
- **Frontend** `app/(dealer)/dealer/vehicles/[id]/edit/page.tsx`, `features/vehicle/{wizard,steps}.tsx`
- **API** `POST|GET /v1/dealer/vehicles`, `GET|PATCH|DELETE /v1/dealer/vehicles/:id`
- **Tests** `tests/unit/modules/vehicles/*.test.ts` (4), `tests/unit/features/vehicle/steps.test.ts` ✅
- **Components — New (feature-specific)** `VehicleWizard` · **Reused** `Stepper`, `Button`, `Banner`, `Field`
- **Sandbox** one scenario per step × complete / blocked
- ⚠️ **MEDIUM** — `vehicles.routes.ts` is also written by F065, F067. F063 introduces it; they amend.

---

# TIER 10 — Listing lifecycle

### F064 — Listing model & state machine

`Listing.status` is never assigned. Every change goes through `transition()`, which validates the source state **and** the actor's authority. `status` appears in no dealer-writable DTO and every input schema is `.strict()`, so a dealer posting `{"status":"APPROVED"}` gets a 400.

- **Status** implemented · **Confidence** HIGH · **Depends on** F055
- **Backend** `modules/listings/{listing.state,listings.facade}.ts`
- **DB** `Listing`; enum `ListingStatus`
- **Tests** `tests/listing-lifecycle.test.ts`, `tests/unit/modules/listings/*.test.ts` ✅
- **Components — Reused** `StatusTag` — the only correct way to render a listing status
- **Sandbox** `StatusTag` — one scenario per `ListingStatus`/`DisplayStatus`, generated from the enum
- The best-guarded code in the repository. Treat its invariants as untouchable during reconstruction.

### F065 — Listing submission & resubmission

- **Status** implemented · **Confidence** HIGH · **Depends on** F064, F063, F050
- **Backend** `modules/vehicles/vehicles.routes.ts` — submit path
- **API** `POST /v1/dealer/vehicles/:id/submit`
- **DB** `Listing.status` → `PENDING_REVIEW`; `CreditTransaction`
- **Components — Reused** `Button`, `Banner`, `StatusTag`
- **Sandbox** submit CTA — ready / blocked / insufficient credits / submitting

### F066 — Dealer inventory list

The dealer's vehicle table with status, price, views and enquiries per row.

- **Status** implemented · **Confidence** HIGH · **Depends on** F064, F047
- **Frontend** `app/(dealer)/dealer/inventory/page.tsx`
- **API** `GET /v1/dealer/vehicles`
- **Components — Reused** `Table`, `StatusTag`, `EmptyState`, `Button`
- **Sandbox** inventory table — empty / one row / many / every status represented

### F067 — Mark sold, remove & renew

The per-row actions and their confirmation dialogs.

- **Status** implemented · **Confidence** HIGH · **Depends on** F066
- **Backend** `modules/vehicles/vehicles.routes.ts` — transition paths
- **Frontend** `features/vehicle/inventory-actions.tsx`
- **API** `POST /v1/dealer/vehicles/:id/mark-sold`, `.../remove-listing`, `POST /v1/dealer/listings/:id/renew`
- **Components — New (feature-specific)** `InventoryActions` · **Reused** `Button`, `Field`, `Banner`, `Dialog`
- **Sandbox** menu closed / open / mark-sold dialog / remove dialog / pending / error / success notice
- 💡 **Create `Dialog` here.** `.dialog` CSS exists with zero consumers and Radix is used ad hoc in F070 — pick one and register it (finding D-C).

### F068 — Vehicle history report

The government-records check: RC status, blacklist, challans, insurance and fitness validity — published under a disclaimer, with `UNKNOWN` never collapsed into `CLEAR`.

- **Status** implemented · **Confidence** HIGH · **Depends on** F058, F050
- **Backend** `modules/reports/{reports.routes,reports.service,reports.repository,reports.facade}.ts`
- **Frontend** `features/report/{report-panel,report-summary}.tsx`
- **API** `GET /v1/dealer/vehicles/:id/report`, `POST /v1/dealer/vehicles/:id/report/refresh`
- **DB** `VehicleReport`; enum `BlacklistStatus`
- **External** Attestr (shared with F058); **billed per refresh**
- **Tests** `tests/unit/modules/reports/*.test.ts` (2)
- **Components — New (feature-specific)** `ReportPanel` (admin, refreshable), `ReportSummary` (public, read-only) · **Reused** `StatusTag`, `Blueprint`, `Banner`, `Button`
- **Sandbox** both — clear / warning / blacklisted / NOC issued / **records unavailable** / stale; `ReportPanel` also refreshing / refresh error
- The `records unavailable` scenario is the important one: a provider outage rendering as a clean bill of health on a stolen car is the worst failure this feature can produce.

---

# TIER 11 — Moderation

### F069 — Moderation queue

The admin's pending-listing queue with a one-click approve. The one place DESIGN-SPEC §4.7 allows a primary button inside a table row, because approving is the queue's whole purpose.

- **Status** implemented · **Confidence** HIGH · **Depends on** F064, F049
- **Backend** `modules/admin/admin.routes.ts` — listing list path
- **Frontend** `app/(admin)/admin/listings/page.tsx`, `features/admin/queue-actions.tsx`
- **API** `GET /v1/admin/listings`
- **Components — New (feature-specific)** `QueueApproveButton` · **Reused** `Table`, `StatusTag`, `Button`, `EmptyState`
- **Sandbox** `QueueApproveButton` — idle / pending / error; queue table — empty / many

### F070 — Listing review & decisions

The full review screen: photos, specs, report, and the approve / reject / request-changes decision with a reason.

- **Status** implemented · **Confidence** MEDIUM · **Depends on** F069, F068, F030
- **Backend** `modules/admin/{admin.routes,admin.service}.ts` — listing decision paths
- **Frontend** `app/(admin)/admin/listings/[id]/page.tsx`, `features/admin/{review-actions,moderation-strip}.tsx`
- **API** `GET /v1/admin/listings/:id`, `POST .../approve`, `.../reject`, `.../request-changes`
- **DB** `Listing.status`, `AuditLog`
- **External** `@radix-ui/react-dialog`
- **Tests** `tests/unit/modules/admin/admin.routes.test.ts`
- **Components — New (feature-specific)** `ReviewActions`, `ModerationStrip` · **Reused** `ReportPanel`, `StatusTag`, `Button`, `Banner`, `Field`
- **Sandbox** `ReviewActions` — per listing status × pending × error × each dialog open; `ModerationStrip` — 0 / 1 / 12 photos
- ⚠️ **Do not split further.** The three decisions share one route file, one service method shape and one dialog component; separate PRs would fight over the same lines for no reviewer benefit.

### F071 — Listing takedown

Post-approval removal, kept separate from rejection because it acts on a live listing and has different audit semantics.

- **Status** implemented · **Confidence** HIGH · **Depends on** F070
- **Backend** `modules/admin/admin.routes.ts` — takedown path
- **API** `POST /v1/admin/listings/:id/takedown`
- **DB** `Listing.status`, `AuditLog`
- **Components — Modified** `ReviewActions` (+ takedown action)
- **Sandbox** `ReviewActions` — approved listing with takedown available

### F072 — Admin platform config editor

The UI over F029: edit a setting or flip a flag, with the value type driving the control.

- **Status** implemented · **Confidence** HIGH · **Depends on** F029, F049, F030
- **Backend** `modules/admin/admin.routes.ts` — config paths
- **Frontend** `app/(admin)/admin/config/page.tsx`, `features/admin/{config-editor,config-actions}.tsx`
- **API** `GET /v1/admin/config`, `PUT /v1/admin/config/:key`, `GET /v1/admin/audit-logs`
- **DB** `PlatformConfig`, `AuditLog`
- **Components — New (feature-specific)** `ConfigRow` · **Reused** `Button`, `Banner`, `Field`, `Input`, `Table`
- **Sandbox** `ConfigRow` — boolean / number / string × clean / dirty / saving / saved / error
- ⚠️ **Do not split** the config editor from the audit-log view; they are one admin screen and one route file.

---

# TIER 12 — Public marketplace

### F073 — Public shell — header & footer

The customer chrome: sticky header with logo plate, main nav and saved-cars badge; and the footer.

- **Status** implemented · **Confidence** HIGH · **Depends on** F009, F011
- **Frontend** `app/(public)/layout.tsx`, `components/layout/{customer-header,customer-footer}.tsx`
- **Components — New (Shared)** `CustomerHeader`, `CustomerFooter`, `HeaderLink` · **Reused** `Plate`, `Button`
- **Sandbox** `CustomerHeader` — each nav item active × saved count 0/1/99 × pre-hydration. Needs the **pathname control** and, once F087 lands, the `SavedCarsProvider` decorator.
- The first shared component that cannot render without a React context provider — the driving example for the sandbox's decorator design.

### F074 — City selector

The header's city chip. The only part of the header that reads the query string, kept behind a tight Suspense boundary so the rest of the header stays statically prerenderable.

- **Status** implemented · **Confidence** HIGH · **Depends on** F073, F026
- **Frontend** `CitySelector` and `CityChipFallback` in `components/layout/customer-header.tsx`
- **API** `GET /v1/cities`
- **Components — New (Shared)** `CitySelector`, `CityChipFallback`
- **Sandbox** closed / open / long city list / no city selected / fallback

### F075 — Vehicle card

DESIGN-SPEC §2.8, and the product's most important component: 4:3 image, year plate, save button, title, tabular price, meta row, then a 1 px divider and the **dealer strip** — on every card, without exception.

- **Status** implemented · **Confidence** HIGH · **Depends on** F011, F034
- **Frontend** `components/vehicle/vehicle-card.tsx` — `VehicleCard`, `VehicleImage`, `VehicleCardSkeleton`
- **Components — New (Shared)** all three · **Reused** `Avatar`, `ImageSlot`, `Plate`, `Tag`
- **Sandbox** **P0, the highest-value entry in the sandbox.** 3 variants × sold × saved × image × verified ≈ 48 states, none currently reachable by any test or tool.
- ⚠️ `variant="list"` delegates to a private `VehicleRow` that re-implements the image block, plate, sold overlay and dealer strip (finding D-E). Two scenarios make that divergence visible; do not refactor during reconstruction.

### F076 — Search API & facets ⚠️

Faceted vehicle search: filtering, sorting, pagination and facet counts.

- **Status** implemented, **query changes under D1** · **Confidence** **MEDIUM** · **Depends on** F064, F026
- **Backend** `modules/search/{search.routes,search.service,search.repository,search.mapper,search.facade,search.docs}.ts`
- **API** `GET /v1/vehicles`, `GET /v1/vehicles/facets`
- **Tests** `tests/unit/modules/search/*.test.ts` (5), `tests/public-visibility.test.ts`
- **Components** none · **Sandbox** none — it supplies the `FacetsResponse` fixtures F078 and F079 need
- ⚠️ **D1 impact.** Make/model facets must now group on **denormalised strings** rather than catalogue foreign keys. Unnormalised values fragment the facet list. Depends on F060 getting write-time normalisation right; if it does not, this feature cannot repair it at query time.

### F077 — Search results page

`/cars` — the grid, the result count, pagination and the applied-filter chips.

- **Status** implemented · **Confidence** HIGH · **Depends on** F075, F076, F073
- **Frontend** `app/(public)/cars/page.tsx`
- **Components — Reused** `VehicleCard`, `VehicleCardSkeleton`, `EmptyState`, `Blueprint`, `Button`
- **Sandbox** results grid — 0 / 1 / 12 results; loading skeleton row

### F078 — Filter panel

DESIGN-SPEC §3.3 — filters that write to the **URL**, not to a store, so every filter state is server-renderable, shareable, indexable and back-button-correct. Count-0 options render **disabled, never hidden**.

- **Status** implemented · **Confidence** HIGH · **Depends on** F076
- **Frontend** `components/search/filter-panel.tsx`
- **Components — New (Shared)** `FilterPanel` · props `facets`, `params`, `basePath`, `dimZeroRows?`, `groups?`, `onNavigate?`
- **Sandbox** nothing selected / one group / multiple groups / zero-count options / price range active / portfolio subset. **P0.**
- ✅ Fully controlled by its `params` prop, so every filter combination is a static scenario. Only `useRouter` needs stubbing.

### F079 — Mobile filter sheet

The bottom sheet below `lg`: backdrop click closes, body scroll locks, and the sticky CTA carries a live result count.

- **Status** implemented · **Confidence** HIGH · **Depends on** F078
- **Frontend** `MobileFilterSheet` in `components/search/search-toolbar.tsx`
- **Components — New (Shared)** `MobileFilterSheet`
- **Sandbox** closed / open at the 375 and 768 viewports. **P0** — the only mobile-specific component in the product, and today there is no way to see it without resizing a real browser against a real API.

### F080 — Search toolbar & sort

Free-text field and sort select, both writing to the URL.

- **Status** implemented · **Confidence** HIGH · **Depends on** F076
- **Frontend** `SearchToolbar` in `components/search/search-toolbar.tsx`, `lib/url.ts`
- **Tests** `tests/unit/lib/url.test.ts` ✅
- **Components — New (Shared)** `SearchToolbar` (`showSearch?`)
- **Sandbox** with and without the search field; each sort option selected

### F081 — Homepage & hero search

DESIGN-SPEC §3.2 — the blueprint search block, body-type tiles and featured rows.

- **Status** implemented · **Confidence** HIGH · **Depends on** F075, F073
- **Backend** `modules/search/search.routes.ts` — home path
- **Frontend** `app/(public)/page.tsx`, `components/search/hero-search.tsx`
- **API** `GET /v1/home`
- **Components — New (Shared)** `HeroSearch` · **Reused** `Blueprint`, `VehicleCard`, `Button`
- **Sandbox** `HeroSearch` — empty / typed / long city name

### F082 — Vehicle detail page

`/car/[slug]` — price block, spec table, dealer strip, report summary and the CTA stack.

- **Status** implemented · **Confidence** HIGH · **Depends on** F075, F068, F087, F089
- **Backend** `modules/search/search.routes.ts` — detail path
- **Frontend** `app/(public)/car/[slug]/page.tsx`, `components/vehicle/vdp-cta.tsx`
- **API** `GET /v1/vehicles/:idOrSlug`
- **DB** reads `Vehicle`, `Listing`, `VehicleMedia`, `Media`, `VehicleReport`, `ListingViewDaily`
- **Components — New (Shared)** `VdpCtaStack` · **Reused** `Blueprint`, `Banner`, `Button`, `ReportSummary`, `EnquiryForm`
- **Sandbox** `VdpCtaStack` — default / saved / sold
- ⚠️ `vdp-cta.tsx` is the **only** file under `components/` importing a server action (finding D-5). Its sandbox scenario needs a module stub; do not "fix" the coupling during reconstruction.

### F083 — Vehicle gallery & lightbox

DESIGN-SPEC §2.9/§2.10 — the 108 px thumbnail strip and the fullscreen lightbox with Escape, arrow paging with wrap, a focus trap, focus returned to the exact opener, and body-scroll lock.

- **Status** implemented · **Confidence** HIGH · **Depends on** F034, F011
- **Frontend** `components/vehicle/gallery.tsx`
- **Components — New (Shared)** `VehicleGallery` · **Reused** `Corners`, `ImageSlot`
- **Sandbox** 0 / 1 / 2 / 12 photos; strip at start, middle and end; lightbox open at index n; wrap at both ends. **P0.**
- ⚠️ `apps/web/vitest.config.ts` documents choosing jsdom over happy-dom **specifically so this component's focus management could be asserted on**. That test was never written (finding D-4). This is the clearest single case for the sandbox paying for itself.

### F084 — Similar vehicles

- **Status** implemented · **Confidence** HIGH · **Depends on** F082, F076
- **Backend** `modules/search/search.routes.ts` — similar path
- **API** `GET /v1/vehicles/:id/similar`
- **Components — Reused** `VehicleCard` (`variant="compact"`)
- **Sandbox** `VehicleCard` compact variant in a row; empty result

### F085 — Dealer directory

`/dealers` — the directory grid with a name search and city chips.

- **Status** implemented · **Confidence** HIGH · **Depends on** F046, F026
- **Backend** `modules/dealers/dealers.public.service.ts`, `modules/search/search.routes.ts`
- **Frontend** `app/(public)/dealers/page.tsx`, `components/dealers/{dealer-card,directory-filters}.tsx`
- **API** `GET /v1/dealers`, `GET /v1/dealers/:slug`
- **Tests** `tests/unit/modules/dealers/dealers.public.service.test.ts`
- **Components — New (Shared)** `DirectoryCard`, `DirectoryFilters` · **Reused** `Blueprint`, `LogoTile`, `Plate`, `Tag`, `ImageSlot`
- **Sandbox** `DirectoryCard` — verified / unverified / no cover / no tagline / 0 / 3 / 5 services / long brand name
- ⚠️ The file is `dealer-card.tsx` but the export is `DirectoryCard`; `DealerCard` is a _contracts type_ (finding D-6). The registry's `aliases` field exists for exactly this.

### F086 — Dealer portfolio

`/dealers/[slug]` — one dealer's inventory, filtered.

- **Status** implemented · **Confidence** MEDIUM · **Depends on** F085, F078, F077
- **Backend** `modules/search/search.routes.ts` — portfolio paths
- **Frontend** `app/(public)/dealers/[slug]/page.tsx`
- **API** `GET /v1/dealers/:slug/vehicles`, `GET /v1/dealers/:slug/facets`
- **Components — Modified** `FilterPanel` (+ `groups`, `dimZeroRows`) · **Reused** `VehicleCard`, `SearchToolbar`, `MobileFilterSheet`, `EnquiryForm`, `VdpCtaStack`
- **Sandbox** `FilterPanel` with `groups` excluding `dealer` and `dimZeroRows` on
- ✅ **The canonical "existing component + props" precedent.** This feature needed a filter panel without a dealer group and added two props instead of creating `PortfolioFilterPanel`. Cite it when applying the reuse rule.

### F087 — Saved cars

Device-scoped saved cars in `localStorage` — ids only, no buyer accounts — rehydrated into cards through a batch endpoint. A car that has left the catalogue comes back as `unavailable` and is pruned rather than 404-ing the page.

- **Status** implemented · **Confidence** HIGH · **Depends on** F075
- **Backend** `modules/search/search.routes.ts` — batch path
- **Frontend** `features/saved/{saved-store,saved-list}.tsx`, `app/(public)/saved/page.tsx`, `app/api/vehicles/batch/route.ts`
- **API** `POST /v1/vehicles/batch`
- **External** browser `localStorage`
- **Components — New (feature-specific)** `SavedCarsProvider`, `useSavedCars`, `SavedCarsList` · **Modified** `VehicleCard` (`variant="list"`, `showSave`)
- **Sandbox** `SavedCarsList` — pre-hydration / empty / loading / loaded / some unavailable / fetch error
- ⚠️ `useSavedCars()` **throws** outside its provider, and five shared components depend on it. The `withSavedCars` decorator is a **hard requirement** of the sandbox (coupling C-1), not a nicety.

---

# TIER 13 — Enquiries

### F088 — Enquiry model & submission API

Buyer anonymity is a product rule (DESIGN-SPEC §4.10): the platform holds the lead, the dealer sees what they need.

- **Status** implemented · **Confidence** HIGH · **Depends on** F036, F027
- **Backend** `modules/enquiries/{enquiries.routes,enquiries.service,enquiries.repository,enquiries.facade,enquiries.docs}.ts`
- **API** `POST /v1/enquiries`
- **DB** `Enquiry`; enums `EnquirySource`, `EnquiryStatus`
- **Tests** `tests/unit/modules/enquiries/*.test.ts` (4)
- **Components** none · **Sandbox** none

### F089 — Public enquiry form

Inline on the VDP and the portfolio — never a modal, because modals lose leads.

- **Status** implemented · **Confidence** HIGH · **Depends on** F088, F013
- **Frontend** `features/enquiry/{enquiry-form,actions,shared}.ts(x)`, `app/(public)/enquiry-sent/page.tsx`
- **Tests** `tests/unit/features/enquiry/{actions,shared}.test.ts` ✅
- **Components — New (feature-specific)** `EnquiryForm` · **Reused** `Field`, `Input`, `Button`, `Banner`
- **Sandbox** vehicle source / dealer source / field errors / submitting / rate limited / sent. **P0.**

### F090 — Contact reveal

The dealer's number is never in the page source. It arrives only after a deliberate click, through a Server Action, and the dealer sees the tap in their inbox. Rate-limited because each reveal costs an SMS.

- **Status** implemented · **Confidence** HIGH · **Depends on** F088, F027, F050
- **Backend** `modules/enquiries/enquiries.routes.ts` — reveal path
- **Frontend** `RevealContactButton` in `components/vehicle/vdp-cta.tsx`
- **API** `POST /v1/vehicles/:id/reveal-contact`
- **DB** `PhoneReveal`
- **Tests** `tests/rate-limit.test.ts`
- **Components — New (Shared)** `RevealContactButton`
- **Sandbox** idle / pending / revealed with call + WhatsApp links / captcha / error. **P1.**

### F091 — Dealer enquiry inbox

The dealer side: status tabs, counts, and per-enquiry status changes.

- **Status** implemented · **Confidence** HIGH · **Depends on** F088, F047
- **Backend** `modules/enquiries/enquiries.routes.ts` — dealer paths
- **Frontend** `features/enquiries/{inbox,actions}.tsx`, `app/(dealer)/dealer/enquiries/page.tsx`, `features/query/query-provider.tsx`, `app/api/dealer/enquiries/route.ts`
- **API** `GET /v1/dealer/enquiries`, `GET /v1/dealer/enquiries/counts`, `PATCH /v1/dealer/enquiries/:id`
- **External** `@tanstack/react-query` — the only feature using it
- **Tests** `tests/unit/features/enquiries/actions.test.ts` ✅
- **Components — New (feature-specific)** `EnquiryInbox`, `QueryProvider` · **Reused** `StatusTag`, `EmptyState`, `Button`, `Segmented`
- **Sandbox** each status tab × empty / loading / loaded / error. Needs the `withQueryClient` decorator (coupling C-2).
- 💡 **Create `Segmented` here.** `.seg`/`.seg-opt` is hand-rolled here and in F045 (finding D-B).

### F092 — SMS notifications

- **Status** implemented · **Confidence** HIGH · **Depends on** F088, F031
- **Backend** `src/platform/notify/{notify.port,msg91.adapter}.ts`
- **External** **MSG91** — `SMS_DRIVER`
- **Tests** `tests/unit/platform/notify/*.test.ts` (2)
- **Components** none · **Sandbox** none

---

# TIER 14 — Surface polish

### F093 — Error boundaries & error pages

Five Next.js error boundaries — root, global, and one per route group.

- **Status** implemented · **Confidence** HIGH · **Depends on** F012
- **Frontend** `app/{error,global-error}.tsx`, `app/({public,dealer,admin})/error.tsx`
- **Components — Reused** `ErrorState`, `Blueprint`, `Button`
- **Sandbox** `ErrorState` — default title / custom title / with and without action

### F094 — Loading & not-found states

- **Status** implemented · **Confidence** HIGH · **Depends on** F012, F082
- **Frontend** `app/(public)/loading.tsx`, `app/(public)/car/[slug]/{loading,not-found}.tsx`
- **Components — Reused** `SkeletonLines`, `VehicleCardSkeleton`, `EmptyState`
- **Sandbox** skeleton layouts for the grid and the VDP

### F095 — SEO & metadata

Sitemap, robots, canonical URLs and per-page metadata.

- **Status** implemented · **Confidence** HIGH · **Depends on** F077, F082, F085
- **Frontend** `app/{sitemap,robots}.ts`, `lib/seo.ts`, `generateMetadata` in the public routes
- **Tests** `tests/unit/lib/seo.test.ts` ✅
- **Components** none · **Sandbox** none

### F096 — API documentation — OpenAPI & Postman

An OpenAPI 3.0 document generated from the same Zod contracts the API validates with, served at `/api/docs`, plus a generated Postman collection. Off in production by default.

- **Status** implemented · **Confidence** HIGH · **Depends on** every API feature
- **Backend** `src/docs/*` (6 files)
- **API** `GET /api/docs`
- **External** `swagger-ui-express`, `yaml`
- **Tests** `tests/{openapi,postman,contracts}.test.ts`, `tests/unit/docs/*` (6)
- **Components** none · **Sandbox** none

### F097 — Seed data & developer bootstrap

A working local dataset: one admin, a few dealers, some vehicles and listings across every status. **Post-D1 this is small** — the ~5,000-line catalogue seed is gone.

- **Status** implemented, **substantially reduced by D1** · **Confidence** HIGH · **Depends on** every model
- **Backend** `prisma/seed/{index,bootstrap,data,images}.ts` — **without** `prisma/seed/catalog/**`
- **Files** `scripts/app-up.sh`, `pnpm app:seed`
- **Components** none · **Sandbox** the seed's vocabulary — Tamil Nadu cities, `₹` formatting, `TN 09 BX 1234` plates — is what sandbox fixtures should imitate

---

# Feature → Component matrix

Only features that touch components appear.

| Feature | Reused                                                                  | New                                                       | Modified                                    |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| F009    | —                                                                       | Button, ButtonLink, Plate                                 | —                                           |
| F010    | —                                                                       | StatusTag, Tag, Banner                                    | —                                           |
| F011    | —                                                                       | Blueprint, Corners, StatCard, ImageSlot, Avatar, LogoTile | —                                           |
| F012    | Blueprint                                                               | EmptyState, ErrorState, SkeletonLines, Stepper            | —                                           |
| F013    | —                                                                       | Field, **Input** ⭐                                       | —                                           |
| F017    | Plate, Blueprint                                                        | AuthShell, AuthHeading                                    | —                                           |
| F018    | AuthShell, AuthHeading, Button, Banner                                  | GoogleSignInButton                                        | —                                           |
| F019    | AuthShell, Field, Input, Banner, Button                                 | AdminLoginForm                                            | —                                           |
| F020    | Button                                                                  | SignOutButton                                             | —                                           |
| F026    | Field                                                                   | city picker                                               | —                                           |
| F035    | —                                                                       | —                                                         | **Plate** (`marker`)                        |
| F037    | AuthShell, Stepper                                                      | OnboardingWizard (shell)                                  | —                                           |
| F038    | Field, Input, Button, Banner                                            | —                                                         | OnboardingWizard                            |
| F039    | Field, Input, Button, Banner                                            | —                                                         | OnboardingWizard                            |
| F041    | StatusTag, Banner, Button                                               | DocumentUploader                                          | OnboardingWizard                            |
| F042    | Blueprint, StatusTag, Button, Banner                                    | —                                                         | OnboardingWizard                            |
| F043    | Banner, StatusTag                                                       | —                                                         | OnboardingWizard                            |
| F044    | StatusTag, Button, Banner, Field                                        | —                                                         | —                                           |
| F045    | StatusTag, Button, Banner, Field                                        | DealerAdminActions, **Table** ⭐                          | —                                           |
| F046    | Field, Input, Banner, Button, **Card** ⭐                               | DealerProfileForm                                         | —                                           |
| F047    | Plate, SignOutButton                                                    | ConsoleNav, ConsoleTabBar                                 | —                                           |
| F048    | StatCard, EmptyState, Banner, Button                                    | —                                                         | —                                           |
| F049    | Plate, SignOutButton                                                    | AdminNav                                                  | —                                           |
| F050    | StatCard, Table                                                         | —                                                         | —                                           |
| F051    | Blueprint, StatCard, Button, Banner                                     | CreditPacks                                               | —                                           |
| F053    | Table, StatusTag, Button                                                | —                                                         | —                                           |
| F054    | Table, Field, Button                                                    | —                                                         | **DealerAdminActions**                      |
| F056    | Field, Input                                                            | PlateInput                                                | —                                           |
| F059    | PlateInput, Plate, Button, Banner, StatusTag                            | RegistrationStep, RcSummary                               | —                                           |
| F060    | Field, Input, Button, Banner                                            | BasicsFields, BasicsStep                                  | —                                           |
| F061    | Field, Input, city picker                                               | DetailsFields                                             | —                                           |
| F062    | ImageSlot, Plate, Banner, Button                                        | PhotoUploader                                             | —                                           |
| F063    | Stepper, Button, Banner, Field                                          | VehicleWizard                                             | —                                           |
| F064    | —                                                                       | —                                                         | **StatusTag** (listing tones)               |
| F065    | Button, Banner, StatusTag                                               | —                                                         | —                                           |
| F066    | Table, StatusTag, EmptyState, Button                                    | —                                                         | —                                           |
| F067    | Button, Field, Banner                                                   | InventoryActions, **Dialog** ⭐                           | —                                           |
| F068    | StatusTag, Blueprint, Banner, Button                                    | ReportPanel, ReportSummary                                | —                                           |
| F069    | Table, StatusTag, Button, EmptyState                                    | QueueApproveButton                                        | —                                           |
| F070    | ReportPanel, StatusTag, Button, Banner, Field, Dialog                   | ReviewActions, ModerationStrip                            | —                                           |
| F071    | —                                                                       | —                                                         | **ReviewActions**                           |
| F072    | Button, Banner, Field, Input, Table                                     | ConfigRow                                                 | —                                           |
| F073    | Plate, Button                                                           | CustomerHeader, CustomerFooter                            | —                                           |
| F074    | —                                                                       | CitySelector, CityChipFallback                            | —                                           |
| F075    | Avatar, ImageSlot, Plate, Tag                                           | VehicleCard, VehicleImage, VehicleCardSkeleton            | —                                           |
| F077    | VehicleCard, VehicleCardSkeleton, EmptyState, Blueprint, Button         | —                                                         | —                                           |
| F078    | —                                                                       | FilterPanel                                               | —                                           |
| F079    | FilterPanel                                                             | MobileFilterSheet                                         | —                                           |
| F080    | —                                                                       | SearchToolbar                                             | —                                           |
| F081    | Blueprint, VehicleCard, Button                                          | HeroSearch                                                | —                                           |
| F082    | Blueprint, Banner, Button, ReportSummary, EnquiryForm                   | VdpCtaStack                                               | —                                           |
| F083    | Corners, ImageSlot                                                      | VehicleGallery                                            | —                                           |
| F084    | —                                                                       | —                                                         | **VehicleCard** (`compact`)                 |
| F085    | Blueprint, LogoTile, Plate, Tag, ImageSlot                              | DirectoryCard, DirectoryFilters                           | —                                           |
| F086    | VehicleCard, SearchToolbar, MobileFilterSheet, EnquiryForm, VdpCtaStack | —                                                         | **FilterPanel** (+`groups`, +`dimZeroRows`) |
| F087    | EmptyState, Button                                                      | SavedCarsProvider, useSavedCars, SavedCarsList            | **VehicleCard** (`list`, `showSave`)        |
| F089    | Field, Input, Button, Banner                                            | EnquiryForm                                               | —                                           |
| F090    | Button, Banner                                                          | RevealContactButton                                       | —                                           |
| F091    | StatusTag, EmptyState, Button                                           | EnquiryInbox, QueryProvider, **Segmented** ⭐             | —                                           |
| F093    | Blueprint, Button                                                       | —                                                         | —                                           |
| F094    | SkeletonLines, VehicleCardSkeleton, EmptyState                          | —                                                         | —                                           |

⭐ = one of the five DESIGN-SPEC components that exist only as CSS today
(finding D-B). Each is created at the first feature that needs it, closing the
duplication before it starts.

---

# Feature → Sandbox matrix

| Feature | Sandbox entries                                                                         |
| ------- | --------------------------------------------------------------------------------------- |
| F007    | design-token swatch page (sandbox step S0)                                              |
| F009    | Button (all variants × sizes × loading × disabled × block), ButtonLink, Plate (4 sizes) |
| F010    | StatusTag (per tone, enum-generated), Tag, Banner (24 combinations)                     |
| F011    | Blueprint, Corners, StatCard, ImageSlot, Avatar, LogoTile                               |
| F012    | EmptyState, ErrorState, SkeletonLines, Stepper                                          |
| F013    | Field (4), **Input**                                                                    |
| F017    | AuthShell, AuthHeading                                                                  |
| F018    | GoogleSignInButton                                                                      |
| F019    | AdminLoginForm                                                                          |
| F020    | SignOutButton                                                                           |
| F026    | city picker                                                                             |
| F037    | OnboardingWizard shell (4 steps), Stepper                                               |
| F038    | Onboarding step 1                                                                       |
| F039    | Onboarding step 2                                                                       |
| F041    | DocumentUploader (7 states)                                                             |
| F042    | Onboarding step 4                                                                       |
| F043    | completeness blockers                                                                   |
| F044    | document review row                                                                     |
| F045    | DealerAdminActions, **Table**                                                           |
| F046    | DealerProfileForm, **Card**                                                             |
| F047    | ConsoleNav, ConsoleTabBar (375 / 768)                                                   |
| F048    | StatCard                                                                                |
| F049    | AdminNav                                                                                |
| F050    | balance card, ledger table                                                              |
| F051    | CreditPacks                                                                             |
| F053    | invoice table                                                                           |
| F054    | credit grant form                                                                       |
| F056    | PlateInput                                                                              |
| F059    | RegistrationStep, RcSummary                                                             |
| F060    | BasicsFields, BasicsStep                                                                |
| F061    | DetailsFields                                                                           |
| F062    | PhotoUploader (8 states)                                                                |
| F063    | VehicleWizard                                                                           |
| F064    | StatusTag (per ListingStatus)                                                           |
| F065    | submit CTA                                                                              |
| F066    | inventory table                                                                         |
| F067    | InventoryActions, **Dialog**                                                            |
| F068    | ReportSummary, ReportPanel                                                              |
| F069    | QueueApproveButton, queue table                                                         |
| F070    | ReviewActions, ModerationStrip                                                          |
| F071    | ReviewActions (takedown)                                                                |
| F072    | ConfigRow                                                                               |
| F073    | CustomerHeader, CustomerFooter                                                          |
| F074    | CitySelector, CityChipFallback                                                          |
| F075    | VehicleCard, VehicleImage, VehicleCardSkeleton                                          |
| F077    | results grid                                                                            |
| F078    | FilterPanel                                                                             |
| F079    | MobileFilterSheet (375 / 768)                                                           |
| F080    | SearchToolbar                                                                           |
| F081    | HeroSearch                                                                              |
| F082    | VdpCtaStack                                                                             |
| F083    | VehicleGallery (0/1/2/12 photos, lightbox)                                              |
| F084    | VehicleCard compact                                                                     |
| F085    | DirectoryCard, DirectoryFilters                                                         |
| F086    | FilterPanel (portfolio subset)                                                          |
| F087    | SavedCarsList, VehicleCard list                                                         |
| F089    | EnquiryForm                                                                             |
| F090    | RevealContactButton                                                                     |
| F091    | EnquiryInbox, **Segmented**                                                             |
| F093    | ErrorState                                                                              |
| F094    | skeleton layouts                                                                        |

Features with no UI: F001–F006, F008, F014–F016, F021–F025, F027, F028, F029,
F030, F031, F032, F033, F034, F036, F040, F052, F055, F057, F058, F076, F088,
F092, F095, F096, F097.

---

# Implementation order

Tiers run top to bottom. Within a tier, features can be worked in parallel
unless a dependency is listed.

```text
TIER 0   chore: initialize project            ← the ONE direct push to main
              │
         PR   chore: component sandbox        ← before F009; the gate must exist
              │                                  before the first thing that must
              │                                  pass through it
TIER 1   F001 F002 F003 F004 F005 F006        platform foundations
         F007 F008 F009 F010 F011 F012 F013   design system & primitives
              │
TIER 2   F014 F015 F016 F017                  identity
         F018 ⭐ FIRST DEALER-FACING FEATURE
         F019 F020
              │
TIER 3   F021 F022 ⭐ CI/CD LANDS HERE (decision D3)
         F023 F024 F025
              │
TIER 4   F026 F027 F028 F029 F030 F031        platform services
              │
TIER 5   F032 F033 F034 F035                  storage & media
              │
TIER 6   F036 F037 F038 F039 F040             dealer onboarding
         F041 F042 F043 F044 F045
              │
TIER 7   F046 F047 F048 F049                  consoles
              │
TIER 8   F050 F051 F052 F053 F054             billing & credits
              │
TIER 9   F055 F056 F057 F058 F059             vehicle intake
         F060 F061 F062 F063
              │
TIER 10  F064 F065 F066 F067 F068             listing lifecycle
              │
TIER 11  F069 F070 F071 F072                  moderation
              │
TIER 12  F073 F074 F075 F076 F077 F078        public marketplace
         F079 F080 F081 F082 F083 F084
         F085 F086 F087
              │
TIER 13  F088 F089 F090 F091 F092             enquiries
              │
TIER 14  F093 F094 F095 F096 F097             surface polish
```

## Ordering conflicts worth knowing about

1. **F041 needs F033 (presign).** KYC documents use the same pipeline as vehicle
   photos. This is why storage (Tier 5) precedes onboarding (Tier 6), even
   though onboarding feels like it comes first in the product.

2. **F043 straddles F039 and F041.** Completeness is derived from fields both
   own. If the split proves awkward in practice, fold F043 into F042.

3. **F044/F045 need F049 (admin shell).** The admin console shell is in Tier 7,
   after the onboarding tier that uses it. Either move F049 up to Tier 6, or
   land F044/F045 as API-only in Tier 6 with the UI following in Tier 7.
   **Recommendation: move F049 to Tier 6**, before F044.

4. **F082 ↔ F089.** The VDP renders `EnquiryForm`, and the form exists for the
   VDP. F089 lands first with a bare harness page; F082 then consumes it.

5. **F073 ↔ F087.** `CustomerHeader` reads `useSavedCars` for its badge. Either
   F073 ships the header without the badge and F087 adds it, or F087 moves ahead
   of F073. **Recommendation: F073 ships without the badge**; F087 modifies it.
   That keeps the saved-cars provider inside the feature that owns it.

6. **F060 → F076.** Post-D1, search facets depend on make/model strings being
   normalised at write time. F060 must settle normalisation before F076 is
   built, or the facet fragmentation is unrecoverable.
