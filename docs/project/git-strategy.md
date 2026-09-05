# Git Analysis, Scaffolding, Risk and the Future Workflow

Audit at `f05acdc`. **No Git operation of any kind was performed.** No branch,
no commit, no tag, no push, no fetch that mutates state.

> **Revised for decisions D1, D2 and D3.** See the decision log at the top of
> `feature-map.md`. In short: the seeded database catalogue is removed (**D1**),
> the feature breakdown went from 27 to **97 features across 14 tiers** (**D2**),
> and **CI/CD moved to Tier 3** — immediately after the first dealer-facing
> feature (**D3**). D1 is the one that changes this document materially: the
> final convergence gate in §5 is no longer _"the diff must be empty"_.

---

## 1. Current Git state

|                     |                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Current branch**  | `main`                                                                                                               |
| **Current HEAD**    | `f05acdc7dadc7f0ad0eb23cac798c31e0e47202c` — _"Merge pull request #23 from shashikiran6sk/rc-lookup-vehicle-intake"_ |
| **Commits on HEAD** | **34**                                                                                                               |
| **Working tree**    | **clean** — `git status --short` is empty                                                                            |
| **Tags**            | **none**                                                                                                             |
| **Local branches**  | 12 — `main` plus 11 stale feature branches                                                                           |
| **Remote branches** | 24 — the same 11, `main`, `HEAD`, and **11 open Dependabot branches**                                                |
| **Remote**          | `https://github.com/shashikiran6sk/Dealers-Drive.git`                                                                |
| **Author**          | one — `shashikiran6sk <shashikiran6.sk@gmail.com>`                                                                   |

### Do existing commits represent meaningful features?

**Mostly no.** The history is 34 commits for ~38,000 lines of application code,
and the size distribution tells the story:

| Commit    | Message                                             | Files   | Insertions  |
| --------- | --------------------------------------------------- | ------- | ----------- |
| `decc10c` | `frontend and backend`                              | **208** | **+42,525** |
| `b2af3d8` | `added_deploy_management_scripts_and_format`        | 210     | +14,170     |
| `2956773` | `Dockerfile`                                        | 8       | +8,632      |
| `94d97b6` | `RC Lookup`                                         | 73      | +8,631      |
| `c067890` | `added google auth`                                 | 101     | +8,118      |
| `4d51a4a` | `Learning docs`                                     | 23      | +7,913      |
| `582efb5` | `Added postman script`                              | 12      | +5,884      |
| `95434b0` | `fixed cars catalogue and sold cars card component` | 57      | +5,419      |
| `b9fd2ee` | `init`                                              | 56      | +11,481     |

`decc10c` alone contains the entire frontend and backend — roughly F014
through F092 of the 97-feature scheme landed in one commit. It is unreviewable
and unbisectable.

**Three commits are genuinely feature-shaped** and are worth studying as
templates for the reconstruction:

- `94d97b6` **RC Lookup** — one vertical slice: adapter, port, routes, schema,
  UI, tests. This is very close to the target PR shape.
- `8c350e0` **Add OpenAPI 3.0 documentation and Swagger UI at /api/docs** — one
  concern, named precisely.
- `be2e743` **Add the test suite, enforce module boundaries, fix two bugs** —
  one concern with an honest message.

Six commits are noise: `ea533e6 trigger ci`, `894d6e0 chore: trigger build`,
`9e37401 unit tests` (0 insertions, 0 deletions), `549f0a8 removed codeql`,
`efe2798 fix image upload`, `d94c09f fix vehicle does not exists`.

### Should history be preserved?

**Yes — preserved, and not rewritten.**

- It is the only record of _when_ and _why_ things happened, and several
  commits contain reasoning that exists nowhere else.
- The 23 merged PRs are referenced from GitHub. Rewriting `main` orphans every
  one of them.
- 11 open Dependabot branches are based on the current `main`. A history rewrite
  invalidates all of them.
- The user's own constraint stands: **never rewrite history unless explicitly
  instructed in a future phase.**

The reconstruction should therefore be **additive**, not destructive — see §5.

### Should a baseline tag be created?

**Yes, and it is the first thing to do in Phase 2.** Recommended:

```text
git tag -a baseline/pre-reorg-2026-09-02 f05acdc \
  -m "Full working system before the feature-by-feature reconstruction."
git push origin baseline/pre-reorg-2026-09-02
```

