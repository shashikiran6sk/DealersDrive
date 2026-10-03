# Authorized stacked retests — 2026-10-03 UTC

Original baseline FAIL and BLOCKED results below remain unchanged. No PR has been merged; no production connection, deployment or live-provider certification is implied. Human UAT PENDING.

| Bug / canonical test           | Baseline                               | Fix                                                    | Layer retest                                                           | Accumulated stack gates                                                 | Remote CI                              |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| BUG-007 / PUBLIC-021 / SEO-009 | FAIL                                   | #209, `107a462`                                        | PASS: 404/noindex/navigation/outage checks                             | PASS: lint/typecheck/build; 4,352 tests                                 | PASS: CI 358 / Security 507            |
| BUG-001 / ADD-RACE-001         | FAIL                                   | #231, final `1f38a13`                                  | PASS: controlled queued winners and API/DB/browser negatives           | PASS: 65 targeted; six browser; 4,357 full tests and local gates        | PASS: CI 361 / Security 510            |
| BUG-002 / VERIFY-011           | FAIL; reproduced before correction     | `fc45269`, `fix/pre-production-02-approval-gate`; #232 | PASS: 159 targeted integration, 268 unit, four browser/DB cases        | 4,379 PASS; typecheck/build PASS; lint/format/docs PASS                 | PASS: `debfb6c`, CI 362 / Security 511 |
| BUG-NEW-002                    | Pre-fix failure during campaign        | BUG-001 required lock-order correction                 | PASS                                                                   | Included in accumulated suite                                           | PASS with #231                         |
| BUG-NEW-003 / BUG-NEW-004      | Pre-fix failures during campaign       | BUG-002 required activation support                    | PASS: upload/state guards, legacy data and preserved approved history  | Included in final updated suite                                         | PASS: `debfb6c`, CI 362 / Security 511 |
| VERIFY-012 / BUG-NEW-005       | New destructive race FAIL at `fc45269` | Dedicated next layer required                          | Three non-destructive decision queues PASS; destructive rejection FAIL | Final-branch API/DB diagnostic FAIL; dedicated next layer required      | NOT_RUN                                |
| Other known bugs / BUG-NEW-001 | Original failures retained             | Not fixed yet                                          | NOT_RUN                                                                | A green automated suite does not close uncovered certification failures | NOT_RUN                                |

[BUG-002 report](../fixes/BUG-002/README.md) links per-assertion evidence, original red results and screenshots. [Canonical mappings](../fixes/BUG-002/canonical-retests.json) keep baseline status alongside individually justified retests. The repeated 390-pixel Admin overflow is attributed to BUG-008, not counted as a mobile layout PASS. Provider, actual-device and human gaps remain open. The final 556-case certification will be recomputed against the complete stack.

Stack: BUG-002 → #231 → #209 → main. BUG-NEW-005 follows BUG-002 only after its actual remote CI passes. See [STACK-MAP.md](STACK-MAP.md). No merge authorized.

---

# Retest status

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

No application fix, fix commit, fix PR, merge, or deployment was performed. Every confirmed bug remains OPEN and every fix retest is NOT_RUN. Baseline SHA and final workspace HEAD are identical. No repeated-green suite result supersedes the failed baseline.

Harness follow-ups are documented separately from fix retests: actual mark-sold route and DELETE 204 semantics; independent lock observer; valid allowlist setup; hydration waits and locator disambiguation. Original blocked attempts were retained. These improve evidence accuracy and do not close any product bug.

A later authorized fix phase must give each BUG-### a regression test, concrete fix diff/PR, targeted retest, neighboring lifecycle/role/tenant checks and required CI. Recompute all 556 classifications, provider/browser gaps and human results on the new exact SHA. The current NO GO stays in force.
