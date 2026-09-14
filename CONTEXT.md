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

Three deliberate ones. The first two are the same decision made twice.

**D1 removes the seeded database catalogue.** Vehicle details come from the
external RC lookup or manual entry instead.

**D6 removes the `cities` table.** A dealership's `city` and `state` are free
text it types; `City`, the `locations` module and `GET /v1/cities` are gone,
and a registered name is unique **per city** rather than globally.

**D8 removes password authentication.** Admins sign in with Google, like
dealers, and authorization is an allow-list of addresses — see §7e.

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

**`pnpm typecheck` had a second, quieter version of the same hole.** The sandbox
type-checks its stories against the real components in `apps/web/src`, which it
reaches through a tsconfig path alias rather than a workspace dependency — a
Storybook cannot depend on an app. Turbo's task graph therefore did not know
that changing a component's props invalidates the sandbox's typecheck, so a
cached PASS survived a change that broke a story: green on the machine that made
the change, red in CI where the cache is cold. `turbo.json` now names
`apps/web/src/**` as an input to `typecheck`, which closes it.

The general lesson, and it applies to the next alias somebody adds: **turbo only
knows about the edges you declare.** A path alias is an edge it cannot see.

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

**Nothing is deployed automatically today.** Neither target exists yet — no
Vercel project, no AWS account — so `deploy-dev` in `release.yml` is commented
out and every merge to `main` builds the two images and stops. The block carries
the three steps that turn it back on. `_deploy.yml` and `promote.yml` are
untouched: the procedure is still written down, it is simply not being run.

**The Google OAuth client needs one redirect URI, not two.** Both consoles come
back through `/v1/auth/google/callback` — see §7e for why the audience travels
in the cookie instead.

---

## 7e. The admin console has no password, and that is the security model

`POST /v1/auth/admin/login`, `password.ts`, `AdminLoginInput`, `AdminLoginForm`
and `@node-rs/argon2` are gone, along with `users.passwordHash`. The console is
entered through the _same_ Google round trip the dealer console uses; what
separates the two is `ADMIN_ALLOWLIST`.

**Three things about that are load-bearing.**

**The audience is sealed at `/start`, not read at the callback.**
`/v1/auth/admin/google/start` mints the transaction cookie with
`audience: 'ADMIN'`; `/v1/auth/google/callback` reads it back out of the sealed,
HMAC-signed cookie. There is one registered redirect URI at Google for both
consoles — a second path would be a second thing to register and get wrong per
environment — and the audience decides the _privilege of the session that is
issued_, so it must not be a value the browser can edit on the return leg.

**The allow-list is checked twice, and the second check is the point.** Once in
`completeAdminGoogle` when the session is issued, and again in `resolveAdmin` on
every request afterwards. That is what makes removing an address a revocation
rather than a note for next time: a console already open stops answering on the
next click, instead of twelve hours later when the session expires.

**The first entry is also the seeded admin and the `AUTH_MODE=dev` identity.**
There used to be a separate `DEV_ADMIN_EMAIL`, and it could disagree with the
allow-list — which meant a local database seeded with an admin nobody was
permitted to sign in as. One variable now answers "who is the admin here".

The one relaxation worth knowing about: `createIdentity` refuses a Google
sign-in whose email matches an existing account with no linked identity
(`ACCOUNT_LINK_REQUIRED`), because a matching email string is not proof that the
same person still holds the address. `completeAdminGoogle` deliberately does
link, for allow-listed addresses only — the platform team wrote that address
into its own deployment configuration, which is a stronger claim than the email
match, and without it the seeded admin row and the Google identity could never
be joined.

**What was traded away.** The account recovery story is Google's rather than
ours, which removes the only password this product ever stored.

**And what R42 traded back.** Adding an admin used to be a deploy. It is now
also a row: a SUPER_ADMIN grants access by email on the settings screen, which
writes a `user_roles` seat with `grantedBy` set.

