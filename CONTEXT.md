# CONTEXT.md

Engineering log and orientation for Dealers-Drive. Written for whoever — human or
agent — picks this up next.

Read this before changing anything in `apps/api`. It records **why** the code is
shaped the way it is, which decisions are load-bearing, which are provisional,
and where the known gaps are. The specs in [`docs/`](docs/) are the requirements;
this file is the state of the build against them.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the design, and the numbered
  rules the code and the linter both enforce
- [`docs/API-SPEC.md`](docs/API-SPEC.md) — every endpoint, keyed `A1…A15`,
  `B…`, `C1…C20`, `D1…D17`, `E…`
- [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md) — the visual system
- [`docs/CLAUDE.md`](docs/CLAUDE.md) — the build brief this was implemented from

---

## 1. What this is

A B2B2C used-car marketplace for Tamil Nadu (the seed models the Vellore
district). Independent dealers list inventory; buyers browse publicly with no
account. Only dealers and platform admins authenticate.

Three surfaces, one repo:

| Surface            | Path                                              | Who                                        |
| ------------------ | ------------------------------------------------- | ------------------------------------------ |
| Public marketplace | `/`, `/cars`, `/car/[slug]`, `/dealers`, `/saved` | anonymous buyers                           |
| Dealer console     | `/dealer/**`                                      | one dealership, resolved server-side       |
| Admin console      | `/admin/**`                                       | platform staff, cross-tenant, audit-logged |

## 2. Stack, and why each piece is not negotiable

| Layer     | Choice                                | Why it cannot be swapped casually                                                         |
| --------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Monorepo  | Turborepo + pnpm workspaces           | `packages/contracts` must be importable by both apps as source of truth                   |
| Web       | Next.js 15 App Router, RSC by default | public pages must be server-rendered for SEO                                              |
| Styling   | Tailwind v4 + CVA, Radix primitives   | design tokens live in `globals.css`; see §9 for the v4 syntax trap                        |
| API       | Express 5, modular monolith           | one deployable, transactional consistency for free                                        |
| DB        | PostgreSQL 16 + Prisma 6              | the invariants live in the database, not the app (§5)                                     |
| Jobs      | pg-boss on the same database          | real queue semantics, zero new infrastructure                                             |
| Contracts | Zod v4                                | one schema validates the request _and_ types the response _and_ generates the OpenAPI doc |

**Do not introduce** MongoDB, Redis, Elasticsearch, GraphQL, NestJS,
microservices, Redux or another global state manager. Every one of those was
considered and rejected in ARCHITECTURE; adding one silently re-opens a settled
decision.

## 3. The nine rules that everything else follows

These are from `docs/CLAUDE.md` and are the highest-value thing in this file.
Most of them are enforced mechanically; the notes say how.

1. **`dealerId` always comes from the session**, never from a body, query or
   path. _Enforced:_ no input schema in `packages/contracts` accepts `dealerId`,
   and every schema is `.strict()`, so sending one is a 400 rather than a silent
   success. Tested in `tests/tenant-isolation.test.ts`.
2. **All input goes through `.strict()` Zod.** An unknown field or query
   parameter is a 400 that _names_ the field. Silent ignoring hides client bugs
   for months.
3. **Money is `BigInt` paise.** No floats, in either direction. `pricePaise:
645000` is ₹6,450. Rupee conversion happens only at the UI boundary.
4. **Every credit movement writes a `CreditTransaction`** in the same
   transaction, with the dealer row locked `FOR UPDATE`. There is no
   `addCredits` and no `spendCredits` — there is `moveCredits(tx, {delta,
reason})`, exported through `billing.facade.ts`, and nothing else may write a
   balance.
5. **Listing status changes only through `transition(listing, event, actor)`.**
   `listing.status = …` outside `listings/listing.state.ts` is a bug. `status` is
   in no dealer-writable schema either, so the two facts together are the
   defence.
6. **Public visibility is one rule:** `listing.status === 'APPROVED' AND
dealer.status === 'ACTIVE'`, evaluated once in the `listing_search` read
   model. Every public count is derived from those same rows — no count is
   stored.
7. **A dealer's phone number never appears in an ordinary public response.** Only
   `POST /v1/vehicles/:id/reveal-contact` returns one, and it is rate-limited
   twice over and logged as a lead.
