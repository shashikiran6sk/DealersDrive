# Authorized stacked retests — 2026-10-02 UTC

The baseline section below and registry retain their original failures and blocked classifications. No PR has been merged; production providers/deployment have not been certified. Human UAT remains PENDING.

| Bug / test                       | Baseline                                                                  | Fix                                                                   | Layer retest                                                           | Accumulated stack checks                                                                                  | Remote CI                   |
| -------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------- |
| BUG-007; PUBLIC-021 / SEO-009    | FAIL                                                                      | #209, `107a462`                                                       | PASS: branded 404/noindex/navigation; 1440/768/390; safe outage states | PASS: lint/typecheck/build; 4,352 tests                                                                   | PASS: CI 358 / Security 507 |
| BUG-001; additional ADD-RACE-001 | FAIL; reproduced deterministically before fix                             | `455938b`, branch `fix/pre-production-01-invitation-race`; PR pending | PASS: both queued winners; HTTP/DB/audit/customer account integrity    | PASS: 65 targeted tests; six browser cases; lint/typecheck/build; 4,357 full tests and API coverage gates | PENDING: PR not created yet |
| BUG-NEW-002                      | FAIL in fix-phase pre-implementation probe (not an original baseline row) | Same required lock-order correction as BUG-001                        | PASS: committed suspension is re-read; no membership or joined audit   | Included in full suite                                                                                    | PENDING with BUG-001        |
| Other known bugs and BUG-NEW-001 | Original results retained                                                 | Not fixed yet                                                         | NOT_RUN                                                                | A green automated suite does not resolve direct certification failures outside its coverage               | NOT_RUN                     |

[BUG-001 reproduction, negative/adjacent tests, screenshots, DB assertions and sanitized CI-equivalent evidence](../fixes/BUG-001/README.md).

Related canonical cases re-exercised by this layer include MEMBER-007/008/010/011/012/013, CONCURRENCY-010 and ABUSE-008. These retain their own original baseline classifications; the actual failing acceptance-withdrawal race is the additional ADD-RACE-001 case. Canonical results are not inferred wholesale from file names. The full 556-case certification will be recomputed on the final accumulated branch, with provider/browser/human gaps retained where unverified.

Stack: #209 `claude/serene-thompson-yuft81` → main; BUG-001 `fix/pre-production-01-invitation-race` → `claude/serene-thompson-yuft81`. See [STACK-MAP.md](STACK-MAP.md).

---

# Retest status

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

No application fix, fix commit, fix PR, merge, or deployment was performed. Every confirmed bug remains OPEN and every fix retest is NOT_RUN. Baseline SHA and final workspace HEAD are identical. No repeated-green suite result supersedes the failed baseline.

Harness follow-ups are documented separately from fix retests: actual mark-sold route and DELETE 204 semantics; independent lock observer; valid allowlist setup; hydration waits and locator disambiguation. Original blocked attempts were retained. These improve evidence accuracy and do not close any product bug.

A later authorized fix phase must give each BUG-### a regression test, concrete fix diff/PR, targeted retest, neighboring lifecycle/role/tenant checks and required CI. Recompute all 556 classifications, provider/browser gaps and human results on the new exact SHA. The current NO GO stays in force.
