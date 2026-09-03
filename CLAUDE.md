# CLAUDE.md — Dealers-Drive

> **Read this before touching anything. It is the operating manual for every
> session on this repository.**

---

# 0. THE ONE THING TO UNDERSTAND FIRST

**This is not a greenfield build. You are not designing this product.**

Dealers-Drive is **already built, already working, and already tested** — about
38,000 lines of application source with 97.74 % API test coverage. That
implementation exists, in full, at:

```
tag     baseline/pre-reorg-2026-09-02      (annotated, immutable)
branch  legacy/pre-reorg                   (same commit, f05acdc)
remote  legacy-origin  →  https://github.com/shashikiran6sk/Dealers-Drive.git
```

What this repository is doing is **restructuring that working code into a clean,
reviewable, feature-by-feature history**. The original repo grew by way of a few
enormous commits — one of them, `decc10c`, contains 208 files and +42,525 lines
and covers most of the product. It is unreviewable and unbisectable. So the code
is being re-delivered, unchanged, in 97 small slices that a human can actually
review.

**Therefore, for every feature you implement:**

| ❌ Do NOT                                       | ✅ DO                                                |
| ----------------------------------------------- | ---------------------------------------------------- |
| Design the feature from scratch                 | Read the legacy implementation and port it           |
| Invent schemas, routes, props or component APIs | Extract the ones that already exist                  |
| "Improve", refactor or modernise while porting  | Reproduce it faithfully; note improvements for later |
| Guess at behaviour                              | `git show legacy/pre-reorg:<path>` and read it       |
| Write new tests from imagination                | Bring the existing tests across with the code        |

If you find yourself writing an implementation and you have **not** read the
legacy version of that file, you are doing it wrong. Stop and go read it.

### How to read the legacy code

```bash
# the file tree at the baseline
git ls-tree -r --name-only legacy/pre-reorg -- apps/api/src/modules/dealers

# any file's exact legacy contents
git show legacy/pre-reorg:apps/api/src/modules/dealers/dealers.service.ts

# bring a file across verbatim
git checkout legacy/pre-reorg -- apps/api/src/modules/dealers/dealers.service.ts

# what a feature branch has changed relative to the baseline
git diff baseline/pre-reorg-2026-09-02 HEAD -- <paths>
```

`git checkout legacy/pre-reorg -- <path>` is the primary tool of this project.
Most feature work is: read the feature-map entry, check out exactly the files it
lists, resolve what does not compile yet, bring the tests, verify, open a PR.

---

# 1. The source of truth

Everything about _what_ to build and _in what order_ lives in `docs/project/`:

| Document                                                                 | Use it for                                                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/project/feature-map.md`](docs/project/feature-map.md)             | **Start here.** The decision log (D1–D3), then 97 features across 14 tiers. Each entry lists its exact files, API routes, DB models, tests, components and dependencies. |
| [`docs/project/component-map.md`](docs/project/component-map.md)         | All 65 UI components — props, states, consumers, coupling, sandbox priority                                                                                              |
| [`docs/project/component-sandbox.md`](docs/project/component-sandbox.md) | How the component sandbox is built and how it gates UI work                                                                                                              |
| [`docs/project/git-strategy.md`](docs/project/git-strategy.md)           | Branching, the init commit, risk register, the verification gate                                                                                                         |

`docs/screens/` and `docs/Dealers-Drive-UI/` are the original visual references.

**The previous specification files** — `docs/ARCHITECTURE.md`, `docs/API-SPEC.md`,
`docs/DESIGN-SPEC.md`, `docs/CLAUDE.md`, `docs/ENGINEER-ONBOARDING.md`,
`docs/DEPLOYMENT.md` — are **not in this repository any more**. They were the
brief for the original build, and that build is done. They remain readable at the
baseline whenever you need the original reasoning:

```bash
git show legacy/pre-reorg:docs/ARCHITECTURE.md
git show legacy/pre-reorg:docs/API-SPEC.md
git show legacy/pre-reorg:docs/DESIGN-SPEC.md
```

The load-bearing rules from those documents are reproduced in §4 below, so you
do not need to fetch them for ordinary work.

---

# 2. The workflow for every feature

```
 1  READ THE FEATURE ENTRY
       docs/project/feature-map.md → the F-number, its files, its dependencies
       Confirm every dependency has already merged.
       ↓
 2  READ THE LEGACY IMPLEMENTATION
       git show legacy/pre-reorg:<each file the entry lists>
       Understand it before you move it.
       ↓
 3  AUDIT THE UI IT NEEDS                              (UI features only)
       List every component the feature renders.
       ↓
 4  SEARCH THE SANDBOX FIRST                           (UI features only)
       apps/sandbox/src/registry.ts — by name, alias and category
       docs/project/component-map.md
       pnpm sandbox — look at it running
       ↓
 5  REUSE OR EXTEND — NEVER DUPLICATE
       Exists and fits              → reuse it
       Exists and nearly fits       → extend it with a prop, document consumers
       Genuinely new                → create it, with a sandbox entry
       ↓
 6  PORT THE CODE
       git checkout legacy/pre-reorg -- <the feature's files>
       Resolve only what does not compile yet. Change nothing else.
       ↓
 7  BRING THE TESTS ACROSS
       The feature-map entry names them. They already exist and already pass.
       ↓
 8  VERIFY
       pnpm lint && pnpm typecheck && pnpm test && pnpm build
       git diff baseline/pre-reorg-2026-09-02 HEAD -- <the feature's files>
         → empty, or every difference explained in the PR description
       ↓
 9  OPEN A PR — and stop.
       A human reviews. A human merges. Never you.