8. **Server components by default** in `apps/web`. `'use client'` needs a
   reason: an event handler, a browser API, or `localStorage`.
9. **No unnecessary `NEXT_PUBLIC_*`.** Build-once-promote-many stays intact.

## 4. Repository layout

```
apps/
  api/
    src/
      config/env.ts          validated, frozen env — reading process.env elsewhere is a bug
      container.ts           the composition root; `buildContainer(overrides)` is the test seam
      routes.ts              every mount point, in one file
      server.ts              express assembly; the middleware order IS the security model
      docs/                  OpenAPI generation (see §8)
      middleware/            request-context · auth · validate · rate-limit · error-handler
      modules/<name>/
        <name>.routes.ts     the ONLY file importing express in the module
        <name>.service.ts    all logic; never sees req/res
        <name>.repository.ts the ONLY file importing prisma in the module
        <name>.facade.ts     the ONLY file other modules may import
        <name>.docs.ts       the OpenAPI operations for this module
      platform/              db · events · jobs · storage · notify · payments · audit · config · telemetry
    prisma/
      schema.prisma          28 models; the invariants are here
      migrations/            3 migrations, applied in order
      seed/                  the world: 5 dealers, 23 vehicles, 18 live listings
    tests/                   8 files, 99 integration tests against a real database
  web/
    src/
      app/(public)/          marketplace
      app/(dealer)/dealer/   console
      app/(admin)/admin/     moderation
      app/api/               BFF handlers, only where the browser genuinely must fetch
      components/            ui primitives · vehicle · dealers · layout · forms
      features/              per-feature client components and server actions
      lib/                   api client · seo · client-ip · cn
      styles/globals.css     the design tokens
packages/
  contracts/                 Zod schemas + inferred types shared by both apps
  config/                    eslint + tsconfig presets
scripts/browse.mjs           CDP driver for headless visual QA
```

## 5. Where the invariants actually live

The database, not the application. This is deliberate — an app-level check is a
suggestion under concurrency.

- **`SELECT … FOR UPDATE`** on the dealer row inside `moveCredits`. Two
  concurrent submits from one dealer serialise instead of both reading a balance
  of 1 and both succeeding.
- **`CreditTransaction.seq BIGSERIAL`** is the append order. `createdAt` is not
  enough: Postgres gives every statement in one transaction the same `now()`, so
  two movements committed together would tie and the running balance could be
  read from the wrong row.
- **A partial unique index** permits one approved listing per vehicle.
- **`listing_search`** is a denormalized read model and the single place the
  visibility rule is evaluated. `search.index(listingId)` re-derives
  publishability from scratch and deletes the row when it fails, which is why
  suspending a dealer removes their cars and reinstating brings them back
  without re-approving anything.
- **`Dealer.creditBalance` is a read cache.** Every write path reads the balance
  from the newest ledger row and treats the column as untrusted.

## 6. What is bypassed or mocked, and what is not

One thing is still deliberately not real — the payment gateway. **It does not
weaken the security model**, and that distinction matters if you are about to
"finish" it.

### Authentication — real, as of r3

Dealers sign in with **Google** (OAuth 2.0 authorization code + PKCE + OIDC
nonce); admins sign in with an **email and an Argon2id password**. Both end in an
opaque `dd_session` cookie backed by a row in `sessions`, so revocation is an
UPDATE that takes effect on the very next request.

`SessionResolver` (`modules/auth/session.port.ts`) is still the seam, and now has
three implementations' worth of behaviour behind it:

- `CookieSessionResolver` — the real one. Cookie → session row → principal,
  rebuilt from the database on every request.
- `DevSessionResolver` — `AUTH_MODE=dev`, for a developer with no Google client.
  Refused in production, and it warns on every boot.
- the harness's switchable resolver, which is how tenant-isolation tests act as
  a different dealership.

Three properties are worth stating because everything else rests on them:

- **The account is the `sub`, not the email.** `OAuthIdentity` is unique on
  `(provider, providerSubject)`. The email is refreshed on every sign-in and is
  never used to find an account — matching on it would let an expired domain
  become somebody else's inventory. An unlinked email collision is refused with
  `ACCOUNT_LINK_REQUIRED` rather than silently merged.
