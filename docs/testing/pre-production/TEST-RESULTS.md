# Baseline execution results

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Decision: **NO GO**. The baseline campaign is documented, but launch certification is incomplete.

| Canonical outcome                   |     Count |
| ----------------------------------- | --------: |
| PASS                                |       244 |
| FAIL                                |         7 |
| BLOCKED                             |       305 |
| NOT_APPLICABLE                      |         0 |
| Total accounted                     |       556 |
| Missing / duplicated / unclassified | 0 / 0 / 0 |

PASS means the exact scenario has reviewed execution evidence within its recorded local method. It does not certify live providers, all browser brands, every layer, or human approval. Individual assertion names, probe IDs, layer results and limitations are in [registry.json](registry.json) and [TEST-COVERAGE-MATRIX.md](TEST-COVERAGE-MATRIX.md). BLOCKED is a launch gap, not a pass. No unsupported behavior was silently declared NOT_APPLICABLE.

| Repository check                      | Result                                                        | Evidence                                 |
| ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| Prisma client generation              | PASS                                                          | TEST-PLAN.md; generated with Prisma 7.10 |
| Fresh typecheck                       | PASS; 6 tasks, 0 cached                                       | evidence/ci/typecheck.log                |
| Fresh lint/format/docs checks         | PASS after dossier generation; 6 tasks, 0 cached              | evidence/ci/final-lint.log               |
| Full unit/integration/contracts suite | **FAIL**, 4,289 passed / 4,290 assertions                     | evidence/ci/tests.log                    |
| API                                   | 2,585 passed / 2,586; one invitation race failed              | evidence/ci/api-assertions.json          |
| Web                                   | 1,284 passed / 1,284                                          | evidence/ci/web-assertions.json          |
| Contracts                             | 420 passed / 420                                              | evidence/ci/contracts-assertions.json    |
| Fresh production build                | PASS; 3 tasks, 0 cached                                       | evidence/ci/build.log                    |
| Fresh PostgreSQL migrations           | PASS; all 39 applied                                          | evidence/ci/migrate.log                  |
| Prisma schema validation              | PASS                                                          | evidence/ci/prisma-validate.log          |
| Dependency audit                      | No critical; 9 high / 12 moderate / 3 low remain              | evidence/ci/dependency-advisories.json   |
| Terraform fmt/validate                | BLOCKED; CLI unavailable                                      | TEST-PLAN.md                             |
| Repository browser E2E script         | Not present; direct Chromium UAT performed                    | AGENT-UAT.md                             |
| API coverage gate                     | BLOCKED; failed suite did not produce verified fresh coverage | evidence/ci/tests.log                    |

Harness corrections were limited to test tooling: Turbo argument forwarding, generated-document formatting, actual mark-sold route/204 semantics, keyset observer snapshot clearing, hydration waits and Playwright selectors. Original browser attempts and blocked race evidence were retained. A cached typecheck was replaced by a fresh run. The application race failure was never rerun until green.

Additional discoveries are separately registered in [additional-tests.json](additional-tests.json); they do not inflate the 556 denominator. [BUG-REPORT.md](BUG-REPORT.md) contains all confirmed failures. All 556 human results remain PENDING.
