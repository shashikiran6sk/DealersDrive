# Authorized stacked retests — current status

Original baseline bytes below are preserved. No PR has been merged. Human UAT PENDING. Production NO GO until remaining fixes and complete-stack certification pass.

| Finding                                        | PR / branch                                                           | Agent retest / CI                                                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-007 branded 404                            | #209 `claude/serene-thompson-yuft81`                                  | PASS; final107a462 CI358/Security507 PASS                                                                                                                                                               |
| BUG-001 invitation race / NEW-002              | #231 `fix/pre-production-01-invitation-race`                          | PASS; final1f38a13 CI361/Security510 PASS                                                                                                                                                               |
| BUG-002 activation / NEW-003 / NEW-004         | #232 `fix/pre-production-02-approval-gate`                            | PASS; final3570dcf CI363/Security512 PASS                                                                                                                                                               |
| BUG-NEW-005 destructive rejection              | #233 `fix/pre-production-new-005-rejection-race`                      | PASS; finald29d9b9 CI366 attempt2/Security515 PASS                                                                                                                                                      |
| BUG-003 DATA-DISC-001/002/003                  | #234 `fix/pre-production-03-stable-pagination`                        | Baseline FAIL retained; scoped Agent PASS; 4428 tests, nine browser cases with refresh/back PASS at20c1b39; lint/typecheck/build PASS; final62b1491 actual CI368/Security517 PASS                       |
| BUG-004 SEC-DISC-002                           | #235 `fix/pre-production-04-suspended-media`, base #234               | Vehicle media Agent PASS at3aa48c4; 4440 tests/three browser widths; lint/typecheck/fresh build PASS; history scan PASS; #235 finaladeb847 actualCI370/Security519 PASS                                 |
| BUG-005 CONCURRENCY-007 / CROSS-019            | `fix/pre-production-05-membership-commit-guard`, base #235; #236 open | Baseline FAIL retained; scoped Agent PASS at69cfc0d;4506 full tests/38 target/335 unit/201 adjacent/three browser widths PASS; lint/typecheck/fresh build/DB PASS; history scan PASS; actual CI pending |
| BUG-006 / BUG-008                              | Not started                                                           | Original findings retained; NOT_RUN                                                                                                                                                                     |
| BUG-NEW-012 queued enquiry revocation          | Next dedicated layer after BUG-005 CI                                 | OPEN P1; real-cookie/API/DB reproduction retained                                                                                                                                                       |
| BUG-NEW-011 media width prose                  | Separate later layer                                                  | OPEN P3; width500/4000 accepted contrary to prose                                                                                                                                                       |
| BUG-NEW-008 /009 /010                          | Separate later layers                                                 | OPEN P2: local PDF MIME, public yard visibility and warmed car page cache                                                                                                                               |
| BUG-NEW-006 mobile onboarding                  | Dedicated later layer                                                 | OPEN P2: viewport390 / scrollWidth518                                                                                                                                                                   |
| BUG-NEW-007 inventory pagination               | Dedicated later layer                                                 | OPEN P2: DB51 / visited1, pages1+0; reproduced atc0d8e3a                                                                                                                                                |
| BUG-009 dependencies / BUG-NEW-001 log privacy | Dedicated assessment/fix pending                                      | Provisional OPEN                                                                                                                                                                                        |

[BUG-003 report](../fixes/BUG-003/README.md) records original red evidence, keyset root correction, supporting Admin test-oracle correction, complete assertions, API/DB lifecycle/authorization checks and browser screenshots. Its base is NEW-005, preserving the accumulated stack. Inventory source is unchanged; [new findings](new-bugs.json) records its separate reproduction.

[NEW-005 report](../fixes/BUG-NEW-005/README.md) preserves destructive-race and rollback red evidence. Its final head d29d9b9 passed actual CI366 attempt2 and Security515. First-attempt unchanged Next font-loader failure was investigated and retained; same-head rerun passed a fresh build and 4404 tests. VERIFY-012 original baseline BLOCKED remains unchanged. Functional UAT does not certify BUG-008 Admin overflow424 or NEW-006 onboarding overflow518.

See [STACK-MAP.md](STACK-MAP.md) for dependencies. Full 556-case recomputation, complete-stack regression, provider/deployment, real-device and human gates remain pending.

[BUG-004](../fixes/BUG-004/README.md) preserves SEC-DISC-002 additional baseline FAIL and exact-parent red evidence. Fresh API and vehicle image checks pass after suspension; warmed public page remains FAIL under NEW-010 and public yard image under NEW-009. Private local PDF MIME is NEW-008. These remain separate OPEN findings, not silently fixed or certified. DATA-DISC and SEC-DISC are additional probes; their results do not rewrite the556 canonical classifications.

[BUG-005](../fixes/BUG-005/README.md) retains exact-parent race red evidence and canonical baseline FAIL. Vehicle writes revalidate locked authority after resource waits. Browser owner-removal/queued-submit/refresh/personal-history checks pass at1440/768/390. Enquiry revocation remains a separately confirmed P1, BUG-NEW-012, scheduled for the next layer.

---

# Retest status

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

No application fix, fix commit, fix PR, merge, or deployment was performed. Every confirmed bug remains OPEN and every fix retest is NOT_RUN. Baseline SHA and final workspace HEAD are identical. No repeated-green suite result supersedes the failed baseline.

Harness follow-ups are documented separately from fix retests: actual mark-sold route and DELETE 204 semantics; independent lock observer; valid allowlist setup; hydration waits and locator disambiguation. Original blocked attempts were retained. These improve evidence accuracy and do not close any product bug.

A later authorized fix phase must give each BUG-### a regression test, concrete fix diff/PR, targeted retest, neighboring lifecycle/role/tenant checks and required CI. Recompute all 556 classifications, provider/browser gaps and human results on the new exact SHA. The current NO GO stays in force.