`grantedBy` is the whole of the distinction and it is worth understanding before
touching either check. **Every admin sign-in already leaves an ADMIN seat
behind** (R41's `ensureSeat`), so a seat's _existence_ means "has signed in
once" and nothing more — reading it as permission would make `ADMIN_ALLOWLIST`
vacuous, and an address removed from the environment would go on working
forever on the strength of its own last visit. Only `grantSeat` sets
`grantedBy`, and only the settings screen calls it.

So the allow-list keeps its original property for the addresses on it: they
cannot be added or removed from inside the product. What a grant adds is a
second, auditable list that can be — and the console shows which row came from
where, refusing to offer a Withdraw control for an allow-listed address rather
than offering one that could not keep its promise.

---

## 7e2. One person, two seats — and why `users.status` is not the switch (R41)

`users.status` is an **account**: one flag for the whole person, every door.
That is the right unit for exactly one thing — an account the platform is
closing altogether — and it was the wrong unit for the one place that used it.

Suspending a dealership used to write `SUSPENDED` onto every member's `users`
row and revoke every session they held. For most dealerships that is
indistinguishable from the right behaviour. For a member who is _also_ a
platform admin it is not: the admin console went dark because of a decision
about a yard in Vellore, and nothing in the console said so. One human, two
jobs, one switch between them.

`user_roles` is the per-seat layer. One row per (person, role), where role is
`DEALER` or `ADMIN` — deliberately neither `DealerRole` (OWNER/MANAGER/SALES, a
rank _inside_ one dealership) nor `AdminRole` (SUPPORT/MODERATOR/SUPER_ADMIN, a
rank inside the console). This is which door you may enter at all.

**The rule is one sentence, and it is what makes the table safe.** A seat row
refuses its role when it is `SUSPENDED`; an absent row says nothing. It can
close a door and it can never open one, so every check that existed before it —
the dealership's own status, `isPlatformAdmin`, `ADMIN_ALLOWLIST` — still
decides, and this is a veto laid over the top.

Three consequences worth knowing:

- **`setDealerStatus` writes seats, not accounts.** `setSeatStatus(tx, { role:
'DEALER' })`, exported through `auth.facade.ts` because `users`, `sessions`
  and `user_roles` are one model with one owner.
- **Session revocation is scoped.** `session.updateMany` on suspension carries
  `scope: 'DEALER'`. An admin session the same person holds is untouched, which
  is the whole point; `revokeAllForUser` takes an optional scope for the same
  reason and still means _everything_ when it is omitted.
- **Signing in never reopens a seat.** `ensureSeat` upserts with an empty
  `update`. A suspension that a dealer could lift by pressing the button again
  would not be a suspension.

The migration backfills a `DEALER` seat for every member, an `ADMIN` seat for
every platform admin, and then **releases `users.status` for the accounts a
dealership suspension had set**. That last statement is safe because
`setDealerStatus` was the only writer of `users.status = 'SUSPENDED'` in the
codebase; every such account was suspended by a dealership decision, which the
first statement has just recorded in the place it belongs.

⚠️ The test suite now runs with **two** addresses on `ADMIN_ALLOWLIST`
(`apps/api/vitest.config.ts`), because proving this needs one operator to
suspend a dealership whose owner holds an operations seat of their own. Anything
asserting on how many emails an admin fan-out produces has to count distinct
templates rather than messages.

---

## 7f. `district` is required, and the reason is the admin filter

`Dealer.district` sits beside `city` and `state`, typed on onboarding step 2,
normalised by the same `normaliseLocality`, and required by `completeness`.

Required rather than optional because the admin console filters on it. A filter
that silently omits the dealerships that skipped the question is a filter that
lies, and the person reading it has no way to tell. Existing rows read as
incomplete until somebody fills it in, which is the truth about them.

The column is nullable in the database and there is no backfill. A district
guessed from a city name would be wrong for exactly the towns that need it most,
and a wrong value in a filter is worse than an absent one.

---

## 7g. Two fields that look like data and are not

**`dealers.mapsUrl` is a security boundary.** A dealer pastes it, and a buyer's
browser follows it from the public portfolio's "Get directions". `GoogleMapsUrl`
in `packages/contracts/src/common.ts` is what stops that being a self-service
open redirect wearing a dealership's name: `https`, and a hostname that is in
the list — compared as a parsed hostname, never as a substring, because
`maps.google.com.attacker.test` contains a Google domain and is not one.

It is stored **verbatim**. Not parsed into `lat`/`lng`, and not "cleaned up": a
share link survives the dealer moving their pin, carries the place's own name
and reviews, and opens the Maps app rather than a web map on a phone. Rewriting
the query string is how a short link stops resolving. `Dealer.lat` / `Dealer.lng`
remain written by nothing; geocoding is still its own feature's problem.

**The phone number stopped being a credential and nobody moved the field.** It
was `readOnly` once a dealership existed, and `UpdateDealerInput` refused it,
both justified by "it is the login identity, and changing it needs an OTP
round-trip". That was true before F018. Since dealers sign in with Google, this
is the number a _buyer_ is given — the thing a dealership changes when it swaps
SIMs — and the read-only box was a dead end for precisely the dealer who needed
it most: the one told the number is already registered, sent back to a step
where they could not change it.

Two consequences worth carrying forward:

- **Two columns, one answer.** `users.phone` is who the dealer is to us and
  `dealers.contactPhone` is what a buyer is shown. Onboarding writes both from
  one field, so an edit has to as well — a stale mirror publishes the old
  number.
- **One predicate for "is this a mobile number".** `isIndianMobile` in
  contracts, imported by the wizard rather than copied. There were three copies,
  they agreed with each other and disagreed with the placeholder in the form,
  which suggests `98400 12345` — a number the validator rejected. Separators are
  stripped before the test because `toE164` strips them before the write.

---

## 7h. Three refusals, and why they are three

"Reject" was one word doing three jobs on the admin dealer screen, and the three
have very different consequences. They are now separate controls with separate
endpoints, and the distinction is worth carrying forward because the wrong one is
expensive.

| Control                          | What it does                                                                                         | Reversible              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------- |
| **Reject file** (one document)   | Deletes that scan from storage, empties the row, reopens the application so the dealer can re-upload | Yes — they upload again |
| **Request changes** (dealership) | PENDING_APPROVAL → DRAFT with a reason. Nothing is deleted                                           | Yes                     |
| **Reject** (dealership)          | Deletes the scans, the yard photo, the documents, the membership and the `dealers` row               | **No**                  |

Three things follow from that table.

**Rejecting a document is not rejecting a dealer.** It says "this file is
unreadable, send another one". Because a PENDING_APPROVAL dealership is shown the
"we are reviewing this" panel and no form, a document rejection that left the
status alone would be an instruction the dealer could not follow — so it returns
the dealership to DRAFT, exactly as _Request changes_ does. It is a request for
changes scoped to one file.

**The file goes when the document is rejected.** A rejected scan of somebody's
PAN card will never be read again, and KYC media is the category where "we still
had a copy" is the wrong answer. The row survives — the checklist is three fixed
rows — but empty, so the dealer sees the slot they saw before they uploaded.

**Rejecting a dealership is a purge, and it leaves an audit row behind.**
`audit_logs.dealerId` is a column and not a foreign key, which is what lets the
record of what was destroyed outlive the row it describes. The whole `before`
block is written into it for that reason, in the same transaction, before the
delete. Storage is emptied _first_, because the row is the only thing that knows
where the bytes are: a KYC key ends in the document row's id.

`statusReason` on a DRAFT dealership is the mark of "an admin looked at this and
handed it back" — nothing else sets it. The onboarding screen reads it twice: as
the banner saying what to fix, and as the signal to open at step one rather than
step three. `POST /v1/dealer/submit` clears it on the way back into the queue.

---

## 7h2. A dealer's public words are proposed, not published (R34)

Rule 7 says a dealer's phone number never appears in an ordinary public
response: only `POST /v1/vehicles/:id/reveal-contact` returns one, rate-limited
twice over and logged as a lead. That was true of every _structured_ field and
false of two free-text ones, and the hole was easy to miss because it did not
look like a phone-number problem — it looked like a profile screen.

`tagline` and `specialities` are the only prose a dealer writes that a buyer
reads. R27 made everything else on the profile screen read-only; these two
stayed editable because a dealership is genuinely entitled to revise how it
describes itself. So they were also the only route by which a number, a URL or a
rival's name reached a public page unread.

They now go to a moderator. What follows is what is worth carrying forward.

**Which fields wait is a question about the type, not about the screen.**
`establishedYear` is an integer bounded by 1900 and 2100 and publishes
instantly: there is nothing that can be hidden in it. If a fourth self-service
field is ever added, that is the test to apply — _can a sentence be smuggled into
this value_ — and not "is this field important".

**A refusal writes nothing.** The live columns are untouched until an approval,
so there is nothing to restore. The tempting alternative — publish now, roll back
if refused — has a window in which the number is on the page, and closing that
window is the whole point.

**One request at a time, refused rather than merged.** A second edit while one
waits is a 409. Two rows would make "what is this dealership asking for" a
question with two answers — and merging them, which was the first design, is
worse: a request that absorbs later edits can change _after_ a moderator has
started reading it. The guarantee under that is a **partial unique index**,
`UNIQUE (dealerId) WHERE status = 'PENDING'` — Prisma's schema language cannot
express one, so it lives in the migration and the model carries a note pointing
at it. If you add another "at most one live row per parent" rule, that is the
pattern.

**Withdrawing is a button, and the boxes are shut until it is pressed.** While a
change waits, the tagline and services inputs are `disabled` and hold the
proposed text — `DELETE /v1/dealer/profile-change` is the only way back to an
editable form. An earlier version inferred the cancellation from the dealer
retyping the live value, which was wrong twice over: it made the exit something
to discover rather than press, and an edit that happens to restore the live text
is still an edit.

What survives from that idea is narrower and is not a withdrawal: the service
asks whether a save _proposes anything at all_. The form re-sends all three
fields every time, so a dealer correcting only their established year would
otherwise queue a request asking a moderator to approve the status quo — and the
comparison is order-insensitive because the services box is one comma-separated
line.

**The screen has to say so, or the product looks broken.** The dealer presses
Save, the box shows what they typed, and their public page does not change.
Without a panel explaining that, the honest state is invisible and the dealer's
conclusion is that the save failed. The same reasoning is why the locked boxes
hold the dealer's own words rather than the live ones: a form that reverted
after every save looks exactly like a save that failed.

**And the reviewer needs the old value on screen.** The question is "is this
_change_ acceptable", not "is this sentence acceptable". `AdminProfileChange`
carries `liveTagline` and `liveSpecialities` for that reason. A field the request
does not touch is `null` / `[]` and must render as **unchanged** — a blank row
reads as _clearing the services_, and approving that reading approves something
nobody asked for.

There is deliberately **no detection**: a regex over ten-digit strings misses
"nine eight four zero zero" and teaches a moderator to trust the absence of a
flag. And **no auto-approve on a timer** — a queue nobody works is a product that
has quietly stopped letting dealers edit their pages, and the answer to that is
staffing, not publishing unread text.

---

## 7i. A React reconciliation bug that looked like a routing bug

Onboarding steps 1 and 2 share one form, and the Continue button was two
elements in one slot: `type="button"` with an `onClick` on the Account step,
`type="submit"` on the Business step. React reconciled them as the **same DOM
node** and mutated `type` in place.

Click is a discrete event, so React flushes the state update synchronously while
the event is still being dispatched. By the time the browser performed the
button's default activation behaviour, the node had become `type="submit"` — so
one press of Continue on the Account step advanced to Business _and_ submitted
the form, landing the dealer on the Documents step without ever seeing the fields
in between.

It only reproduced when the Business step was already filled in, because
otherwise the submit came back with validation errors and the jump read as an
ordinary refusal. That is what made it look like a navigation problem.

The fix is a distinct `key` on each button, which makes them distinct elements:
the clicked node is unmounted, and a removed node has no default action left to
perform. **Any conditional pair of buttons inside a form is exposed to this** —
if they differ by `type`, give them keys.

A second, quieter one lived next to it: `local` (which of the two panes is open)
was `useState`-initialised once, and Next keeps the wizard mounted across a
`?step=` change — same route, same tree position. So `Back` from the Documents
step arrived showing whichever pane was open when the page was first entered.
Both are now reconciled during render rather than in an effect, so the step and
the pane change in one paint.

---

## 7j. Why CI kept failing on green branches

The working agreement names four commands — `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build` — and CI runs **six** steps. The two extra ones were
`pnpm format:check` and `pnpm docs:check`, and neither was reachable by running
the documented gate.

That is the whole explanation for a run of red pull requests whose authors had
verified them locally first. The failures were never in the code: they were a
reflowed comment block, a `prettier` disagreement about where a ternary breaks,
a renamed script quoted in a document. Every one of them arrived as a 45-second
round trip and a context switch, and every one of them was invisible until the
push.

A gate that a developer cannot run is not a gate, it is a lottery. So the four
commands now cover all six:

```json
"lint": "pnpm format:check && turbo run lint && pnpm docs:check",
"lint:fix": "pnpm format && turbo run lint -- --fix",
```

`ci.yml` still runs Format, Lint and Documentation references as three separate
steps, and that duplication is deliberate: a named step tells you which of the
three failed without opening the log. Eight seconds of repeated work against a
round trip that costs a minute and somebody's attention is not a close call.

**If you add a check to `ci.yml`, add it to one of those four commands in the
same PR.** Anything else re-opens this.

The formatting rule itself is worth stating plainly, because it is the one that
catches people: run `pnpm format` (or `pnpm lint:fix`) before you commit.
Prettier reflows comment blocks, and this repository has a great many of them.

---

## 7k. The API sends no email, and that is load-bearing (R40)

There are two Node processes now. `src/index.ts` serves HTTP; `src/worker.ts`
drains the outbox and works the pg-boss queue. Same image, same container, same
`startWorker` function — one composition root, so the two cannot drift into
running different handlers.

**No route, service or request handler holds a `MailerPort`.** If you find
yourself importing one outside `modules/notifications`, stop: the API's entire
contribution to an email is one `outbox_events` row written inside the
transaction that caused it.

The tempting shortcut is `void mailer.send(…)` after the response. It looks
asynchronous and is not: the work still runs on the API's event loop, still
holds its memory, still dies with a SIGTERM mid-flight, and still has nowhere to
record that it failed. When the provider has a slow minute, every one of those
becomes the API's slow minute.

Locally `WORKER_INLINE=true` keeps it one process, so `pnpm dev` is still one
command. Production runs `WORKER_INLINE=false` on the API and one worker task
beside it. **Set them together or not at all** — an API with `true` and a worker
beside it means two processes racing for the same rows, which is safe
(`FOR UPDATE SKIP LOCKED`) and pointless.

Three things about the queue that are easy to get wrong later:

- **pg-boss is at-least-once.** A duplicate delivery is not a bug to prevent, it
  is a normal event to absorb. `notification_deliveries.dedupeKey` is a unique
  index and the worker claims the row _before_ calling the provider.
- **The dedupe key comes from the event**, never from the attempt. A key
  generated per job is unique per delivery and deduplicates nothing.
- **A 4xx from the provider is not retried.** Five more attempts collect the
  same 422. It is marked `FAILED` with the provider's sentence, which is usually
  the instruction.

## 7l. The integration suite was flaky, and the cause was not the product (R39)

The API integration tests used to fail intermittently — measured at **1 run in
12** on `main` at `087c839` — always somewhere in the OAuth sign-in round trip
(`GET /v1/auth/google/start` answering 200 instead of 302, a session 401 a
moment later, a 200 whose body is not the shape the route returns), and never
the same test twice. It reproduces with `--no-file-parallelism`, so it is not
the two integration files contending for the database.

It got likelier as the suite grew — R40's nine new integration cases took the
observed rate to 3 in 12 — which is what made it worth finding rather than
tolerating.

**R39 found it, by printing the body.** A failing
`GET /v1/auth/google/start` answered:

```json
{ "type": "error", "error": { "type": "authentication_error", ... } }
```

with `connection: close` and no `x-trace-id`. **That is not our app.** Every
error this API produces is RFC 9457 — `{ type, title, status, code, traceId }`
— so the socket was answered by something else on the machine.

The mechanism is supertest's. `request(app)` calls `app.listen(0)` when the app
is not already listening and closes the server when the request ends, so the
suite performs one listen/close **per request** and hands the port back to the
operating system each time. A long-lived local service that reconnects on a
loop can bind a port the suite has just released, and the next request dials
what it believes is its own server. That is why it scales with request count —
R40's nine cases took it to 3 in 12, and R39's ~180 extra requests kept it
there — why it is never the same test twice, and why it is a _foreign_ response
rather than a wrong one.

It is therefore **an artifact of running the suite on a workstation that has
other servers on it**, not a bug in the product or in the tests. CI is a clean
container and has not shown it.

**Fixed in R39 by listening once.** `createAuthHarness` now holds one
`app.listen(0)` for the file's whole run and hands agents the `Server` rather
than the `Express` app, so there is no port to hand back between requests. Eight
consecutive clean runs of the integration project against a suite that had been
failing about one run in five with R39's extra requests in it.

The diagnostic habit is worth keeping even so: **print the body before
investigating a red integration run.** A response that is not RFC 9457 did not
come from this API, and nothing in the diff caused it.

## 7m. One writer, or the column stops meaning anything (R39)

`users.phone` is written by `POST /v1/auth/phone/verify` and by nothing else.
Not "should be" — the two other write paths that used to set it now _assert_
against it (`assertPhoneVerified`, exported through `auth.facade.ts`) and refuse
when it does not already hold the number they were handed.

This is the same shape as rule 5, and it is worth knowing why it is worth the
awkwardness. The column holds **a number somebody proved they hold**. A number
somebody typed is a different fact. The moment both can land in the same column,
there is no way to tell them apart afterwards — and the thing that reads it is
the public portfolio, where the difference is whether a buyer's call reaches the
dealership or a stranger.

The alternative design — a `verified` boolean that every writer is expected to
set honestly — fails the same way an `addCredits()` helper would: it works
until the sixth call site, and the sixth call site is written by somebody who
did not read this file.

**If you are adding a write path that stores a dealer's contact number, you are
adding an `assertPhoneVerified` call, not a `phone:` key.**

The corollary is where refusals live. `PHONE_ALREADY_REGISTERED` used to be
answered by onboarding and by the profile PATCH; it is answered by the verify
endpoint now, because a number another account holds can never _become_ this
account's verified number. Moving the write moved the error to the moment of
the claim — which happens to be the moment the dealer is looking at the box.

## 7n. A client-side OTP widget moves a spend control out of your hands (R39)

MSG91's OTP widget runs in the browser: it sends the SMS and collects the code,
and the API only ever sees a signed token afterwards. That is what makes the
integration small, and it has one consequence worth stating plainly rather than
discovering later — **the API cannot rate-limit the sending.** Rule 10 is about
counting things across requests; this is a thing that never becomes a request.

What is left is who may _start_ one. `GET /v1/auth/phone/widget` is behind
`requireSignedIn` and deliberately **not** on `GET /v1/config/public`, which is
anonymous and `Cache-Control: public`. That bounds the spend by the set of
people who have completed a Google sign-in instead of by the internet. It does
not bound how many messages one of them can provoke; MSG91's own per-identifier
limits are the only thing that does.

The browser-side cooldown and the three-attempt cap are courtesies on top of
that, not controls — they are in a page anybody can edit. If the provider's
limits prove too loose, the answer is an API-side send endpoint, which is a
different integration rather than a tightening of this one.

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

## 8a. A dealership's slug is its storage identity

`dealers.slug` reads `sri-lakshmi-motors-katpadi-vellore-tamil-nadu`, and it is
two things at once: the URL of the public portfolio, and the name of the
dealership's folder in the bucket. Everything it owns lives under
`dealers/{slug}/` — the KYC scans under `dealers/{slug}/documents/`, the yard
photograph under `dealers/{slug}/yard/`.

(Those are object-storage keys, not paths in this repository. Keep the
`{slug}` placeholder in them when quoting one: `scripts/check-docs.mjs`
resolves every backticked path against the workspace, and a bare prefix ending
in a slash looks exactly like a directory somebody renamed.)

A KYC document's key is **derived** from the slug rather than stored
(`dealer-storage-keys.ts`), which makes one rule load-bearing:

> **Nothing may change a slug without moving that dealership's objects in the
> same pass.**

No write path does. It is set at registration by `dealerSlug()` and left alone
— a dealer who corrects their town keeps the slug they had, along with the link
they may have printed. The single exception is
`apps/api/scripts/relocate-dealer-storage.ts`, which recomputes every slug and
copies the objects before it renames anything; it exists for the migration off
the old `kyc/{uuid}/` layout and is safe to re-run.

Two seeds derive their slugs from the same function rather than typing them, and
`DEV_DEALER_SLUG` defaults to the string `prisma/seed/data.ts` produces —
pinned by `tests/unit/config/env.test.ts`, because a drift there breaks dev
sign-in at run time rather than at build time.

---

## 8b. Public pages are cached, and a write has to say so

Every public read asks for `revalidate: 600`, and `/dealers/[slug]` is
`export const revalidate = 600` on top of it. Both are right — a directory
changes at the pace of onboarding, not of browsing — and both mean a change is
invisible for ten minutes unless something says otherwise.

`apps/web/src/lib/cache-tags.ts` is that something. Three tags, two functions:

```ts
revalidatePublicDealer(slug); // clears `dealers`, and `dealer:<slug>` if given
revalidatePublicConfig(); // clears `public-config` — the footer's payload (R44)
```

**If you add a write path that changes anything a buyer can see, call it.** The
list today is the dealer's profile save, the yard-photo commit and delete, the
admin config save (**R44** — some of those keys are rendered in the footer), and
the eight admin moderation actions — and the last of those is the reason this
is a rule rather than a nicety: public visibility is `dealer.status ===
'ACTIVE'`, so suspending a dealership is the write that takes it off the
marketplace, and without the call its portfolio stays up for ten minutes.

Tags, not `revalidatePath`. The guarantee you want is that the _fetch_ is
re-issued, and a tag says so directly; a path expression leaves you reasoning
about which of Next's caches it reaches.

The API sends `Cache-Control: public, max-age=300` as well. It is not a factor
today — nothing between the Next server and the API caches, and no browser
reaches those routes — but it will be the day a CDN goes in front of the API,
and no tag can clear that one.

---

## 8c. A debounce is not what makes a typeahead correct (R43)

The directory's search box asks an endpoint while somebody is typing, and there
are **three** defences in it. The first two are the ones everybody writes. The
third is the one that is usually missing, and it is the only one that catches
the bug a user actually sees.

1. **Debounce** — `lib/use-debounced-value.ts`, 300 ms. Stops it asking per
   keystroke. "vellore" is one request, not seven.
2. **Abort** — an `AbortController` in the effect's cleanup. Cancels the request
   the buyer has already typed past, and covers unmount for free.
3. **The stale guard** — every suggest response **echoes the search it
   answered**, and a reply that is not the current question is dropped.

Three exists because of what one and two cannot do. Once bytes are on the wire,
abort is advisory: a two-character query against a cold cache can resolve _after_
the four-character one that replaced it, and the dropdown then shows answers to
something the buyer finished typing past half a second ago. Nothing throws;
nothing logs; the list is simply wrong, intermittently, and only for fast
typists — which is to say, never on the machine of whoever is debugging it.

`DealerSuggestResponse.search` exists for this and for nothing else. **A suggest
endpoint added later must echo its query back too**, or the generic
`useAutocomplete` cannot be made correct over it — the field is part of the
`SuggestPayload<T>` contract, not a convenience.

The related trap, and the reason for the `chosen` ref in `useAutocomplete`:
choosing a row writes that row's label into the input, which is a change to the
value, which debounces into a request for the thing that was just chosen — and
reopens the dropdown over a page that is already navigating. Any control that
writes to its own input needs to remember that it did.

---

## 8d. A string an operator types is a string a buyer's browser executes (R44)

The footer's social links come from `platform_config`, edited at
`/admin/config`. That is the right home for them — a marketing account is
opened, renamed and closed on a timescale that has nothing to do with a release,
and the alternatives are a deploy per correction or a `NEXT_PUBLIC_*` that ends
build-once-promote-many (Rule 9).

It also introduces a shape this codebase did not previously have: **a
configuration value that is rendered into an `href` on every public page in the
product.** Every other key is a number, a boolean or a list of sentences; none
of them reaches the DOM as a URL.

So `config.service.ts` refuses anything that is not an `https:` URL before it
goes on the payload:

```ts
function socialHref(value: string): string | null {
  if (value === '') return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
```

Three things about where that lives are deliberate:

- **On the way out of the API, not in the component.** One check, at the single
  place the value becomes public, rather than one per render site — and the
  footer then has no rule of its own about which links are real.
- **A drop, not an error.** A mistyped URL shows the operator a missing icon on
  the page they are editing, which is a clearer signal than a 400 on a save
  that looked fine.
- **Not in `UpdateConfigInput`.** The schema is `.strict()` and typed per key,
  but it is generic over every `string` key; teaching it that `social.*` means
  "URL" would put a per-key rule in a shared contract.

**If you add another config key whose value ends up in an `href`, an `src` or a
`style`, guard it the same way and in the same place.** The admin console is
audit-logged and permission-checked, which bounds who can do this — it does not
make what they type safe to interpolate.

---

## 8e. Slice the query, never the derivation (F048)

Most of this reconstruction's features want a model that has not landed. There
are two ways to ship anyway, and only one of them is reversible cheaply.

The **wrong** one is to compute the answer inline in the service:

```ts
// Don't. The derivation is now hidden behind the slice.
const weekTotal = 0;
const viewDelta = null;
```

The **right** one is to hold the _query_, on the repository, and leave every line
of arithmetic above it exactly as the baseline wrote it:

```ts
// dealers.repository.ts — the query is what waits, and it says so
// eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
async viewRollups(_dealerId: string, _from: Date): Promise<{ day: Date; views: number | null }[]> {
  return [];
}
```

Three things follow, and they are the reason this is a rule rather than a taste:

- **The derivation stays reviewable.** It is what `git diff` against the
  baseline has to show as unchanged, and it is the part a later feature must not
  re-invent. `dashboard()`'s seven-day series, height scaling and four delta
  sentences are 90 lines of it; the slice is six one-line stubs.
- **It stays tested.** Every legacy test about the arithmetic comes across by
  stubbing the repository, and **does not change** when the model lands — only
  the thing behind the stub does. F048 brought 22 of them that way.
- **Restoring it is one function body.** `newEnquiryCount` and
  `pendingListingCount` had already set this pattern; F048 added six more.

**Keep the shape the real query would return, not a simpler one.**
`previousWeekViews` answers `number | null` because Prisma's `_sum` is null for
an empty aggregate, and the dashboard renders the two differently — null is "no
data for last week", zero is a real week with no traffic, and flattening them
would print a fabricated −100% trend. A stub that returns `0` would have made
that bug impossible to see until F064.

And **assert the sliced state**. F048's last service test pins the zeros
explicitly, so they are a recorded decision rather than an accident — and it is
the test that should fail on the day the models arrive, which is exactly what is
wanted of it.

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
