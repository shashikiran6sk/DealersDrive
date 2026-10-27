# AGENTS.md — Dealers-Drive

> **The operating manual for everyone who changes this repository — people and
> coding agents alike. Read it before touching anything.** It is the only
> instruction file: there is no `CLAUDE.md`, `.cursorrules` or second copy to
> keep in step. Task-shaped guides live in `.claude/skills/` (§9).

---

# 0. What this is

Dealers-Drive is a B2B2C used-car marketplace for Tamil Nadu, live at
[www.dealers-drive.com](https://www.dealers-drive.com). Independent dealers list
their inventory; buyers browse publicly without an account and send enquiries;
an admin console approves dealerships and moderates listings.

It is a Turborepo + pnpm monorepo:

| Path                 | What it is                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| `apps/api`           | Express 5 modular monolith — one deployable, Prisma on PostgreSQL, pg-boss jobs       |
| `apps/web`           | Next.js 15 App Router — public marketplace, dealer console, admin console, BFF routes |
| `apps/sandbox`       | Storybook component sandbox — every UI component has an entry here                    |
| `packages/contracts` | Zod schemas both apps speak; the single source of every request and response shape    |
| `packages/config`    | Shared ESLint, TypeScript and Tailwind configuration, including the custom lint rules |
| `deploy/`            | AWS (ECS behind one ALB, Terraform) and the single-box demo deployment                |
| `observability/`     | Grafana Cloud dashboards and alert rules                                              |

---

# 1. Where things are

## On `main`

| Document                                         | Use it for                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                      | This manual                                                                                                                                           |
| [`docs/code/README.md`](docs/code/README.md)     | **Why the code is the way it is.** Every note that was once a comment in `apps/*/src`, on a page mirroring the source path. Walk down from the index. |
| [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md)     | What the product looks like. UI work cites it by section.                                                                                             |
| [`docs/errors.md`](docs/errors.md)               | Every API error code and what the client does with it                                                                                                 |
| [`docs/observability.md`](docs/observability.md) | Metrics, logs, dashboards and production alerts                                                                                                       |
| [`docs/seo.md`](docs/seo.md)                     | Metadata, sitemaps and structured data                                                                                                                |
| [`docs/legal/`](docs/legal)                      | The legal v1 review and its manifest                                                                                                                  |
| [`deploy/README.md`](deploy/README.md)           | Deployment, with the AWS setup in `deploy/aws/README.md`                                                                                              |
| `.claude/skills/`                                | Step-by-step guides for the common tasks (§9)                                                                                                         |

## On the `docs` branch

History and process documents live on the
[`docs` branch](https://github.com/shashikiran6sk/DealersDrive/tree/docs), not
on `main`. They explain how the product was planned, built and certified; none
of them is needed to build or run it.

| Document on `docs`                                                                                                      | Read it when                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [CONTEXT.md](https://github.com/shashikiran6sk/DealersDrive/blob/docs/CONTEXT.md)                                       | Before a refactor or anything surprising — the engineering log of gotchas and decisions (§7a–§8e) |
| [docs/project/feature-map.md](https://github.com/shashikiran6sk/DealersDrive/blob/docs/docs/project/feature-map.md)     | Building an F-number not yet delivered — its files, routes, models, tests and dependencies        |
| [docs/project/progress.md](https://github.com/shashikiran6sk/DealersDrive/blob/docs/docs/project/progress.md)           | Asking which features are built                                                                   |
| [docs/project/component-map.md](https://github.com/shashikiran6sk/DealersDrive/blob/docs/docs/project/component-map.md) | Designing a UI change — the components' props, states and consumers                               |
| [docs/qa/production-release/](https://github.com/shashikiran6sk/DealersDrive/tree/docs/docs/qa/production-release)      | The pre-production certification: test registry, defect register, evidence                        |
| [docs/original-spec/](https://github.com/shashikiran6sk/DealersDrive/tree/docs/docs/original-spec)                      | The original architecture, API and deployment specifications                                      |
| [docs/screens/](https://github.com/shashikiran6sk/DealersDrive/tree/docs/docs/screens)                                  | The original screen designs                                                                       |

From a checkout, read them without switching branch:

```bash
git fetch origin docs
git show origin/docs:CONTEXT.md
git show origin/docs:docs/project/feature-map.md
git ls-tree -r --name-only origin/docs
```

The `docs` branch's `README.md` indexes everything on it.

---

# 2. The workflow for every change

```
 1  UNDERSTAND WHAT IS THERE
       The docs/code page for every file you will touch.
       CONTEXT.md on the docs branch, for the gotchas.
       A new F-number: its feature-map entry on the docs branch, and its dependencies.
       ↓
 2  AUDIT THE UI IT NEEDS                              (UI changes only)
       List every component the change renders.
       ↓
 3  SEARCH THE SANDBOX FIRST                           (UI changes only)
       apps/sandbox/src/registry.ts — by name, alias and category
       pnpm sandbox — look at it running
       ↓
 4  REUSE OR EXTEND — NEVER DUPLICATE
       Exists and fits              → reuse it
       Exists and nearly fits       → extend it with a prop, check its consumers
       Genuinely new                → create it, with a sandbox entry
       ↓
 5  IMPLEMENT, WITH TESTS
       Tests beside the code, in the same PR. A bug fix starts with a failing test.
       ↓
 6  DOCUMENT IN THE SAME PR
       Reasoning      → the docs/code page that mirrors the source path (§4b)
       A route        → its OperationSpec in the module's *.docs.ts (§4a)
       ↓
 7  VERIFY
       pnpm lint && pnpm typecheck && pnpm test && pnpm build
       ↓
 8  OPEN A PR — and stop.
       A human reviews. A human decides the merge.
```

The `verify-change` skill is step 7 with the details; `add-api-route` and
`add-ui-component` cover steps 2–6 for the two commonest changes.

---

# 3. Git rules — absolute

```
NEVER push feature work directly to main
NEVER merge a PR unless the repository owner has told you to merge that PR
NEVER approve your own PR
NEVER bypass human review
NEVER force-push a shared branch
NEVER rewrite published Git history
NEVER delete an unmerged branch
NEVER modify branch protection or repository settings
```

Everything that reaches `main` is a pull request, squash-merged.

**Branch naming:** a type, the ticket, then a kebab-case title —
`feat/f050-credit-ledger`, `fix/bug-113-fresh-search-results`,
`chore/repo-restructure`.

**Commit messages:** Conventional Commits (`feat(web): …`, `fix(api): …`,
`docs: …`), with the F- or BUG-number in the body when there is one.

**CI** runs on every PR: `lint · typecheck · test · build`, `dependency audit`
(`pnpm audit --audit-level=critical`), `semgrep`, `gitleaks` and
`terraform fmt / validate`. A PR is mergeable when all of them are green on its
current head and it is up to date with `main`.

---

# 4. Engineering invariants

These carried the original build and they carry every change since. Most are
enforced mechanically.

1. **`dealerId` always comes from the session** — never from a body, query or
   path. No dealer-facing input schema in `packages/contracts` accepts
   `dealerId`, and every schema is `.strict()`, so sending one is a 400 rather
   than a silent success.
2. **All input goes through `.strict()` Zod.** An unknown field or query
   parameter is a 400 that _names_ the field. Silent ignoring hides client bugs
   for months.
3. **Money is `BigInt` paise.** No floats, in either direction. `pricePaise:
645000` is ₹6,450. Rupee conversion happens only at the UI boundary.
4. **Every credit movement writes a `CreditTransaction`** in the same
   transaction, with the dealer row locked `FOR UPDATE`. There is no
   `addCredits` and no `spendCredits` — there is one `moveCredits(tx, { delta,
reason })`, exported through the billing facade, and nothing else may write a
   balance. (Billing is not built yet; this is the rule it is built to.)
5. **Listing status changes only through `transition(…)`** in
   `apps/api/src/modules/listings/listing.state.ts`. `listing.status = …`
   anywhere else is a bug. `status` is in no dealer-writable schema either; the
   two facts together are the defence.
6. **Public visibility is two rules, and the split is load-bearing (R71).**
   Both require a public slug and an `ACTIVE` dealership.
   - **Visible** — listing status `ACTIVE` or `RESERVED`: what may appear. Only
     the result list and the vehicle page use it. A reserved car is shown
     greyed, badged, unclickable and sorted last.
   - **Available** — listing status `ACTIVE`: what a buyer can act on. **Every
     count means available** — facets, the response's `available`,
     suggestions, the directory's and the district dialog's car counts — and
     so does the enquiry guard.

   A `SOLD` or `WITHDRAWN` car is on no public surface at all. The rules are
   `PUBLIC_VISIBLE_LISTING_WHERE` / `PUBLIC_AVAILABLE_LISTING_WHERE` in
   `apps/api/src/modules/search/search.repository.ts`, and
   `isListingPubliclyVisible` / `isListingAvailable` in contracts for code that
   holds a status rather than a query. `listingWhere` defaults to
   `'available'`, so a new count written without thinking counts stock.

7. **A dealer's phone number never appears in an ordinary public response.**
   The one route allowed to return it is `POST /v1/vehicles/:id/reveal-contact`
   — not built yet; when it is, it is rate-limited twice over and logged as a
   lead.
8. **Server components by default** in `apps/web`. `'use client'` needs a
   reason: an event handler, a browser API, or `localStorage`.
9. **No unnecessary `NEXT_PUBLIC_*`.** Build-once-promote-many stays intact.
10. **Anything counted across requests goes through the `CachePort`**, never a
    module-level `Map`. `apps/api/src/config/env.ts` refuses
    `CACHE_DRIVER=memory` in production. A counter in process memory is
    correct for one process and silently N times too permissive behind N tasks
    — and since an OTP costs an SMS, the limiter is a spend control as much as
    a security one.
11. **Every route is documented in the same PR that mounts it.** A module's
    endpoints live in its `*.docs.ts` beside its routes, and the module is
    listed in `MODULES` in `apps/api/src/docs/openapi.ts`.
    `apps/api/tests/unit/docs/openapi.test.ts` walks the assembled Express
    router and fails when a mounted route has no operation, or an operation has
    no route. See §4a.

**The RC lookup port is a privacy boundary** (when it lands). Owner name,
address, phone, chassis and engine number are dropped _before_ the domain
object is constructed — not filtered later. `RcSpecs` is immutable and cached 30
days; `RcRecords` holds mutable claims and is cached 24 hours. `UNKNOWN` must
never collapse to `CLEAR`.

**Do not introduce** MongoDB, Redis, Elasticsearch, GraphQL, NestJS,
microservices, Redux or another global state manager. Each was considered and
rejected; adding one silently re-opens a settled decision.

---

# 4a. The API reference is part of the feature, not a follow-up

**If your PR mounts, changes or removes a route, it updates the OpenAPI
document in the same PR.** There is no separate documentation ticket.

The reference is served at `/api/docs` (Swagger UI), with the raw document at
`/api/docs/openapi.json` and `/api/docs/openapi.yaml`. It is on outside
production and off inside it, by `DOCS_ENABLED`.

## What to write, and where

| You did this                         | Do this too                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Added a route to an existing module  | Add an `OperationSpec` to that module's `*.docs.ts`                                                                               |
| Added a whole module                 | Create `<module>.docs.ts`, then add it to `MODULES` in `src/docs/openapi.ts` **and** `DOC_TAGS`/`TAG_ORDER` in `src/docs/tags.ts` |
| Added a params/query/body Zod schema | Add its export name to `INPUT_SCHEMA_NAMES` in `src/docs/schemas.ts`                                                              |
| Changed a response shape             | Nothing — response schemas are generated from `packages/contracts`                                                                |
| Removed a route                      | Remove its operation, or the test fails in the other direction                                                                    |

## What you must not write

**Do not hand-transcribe a schema.** `components.schemas` is generated from
`@dealers-drive/contracts` — the same Zod objects `validate()` parses with — so
a renamed field cannot drift out of the reference, because there is no second
copy of it to drift from.

Likewise, do not restate the shared truths per operation. The security
requirement comes from the mount point (`audience`), the parameter list is
expanded from the same schema the route validates with, and every error body
comes from `src/docs/errors.ts`.

## Why it is enforced by a test

`openapi.test.ts` asks the question mechanically, in both directions:

- a **mounted route with no operation** — the PR that added it skipped the docs
- an **operation with no mounted route** — the docs describe something removed

The second matters as much as the first: a reference listing an endpoint that
404s is worse than one that omits it, because a client writes code against it.

`buildOpenApiDocument()` additionally throws at startup on a duplicate
`operationId`, a path parameter the params schema does not declare, and an
`INPUT_SCHEMA_NAMES` entry contracts no longer exports.

---

# 4b. Code layout — where a thing goes

These are the shapes the code is already in. They are cheap to keep and
expensive to restore: the sandbox exists because `Button` was once bypassed
75 % of the time and `.table` was hand-rolled five times, and both of those
started as one file that was slightly too hard to find.

## Components

**Every React component has its own folder**, named for the component in
kebab-case:

```
components/ui/button/
  index.ts              the barrel — this is what callers import
  button.tsx            the main component, and nothing else
  button-link.tsx       a second component gets a second file
  button.variants.ts    the cva table and buttonClass
  spinner.tsx           a private sub-component still gets its own file
```

`index.ts` is what makes this cheap: `@/components/ui/button` keeps working
whatever the folder is rearranged into.

**A component file contains its component.** When a second one appears beside
it, it moves to its own file in the same folder and is re-exported from the
barrel. `apps/web/src/components/dealers/dealer-card/` is the shape to copy.

## Routes — one per file

**An API route lives in its own file.** `<module>.routes.ts` keeps its export
and becomes the list:

```
modules/admin/
  admin.routes.ts          createAdminRouter — the ROUTES array, in order
  routes/
    route.ts               the module's RouteRegistrar alias
    handle.ts              a wrapper the module's routes share
    get-dealers.ts         one file, one route
    patch-dealer.ts
    post-dealer-approve.ts
```

The file is named for the verb and the path it answers, and it exports one
registrar: `(router, deps) => { router.post('/dealers/:id/approve', …); }`.
**The array in `<module>.routes.ts` is the registration order**, and order is
load-bearing — Express matches in it — so a new route goes in the position it
would have been mounted, not at the end.

A helper two routes share goes in its own file beside them, never back into the
aggregator. Adding a route is: one new file, one import, one line in the array,
and its `OperationSpec` in the module's `*.docs.ts` (§4a).

## Helpers, types and constants

| What                                       | Where it goes                                         |
| ------------------------------------------ | ----------------------------------------------------- |
| A helper only this component uses          | `<component>/utils.ts`                                |
| A helper two components could use          | `apps/web/src/lib/` — this repo's utils folder        |
| A type only this component uses            | `<component>/<component>.types.ts`, or inline if tiny |
| A type two components or features share    | `apps/web/src/types/`                                 |
| A shape the API and the web app both speak | `packages/contracts` — never a second copy            |
| Repeated strings, limits, routes, lookups  | `<component>/<component>.constants.ts`                |
| A sentence more than one API module says   | `apps/api/src/platform/messages.ts`                   |
| A sentence one API module says             | `<module>.messages.ts` beside it                      |

`apps/web/src/lib/` **is** this repo's utils folder, and there is deliberately
no second one. Check it before writing a helper.

**Do not hardcode user-facing text inside a `return`.** A label, a placeholder,
an `aria-label`, an error sentence, a confirmation — it goes in the constants
file as a named value, and a value that takes an argument is a function there
(`removeLabel: (service: string) => …`).

## Types

**Use a type or an interface wherever it makes a contract clearer or reusable**,
and keep it local when it is not reused.

**No new `any`, ever** — `@typescript-eslint/no-explicit-any` is an error with
no exemption. `unknown` plus a narrowing check is the answer wherever a value
genuinely is unknown.

**No new `as` assertions.** `@typescript-eslint/consistent-type-assertions` is
set to `assertionStyle: 'never'`. Reach for a type guard (`isRecord`,
`errorCode` in `apps/api/src/platform/errors.ts`), a Zod parse
(`apiGetParsed`), or a narrowing helper instead. Two exemptions:

- **Tests and stories** may assert.
- **A genuine boundary** — a JSON body, a Prisma `Json` column, an environment
  variable, a library that types its own callback as `never` — carries a
  `// eslint-disable-next-line @typescript-eslint/consistent-type-assertions --`
  with the reason on the same line.

## Comments — there are none

**`src` carries no prose.** Not a docblock, not a one-liner, not a `//` at the
end of a line. What a file does is the code; **why** it does it is a page under
[`docs/code`](docs/code/README.md), addressed by the source path it came from.
`dealers-drive/no-comments` is an ESLint error on `src/**`.

**The one exception is a toolchain directive** — `eslint-disable`,
`@ts-expect-error`, `prettier-ignore`, a coverage pragma. Inside JSX a
directive still needs its `{/* … */}` container.

**When you would have written a comment, write the page instead.** Find the file
under `docs/code` that mirrors the source folder, add a `###` heading naming the
declaration, and put the reasoning under it. The `write-code-notes` skill has
the details.

## Refactors preserve behaviour

A refactor changes where code lives, not what it does. The test suite passing
unchanged is the evidence, and a refactor that needed a test edited is a
refactor that changed something — say which, in the PR, or put it back.

---

# 5. Decision D1 — there is no vehicle catalogue

Vehicle details come from the RC lookup or from manual entry. There are no
`Make`, `Model`, `Variant`, `Color` or `Rto` tables, no catalogue module and no
catalogue bundle endpoint, and none should be added. What stays is `City` and
`GET /v1/cities`, and `GET /v1/config/public`.

⚠️ **The risk D1 creates.** Without a catalogue, make, model and variant are
free text, and facets fragment: `Maruti`, `Maruti Suzuki` and
`MARUTI SUZUKI INDIA LTD` become three values. Normalisation therefore happens
at **write time**, in one place, and manual entry carries a
suggest-existing-values guard rail. The reasoning is D1 in the feature map and
§7 of `CONTEXT.md`, both on the `docs` branch.

---

# 6. Definition of done

A change is done when **all** of these are true:

```
☐ Tests for the change are present and passing
☐ pnpm lint · pnpm typecheck · pnpm test · pnpm build all green
☐ The reasoning is in docs/code, not in a comment
☐ No new dependency without saying why in the PR
```

and, for anything that mounts or changes an API route:

```
☐ Every route the change adds has an operation in the module's *.docs.ts
☐ A new module is in MODULES (src/docs/openapi.ts) and DOC_TAGS + TAG_ORDER (src/docs/tags.ts)
☐ A new params/query/body schema is in INPUT_SCHEMA_NAMES
☐ tests/unit/docs/openapi.test.ts is green — it fails in both directions
☐ The operation was read in Swagger UI at /api/docs, not just compiled
```

and, for anything with UI:

```
☐ The sandbox was searched before any component was created
☐ Every component the change renders has a sandbox entry
☐ Meaningful props exposed as controls; relevant states rendered
☐ The sandbox scenario was verified by eye
☐ Screenshot attached to the PR
```

**A component that exists only inside a feature, with no sandbox entry, is not
done**, and **a route that works and is undocumented is not done.** The sandbox
and the generated reference are the discovery mechanisms; discovery failure is
what they exist to prevent.

---

# 7. Stack

| Layer     | Choice                                       | Why it is not negotiable                                  |
| --------- | -------------------------------------------- | --------------------------------------------------------- |
| Monorepo  | Turborepo + pnpm workspaces                  | `packages/contracts` must be importable by both apps      |
| Web       | Next.js 15 App Router, React 19, RSC default | public pages must be server-rendered for SEO              |
| Styling   | Tailwind v4 `@theme` + CVA, Radix primitives | tokens live in `globals.css`                              |
| Sandbox   | Storybook 10                                 | the component index every UI change searches first        |
| API       | Express 5, modular monolith                  | one deployable, transactional consistency for free        |
| DB        | PostgreSQL 16 + Prisma 7                     | the invariants live in the database, not the app          |
| Jobs      | pg-boss on the same database                 | real queue semantics, zero new infrastructure             |
| Contracts | Zod v4                                       | one schema validates the request _and_ types the response |
| Hosting   | Vercel (web) · AWS ECS behind one ALB (API)  | build once, promote the same image                        |

Node 24 (LTS), TypeScript 5.9, pnpm 9.15.9.

---

# 8. What a PR updates — and what it must not

| File                           | Updated by a PR to `main`?                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `docs/code/**`                 | **Yes** — the page mirroring every source file whose reasoning changed                                                       |
| a module's `*.docs.ts`         | **Yes** — whenever a route is added, changed or removed                                                                      |
| `apps/sandbox/src/registry.ts` | **Yes** — whenever a component is added                                                                                      |
| `AGENTS.md`                    | **Almost never.** A change to the rules is a decision needing its own discussion and its own PR — not a side effect          |
| `README.md`                    | Almost never. It orients a newcomer                                                                                          |
| anything on the `docs` branch  | **Not in the same PR.** Progress, the feature map, the component map and `CONTEXT.md` are updated by a separate PR to `docs` |

**Do not add progress statements to prose.** "F001 is the first feature PR" was
true for about a day. `git log` and the `docs` branch's `progress.md` are the
record; a sentence in a document is a copy that goes stale silently.

---

# 9. Skills

Task-shaped guides, in `.claude/skills/<name>/SKILL.md`. Claude Code loads
them as skills; any other agent or person can read them as plain Markdown.

| Skill                  | Use it to                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `verify-change`        | Run the same gate CI runs, locally, before pushing                                        |
| `add-api-route`        | Add or change an Express route: one file per route, its Zod schema, its OpenAPI operation |
| `add-ui-component`     | Find, extend or create a UI component, with its sandbox entry and story                   |
| `write-code-notes`     | Put the reasoning for a change in `docs/code` instead of a comment                        |
| `read-project-history` | Find the plan, the engineering log, the certification and the original specs on `docs`    |

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
