# PR 4 — canonical service locations

Branch: `feat/dynamic-service-locations` · Base: `feat/standard-dealer-directory-image` (#289)
Implementation head: `7fdf6a87501dcf22a3f41e6ebfe5064edf8c85ba`
PR: [#291](https://github.com/shashikiran6sk/DealersDrive/pull/291). State: **OPEN**, unmerged. No production deployment.

## Implementation

Tamil Nadu only for initial onboarding, with all 38 districts; all 36 states/UTs in a
maintainable catalogue. Canonical geographic references and preserved public filter URLs.
Independent photography flags. Shared searchable selectors for self, assisted, and admin
editing. Permission-guarded, versioned configuration with transactional audit history and
reviewed government-source district additions. Legacy ambiguous text is preserved for
administrative review instead of guessed or deleted.

52 files changed. Two migrations: `20261010090000_service_locations` (transactional
catalogue/FKs/backfill) and `20261010090100_service_location_audit_index` (concurrent
partial index; must remain outside a transaction). Rehearse on a sanitized production-size
snapshot before any owner-controlled rollout. No production migration was run. Drain old onboarding writers during API cutover; reconcile any nullable references produced during a mixed-version window through the normal review/forward-fix process.

## Before creation — executed

- `TZ=UTC APP_ENV=local pnpm run test --force --env-mode=loose`: **5,050 PASS** — API 3,103,
  web 1,506, contracts 441. No cached tests in this final run.
- `pnpm lint`, `pnpm run typecheck`, `pnpm build`: PASS.
- Prisma generation and `prisma validate`: PASS.
- Five scratch-database migration rehearsals: PASS, including exact alias backfill,
  ambiguous data preservation, ownership preservation, rollback/retry, and concurrent index.
- `pnpm --filter @dealers-drive/sandbox build:sandbox`: PASS.
- Actual built-app browser UAT: PASS at 320/390/768/1280. See `pre-pr-final/browser-results.json`.
  Real saved dealer registration, canonical address persistence, 38-district search,
  keyboard selection, immediate visible selections, independent saved photography settings,
  district disable/re-enable, live public availability, readable audit history, and public
  `/cars`/`/dealers` filter routes. Before screenshot is the actual parent build.
- Scoped security: real session/permission routing, moderator refusal, forged locations,
  database FK enforcement, lost-update conflict, and admission/disable locking PASS.
- Final API coverage: lines 96.96%, branches 90.22%; required 90% gate retained.

## After creation — executed on final head

- Additional adversarial input probing found that malformed government-source URLs threw
  `TypeError` rather than normal validation errors. Corrected in the same PR, with three
  new contract cases plus API and server-action regression coverage. Also enlarged mobile
  configuration save/checkbox hit areas to 44 pixels.
- After commit/push, fresh `pnpm run test --force --env-mode=loose` with `TZ=UTC APP_ENV=local`:
  **5,053 PASS** — API 3,103, web 1,506, contracts 444; no cached tests.
- `pnpm lint`, `pnpm run typecheck`, `pnpm run build --force`: PASS. Production builds
  executed with caches bypassed. Prisma generation/validation: PASS.
- Post-creation browser UAT on the final production build: PASS at all four widths,
  including real registration persistence, settings persistence, independent photography,
  availability changes, old public filter routes, keyboard/first-click selection, malformed
  API URL rejection, and measured mobile save controls of at least 44 pixels.
- Final API coverage: lines **96.96%**, branches **90.20%**; existing threshold unchanged.
- All required checks passed on the exact final SHA. [CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37982055847)
  and [Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37982055916).
  Dependency audit, semgrep, gitleaks, Terraform validation and Vercel preview also passed.
- `deployments.json` confirms Preview with `production_environment=false` for this SHA.
- Base/head, two incremental commits, 52-file comparison, clean worktree, and unmerged state
  were verified. Final local failures: zero. Outstanding blockers: none for this PR.

## Limitations and owner review

The initial district master loads Tamil Nadu; future districts are maintained through the
reviewed admin workflow, not a complete preloaded India district dump. IDs are internal,
not asserted LGD numbers. Production builds succeeded with existing API-fetch fallback warnings while the default local prerender API was unavailable; live routes were tested against the isolated running API. Native Safari/physical-device UAT and live Google/MSG91 journeys
are not claimed. Existing provider regressions use controlled adapters and real local
application/database boundaries. Historical 556-case reports are not a current pass claim.

All fixtures were synthetic and used `dealersdrive_test` or guarded scratch databases.
Screenshots mask contact and identifier fields. Private cookies/OTP values/fixture-session
files are excluded. No KYC documents or production data were used.

Owner UAT: follow `docs/project/service-locations.md` on the feature branch, especially
new onboarding, disabled-location preservation, independent coverage, stale admin edits,
and existing filter links. Deploy the API/migrations only to an isolated review environment
before testing a web-only preview; no production deployment is authorized.

Next planned PR: optional tagline. This PR’s post-creation and final-SHA CI gate is complete.
