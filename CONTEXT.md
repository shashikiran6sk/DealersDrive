# CONTEXT.md

Engineering log and orientation for Dealers-Drive. Written for whoever — human
or agent — picks this up next.

**Read [`CLAUDE.md`](CLAUDE.md) first.** It carries the rule that governs
everything here: _this is a reconstruction of a working product, not a new
build._ This file is the running state of that reconstruction.

---

## 1. What this is

A B2B2C used-car marketplace for Tamil Nadu (the original seed models the
Vellore district). Independent dealers list inventory; buyers browse publicly
with no account. Only dealers and platform admins authenticate.

Three surfaces, one repo:

| Surface            | Path                                              | Who                                        |
| ------------------ | ------------------------------------------------- | ------------------------------------------ |
| Public marketplace | `/`, `/cars`, `/car/[slug]`, `/dealers`, `/saved` | anonymous buyers                           |
| Dealer console     | `/dealer/**`                                      | one dealership, resolved server-side       |
| Admin console      | `/admin/**`                                       | platform staff, cross-tenant, audit-logged |

Dealers-Drive is the technology and marketplace layer. It does **not** own the
vehicles.

---

## 2. What state the project is actually in

This is the part that is easy to get wrong, so it is stated plainly.

**The product is built.** ~38,000 lines of application source, 12 API modules,
27 Prisma models, ~80 HTTP endpoints, 32 Next.js pages, 65 React components,
97.74 % API line coverage and 100 % contracts coverage. It runs.

**The Git history is not.** 34 commits, one of which (`decc10c`) is 208 files
and +42,525 lines. Nothing is reviewable feature-by-feature, nothing is
bisectable, and no commit tells you why anything is the way it is.

**So the code is being re-delivered, not rewritten.** 97 features across 14
tiers, one PR each, each one diffed against the baseline to prove it did not
change behaviour on the way through.

|                                |                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Baseline (the working product) | tag `baseline/pre-reorg-2026-09-02` = `f05acdc`                                        |
| Local reference branch         | `legacy/pre-reorg`                                                                     |
| History remote (read-only)     | `legacy-origin` → `shashikiran6sk/Dealers-Drive`                                       |
| Reconstruction remote          | `origin` → `shashikiran6sk/DealersDrive`                                               |
| Reconstruction progress        | [`docs/project/progress.md`](docs/project/progress.md) — the only place it is recorded |

---

## 3. Why the reorganisation is happening at all

Two findings from the Phase 1 audit (`docs/project/`) drove it.

**The history is unreviewable.** Three commits are genuinely feature-shaped —
`94d97b6` "RC Lookup" is a clean vertical slice of adapter, port, routes,
schema, UI and tests, and is close to the target PR shape. The rest are not.

**The web layer is untested and its components are undiscoverable.** The API is
at 97.74 % line coverage; the web app is at **13.83 %**, with **1 of 65
components** carrying a test. That gap is not an accident of effort — it is a
discovery failure, and it shows up as duplication:

- `<Button>` is used 29 times; `className="btn …"` is used **88** times. **75 %
  of the buttons in the product bypass the component.**
- Five components that the design spec defines exist only as CSS classes:
  `.input` (70 uses), `.card` (32), `.table` (hand-rolled in 5 separate pages),
  `.seg` (2), `.dialog` (dead — Radix was used instead).
- `dealer-card.tsx` exports `DirectoryCard`, so nobody searching for
  `DealerCard` finds it.
- `vitest.config.ts` selects jsdom specifically to test `VehicleGallery`'s focus
  trap. That test was never written.

The component sandbox (`docs/project/component-sandbox.md`) exists to close
that gap, and it is part of the definition of done rather than a side project.

---

## 4. Stack, and why each piece is not negotiable

| Layer     | Choice                                | Why it cannot be swapped casually                                                         |
| --------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Monorepo  | Turborepo + pnpm workspaces           | `packages/contracts` must be importable by both apps as source of truth                   |
| Web       | Next.js 15 App Router, RSC by default | public pages must be server-rendered for SEO                                              |
| Styling   | Tailwind v4 + CVA, Radix primitives   | design tokens live in `globals.css`                                                       |
| API       | Express 5, modular monolith           | one deployable, transactional consistency for free                                        |
| DB        | PostgreSQL 16 + Prisma 6              | the invariants live in the database, not the app                                          |
| Jobs      | pg-boss on the same database          | real queue semantics, zero new infrastructure                                             |
| Contracts | Zod v4                                | one schema validates the request _and_ types the response _and_ generates the OpenAPI doc |