- **A verified identity is not a tenant.** A Google account with no
  `DealerMember` row is a `PendingPrincipal`: a real session that can reach
  exactly one endpoint, `POST /v1/auth/onboarding`. It holds no permissions.
- **The two consoles are separate scopes.** `sessions.scope` is `DEALER` or
  `ADMIN`; a dealer's cookie cannot reach `/v1/admin/**` and an admin's cannot
  reach `/v1/dealer/**`, even for one human holding both seats.

What was already true, and still is:

- `requireDealer` → `requireDealerActive` → `requirePermission`, then the
  service re-checks ownership inside the transaction that writes. Both checks,
  always, so there is no TOCTOU gap between "you may" and "this row is yours".
- Repository methods take `dealerId` first, so an unscoped query is a type error.
- Cross-tenant reads answer **404, not 403**. A 403 confirms the id is real and
  is a slow enumeration oracle for a competitor with a list of guessed uuids.
- The §8.3 permission table, per operation rather than per role blanket.

The signature of `SessionResolver` offers **no way to pass an identity in** — the
request is available only so a cookie can be read from it. That property is what
makes tenant-isolation testing possible at all: a test swaps the resolver through
`buildContainer({ sessions })`, because there is no header it could set instead.
Sign-in itself is tested the same way, one seam lower: `buildContainer({ oauth })`
replaces Google, and everything above it — the transaction cookie, the state
check, the session row — runs unmodified (`tests/auth.test.ts`, 44 tests).

### Payments — the gateway only

`PAYMENT_PROVIDER=development` settles an order inline, through the same internal
function a Razorpay webhook will call. No gateway page, no second
implementation of "add credits". The credit _accounting_ is production-grade:
append-only ledger, row locking, materialised `balanceAfter`, GST invoice.

### Also console-only for now

`MailerPort` logs what would have been sent, which is enough to prove the outbox
fires and the lead-notification path is wired. Nothing in authentication depends
on it: Google verifies the address and there is no email OTP.

`SmsPort` has a real MSG91 adapter (`SMS_DRIVER=msg91`) written against the
documented API and unit-tested with a stubbed `fetch` — **never exercised against
a real account**, and DLT registration comes before the first send. `console` is
the local default. Mobile OTP is out of scope: onboarding collects a phone
number, nothing sends a code to it.

`StoragePort` has three deployments and two implementations: local disk, and one
S3 adapter serving both MinIO (`STORAGE_DRIVER=minio`) and Cloudflare R2
(`STORAGE_DRIVER=r2`). Local development runs on MinIO — the seed writes its
~100 images there — and the presign → PUT → commit contract is identical in all
three, including the signed content-type and content-length that make the commit
step's trust in what it finds well founded.

## 7. Test suite

`pnpm test` — 2 097 tests. Vitest, `pool: 'forks'`, `maxWorkers: 1`,
`fileParallelism: false`: the files share one database and a parallel run would
have two suites moving the same dealer's credits.

`apps/api/tests/` runs against a **real** `dealersdrive_test` database, dropped,
migrated and seeded once per run by `tests/global-setup.ts`. That is deliberate —
every invariant worth testing lives in the database (§5), and a mocked Prisma
would test the mock.