The repository has **zero** tags today. There is no named point to return to and
no way to say "the version that worked" without quoting a SHA. A tag is free,
immutable, and it is the safety net that makes everything in §5 reversible.

**Not done in this phase** — it is a Git mutation, and Phase 1 is read-only.

### Risks of reconstructing history

| Risk                                                  | Severity     | Note                                                                                                                     |
| ----------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Losing working code while splitting a 42k-line commit | **CRITICAL** | Mitigated entirely by the additive strategy in §5                                                                        |
| Orphaning 23 merged PR references                     | HIGH         | Only if `main` is rewritten. Do not rewrite.                                                                             |
| Invalidating 11 open Dependabot branches              | MEDIUM       | Same                                                                                                                     |
| Intermediate commits that do not build                | MEDIUM       | Each reconstructed PR must pass CI on its own — this is the hard part and the reason for the tiering in `feature-map.md` |
| Losing the reasoning in existing commit messages      | MEDIUM       | Preserved by keeping the old history reachable                                                                           |
| Merge conflicts on shared files                       | HIGH         | See §4 — `routes.ts`, `schema.prisma`, `container.ts`, `globals.css`                                                     |
| Divergence between reconstructed and real code        | HIGH         | Every reconstructed PR must be diffed against `f05acdc` before merge                                                     |

### Existing PR workflow

**A PR workflow already exists and is being followed.** 23 merged PRs, feature
branches per change, merge commits on `main`. The gap is not process — it is
**granularity** (PRs of 200 files) and **naming** (`minor_fixes`,
`added_deploy_management_scripts_and_format`).

**Only two commits ever landed on `main` outside a PR** — verified with
`git log --first-parent --no-merges main`:

- `b9fd2ee` `init`
- `decc10c` `frontend and backend` (208 files, +42,525)

Everything since `decc10c` arrived through one of the 23 merged PRs. Commits
that _look_ like direct pushes in `git log --oneline` — `ea533e6 trigger ci`,
`894d6e0 chore: trigger build`, `168841c Billing fix` — are on second parents,
i.e. they were pushed to a feature branch and merged. So the PR discipline is
better than the commit messages suggest.

### Branch protection

**Not detectable from this machine.** The `gh` CLI is not installed
(`command not found: gh`), and the audit will not add software or make network
calls to find out.

**What is detectable, and what it does not prove:**
`.github/workflows/ci.yml` runs on `pull_request: branches: [main]` **and**
`push: branches: [main]`. The push trigger fires on merge commits too, so it is
_not_ evidence that direct pushes are allowed. Equally, `decc10c` landed
directly — but that was at the very start of the project, before the PR
workflow existed.

**Conclusion: unknown, and it must be established rather than assumed.** Check
with `gh api repos/shashikiran6sk/Dealers-Drive/branches/main/protection`, or in
Settings → Branches. There is no `CODEOWNERS` file, which is the one piece of
review enforcement that _is_ verifiable from the repository, and it is absent.

### Does CI enforce PRs?

**CI runs; whether it blocks is a repository setting, not a workflow one.**
The `verify` job (lint · typecheck · test · build against a real Postgres 16),
`docker` (both images build from a clean context), `terraform` and `audit` all
run on every PR. Whether a red run _prevents_ a merge depends on required-status
checks in branch protection — see above. There is no `CODEOWNERS` file, so no
review is required by the repository itself.

### Required before Phase 2

1. Tag `baseline/pre-reorg-2026-09-02` at `f05acdc`.
2. Enable branch protection on `main`: require PRs, require the `verify` and
   `docker` checks, require ≥1 approval, block force-push, block deletion.
3. Add `CODEOWNERS`.
4. Decide what to do with the 11 stale local/remote feature branches (all
   merged; safe to delete after the tag exists).
5. Triage the 11 Dependabot PRs before starting, so they do not conflict with
   reconstruction work.

Item 2 is what mechanically makes _"Claude never pushes to `main`"_ true rather
than merely promised.

---

## 2. Architecture summary

**Dealers-Drive** — a B2B2C used-car marketplace for Tamil Nadu. Dealers list
their own inventory; buyers browse without an account; dealers spend credits on
metered actions; the platform never owns a vehicle.