**Do not introduce** MongoDB, Redis, Elasticsearch, GraphQL, NestJS,
microservices, Redux or another global state manager. Every one of those was
considered and rejected during the original build; adding one silently re-opens
a settled decision.

The ten engineering invariants that everything else follows are in
[`CLAUDE.md` §4](CLAUDE.md). They are not repeated here — one copy, not two.

---

## 5. Repository layout

```
apps/
  api/          Express 5 modular monolith
    src/
      modules/      one folder per bounded context: routes · service ·
                    repository · facade · docs
      platform/     shared runtime: errors, telemetry, db, cache, storage,
                    media, events, jobs, payments, notify, rc
      middleware/   the seven, mounted in routes.ts
      routes.ts     the single mount table — and the whole authz model
      container.ts  dependency injection
  web/          Next.js 15 App Router
    src/
      app/          route groups: (public) (dealer) (admin) (auth) + BFF proxies
      components/   ui/ primitives, then shared domain components
      features/     feature-specific composition
packages/
  contracts/    Zod v4 schemas shared by browser and server
  config/       tsconfig and eslint presets
docs/
  project/            the reorganisation plan — start at feature-map.md
  screens/            original screen references
  Dealers-Drive-UI/   original interactive UI prototype
```

Most of `apps/` and `packages/contracts/src` is currently **empty**. That is
expected: each directory refills as its features land. `git ls-tree -r
legacy/pre-reorg` shows what is coming.

---

## 6. Two files every API feature will fight over

`apps/api/src/routes.ts` and `apps/api/src/container.ts` are touched by **every**
API feature — the first to mount a router, the second to register a module. So
is `apps/api/prisma/schema.prisma`, which ends up at 1,010 lines and 27 models.

**Rebase, never merge, while a feature branch is open.** The conflicts are
trivial but constant, and a merge commit in the middle of a reconstruction PR
destroys the diff-against-baseline check that makes the whole approach safe.

The worst sequence is dealer onboarding: **F036–F046 are eleven features sharing
`dealers.routes.ts` and `dealers.service.ts`.** They must land strictly in
order. The full shared-file register is in `docs/project/git-strategy.md` §4.

---

## 7. Known divergence from the baseline

Two, both deliberate, and they are the same decision made twice.

**D1 removes the seeded database catalogue.** Vehicle details come from the
external RC lookup or manual entry instead.

**D6 removes the `cities` table.** A dealership's `city` and `state` are free
text it types; `City`, the `locations` module and `GET /v1/cities` are gone,
and a registered name is unique **per city** rather than globally.

The consequence is that the reconstruction is _not_ byte-identical to the
baseline, so the final convergence check is "the diff contains only the
sanctioned divergences" rather than "the diff is empty". The exact permitted
hunks are tabulated in `docs/project/git-strategy.md` §5.

The risk both create is one risk: **facet fragmentation on unnormalised
strings.** It is tracked at **F060** (make/model normalisation moves to write
time) and **F076** (search facets). `CLAUDE.md` §5 has the detail. It is the
single most likely place for this reorganisation to quietly degrade the
product, so it is worth reading before F060.

### Why D6 happened, which is the part worth carrying forward

D1 looked at `City` and kept it, on the reasoning that cities are not
vehicle-catalogue data — they drive the header selector, the directory, search
filters and dealer profiles. That reasoning describes what the table is **read**
for. It misses what the table **decides**.

`cities` held five towns in one state. A dealer in Salem could not complete
onboarding at all, and a dealer in Bengaluru could not be described by the
form, because `state` was whatever the joined row said rather than where the
yard is. Nobody noticed until somebody filled the form in.

**The test D1 should have applied, and D6 does:** a reference table is
catalogue data if it gates who or what may exist, whatever else it is read for.
`City` gated sign-up. `rc-aliases.ts` does not gate anything — it is a
committed constant that translates a manufacturer string, and it survives both
decisions for that reason.

`Dealer.lat` / `Dealer.lng` are the visible residue. They used to be copied off
the city row; nothing writes them now. The columns stay because the distance
sort that reads them is a real feature, and geocoding a typed address is that
feature's problem rather than onboarding's.

### The normalisation is not optional and it lives in one place