| File                                          | Tests | What it pins                                                                                                                                  |
| --------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant-isolation.test.ts`                    | 12    | Dealer A cannot reach B's vehicles, enquiries, media, ledger or presign — all 404, not 403                                                    |
| `credits.test.ts`                             | 9     | hold → consume/release; resubmit reuses the hold; refusal at zero; no negative balance; purchase → one row + invoice; cache equals newest row |
| `listing-lifecycle.test.ts`                   | 18    | the `transition` table as a unit, then double-approve/double-submit conflicts, forged `status`, takedown, mark-sold, catalogue-reference 404s |
| `public-visibility.test.ts`                   | 6     | rule 6 both ways incl. suspend/reinstate; rule 7 by scanning whole responses for every phone in the DB                                        |
| `errors.test.ts`                              | 19    | RFC 9457 shape, `.strict()` rejections, fractional paise, 401/403 per seat, documented errors                                                 |
| `rate-limit.test.ts`                          | 4     | limits turned back **on**, in its own module registry                                                                                         |
| `contracts.test.ts`                           | 24    | every response parsed through `packages/contracts`                                                                                            |
| `openapi.test.ts`                             | 12    | the document describes _this_ API, in both directions (§8)                                                                                    |
| `postman.test.ts`                             | 10    | the committed collection is regenerated and compared byte-for-byte — a route change without `pnpm docs:postman` fails here (§8.1)             |
| `packages/contracts/tests/formatting.test.ts` | 15    | `₹6.45 Lakh`, `02 Aug 2026`, `+91 98400 12345` — the forms DESIGN-SPEC §4.14 fixes                                                            |

**Two harness details worth knowing.** `tests/harness.ts` injects a switchable
`SessionResolver` and exposes `actAs(slug, role?)` — the role seam exists because
the permission table is only meaningfully tested from a seat that lacks the
permission. `h.drain()` runs the outbox to exhaustion; indexing and notification
are deliberately asynchronous, so a test that asserts on the catalogue must
advance the pipeline first.

## 8. The OpenAPI reference

`http://localhost:4000/api/docs` (UI), `/api/docs/openapi.json`,
`/api/docs/openapi.yaml`. 73 operations, 68 paths, 143 component schemas.

**The schemas are converted, not transcribed.** `docs/schemas.ts` runs
`z.toJSONSchema()` over every export of `packages/contracts` — the same schemas
`validate()` parses with. A renamed field cannot drift out of the reference
because there is no second copy to drift from.

Two conversions: `io: 'input'` for bodies/queries/params (pre-parse — a field
with a default is optional, `z.coerce.number()` accepts the string a query
string carries) and `io: 'output'` for responses (post-parse — defaults filled
in and therefore required). Getting that backwards documents `?limit=` as
required and `page.limit` as optional, exactly inverted. `INPUT_SCHEMA_NAMES` in
that file is the explicit partition; the builder throws if it names a schema
contracts no longer exports.

Per-operation prose lives in `modules/<name>/<name>.docs.ts`, beside the routes.
Everything derivable is derived: parameters expand from the schema, security
comes from the mount point, error bodies come from `docs/errors.ts`.

`tests/openapi.test.ts` guards both failure modes. Every documented operation is
called against the running app and must not reach the not-found middleware
(nothing invented); the Express router tree is walked to prove no route is
undocumented (nothing missed). **If you add a route, that test fails until you
document it.** That is the intended cost.

`DOCS_ENABLED` defaults off in production and under test.

### 8.1 The Postman collection

`docs/postman/dealers-drive.postman_collection.json` +
`…_environment.json` — 73 requests in 10 folders, 21 variables. Generated by
`pnpm docs:postman` (`src/docs/postman.ts`) from the OpenAPI document above, so
there is still only one description of the API.

It is **committed** so a tester can import it without running a build, and that
is exactly why `tests/postman.test.ts` regenerates it and compares byte-for-byte.
`serialise()` fixes the formatting (2-space JSON, trailing newline) so a no-op
regeneration is an empty diff. `generate-postman.ts` only writes when it is
`process.argv[1]` — importing it from the test must not write the file the test is
about to check, or the comparison is against itself.

Three things the generator does that a plain OpenAPI import does not:

- **`{id}` is not one variable.** `PATH_VARIABLES` maps each path pattern to a
  semantically named variable — `vehicleId`, `listingId`, `orderId`,
  `documentType`, `publicVehicleId`, `vehicleSlug`, `dealerSlug` — because a
  shared `{{id}}` sends a listing id to a vehicle endpoint. `CAPTURES` then fills
  them from real responses, so `Run all` works from a clean seed: the catalogue
  bundle supplies `makeId`/`modelId`/`colorId`/`cityId`, creating a vehicle fills
  `vehicleId`, submitting fills `listingId`.
- **Destructive requests run last, and `DELETE /v1/dealer/vehicles/{id}` points at
  `disposableVehicleId`, which nothing sets.** Both were learned the hard way: a
  full run deleted the draft the media and listing folders still needed. The
  delete is opt-in — paste an id into that variable when you mean it.
- **Every response is asserted against the error contract.** The collection-level
  test script requires any status ≥ 400 to be `application/problem+json` with
  `code`, `traceId`, a matching `status`, and no `stack`. That assertion is what
  found the bug in §10.6.