```text
pnpm + Turborepo monorepo (Node 24, TypeScript 5.9, pnpm 9.15.9)

apps/
  api/    Express 5 modular monolith  ·  ~21,200 LOC src  ·  97.7 % coverage
          ├── src/modules/     12 feature modules, each routes/service/
          │                    repository/facade/docs
          ├── src/platform/    30 files — db, cache, storage, rc, notify,
          │                    payments, events, jobs, telemetry, audit
          ├── src/middleware/  7 — auth, validate, rate-limit, request-context,
          │                    request-logger, error-handler, not-found
          ├── src/routes.ts    the single mount table; the whole authz model
          └── prisma/          27 models, 27 enums, ~5,350 LOC incl. seed

  web/    Next.js 15 App Router (React 19, Tailwind v4)  ·  ~14,100 LOC src
          ├── src/app/(public)/   9 routes    — marketplace
          ├── src/app/(dealer)/   8 routes    — dealer console
          ├── src/app/(admin)/    8 routes    — admin console
          ├── src/app/(auth)/     4 routes    — sign-in & onboarding
          ├── src/app/api/        9 BFF proxy routes
          ├── src/components/    19 files — the reusable layer
          ├── src/features/      36 files — feature UI + server actions
          └── src/styles/globals.css — the design-token + component CSS layer

packages/
  contracts/  Zod schemas — one definition per request/response  · 100 % coverage
  config/     shared tsconfig + eslint presets

Infrastructure
  docker-compose (postgres · minio · mailpit · api · web · seed)
  GitHub Actions: ci · release · promote · security · _deploy
  Terraform → AWS ECS Fargate behind an ALB, two services
```

**Four architectural properties that matter for the reorganisation:**

1. **Module boundaries are enforced**, not aspirational. Every API module has
   the same five-file shape, and `routes.ts` is the only mount point. Feature
   extraction on the API side is genuinely tractable.
2. **Contracts are shared and validated at both ends.** The same Zod schema
   validates the request in Express and the form in the browser.
3. **State is in the URL, not in a store.** Filters, sort and search are
   `searchParams`. There is no Redux, no Zustand, no global client state except
   `SavedCarsProvider` (localStorage) and one React Query client.
4. **`components/ui/` knows nothing about the domain** — verified. That is what
   makes the sandbox buildable bottom-up, and what keeps `packages/ui` open as a
   future move (ARCHITECTURE §16.4).

---

## 3. Scaffolding — what belongs in `chore: initialize project`

The principle: **project foundation + developer tooling, never application
features.**

### Include

```text
Workspace & tooling
  package.json (root)              pnpm-workspace.yaml
  pnpm-lock.yaml                   turbo.json
  .npmrc                           .nvmrc
  .gitignore  .dockerignore        .prettierrc.json  .prettierignore
  packages/config/**               tsconfig presets + eslint presets
  apps/api/tsconfig{,.build}.json  apps/api/eslint.config.mjs
  apps/web/tsconfig.json           apps/web/eslint.config.mjs
  apps/web/next.config.ts          apps/web/postcss.config.mjs
  packages/contracts/tsconfig*.json + eslint.config.mjs

Package manifests (dependencies only; no feature source)
  apps/api/package.json  apps/web/package.json  packages/contracts/package.json

Testing infrastructure (harness, no tests)
  apps/api/vitest.config.ts        apps/web/vitest.config.ts
  packages/contracts/vitest.config.ts
  apps/web/tests/setup.ts          apps/web/tests/stubs/server-only.ts
  apps/api/tests/{global-setup,harness,fixtures,auth-harness,router-probe}.ts

Local infrastructure
  docker-compose.yml               apps/api/Dockerfile  apps/web/Dockerfile
  .env.example
  scripts/app-up.sh                scripts/check-docs.mjs

CI/CD
  .github/workflows/{ci,release,promote,security,_deploy}.yml
  .github/dependabot.yml           .gitleaks.toml  .semgrepignore
  deploy/**  (terraform, nginx, systemd, release.sh, bootstrap.sh)

Base folder structure (empty or minimal)
  apps/api/src/{index,server,container,routes}.ts   ← wired, no feature routers
  apps/api/src/config/env.ts
  apps/api/src/middleware/**                        ← the 7 middleware
  apps/api/src/platform/{errors,telemetry,db}/**    ← the shared runtime
  apps/api/prisma/schema.prisma                     ← datasource + generator ONLY
  apps/web/src/app/layout.tsx                       ← root layout
  apps/web/src/lib/cn.ts
  packages/contracts/src/index.ts                   ← empty barrel

Documentation & agent context
  README.md  CONTEXT.md
  docs/{ARCHITECTURE,API-SPEC,DESIGN-SPEC,CLAUDE,DEPLOYMENT,ENGINEER-ONBOARDING}.md
  docs/screens/**  docs/Dealers-Drive-UI/**
  docs/project/**                 ← this audit
  CLAUDE.md at the repo root      ← the workflow rules in §7
```