`normaliseLocality` in `packages/contracts/src/common.ts`, applied by
`auth.service.onboard` and `dealers.service.update`, on the way **in**. Case and
whitespace only — it does not correct spelling, expand abbreviations or
transliterate, because each of those is a judgement about a place name the
dealer standing in it knows better than we do.

Read-time normalisation would be the tempting shortcut and it does not work:
the uniqueness constraint is a database index over the stored string, so what
is stored is what the constraint sees. `vellore` and `Vellore` stored as typed
are two cities to the index and one city to a human.

### One name per city, and why the check is the submit

A global unique on `legalName` was the first shape of this rule and it is wrong
in a way that only shows up at scale: "Sri Balaji Motors" is a name three
unrelated families use in three different towns, and the first to sign up locks
the other two out of the product. Inside one city the same name is a duplicate
application or an impersonation, and a buyer cannot tell which dealership they
are calling.

Both halves of the pair are typed on onboarding step 2, so that step's submit
is when the question can first be asked — and it is asked by the write, against
`@@unique([legalName, city])`, not by a lookup as the dealer types. Two reasons,
and the second is the one that is easy to miss:

1. A pre-submit check is one that two simultaneous applications can race past,
   between the answer and the write.
2. It would hand anyone with a browser a way to enumerate which dealerships
   exist in which town.

The service reads first anyway, case-insensitively, and that read exists purely
to turn a collision into a 409 naming `legalName` rather than a Prisma `P2002`
the error handler renders as a 500. The index is the guarantee; the read is the
error message.

---

## 7a. The sandbox needs Tailwind told where to look

Found at F017, and it had been silently true since S1.

`apps/sandbox/.storybook/preview.tsx` imports the real
`apps/web/src/styles/globals.css`, whose first line is `@import 'tailwindcss'`.
Two things have to be arranged for that to produce any CSS at all, and neither
is inferred:

1. **PostCSS runs from the sandbox's root, not the stylesheet's.** Vite resolves
   `postcss.config.*` against its own root — `apps/sandbox` — so `apps/web`'s
   config never applies. Without `apps/sandbox/postcss.config.mjs` the
   `@import` does not expand and the sheet is inert.
2. **Tailwind v4 discovers utility classes by scanning outward from the
   stylesheet it is processing.** From `apps/sandbox` that walk does not reach
   `apps/web/src`, so every utility class in every component produces nothing.
   `apps/sandbox/src/preview.css` states both roots explicitly with `@source`.

The failure mode is the reason this is written down: with (1) missing the story
renders as unstyled HTML, which reads as a broken import; with (2) missing the
story renders with its `@theme` colours and typography but **no layout**, which
reads convincingly like a bug in the component. Both send you hunting in
`apps/web`, where nothing is wrong.

If a story ever loses its styling, check these two files before the component.

---

## 7a2. `pnpm build` does not build the sandbox

Found at F041, the hard way: a green local gate and a red CI.

`turbo run build` covers `contracts`, `api` and `web`. The sandbox declares a
`build:sandbox` script rather than a `build` one, deliberately — a broken story
must never be able to fail a deploy, which is the same reason stories live
outside `apps/web` at all.

⚠️ **Nothing catches this automatically any more.** CI ran it as its own job
(`sandbox typecheck / build`) until D7, when the job was removed at the
author's request. This section used to describe a trap CI would catch for you
on the pull request; it now describes one that reaches `main`.