Optional query parameters are emitted `disabled: true` — the API is `.strict()`,
so an empty `?q=` is a filter for the empty string, not the absence of a filter.

Verified with `pnpm dlx newman run docs/postman/dealers-drive.postman_collection.json`:
73 requests, 101 assertions, 0 failures against a freshly seeded database
(50×200, 6×201, 3×204, 5×422, 4×409, 4×404, 1×400).

**Thirteen requests are non-2xx on a clean run and all thirteen are correct.**
`CLEAN_RUN_NOTES` appends the reason to each one's description, because a tester
who reads a 409 as a broken collection debugs the wrong thing — and trimming the
collection down to what goes green would hide a third of the state machine. The
recurring reasons: a collection cannot PUT the file a presign was issued for, so
both `commit` steps 422 `UPLOAD_MISSING` and the draft has no photos
(`TOO_FEW_PHOTOS`, then nothing to publish, mark sold or reorder); and the admin
folder approves a listing before the reject/request-changes requests reach it.

A run mutates the database — it buys credits, changes `listing.minPhotos`,
suspends and reinstates the dev dealer, deletes a KYC document — so re-seed
afterwards.

Note the shape of the one collection defect worth remembering: `{{listingId}}`
was empty for the whole inventory folder, because it was captured from
submit-for-review, which correctly 422s. The URL became `/v1/dealer/listings//renew`
and answered 404 — a *plausible* status hiding an empty variable. Captures now
support a `*` path segment (`data.*.listingId`: first array element where the rest
of the path resolves), so the id comes from the inventory list instead.

## 9. Traps that cost time, recorded so they cost it once

- **Tailwind v4 CSS variables.** `bg-(--var)` is the arbitrary-value syntax.
  The v3 shorthand `bg-[--var]` compiles silently and emits invalid CSS
  (`background-color: --color-ok-bg;`). 66 occurrences were fixed once; do not
  reintroduce it.
- **helmet's `Cross-Origin-Resource-Policy: same-origin`** blocks cross-origin
  image embedding. The media delivery route sends `cross-origin` — what a real
  R2/Cloudflare origin sends — on that route only. The JSON API keeps the strict
  default.
- **`'use server'` modules may only export async functions.** Constants shared
  with a server-action module go in a sibling file (see
  `features/enquiry/shared.ts`).
- **`.strict()` rejects `undefined`.** An action with no input must send `{}`,
  not nothing: several endpoints declare an all-optional body. `lib/api.ts`
  defaults non-DELETE bodies to `{}` for exactly this reason.
- **`apiSend` with no body silently 400s** if you bypass that default. This was
  a real bug: admin Approve did nothing at all.
- **A placeholder is page source.** The enquiry form's phone placeholder once
  matched a seeded dealer's real number. It is now `9876543210`.
- **Swagger UI needs a looser CSP** than the API. `docs.routes.ts` replaces the
  policy on that route only, same-origin throughout.
- **Express 5 compiles mount paths** into matcher functions and does not keep the
  string, so the full path cannot be recovered from the router tree. The
  OpenAPI coverage test works around this; see the comment there.
- **Stale processes squat on ports.** A two-day-old `node dist/index.js` on 4100
  cost real time during verification. Check `lsof -nP -iTCP:<port> -sTCP:LISTEN`
  before concluding a build is broken.

## 10. Bugs found and fixed during the build

Kept because each one is a class of mistake, not a one-off.

1. **Credit double-hold on resubmit.** A resubmission after
   `CHANGES_REQUESTED` took a _second_ `HOLD_SUBMIT`, so a dealer paid twice for
   one listing and `Dealer.creditsHeld` disagreed with the ledger. The surviving
   hold is the only thing separating "request changes" from "reject". Fixed in
   `vehicles.service.ts`; `credits.test.ts` exists for this.
2. **`.strict()` rejections did not name the field.** An unknown query parameter
   400'd with `field: "query"`. The whole point of `.strict()` is that the caller
   can find their typo, so `unrecognized_keys` now yields one
   `UNRECOGNIZED_KEY` error per stray key.
3. **Module boundaries were unenforced in practice.** ARCHITECTURE §5.5 rule 3
   mandates `*.facade.ts`; none existed and 26 imports reached into other
   modules' internals. The linter had been catching it all along — nobody had
   run `pnpm lint` at the root. Nine facades added; the cursor helpers and
   `mediaUrl` moved to `platform/`, since neither was ever module-owned.
