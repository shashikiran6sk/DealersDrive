# Legal V1 verification — 24 October 2026

The two policies contain the owner-confirmed operator, grievance contact,
business address/phone/email and intended effective date (24 October 2026).
No mandatory identity/contact placeholders remain. External counsel review and
operational follow-ups are recorded in [the audit](../../legal/LEGAL_V1_REVIEW.md).
The versioned source is pinned by [the V1 manifest](../../legal/v1-manifest.json)
and its checksum test. No production deployment or database operation occurred.

## Completed verification

| Check                             | Result                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm lint                         | Passed, including formatting and documentation freshness. Existing classify-photo test has one unused-directive warning; sandbox emits its existing pages-directory notice. Neither is suppressed or modified.                                                                                                                                                  |
| pnpm typecheck                    | All six workspace tasks passed. Existing config task emits a no-output warning.                                                                                                                                                                                                                                                                                 |
| API unit + integration + coverage | 177 files, **3,476 tests passed**, none failed/skipped. Command: TZ=UTC APP_ENV=local pnpm --filter @dealers-drive/api test. Statements 95.73%, branches 90.11%, functions 97.92%, lines 96.95%.                                                                                                                                                                |
| Web unit/component/action/routing | 147 files, **1,790 tests passed**, none failed/skipped. Command: pnpm --filter @dealers-drive/web test.                                                                                                                                                                                                                                                         |
| Contracts                         | 25 files, **589 tests passed**, none failed/skipped. Command: pnpm --filter @dealers-drive/contracts test.                                                                                                                                                                                                                                                      |
| Production builds                 | pnpm build passed for API and web; final owner-confirmed web bundle also built and served locally for browser checks.                                                                                                                                                                                                                                           |
| Sandbox build                     | pnpm --filter @dealers-drive/sandbox build:sandbox passed.                                                                                                                                                                                                                                                                                                      |
| Database rehearsals               | Fresh/current-main populated database and database containing all five original #279 SQL migrations with applied records both passed Prisma migrate deploy; old rows, evidence and checksums preserved. No acceptance backfill. Repeat deploy is a no-op. Immutability and code-rollback reads verified.                                                        |
| Browser                           | **37 full-stack checks passed** against the local Next production bundle and guarded synthetic API database. Two anonymous HTTP-200 policy routes, metadata, date/version, footer navigation, mandatory unchecked controls, real server actions, gated direct APIs, submission, approved dealer access and repeat-entry behavior.                               |
| Responsive sandbox                | **16 checks passed** across 375, 768, 1024 and 1280 px. Actual pages/gates also checked at those widths without horizontal overflow.                                                                                                                                                                                                                            |
| Accessibility                     | Semantic article/headings, exact accessible checkbox name, native required/unchecked state, keyboard toggle, focusable policy links and mobile/desktop layout inspected. This is a focused smoke check, not an assertion of full WCAG certification.                                                                                                            |
| Security/diff                     | Strict server-derived identity/version/timestamp, owner membership recheck, concurrency uniqueness, no marketing inference, no acceptance backfill, support/auth exemptions and unchanged role/state restrictions reviewed. Exactly two new public policy routes; one shared checkbox component. No StudioCar/image-processing changes or dependency additions. |
| CI                                | Verify current results on the PR. Local verification does not substitute for remote CI. No merge or deployment is authorized/performed.                                                                                                                                                                                                                         |

The first root test attempt inherited APP_ENV=dev from the local .env after Turbo
filtered shell variables, causing the pre-existing logger test's local expectation
to fail; the complete API suite passes with APP_ENV=local and TZ=UTC stated directly.
An early non-UTC migration assertion also exposed the local timezone dependency.
No unrelated assertions were weakened. Existing pg-client deprecation notices
remain visible. Implementation-caused failures were fixed and complete suites rerun.

## Evidence

[Full-stack browser checks](browser-results.json) ·
[Sandbox checks](sandbox-results.json) ·
[Keyboard/accessibility and Swagger smoke checks](accessibility-results.json).
Only synthetic accounts and local fake Google/OTP providers were used; page-level
external HTTPS requests were blocked during browser verification. Real Google,
MSG91 delivery, provider settings and physical-device UAT remain release checks.

| Screen                     | Mobile (375 px)                         | Desktop (1280 px)                        |
| -------------------------- | --------------------------------------- | ---------------------------------------- |
| Terms & Conditions         | [Screenshot](terms-375.png)             | [Screenshot](terms-1280.png)             |
| Privacy Policy             | [Screenshot](privacy-375.png)           | [Screenshot](privacy-1280.png)           |
| Customer checkbox          | [Screenshot](customer-checkbox-375.png) | [Screenshot](customer-checkbox-1280.png) |
| Dealer onboarding checkbox | [Screenshot](dealer-checkbox-375.png)   | [Screenshot](dealer-checkbox-1280.png)   |

## Reproducing local browser checks

Run the guarded apps/api/tests/legal-v1-browser-harness.ts with NODE_ENV=test,
APP_ENV=local, DATABASE_URL pointing only to the local
**dealersdrive_test_legal_browser** database, PHONE_OTP_DRIVER=fake,
STORAGE_DRIVER=local, JOBS_ENABLED=false, WORKER_INLINE=false,
GRAFANA_CLOUD_LOGS_ENABLED=false, LEGAL_V1_PREVIEW=true and DOCS_ENABLED=true.
It creates/migrates that isolated database if needed, uses synthetic fixtures,
listens on 4191 and writes short-lived synthetic session tokens to a mode-0600
file in /tmp. It never resets a database or sends real provider messages.

Build/start Next on localhost:3101 with APP_ENV=local, LEGAL_V1_PREVIEW=true,
API_BASE_URL/API_ORIGIN pointing to http://127.0.0.1:4191 and WEB_BASE_URL pointing
to http://localhost:3101. Run an isolated headless Chrome debugging on 9231, then
run pnpm --filter @dealers-drive/web exec node tests/responsive/legal-v1-check.mjs.
Restart the harness before repeating, since acceptance is intentionally persistent.
Do not run Next build and dev against the same output directory concurrently.

## Files changed

See the PR Files changed tab for the complete reviewed file list. Changes are
limited to the two policy references/routes, existing footer, the one shared legal
checkbox/gates, minimal acceptance schema/service/middleware, related integration
points, tests/sandbox evidence, and legal audit/rollout documentation. The old #279
SQL copies are isolated test fixtures; none is a restored deployment migration.