```

## Step 8 is the gate that makes this safe

The reconstruction is **the same code, re-delivered in reviewable slices**. Any
difference that is not deliberate and explained is a bug the reorganisation
introduced. The diff is how it gets caught. Put the diff, or the explanation of
it, in every PR description.

---

# 3. Git rules — absolute

```
NEVER push feature work directly to main
NEVER merge your own PR
NEVER approve your own PR
NEVER bypass human review
NEVER force-push any branch
NEVER rewrite Git history
NEVER delete an unmerged branch
NEVER modify branch protection or repository settings
NEVER touch the legacy/pre-reorg branch, the baseline tag, or legacy-origin
```

The **only** commit ever pushed directly to `main` is
`chore: initialize project`, and it has already happened. Everything after it is
a pull request.

| Remote          | Points at                                             | Use                                     |
| --------------- | ----------------------------------------------------- | --------------------------------------- |
| `origin`        | `https://github.com/shashikiran6sk/DealersDrive.git`  | the reconstruction — all new work       |
| `legacy-origin` | `https://github.com/shashikiran6sk/Dealers-Drive.git` | read-only history. **Never push here.** |

**Branch naming:** `feat/f001-contracts-foundation` — the F-number, then the
feature-map title in kebab-case.

**Commit messages:** Conventional Commits, with the F-number in the body and a
line stating what the change is relative to the baseline.

---

# 4. Engineering invariants

These carried the original build and they carry the reconstruction. They came
from the now-removed `docs/ARCHITECTURE.md` and `docs/CLAUDE.md`; they are
reproduced here so they survive. Most are enforced mechanically.

1. **`dealerId` always comes from the session** — never from a body, query or
   path. No input schema in `packages/contracts` accepts `dealerId`, and every
   schema is `.strict()`, so sending one is a 400 rather than a silent success.
2. **All input goes through `.strict()` Zod.** An unknown field or query
   parameter is a 400 that _names_ the field. Silent ignoring hides client bugs
   for months.
3. **Money is `BigInt` paise.** No floats, in either direction. `pricePaise:
645000` is ₹6,450. Rupee conversion happens only at the UI boundary.
4. **Every credit movement writes a `CreditTransaction`** in the same
   transaction, with the dealer row locked `FOR UPDATE`. There is no
   `addCredits` and no `spendCredits` — there is `moveCredits(tx, { delta,
reason })`, exported through `billing.facade.ts`, and nothing else may write
   a balance.
5. **Listing status changes only through `transition(listing, event, actor)`.**
   `listing.status = …` outside `listings/listing.state.ts` is a bug. `status`
   is in no dealer-writable schema either; the two facts together are the
   defence.
6. **Public visibility is two rules, and the split is load-bearing.**
   _Membership_ of `listing_search`: `listing.status IN ('APPROVED','SOLD') AND
dealer.status === 'ACTIVE'`. _Availability_: `is_sold = false`. Both are
   evaluated once, in the read model. A sold car stays on the marketplace —
   greyed, badged, unclickable, sorted last — because a dealer who moves stock
   should be seen to; it is not stock, so **every count means available** and
   `buildWhere` adds `is_sold = false` unless a caller opts out.
7. **A dealer's phone number never appears in an ordinary public response.**
   Only `POST /v1/vehicles/:id/reveal-contact` returns one, and it is
   rate-limited twice over and logged as a lead.
8. **Server components by default** in `apps/web`. `'use client'` needs a
   reason: an event handler, a browser API, or `localStorage`.
9. **No unnecessary `NEXT_PUBLIC_*`.** Build-once-promote-many stays intact.
10. **Anything counted across requests goes through the `CachePort`**, never a
    module-level `Map`. `env.ts` refuses `CACHE_DRIVER=memory` in production. A
    counter in process memory is correct for one process and silently N times
    too permissive behind N tasks — and since a phone reveal costs an SMS, the
    limiter is a spend control as much as a security one.