4. **Tests and `prisma/seed` were outside every tsconfig `include`**, so they
   were neither typechecked nor type-lintable. Each package now has a checking
   project (`tsconfig.json`, src + tests, `noEmit`) and a narrower
   `tsconfig.build.json` that emits `dist`. This immediately surfaced a real
   seed bug under `noUncheckedIndexedAccess`.
5. **`/cars` could not prerender** — `useSearchParams` in the header with no
   Suspense boundary. The boundary now wraps the city chip alone.
6. **A client mistake was reported as a server fault.**
   `POST /v1/dealer/vehicles` with a `makeId` that does not exist reached Prisma
   and came back as an unhandled foreign-key error — a 500 with the failing query
   text attached, which is precisely the internal detail rule 9 forbids leaking.
   `findBrokenCatalogueRef` now checks the references first and 404s naming the
   field (`errors[0].field: "makeId"`). It checks **coherence**, not just
   existence: a real model id filed under the wrong make fails too, because
   ARCHITECTURE §6.2 constrains dealers to dropdowns for the reason that a Kia
   Seltos under Maruti Suzuki takes search, filters and SEO down with it. Found by
   the Postman run's error-contract assertion, not by a human reading responses —
   which is the argument for that assertion.

## 11. Known gaps

Honest list. Each is a deliberate stopping point, not an oversight.

| Gap                         | State              | Notes                                                                                                                                                                                                               |
| --------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL RLS**          | deferred           | Layers 1, 2 and 4 of the four-layer tenancy model are done and tested. `withTenant` already issues `SET LOCAL app.dealer_id`, so the policies have a hook waiting — the migration that creates them is not written. |
| **Razorpay adapter**        | not written        | `PaymentProvider` port exists with `DevelopmentPaymentProvider`. §12 has the plan.                                                                                                                                  |
| **Resend / MSG91 adapters** | not written        | `MailerPort`/`SmsPort` exist with console adapters.                                                                                                                                                                 |
| **R2 storage adapter**      | not written        | `StoragePort` exists with a local adapter implementing the same presign contract.                                                                                                                                   |
| **Sitemap `lastmod`**       | omitted            | ARCHITECTURE §17.4 wants an accurate one, but no public response carries a listing timestamp. The field is left out rather than fabricated.                                                                         |
| **Sentry**                  | TODO in place      | `error-handler.ts` has the marked call site.                                                                                                                                                                        |
| **`docs/MVP-SCOPE.md`**     | referenced, absent | ARCHITECTURE §5.5 carries the same numbered rules; the README now points there.                                                                                                                                     |

### One unexplained flake, recorded rather than buried

Two runs out of roughly thirty failed with a **401 on a public GET** —
`/v1/vehicles?limit=1` in `public-visibility.test.ts`, and
`/v1/vehicles/facets` in `contracts.test.ts` — where the same request had
returned 200 milliseconds earlier in the same file. It has not reproduced in 21
consecutive runs since (10 × `pnpm vitest run`, 6 more, 5 × root `pnpm test`).

What was ruled out, so nobody repeats it: only `requireDealer`/`requireAdmin`
construct a 401, and a probe confirmed a public read still returns 200 when the
session resolves to nothing (`actAs('no-such-dealer-slug')` → search 200, facets
200, `/v1/dealer/vehicles` 401). The public routers carry no guard, `validate()`
never calls `next('route')`, and the rate limiter answers 429, not 401 — so
falling through to the path-less `requireDealer` at `routes.ts:65` should not be
reachable for a matched public route. Env leakage is also out: `pool: 'forks'`
with `fileParallelism: false` gives each file a fresh process, so
`rate-limit.test.ts` setting `RATE_LIMIT_ENABLED` cannot reach another file.

If you see it again, capture the response body and the `x-trace-id` before doing
anything else — that is the missing evidence.

### One documented conflict between specs

ARCHITECTURE implies non-null `Vehicle` columns; API-SPEC's draft flow requires
them nullable (a draft is created with make/model/year and nothing else).
**Resolved in favour of API-SPEC** — drafting is otherwise unimplementable. This
is the only place two source-of-truth documents disagree, and it is worth a
decision from whoever owns the specs.

