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

Exactly one, and it is deliberate: **D1 removes the seeded database catalogue.**
Vehicle details come from the external RC lookup or manual entry instead.

The consequence is that the reconstruction is _not_ byte-identical to the
baseline, so the final convergence check is "the diff contains only the
sanctioned D1 divergence" rather than "the diff is empty". The exact permitted
hunks are tabulated in `docs/project/git-strategy.md` §5.

The risk this creates — facet fragmentation on unnormalised make/model strings —
is tracked at **F060** (normalisation moves to write time) and **F076** (search
facets). `CLAUDE.md` §5 has the detail. It is the single most likely place for
this reorganisation to quietly degrade the product, so it is worth reading
before F060.

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