**The RC lookup port is a privacy boundary.** Owner name, address, phone,
chassis and engine number are dropped _before_ the domain object is
constructed — not filtered later. `RcSpecs` is immutable and cached 30 days;
`RcRecords` holds mutable claims and is cached 24 hours. `UNKNOWN` must never
collapse to `CLEAR`.

**Do not introduce** MongoDB, Redis, Elasticsearch, GraphQL, NestJS,
microservices, Redux or another global state manager. Each was considered and
rejected during the original build; adding one silently re-opens a settled
decision.

---

# 5. The one place you must NOT copy the legacy code

**Decision D1 — the seeded database catalogue is removed.** Vehicle details now
come from the external RC lookup or from manual entry. See
`docs/project/feature-map.md` §D1 for the full entry.

This is the single deliberate divergence from the baseline. These do **not**
come across:

- `Make`, `Model`, `Variant`, `Color`, `Rto` Prisma models and their enums
- `apps/api/src/modules/catalog/**`
- `GET /v1/catalog/bundle`, `GET /v1/catalog/models/:id/variants`
- `apps/api/prisma/seed/catalog/**` (~5,000 lines)
- the `CatalogBundle` contract and the web BFF proxy route for variants

Six components change shape as a result — `VehicleWizard`, `RegistrationStep`,
`BasicsStep`, `BasicsFields`, `DetailsFields` and `Combobox`. The D1 impact
table at the end of `docs/project/component-map.md` says exactly how.

**What survives D1 and must be ported unchanged:** `City` and `GET /v1/cities`
(F026), `GET /v1/config/public` (F029), and
`apps/api/src/platform/rc/rc-aliases.ts` — a committed constant mapping VAHAN
maker strings to brands, not a catalogue table.

⚠️ **The risk D1 creates.** Without a catalogue, make/model/variant become free
text, and facets will fragment: `Maruti`, `Maruti Suzuki` and
`MARUTI SUZUKI INDIA LTD` become three separate values. Normalisation therefore
moves to **write time** (F060), and manual entry needs a suggest-existing-values
guard rail. Do not defer this to F076 and hope.

---

# 6. Definition of done

A feature is done when **all** of these are true:

```
☐ Every file the feature-map entry lists is present
☐ git diff against the baseline is empty, or every difference is explained
☐ The legacy tests for the feature are present and passing
☐ pnpm lint · pnpm typecheck · pnpm test · pnpm build all green
☐ No new dependency that the baseline did not already have
```

and, for anything with UI:

```
☐ The sandbox was searched before any component was created
☐ Every component the feature renders has a sandbox entry
☐ Meaningful props exposed as controls; relevant states rendered
☐ The sandbox scenario was verified by eye
☐ Screenshot attached to the PR
```

**A component that exists only inside a feature implementation, with no sandbox
entry, is not done.** The sandbox is the discovery mechanism, and discovery
failure is what produced the current state: 75 % of buttons in the product
bypass the `Button` component, and `.table` was hand-rolled five separate times.

---

# 7. Stack

| Layer     | Choice                                       | Why it is not negotiable                                  |
| --------- | -------------------------------------------- | --------------------------------------------------------- |
| Monorepo  | Turborepo + pnpm workspaces                  | `packages/contracts` must be importable by both apps      |
| Web       | Next.js 15 App Router, RSC by default        | public pages must be server-rendered for SEO              |
| Styling   | Tailwind v4 `@theme` + CVA, Radix primitives | tokens live in `globals.css`                              |
| API       | Express 5, modular monolith                  | one deployable, transactional consistency for free        |
| DB        | PostgreSQL 16 + Prisma 6                     | the invariants live in the database, not the app          |
| Jobs      | pg-boss on the same database                 | real queue semantics, zero new infrastructure             |
| Contracts | Zod v4                                       | one schema validates the request _and_ types the response |

Node 22, TypeScript 5.9, pnpm 9.15.9.

---

# 8. Current position

The reconstruction is at the very beginning:

- ✅ `chore: initialize project` — scaffolding, tooling, docs. On `main`.
- ⏭️ **F001 — Contracts package foundation** is the first feature PR.
- Then F002 → … → F097, in the tier order in `feature-map.md`.

Note the tier order that D3 produced: **CI/CD is Tier 3 (F021–F025)**,
immediately after F018 _Dealer sign-in with Google OAuth_ — the first commit at
which a person can open a browser, click a button and be signed in. Until F021
lands there are no Dockerfiles, no workflows and no `deploy/`, and the `app:*`
scripts in `package.json` are inert. `pnpm infra:up` (Postgres, MinIO, Mailpit)
works from the init commit onward.