So `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all green says
nothing about whether Storybook still builds. **`pnpm --filter
@dealers-drive/sandbox typecheck` passes too** — it type-checks the stories
against the real components, and the alias that breaks is a Vite one, not a
TypeScript one.

The specific trap: `apps/sandbox/.storybook/main.ts` aliases
`@/features/auth/actions` to `apps/sandbox/src/mocks/auth-actions.ts` (coupling
C-4 — Server Actions need a server the sandbox does not have). **Every action a
story's component imports must exist in that stub.** Add one to
`apps/web/src/features/auth/actions.ts` without adding it to the mock and the
Storybook build fails to resolve it, while every other check stays green.

Before opening a PR that touches `apps/web/src/features/auth/actions.ts` or any
component a story renders, build the sandbox with the workspace's
`build:sandbox` script:
`pnpm --filter @dealers-drive/sandbox build:sandbox`. Since D7 this is the only
thing that will tell you.

---

## 7b. The restore ledger

Tier 2 could not be reconstructed feature-by-feature without cutting into files
that later features own. Every cut is marked in the code with a
`── Reconstruction slice ──` comment and in the owning feature's `feature-map.md`
entry, but they are scattered, so this is the one list.

**Nothing here is a decision. Each line is a promise to put something back.**

| Restore in                      | What comes back                                                                                                                                                     | Where it was cut                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **F034**                        | `media.service.ts`'s `process()` and `describe('process')` — the sharp/blurhash pipeline, and the only tests that drive real image bytes                            | `media.service.ts`, `media.service.test.ts`                        |
| **F035**                        | `reorder()`, the `VehicleMedia` link in `commit()`/`get()`/`remove()`, and `PUT /vehicles/:id/media/order`                                                          | `media.service.ts`, `media.routes.ts`, both media test files       |
| **F039**                        | `saveBusinessIdsAction` + its `describe` block                                                                                                                      | `features/auth/actions.ts`, `actions.test.ts`                      |
| **F042**                        | `submitForVerificationAction` + its `describe` block                                                                                                                | same two files                                                     |
| **F046**                        | `GET /v1/dealer` → 200 in `auth.test.ts`; `reached` in `routes.test.ts`; the rest of `dealers.service.ts`                                                           | the two test files, `dealers.service.ts`                           |
| **F049**                        | `GET /v1/admin/metrics/overview` → 200; `AdminOverview` as `currentAdmin`'s type                                                                                    | `auth.test.ts`, web `lib/session.ts`                               |
| **F055**                        | `presign()`'s `MAX_PHOTOS_PER_VEHICLE` quota and its vehicle-ownership 404 — ⚠️ nothing else enforces the cap                                                       | `media.service.ts`, `media.service.test.ts`                        |
| **F064**                        | `pendingListingCount`'s real query + 1 test case; ⚠️ `remove()`'s below-minimum-photos guard on a live listing, and the `PlatformConfigService` dependency it needs | `dealers.repository.ts`, `media.service.ts`                        |
| **F066**                        | `describe('tenant isolation survives real sessions')`, and `tests/tenant-isolation.test.ts`                                                                         | `auth.test.ts`                                                     |
| **F076**                        | the real `SearchRepository` behind `locations.service.ts`'s `CityCountsPort` — `emptyIndex` answers zero until then                                                 | `container.ts`                                                     |
| **F088**                        | `newEnquiryCount`'s real query + 2 test cases                                                                                                                       | `dealers.repository.ts`                                            |
| **F095**                        | `seoMetadata({ kind: 'private' })` on both login pages                                                                                                              | `app/(auth)/*/login/page.tsx`                                      |
| **F096**                        | `auth.docs.ts`, `media.docs.ts` — and every other module's docs file                                                                                                | never landed                                                       |
| **F097**                        | the real seed; `prisma/seed/index.ts` is currently the three rows `auth.test.ts` needs                                                                              | `prisma/seed/`                                                     |
| the last of F033/F055/F076/F092 | `platform/jobs/handlers.ts`, `registerSchedules`, `handlers.test.ts`                                                                                                | never landed — `HandlerDeps` names five services that do not exist |

Two lines are **not** restores and must not be treated as such:

- `GET /v1/catalog/bundle` is gone for good — decision D1.
- `/v1/dealer` and `/v1/admin` are mounted with their guard and no child
  routers. That is the finished state of F016, not a stub: the guard runs on
  every path under the prefix, so later routers inherit the boundary rather
  than re-declaring it.

---

## 7c. The OpenAPI layer, and the two ways it bites

The reference at `/api/docs` is built once at startup from `MODULES` in
`src/docs/openapi.ts`. `CLAUDE.md` §4a is the rule; this is what to know when
it goes wrong.

**Response schemas are generated; input schemas are listed by hand.**
`buildSchemaCatalogue()` walks everything `@dealers-drive/contracts` exports and
converts it, so a response shape needs no maintenance. But it has to know which
schemas are _request input_, because that decides whether a `.default()` field
reads as required — get it backwards and `?limit=` documents as a required
integer. That list is `INPUT_SCHEMA_NAMES`, and it is explicit on purpose: a
silent misclassification is worse than a list somebody has to extend.

The bite: **it throws when a name is listed but not exported.** The baseline
lists 42 names; only 8 of those schemas exist so far, so the list was cut to 8
and grows as features land. If you add a params/query/body schema and forget to
list it, the operation referencing it fails the build with
`docs: no component schema named "…"`. If you list one before contracts exports
it, the API refuses to boot. Both are loud, which is the design.

**Express 5 hides mount paths, which is why the drift test looks odd.**
`tests/unit/docs/openapi.test.ts` has to enumerate every route the router
actually serves. In Express 4 you could read `layer.regexp.source` and recover
`/v1/dealer`. Express 5 replaced that with a `matchers` array of closures — a
matcher will tell you the prefix only if you hand it a path that already
matches, which is useless for discovery:

```ts
matcher('/health/live'); // { path: '/health', params: {} }
matcher.path; // undefined — the mount path is in the closure
```

So the test wraps `Router.prototype.use` for the duration of `createRoutes()`,
records which child router was mounted at which path, and restores it in a
`finally`. Do not "simplify" that back to reading layer internals; there is
nothing there to read. If a future Express exposes the path again, the wrapper
is the thing to delete.

---

## 7d. Two platforms, one commit (D7)

The front end deploys to Vercel and the API to ECS. Three things about that are
not obvious from either the workflows or the code, and all three have bitten
somebody before.

**The session cookie is the whole difficulty.** `dd_session` is host-only in
every environment on purpose — `SESSION_COOKIE_DOMAIN` is empty so a dev
session can never be presented to production. The Google callback sets it on
whichever host answered the redirect. That is why `apps/web/next.config.ts`
rewrites `/v1/auth/google/*` to the API: it puts the callback back on the web
origin so the cookie lands where `cookies()` can read it. **Do not "simplify"
that rewrite away**, and do not reach for a parent-domain cookie instead — that
is the isolation the empty domain exists to provide.

**`GIT_SHA` is read at request time, not inlined.** `apps/web/src/app/api/
health/route.ts` reports `GIT_SHA ?? VERCEL_GIT_COMMIT_SHA ?? 'unknown'`, and
`next.config.ts` deliberately has no `env` block. Adding one would inline the
value at build time and break the Docker path, which sets `GIT_SHA` on the
runtime image rather than during `next build`. The deploy workflow passes it
with `vercel deploy --env GIT_SHA=…`.

**Per-IP rate limiting is currently wrong, and known to be.** Every API request
now originates from Vercel's egress, so the reveal-contact and enquiry limiters
would count the entire internet as one bucket. `apps/web/src/lib/api.ts` has a
`headers` option reserved for forwarding the buyer's IP and nothing uses it
yet. **This must land before F088–F092**, and `app.set('trust proxy', 1)` in
`apps/api/src/server.ts` needs revisiting for the extra hop.

---

## 8. Local development

```bash
pnpm install
pnpm infra:up        # Postgres 16, MinIO, Mailpit
pnpm typecheck && pnpm test && pnpm build
```

`pnpm dev` runs the API and web app once F002 and F008 have landed. The `app:*`
scripts build Docker images and stay inert until **F021** — decision D3 moved
CI/CD to Tier 3, immediately after the first dealer-facing feature, so there are
no Dockerfiles, no GitHub workflows and no `deploy/` directory before then.

Locally the two apps are on two ports and always were, so the D7 origin split
changes nothing here. `API_ORIGIN` is unset, so the OAuth rewrite in
`next.config.ts` does not exist and the browser talks to `localhost:4000`
directly — which is what `GOOGLE_CALLBACK_URL`'s default already assumes.

Copy `.env.example` to `.env` before running anything that touches the database.

---

## 9. Where to look when you are stuck

| Question                               | Answer lives in                                   |
| -------------------------------------- | ------------------------------------------------- |
| What am I supposed to build next?      | `docs/project/feature-map.md`                     |
| What did the original code look like?  | `git show legacy/pre-reorg:<path>`                |
| Why was it built that way?             | `git show legacy/pre-reorg:docs/ARCHITECTURE.md`  |
| What is this endpoint meant to return? | `git show legacy/pre-reorg:docs/API-SPEC.md`      |
| What should this screen look like?     | `docs/screens/`, `docs/Dealers-Drive-UI/`         |
| Does this component already exist?     | `docs/project/component-map.md`, then the sandbox |
| How do I ship it?                      | `CLAUDE.md` §2, then §6                           |
| What does this endpoint return?        | `/api/docs` — generated, so it cannot be stale    |
| Why did the docs test fail?            | `CLAUDE.md` §4a, then §7c above                   |