## 12. Roadmap

Ordered by what unblocks the most. Each entry says where the seam already is,
because in every case the abstraction exists and only the adapter is missing.

### 12.1 Authentication — what is left

Sign-in itself is done (§6). Three follow-ups, none of them blocking:

1. **Account linking.** A Google identity whose verified email already belongs to
   an account is refused with `ACCOUNT_LINK_REQUIRED` — deliberately, because
   merging on a matching string is a takeover primitive. What is missing is the
   *deliberate* path: an admin-initiated link, or a confirmation sent to the
   existing address. Until then, support links an account by inserting the
   `oauth_identities` row.
2. **Team seats.** `DealerMember` already carries `MANAGER` and `SALES`, and the
   permission table distinguishes them. There is no invite flow, so every
   dealership has exactly one member — the owner who signed up.
3. **CSRF tokens.** `SameSite=Lax` plus a CORS allow-list naming one origin is
   what protects state-changing routes today; API-SPEC §0.3 also specifies a
   double-submit `X-CSRF-Token`, which is not implemented. Worth adding before
   any third-party origin is allowed to call the API with credentials.

### 12.2 Razorpay

1. `platform/payments/razorpay.provider.ts` implementing `PaymentProvider`:
   `createOrder`, `verifyClientHandshake`, and a webhook verifier.
2. `POST /v1/webhooks/razorpay`, raw-body signature check. The `WebhookEvent`
   model already exists for idempotency: **INSERT the event first** — a
   duplicate delivery collides on `gatewayEventId` and is acknowledged without
   re-running anything.
3. Route the capture into the existing `settleCapturedPayment`. That function is
   already the only path that adds purchased credits; the development provider
   calls it inline today. Do not add a second one.
4. `settlement: 'deferred'` on the gateway response makes `verifyOrder` return
   **202** with `pollAfterSeconds` — that branch is already written and
   documented. Credits appear when the webhook lands, never because a client
   said so.
5. Refunds: `admin:payment:refund` exists in the permission table with no
   endpoint behind it.

### 12.3 Notifications

`Msg91Sms` exists behind `SmsPort` (`SMS_DRIVER=msg91`), written against MSG91's
documented API and unit-tested with a stubbed `fetch` — it has never sent a real
message, and India's DLT registration of the entity, sender header and every
template must land first. `ResendMailer` against `MailerPort` is still to write.

The handlers, the priorities (`notification.enquiry-to-dealer` is priority 100 —
it is the product) and the retry policy are already wired. Add a template layer;
the 30-second p95 target for the lead notification is in ARCHITECTURE §14.5.

### 12.4 Monitoring, logging and observability

Structured logging exists and is good: pino, one JSON line per event, a mixin
that stamps `traceId` (plus `userId`/`dealerId` after auth) on **every** line
emitted anywhere in a request, and a redact list covering `authorization`,
`cookie`, `set-cookie`, `*.password`, `*.passwordHash`. Nothing needs to
remember to pass a correlation id. What is missing is everywhere for those logs
to go and anything watching them:

1. **Error tracking.** `SENTRY_DSN` is accepted and validated by `env.ts`, and
   **no SDK is installed** — setting it today does nothing. Install
   `@sentry/node`, initialise it in `index.ts`, and report from the marked TODO
   in `error-handler.ts`. Tag with `traceId` so a report links to the log line.
   Only 5xx — a 422 `INSUFFICIENT_CREDITS` is not an exception.
2. **Log shipping.** Ship stdout to a hosted sink (Better Stack, Axiom,
   Datadog). Do not add a transport inside the process; the container's stdout
   is the interface.
3. **Metrics.** `/metrics` behind an allowlist, or push. The four that matter
   here: enquiry-notification latency (the product), moderation queue depth and
   age, credit-ledger drift (`Dealer.creditBalance` vs newest `balanceAfter` —
   should always be zero, and an alert on non-zero catches any future write path
   that bypasses `moveCredits`), and pg-boss failed-job count.
4. **Tracing.** OpenTelemetry, if a second service ever appears. The `traceId`
   in `request-context.ts` is the natural span id.
5. **Uptime.** Poll `/health/ready`, not `/health/live` — readiness names the
   failing dependency, liveness deliberately touches nothing.