### Exclude — these are features

```text
✗ apps/web/src/styles/globals.css beyond @import 'tailwindcss' + @theme tokens
  → the .btn/.card/.input/.tag/.blueprint component layer is F009–F013
✗ every apps/api/src/modules/** except health          → F014 onward
✗ apps/api/prisma/schema.prisma models and enums       → each feature adds its own
✗ apps/api/prisma/seed/**                              → F097 (and see D1 below)
✗ every apps/web/src/{components,features}/**          → F007 onward
✗ every apps/web/src/app route except layout.tsx       → per feature
✗ packages/contracts/src/* except index.ts             → F001
✗ apps/api/src/docs/**                                 → F096
✗ every test file                                      → ships with its feature

Note on `prisma/seed/**`: under **D1** the catalogue seed
(`prisma/seed/catalog/**`, ~5,000 LOC) is not reconstructed at all. It is not
deferred to a later feature — it is dropped. Only the non-catalogue seed data
returns, at F097. Lift its make/model vocabulary into the sandbox mocks first
(`component-sandbox.md` §8); after the reconstruction it is the only record of
what real values look like.
```

### The one genuinely debatable line: `globals.css`

`globals.css` is 694 lines: `@theme` tokens (~80), `@layer base` (~80),
`@layer components` (~475 — every `.btn`, `.card`, `.input`, `.tag`,
`.blueprint`, `.table`, `.dialog`), `@layer utilities` (~50).

**Recommendation: split it.** Tokens + base go in the init commit — they are the
design foundation and nothing renders without them. The component layer belongs
to **F007 (design tokens & base stylesheet)** and **F009–F013 (the primitives)**,
alongside the React components that wrap it. Anything else means the init commit
ships the styling for components that do not exist for another dozen PRs.

### Should the sandbox be in the init commit?

**No. Recommend a dedicated PR immediately after — before F007.**

| Argument                                                                                                                         | For init | For a separate PR |
| -------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------- |
| It is developer tooling, and the principle says tooling belongs in init                                                          | ✅       |                   |
| The init commit is the only direct push to `main` — it must be small enough to eyeball                                           |          | ✅                |
| The sandbox is ~300 packages and a framework decision that deserves review                                                       |          | ✅                |
| An empty sandbox with zero stories proves nothing and cannot be reviewed                                                         |          | ✅                |
| The first sandbox PR should land **with** the primitives it displays, so a reviewer can run `pnpm sandbox` and see something     |          | ✅                |
| The lockfile / Dockerfile interaction (§11 of the sandbox doc) needs a CI run to validate — you want that on a PR, not on `main` |          | ✅                |

**Recommended sequence:**

```text
chore: initialize project              (direct push to main — the ONLY one)
   │
   ├── PR → chore: component sandbox   (S0: harness only)
   │
   ├── PR → feat: shared contracts     (F001)
   ├── PR → feat: api bootstrap        (F002–F006)
   ├── PR → feat: design tokens        (F007 — tokens + base layer)
   ├── PR → feat: ui primitives        (F009–F013, each with its stories = S1)
   └── PR → …                          then Tier 2, then CI/CD at Tier 3
```

The sandbox PR lands first because F009's definition of done _requires_ a
sandbox entry. Building the gate before the first thing that must pass through
it is the ordering that makes the rule real from day one instead of retrofitted.
S0 (harness) ships alone; S1 (the 16 primitive stories) ships _inside_ the
F009–F013 PRs rather than as a separate sandbox PR, which is what "the sandbox
is part of the definition of done" means in practice.

---

## 4. Risk assessment

### CRITICAL

| Risk                                               | Detail                                                                                                                                                                                            | Mitigation                                                                                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Splitting a working 42k-line system**            | `decc10c` contains most of the product in one commit. Any per-feature split risks losing behaviour that nothing tests — and the web layer has 13.83 % coverage, so most UI behaviour is untested. | Additive reconstruction (§5). Every reconstructed PR is diffed against `f05acdc`. The final state must differ from it **only by the sanctioned D1 and D6 divergences** — see the verification gate below. |
| **`prisma/schema.prisma` — 27 models in one file** | Every full-stack feature must add models to the same file. 20 PRs all editing one 1,010-line file.                                                                                                | Strict tier order (`feature-map.md`). Rebase, never merge, while a feature branch is open. Accept that migrations must be regenerated per feature.                                                |

### HIGH

| Risk                                               | Detail                                                                                                                 | Mitigation                                                                                                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes.ts`                           | Every API feature adds a mount line. Guaranteed conflict on 12+ PRs.                                                   | Trivial conflicts, but constant. Rebase before every push.                                                                                                                              |
| `apps/api/src/container.ts`                        | Every module registers here. Same shape.                                                                               | Same                                                                                                                                                                                    |
| `apps/web/src/styles/globals.css`                  | 475 lines of component CSS spread across F007 and every feature that added a class.                                    | Land tokens and base in F007, the component layer in F009–F013. Later features add only what is genuinely new.                                                                          |
| `apps/api/src/modules/vehicles/vehicles.routes.ts` | Serves F063 (wizard/CRUD), F065 (submission & transitions) and F067 (sold/remove/renew). Three features, one file.     | F063 first; F065 and F067 edit it.                                                                                                                                                      |
| `apps/api/src/modules/admin/admin.routes.ts`       | 245 lines, 21 routes, 4 concerns.                                                                                      | **Ship F070 as one PR.** Splitting it produces four PRs fighting over one file for no reviewer benefit. Its siblings F044, F045, F054, F069, F071 and F072 add routes to it afterwards. |
| `apps/api/src/modules/dealers/*`                   | F036–F046 all touch `dealers.routes.ts` and `dealers.service.ts` — eleven features, two files.                         | F036 introduces both. F037–F046 amend, strictly in order. This is the single most conflict-prone sequence in the plan and the strongest argument for the rebase-never-merge rule.       |
| `apps/api/src/modules/search/search.routes.ts`     | Serves F076 (search & facets), F082 (VDP), F084 (similar), F085/F086 (directory & portfolio), F087 (saved-cars batch). | F076 first; the rest edit.                                                                                                                                                              |
| **`Button` bypassed 88 times**                     | 75 % of buttons in the product do not go through the component (29 `<Button>` vs 88 raw `className="btn …"`).          | Do **not** fix during reconstruction — it would make every feature PR a mixed-purpose diff. One mechanical PR afterwards.                                                               |
| **Five DESIGN-SPEC components exist only as CSS**  | `.table` hand-rolled 5×, `.input` 70×, `.card` 32×.                                                                    | Sandbox step S6. Not during reconstruction.                                                                                                                                             |
| **13.83 % web coverage**                           | Any UI reconstruction is unverified by tests.                                                                          | This is the argument for building the sandbox _before_ F009, not after.                                                                                                                 |

### MEDIUM

| Risk                                                                                                                  | Detail                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `useSavedCars()` throws outside its provider — couples 5 components to F087                                           | Sandbox decorator; do not restructure                                        |
| `vdp-cta.tsx` is the only `components/` file importing a server action                                                | Documented as D-5; do not fix during reconstruction                          |
| F082 ↔ F089 mutual reference (VDP renders `EnquiryForm`; the form only exists for the VDP)                            | F089 first with a bare harness page                                          |
| F041 ↔ F033 (KYC upload shares the media presign pipeline)                                                            | F033 first — Tier 5 already precedes Tier 6, so the tier order resolves this |
| F073 ↔ F087 (the header renders the saved-cars badge)                                                                 | F073 first, badge stubbed at zero; F087 wires it                             |
| `VehicleCard` / `VehicleRow` internal duplication                                                                     | Two sandbox scenarios make it visible                                        |
| Three unused production dependencies (`react-hook-form`, `@hookform/resolvers`, `@radix-ui/react-popover`)            | Separate cleanup PR                                                          |
| Adding `apps/sandbox` changes `pnpm-lock.yaml`; both Dockerfiles use `--frozen-lockfile` with partial manifest copies | Watch the first CI run; one-line fix if needed                               |

### LOW

- Empty directories (`docs/startup-pitch/`, `docs/mobile-handoff/mock/*`, `.storage-test/`)
- Dead CSS (`.dialog`, `.tag-draft`, `.tag-expired`, `.tag-sold`)
- Unused `ButtonLink` export
- `StatusTone` vs `Banner.tone` divergence
- `dealer-card.tsx` exports `DirectoryCard` (naming)

### Features that cannot be cleanly separated

| Pair                                    | Why                                                        | Decision                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F063 / F065 / F067                      | one route file, one service, one state machine             | F063 introduces; F065 and F067 amend                                                                           |
| F036 … F046                             | one dealers service, one route file, eleven features       | F036 introduces; the rest amend in strict order                                                                |
| F076 / F082 / F084 / F085 / F086 / F087 | one search route file                                      | F076 introduces; the rest amend                                                                                |
| F070 internals                          | 21 routes, 4 concerns, one file                            | **do not split**                                                                                               |
| F058 / F068                             | share the Attestr adapter and the credit-charge path       | F058 introduces the adapter; F068 reuses                                                                       |
| F038 / F039 / F041 / F042               | four wizard steps, one shell, one completeness calculation | F037 introduces the shell; F043 lands after F041 because completeness cannot be computed until documents exist |

### Components that cannot be isolated without a decorator

`VehicleCard`, `VdpCtaStack`, `RevealContactButton`, `CustomerHeader`,
`SavedCarsList` (C-1) · `EnquiryInbox` (C-2) · 17 components reading
`next/navigation` (C-3) · 20 files calling server actions (C-4) ·
`DocumentUploader`, `PhotoUploader`, `SavedCarsList` (C-5).

All are solvable with the four decorators in `component-sandbox.md` §8. **None
requires changing application code.**

---

## 5. Recommended Git strategy

### The principle: additive, never destructive

Do **not** rewrite `main`. Do **not** rebase 34 commits into 25. The existing
history stays exactly where it is, reachable, with its PR references intact.

Instead, build the clean history **forward** from a new root and let the two
converge:

```text
main (existing, 34 commits, f05acdc)
  │
  ├─ tag baseline/pre-reorg-2026-09-02          ← safety net, do this first
  │
  └─ chore: initialize project                  ← the ONE direct push to main
        │                                          (an orphan-rooted commit,
        │                                           or a scaffolding-only commit
        │                                           on top of main — see below)
        ├── PR #24 → chore: component sandbox     (S0 harness)
        ├── PR #25 → feat: shared contracts       (F001)
        ├── PR #26 → feat: api bootstrap          (F002–F006)
        ├── PR #27 → feat: design tokens          (F007)
        ├── PR #28 → feat: web app shell          (F008)
        ├── PR #29 → feat: ui primitives          (F009–F013, with stories)
        ├── …        Tier 2 — identity            (F014–F018)
        ├── …        Tier 3 — CI/CD               (F021–F025)  ← see D3
        └── …                                     one PR per feature, in tier order
```

### Two ways to place the init commit — pick one, deliberately

**Option A — orphan branch, promoted later (recommended).**

```text
git switch --orphan reconstruction
# stage only the scaffolding from §3
git commit -m "chore: initialize project"
git push -u origin reconstruction
```

Every feature PR targets `reconstruction`. `main` is untouched throughout. When
the reconstruction is verifiably identical to `f05acdc`, `reconstruction`
becomes the new `main` in **one deliberate, human-executed** operation.

- ✅ `main` always points at working, deployable code
- ✅ CI can run against both
- ✅ Nothing is irreversible until the final swap
- ⚠️ Two long-lived branches for the duration
- ⚠️ The final swap is a force-update of `main` — **a human does this, never Claude**

**Option B — scaffolding commit on top of `main`.**

Push `chore: initialize project` directly onto `main` and open feature PRs
against it.

- ✅ One branch, simpler
- ⚠️ `main` temporarily holds both the old code and a scaffolding commit that
  contradicts it
- ⚠️ Much harder to abandon halfway

**Recommendation: Option A.** It is the only one where "stop and revert" remains
free at every point.

### Verification gate for every reconstructed PR

```text
1. pnpm lint · pnpm typecheck · pnpm test · pnpm build   all green
2. CI green (verify + docker)
3. git diff baseline/pre-reorg-2026-09-02 <branch> -- <the feature's files>
   → empty, or every difference explained in the PR description
      and attributable to a logged decision (D1)
4. Sandbox verification for UI features
5. Screenshots for UI features
6. HUMAN REVIEW
7. HUMAN MERGE
```

Step 3 is the one that makes this safe. The reconstruction is not a rewrite —
it is the _same code_, re-delivered in reviewable slices. Any unexplained
difference is a bug introduced by the reorganisation, and the diff is how it
gets caught.

### Final convergence — amended by D1 and D6

The original gate was _"the diff must be empty."_ **Decision D1 removes the
seeded database catalogue** and **decision D6 removes the `cities` table**, so
the reconstruction is deliberately no longer byte-identical to `f05acdc`. The
gate becomes:

```text
git diff baseline/pre-reorg-2026-09-02 reconstruction -- apps/ packages/
```

must contain **only the sanctioned D1 and D6 divergences**, and nothing else.

**D1 — the seeded database catalogue:**

| Expected difference                                                           | Where                           |
| ----------------------------------------------------------------------------- | ------------------------------- |
| `Make`, `Model`, `Variant`, `Color`, `Rto` models + their enums deleted       | `apps/api/prisma/schema.prisma` |
| `modules/catalog/**` deleted                                                  | `apps/api/src/modules/`         |
| `GET /v1/catalog/bundle`, `GET /v1/catalog/models/:id/variants` unmounted     | `apps/api/src/routes.ts`        |
| `prisma/seed/catalog/**` deleted (~5,000 LOC)                                 | `apps/api/prisma/`              |
| `CatalogBundle` and its dependents removed or reshaped                        | `packages/contracts/`           |
| the catalog BFF proxy route deleted                                           | `apps/web/src/app/api/`         |
| make/model/variant fields become free text with a suggest-existing guard rail | F060 — `basics-fields.tsx`      |

**D6 — the `cities` table:**

| Expected difference                                                           | Where                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `City` model deleted; `Dealer.cityId` → `Dealer.city` + `Dealer.state` (text) | `apps/api/prisma/schema.prisma`                 |
| `dealers.legalName` unique becomes `@@unique([legalName, city])`              | `apps/api/prisma/schema.prisma`                 |
| `modules/locations/**` deleted, `GET /v1/cities` unmounted                    | `apps/api/src/modules/`, `apps/api/src/routes.ts` |
| `CitiesResponse`, `CityRef` removed; `normaliseLocality` added                | `packages/contracts/`                           |
| `OnboardingInput.citySlug` → `city` + `state`; same on `UpdateDealerInput`    | `packages/contracts/`                           |
| `CITIES` removed from the seed                                                | `apps/api/prisma/seed/`                         |
| the city dropdown and disabled State box become two text inputs               | `onboarding-wizard.tsx`                         |

**Everything else must still be empty.** `GET /v1/config/public` is part of
neither decision and must survive byte-identical (F029).
`apps/api/src/platform/rc/rc-aliases.ts` is a committed constant, not a
catalogue table, and must survive **unchanged** — the test that separates it
from `City` is in `CONTEXT.md` §7: a reference table is catalogue data if it
gates who or what may exist, and an alias map gates nothing.

The practical consequence: write the exclusion as an explicit pathspec so the
gate stays honest rather than being loosened by hand each time.

```text
git diff baseline/pre-reorg-2026-09-02 reconstruction -- apps/ packages/ \
  ':!apps/api/prisma/seed/catalog' \
  ':!apps/api/src/modules/catalog'
```

That command must be empty except for the schema, routes, contracts,
`basics-fields.tsx` and `onboarding-wizard.tsx` hunks listed above, each of
which is reviewed once, by a human, against the D1 and D6 entries in
`feature-map.md`. Documentation, CI and the
sandbox differ by design throughout.

---

## 6. Absolute rules for Claude

```text
NEVER push feature work directly to main
NEVER merge its own PR
NEVER approve its own PR
NEVER bypass human review
NEVER force-push any branch
NEVER rewrite Git history unless explicitly instructed in a future phase
NEVER delete a branch that has not been merged
NEVER modify branch protection or repository settings
NEVER run the final reconstruction → main promotion
```

The only commit that is ever pushed directly to `main` is
`chore: initialize project`, and it is pushed once.

---

## 7. The mandatory future feature workflow

This is the exact sequence for **every** feature from Phase 2 onward. It belongs
in the repo-root `CLAUDE.md` so it is loaded into every session.

```text
 1  READ FEATURE
        · docs/project/feature-map.md — the F-number, its scope, its dependencies
        · confirm every dependency has merged
        ↓
 2  AUDIT REQUIRED COMPONENTS
        · list every UI element the feature needs
        ↓
 3  SEARCH SANDBOX
        · apps/sandbox/src/registry.ts — by name, alias and category
        · docs/project/component-map.md
        · pnpm sandbox — look at it running
        ↓
 4  REUSE OR CREATE
        ┌──────────────────────────────────────────────┐
        │ Exists and fits as-is        → REUSE          │
        │ Exists, needs a prop/variant → MODIFY, and    │
        │   document: consumers · existing scenarios ·  │
        │   existing props · new props · back-compat ·  │
        │   affected features · tests to update         │
        │ Does not exist               → CREATE         │
        └──────────────────────────────────────────────┘
        Prefer <Card variant="vehicle"> over a new VehicleCard.
        Never create a second component that duplicates an existing one.
        ↓
 5  UPDATE SANDBOX
        · story file with every relevant state
        · meaningful props exposed as controls
        · RegistryEntry (id · aliases · features · states)
        · row in docs/project/component-map.md
        ↓
 6  IMPLEMENT FEATURE
        · branch:  feat/f0XX-<kebab-name>   (from the reconstruction base)
        ↓
 7  TEST
        · component tests — play() functions in the sandbox
        · feature tests   — API integration + web unit
        · pnpm lint · typecheck · test · build   all green
        ↓
 8  SANDBOX VERIFY
        · pnpm sandbox — every documented state renders
        · check 375 / 768 / 1024 / 1280 for anything responsive
        ↓
 9  SCREENSHOTS
        · one per significant state, attached to the PR
        ↓
10  COMMIT
        · feat: <feature name>     (conventional commits; one logical commit
        ·                           where practical)
        ↓
11  PUSH FEATURE BRANCH
        · git push -u origin feat/f0XX-<name>       ← NEVER to main
        ↓
12  OPEN PR
        · body: scope · files · API changes · schema changes ·
          the sandbox table · screenshots · verification-gate results
        ↓
13  STOP
        ·
        ·  ← Claude does nothing further. No merge. No follow-up push.
        ·
        ↓
14  HUMAN REVIEWS
        ↓
15  HUMAN MERGES
```

### Definition of done for a UI component

```text
☐ Component exists
☐ Existing sandbox components were checked first
☐ An existing component was reused where appropriate
☐ A new component was added to the sandbox
☐ Props documented in component-map.md
☐ Meaningful props exposed as sandbox controls
☐ Relevant states documented and rendered
☐ Component tested (play() / Testing Library)
☐ Sandbox scenario verified by eye
☐ The feature actually uses the component
☐ Visual verification completed
☐ Screenshot attached to the PR where appropriate
```

A component that exists only inside a feature implementation, with no sandbox
entry, is **not done**.

---

## 8. What happens next

**Nothing, until this audit is reviewed and approved.**

When it is, Phase 2 begins with the five prerequisites in §1 — tag, branch
protection, CODEOWNERS, stale-branch cleanup, Dependabot triage — followed by
the sandbox PR, then F001 → F002–F006 → F007 → F008 → F009–F013, then the
tiers in `feature-map.md`.

Note the tier order that decisions **D1**, **D2** and **D3** produced: 97
features across 14 tiers, with **CI/CD at Tier 3 (F021–F025)** — immediately
after **F018, dealer sign-in with Google OAuth**, the first commit at which a
person can open a browser, click a button and be signed in. Everything from
Tier 4 onward therefore ships through a pipeline that already builds, scans,
tests and deploys, rather than accumulating 90 features and then bolting CI on
at the end.
