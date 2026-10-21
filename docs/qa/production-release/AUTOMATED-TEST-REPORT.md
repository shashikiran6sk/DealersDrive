# Automated test report

| Field                      | Value                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Commit                     | `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2` (main, #330)                                                              |
| Environment                | Isolated container, 4 vCPU / 16 GiB, Node 24.22.0, pnpm 9.15.9, PostgreSQL 16.15, Chromium 141 (Playwright 1.56.1)   |
| Repository gate            | 2026-10-20 15:28 → 15:43:57 UTC                                                                                      |
| Campaign (first execution) | 2026-10-20 15:30 → 2026-10-21 05:25 UTC, including two unplanned container restarts                                  |
| Final full pass            | 2026-10-21 05:27:14 → 05:52:14 UTC (`run-all.sh`), plus re-runs of u01, d02 and the new s01 after the second restart |

Two different things are counted here and they must not be confused: **framework tests** (the
repository's own Vitest suites — individual `it()` assertions) and **acceptance scenarios** (the
556 canonical plus discovered scenarios, each a judged end-to-end behaviour).

## 1. Repository gate (CI-equivalent)

Exactly the commands `.github/workflows/ci.yml` runs, in its order, under Node 24:

| Step             | Command                                                              | Result                                                                |
| ---------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Prisma client    | `pnpm --filter @dealers-drive/api db:generate`                       | exit 0                                                                |
| Format           | `pnpm format:check`                                                  | exit 0                                                                |
| Lint             | `pnpm lint` (turbo lint across packages + format + docs)             | exit 0 — 0 errors, 1 warning (unused eslint-disable directive in web) |
| Docs references  | `pnpm docs:check`                                                    | exit 0                                                                |
| Typecheck        | `pnpm typecheck`                                                     | exit 0                                                                |
| Tests            | `pnpm test` (unit + real-PostgreSQL integration, coverage gate 90 %) | exit 0                                                                |
| Build            | `pnpm build`                                                         | exit 0                                                                |
| Dependency audit | `pnpm audit --audit-level=critical`                                  | exit 0 (0 critical; 7 high, 8 moderate reported — BUG-108)            |

| Package                    | Test files |     Tests | Result                                | Coverage (lines / branches / functions / statements) |
| -------------------------- | ---------: | --------: | ------------------------------------- | ---------------------------------------------------- |
| `@dealers-drive/api`       |        173 |     3,422 | all passed                            | 96.99 % / 90.19 % / 97.97 % / 95.84 %                |
| `@dealers-drive/web`       |        145 |     1,756 | all passed                            | (no coverage gate)                                   |
| `@dealers-drive/contracts` |         24 |       576 | all passed                            | 98.96 % / 95.29 % / 97.56 % / 98.54 %                |
| **Total**                  |    **342** | **5,754** | **5,754 passed, 0 failed, 0 skipped** |                                                      |

Logs: `EVIDENCE/ci/*.log`. The suite ran once; nothing was re-run to get green. "Unique constraint
failed" lines in the log are expected output of tests asserting conflicts.

Not run: Terraform `fmt`/`validate` (no Terraform binary here) and the Semgrep job (needs the
`semgrep/semgrep` container). A first attempt under the container's default Node 22 was
abandoned before completion and is not counted (its lint step failed only because the Prisma
client had not been generated yet — the step CI runs first).

## 2. Acceptance campaign

Harness: `harness/*.mjs`, driven by `harness/run-all.sh`. Every script talks to the running
services (HTTP, browser, SQL); verdicts go to `registry/results/<area>.json`.

| Script   | Area                                | What it covers                                                                        | Final pass                                                                                               |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| c01      | priority                            | earlier P0/P1 findings: forged storage links, dealer lifecycle bypasses, KYC lock     | 12 PASS                                                                                                  |
| c02      | public                              | PUBLIC, SEARCH                                                                        | 26 PASS                                                                                                  |
| c03      | auth-customer-saved                 | AUTH, CUSTOMER, SAVED                                                                 | 30 PASS, 5 BLOCKED                                                                                       |
| c04      | enquiry                             | ENQ-CREATE, ENQ-LIFE                                                                  | 52 PASS                                                                                                  |
| c05      | onboard-verify                      | ONBOARD, VERIFY                                                                       | 32 PASS                                                                                                  |
| c06      | member-identity-rbac                | MEMBER, IDENTITY, OWNER, MANAGER, STAFF, PROFILE                                      | 95 PASS                                                                                                  |
| c07      | listing                             | LISTING-CREATE, MODERATION, MEDIA, LISTING-LIFE                                       | 78 PASS                                                                                                  |
| c08      | admin-dealerlife-cross              | ADMIN-*, DEALER-LIFE, CROSS                                                           | 48 PASS                                                                                                  |
| c09      | cross-search-data                   | CROSS, SEARCH, DATA                                                                   | 45 PASS                                                                                                  |
| c10      | security                            | API-SEC, STORAGE, ABUSE                                                               | 44 PASS                                                                                                  |
| c11      | notify-recovery-obs                 | NOTIFY, RECOVERY, OBS                                                                 | 30 PASS                                                                                                  |
| c12      | prod-deploy                         | PROD, DEPLOY                                                                          | 22 PASS, 2 BLOCKED                                                                                       |
| d01      | delta                               | support limits, Admin Members, Sales, Dealer Verified, portfolio, KYC, e-mail privacy | 21 PASS, 1 FAIL (BUG-102)                                                                                |
| d02      | stale-suspension                    | out-of-band suspension cache window                                                   | 1 PASS (re-run after the second restart: car 71 s, dealer 614 s)                                         |
| d03      | console-suspension                  | console suspension takes effect at once                                               | 1 PASS                                                                                                   |
| d04      | backup-restore                      | logical dump/restore drill                                                            | 1 PASS                                                                                                   |
| d05      | msg91-faults                        | msg91 adapter refusal/outage/replay/identity binding                                  | 3 PASS                                                                                                   |
| s01      | stored-xss                          | stored XSS across public/dealer/customer/admin pages                                  | 1 PASS                                                                                                   |
| retest-* | 8 scripts                           | every finding of the previous fix campaign                                            | 23 PASS, 2 FAIL (BUG-101, superseded timing check)                                                       |
| b01      | browser-public-seo                  | browser public pages, SEO                                                             | 13 PASS, 2 FAIL (BUG-101)                                                                                |
| b02      | browser-ux                          | browsers, devices, accessibility                                                      | 20 PASS, 4 BLOCKED                                                                                       |
| b03      | browser-golden                      | the ten golden paths in the UI                                                        | 10 PASS                                                                                                  |
| u01–u04  | agent-uat, touch, gallery, recovery | Agent UAT walk-through, touch swipe, gallery, outages mid-journey                     | u01 45 PASS (re-run after the Back/Forward fix) · u02 2 PASS · u03 3 PASS, 1 FAIL (BUG-109) · u04 3 PASS |

Totals and every verdict: [TEST-RESULTS.md](TEST-RESULTS.md), `EVIDENCE/final-counts.json`,
[TEST-TRACEABILITY.csv](TEST-TRACEABILITY.csv). `finalize.mjs` exits non-zero unless all 556
canonical scenarios carry one of PASS/FAIL/BLOCKED/NOT_APPLICABLE; it exited 0.

## 3. Flakiness

| Check                                                         | Observation                                                                                                                                                     | Handling                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GOLDEN-002 (saved list after re-login)                        | Once in four runs the list rendered ~1–3 s after the redirect settled; the data was always there and survived reload                                            | Harness now waits for the list (8 s); recorded, not hidden                               |
| BUG-NEW-010-timing (dealer page after out-of-band suspension) | 332 s once, 614 s on the final run; two runs in between stopped observing at 600 s — inherent to a 600 s stale-while-revalidate window and when a request lands | Observation window widened to 900 s, budget set to the designed ≈ 660 s; finding BUG-111 |
| u01 Back/Forward                                              | `goForward` waiting for `networkidle` timed out on a client-side navigation                                                                                     | Harness waits for the URL instead (u02 proved the behaviour)                             |

No product check was re-run until it passed; every re-run followed a harness change recorded in
[RETEST-REPORT.md](RETEST-REPORT.md).

## 4. Reproduce

[TEST-EXECUTION-GUIDE.md](TEST-EXECUTION-GUIDE.md).