6. **Job observability.** pg-boss keeps state in the `pgboss` schema. Surface
   failed and retrying jobs in the admin console; there is no visibility today.
7. **Audit log UI.** `admin:audit:read` and `GET /v1/admin/audit-logs` exist and
   are documented; the console has no screen for them yet.

### 12.5 Deployment

`apps/api/Dockerfile` exists — multi-stage, `NODE_ENV=production`, and its
`HEALTHCHECK` already polls `/health/ready`. Its `CMD` runs the API.

**There is no separate worker process yet.** Today `WORKER_INLINE=true` runs the
job handlers inside the HTTP process, which is what keeps `pnpm dev` a single
command; `env.WORKER` exists but only decides whether cron schedules are
registered. ARCHITECTURE §19.1 wants one image and two process types, so the
remaining work is a `worker.ts` entrypoint that builds the container, calls
`startBackground`, and never listens — plus a second service definition pointing
its `CMD` at it. Until then, scaling the API horizontally would run the job
handlers N times over.

Deploys should gate on `/health/ready`, and `prisma migrate deploy` must run
before the new image takes traffic.

### 12.6 Product work not started

Photo requests (`CreatePhotoRequestInput` and `photo:request` exist, no
endpoint), team members (`member:manage` exists, no endpoint), saved searches,
dealer analytics beyond the dashboard, buyer accounts (explicitly out of scope
in ARCHITECTURE), mobile and tablet layouts (the brief scoped this to desktop;
DESIGN-SPEC's breakpoints are implemented where they were cheap).

## 13. Working agreements

- **`pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass** before
  anything is called done. All four, at the root. Three of the five bugs in §10
  were found by running them for the first time.
- **Do not invent an endpoint.** If API-SPEC does not describe it, report the
  gap instead of filling it. The OpenAPI test enforces the converse — a route
  with no documentation fails the build.
- **Verify by running it, not by reading it.** `scripts/browse.mjs` drives
  headless Chrome over CDP for visual and interaction QA:
  `node scripts/browse.mjs <url> <out.png> [--width=1440] [--steps=steps.json]`,
  where a step is `{eval}`, `{wait}` or `{shot}`. It prints console errors.
  Note that headless Chrome may apply auto-dark-mode — check
  `getComputedStyle(document.body).backgroundColor` before believing a
  screenshot's colours.
- **Assign CDP eval helpers to `window.`**, not `const` — a second `eval` step
  in the same context otherwise fails with "already declared".
- **Commit on a branch.** `main` is the default branch; the history so far is
  `main` → `tests-and-module-boundaries` → `openapi-docs`.

## 14. Local database facts

`pnpm db:seed` builds a deterministic world: 5 dealers, 23 vehicles, 18 live
listings, 4 credit packs, and the dev dealer `sri-lakshmi-motors` with credits.
The credit ledger is **built, not asserted** — each dealer's balance is whatever
the chain of grants, purchases, holds and consumptions arrives at, because the
ledger is the truth.

Cities are Vellore-district (`vellore`, `katpadi`, `arcot`, `ranipet`,
`gudiyattam`) — there is **no `chennai`**, and `?city=chennai` legitimately
returns zero results. This looks like a bug and is not one.

The five dealerships: `sri-lakshmi-motors` (the dev dealer, and Dealer A in the
isolation tests), `velavan-cars` (Dealer B), `anbu-auto-hub`, `mrv-motors` — all
ACTIVE — and `gokul-cars`, which is `PENDING_APPROVAL` on purpose so the
verification queue and the `DEALER_NOT_ACTIVE` guard have something real to act
on.

**None of the seeded dealers can sign in with Google.** Their email addresses are
fictional, so nobody owns the Google account behind them, and the seed creates no
`oauth_identities` row. The first real dealer on a fresh database is whoever
presses "Continue with Google" and completes onboarding — which is also the way
to see the new-dealer path. `AUTH_MODE=dev` is the shortcut into
`sri-lakshmi-motors`'s console without any of that.

The one seeded account that *can* sign in is the admin: `DEV_ADMIN_EMAIL` with
`DEV_ADMIN_PASSWORD`, hashed with Argon2id at seed time. Change the variable and
re-seed to rotate it; the plaintext is never stored, logged or returned.
