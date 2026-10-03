# Authorized stacked retests — current status

Original FAIL and BLOCKED baseline results below are preserved. No merges or production connections. Human UAT PENDING.

| Layer / canonical                                    | Baseline                                     | Current Agent retest                                                                                                                                                       | Remote CI                                |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| BUG-007 PUBLIC-021 / SEO-009                         | FAIL                                         | Branded route/outage checks PASS                                                                                                                                           | #209 final107a462 CI358/Security507 PASS |
| BUG-001 ADD-RACE-001                                 | FAIL                                         | Race, authorization, API/DB/browser PASS                                                                                                                                   | #231 final1f38a13 CI361/Security510 PASS |
| BUG-002 VERIFY-011                                   | FAIL                                         | Activation prerequisites and required NEW-003/004 safeguards PASS; 4,379 accumulated tests                                                                                 | #232 final3570dcf CI363/Security512 PASS |
| NEW-005 VERIFY-012                                   | BLOCKED original; campaign reproduction FAIL | Both destructive race and rollback red→green; 15 specific /137 targeted/214 unit tests; 4,404 full tests; lint/type/build and four functional browser cases PASS atd5043b5 | #233;3150811 CI364/Security513 PASS      |
| Other primary bugs / NEW-001 / dependency assessment | Historical findings retained                 | NOT_RUN                                                                                                                                                                    | NOT_RUN                                  |
| NEW-006 mobile onboarding                            | New P2 FAIL atd5043b5                        | 390 viewport,518 scroll width measured and screenshot captured; fix pending                                                                                                | NOT_RUN                                  |

[NEW-005 evidence](../fixes/BUG-NEW-005/README.md) includes complete sanitized assertions and [canonical mapping](../fixes/BUG-NEW-005/canonical-retests.json). Eight dealer/listing lifecycle intersections preserve vehicles, memberships, enquiries, Saved Cars and audits. Required cleanup uses the persisted outbox and does not acknowledge provider failure. Role changes, stale cookies, replay and forbidden callers are covered.

Functional UAT PASS does not certify BUG-008 Admin mobile overflow or NEW-006 onboarding overflow. Provider and human gaps remain open. Complete 556-case certification will be recomputed after the final stack is ready.

Stack: NEW-005 → #232 → #231 → #209 → main. See [STACK-MAP.md](STACK-MAP.md). Next primary BUG-003 starts only after NEW-005 actual CI passes.

---

# Retest status

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

No application fix, fix commit, fix PR, merge, or deployment was performed. Every confirmed bug remains OPEN and every fix retest is NOT_RUN. Baseline SHA and final workspace HEAD are identical. No repeated-green suite result supersedes the failed baseline.

Harness follow-ups are documented separately from fix retests: actual mark-sold route and DELETE 204 semantics; independent lock observer; valid allowlist setup; hydration waits and locator disambiguation. Original blocked attempts were retained. These improve evidence accuracy and do not close any product bug.

A later authorized fix phase must give each BUG-### a regression test, concrete fix diff/PR, targeted retest, neighboring lifecycle/role/tenant checks and required CI. Recompute all 556 classifications, provider/browser gaps and human results on the new exact SHA. The current NO GO stays in force.
