# PR 4 — canonical service locations

Branch: `feat/dynamic-service-locations` · Base: `feat/standard-dealer-directory-image` (#289)
Implementation head: `40f5b87c36ae6b00a52f96a8fa37bb7da2322dfa`
PR: pending creation. State: prepared, unmerged. No production deployment.

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
snapshot before any owner-controlled rollout. No production migration was run.

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

## After creation

NOT RUN yet. The mandatory post-creation campaign and final-SHA GitHub checks remain
required before starting PR 5. This report will be updated after actual execution.

## Limitations and owner review

The initial district master loads Tamil Nadu; future districts are maintained through the
reviewed admin workflow, not a complete preloaded India district dump. IDs are internal,
not asserted LGD numbers. Native Safari/physical-device UAT and live Google/MSG91 journeys
are not claimed. Existing provider regressions use controlled adapters and real local
application/database boundaries. Historical 556-case reports are not a current pass claim.

All fixtures were synthetic and used `dealersdrive_test` or guarded scratch databases.
Screenshots mask contact and identifier fields. Private cookies/OTP values/fixture-session
files are excluded. No KYC documents or production data were used.

Owner UAT: follow `docs/project/service-locations.md` on the feature branch, especially
new onboarding, disabled-location preservation, independent coverage, stale admin edits,
and existing filter links. Deploy the API/migrations only to an isolated review environment
before testing a web-only preview; no production deployment is authorized.

Next planned PR: optional tagline, only after post-creation checks and final-SHA CI pass.
