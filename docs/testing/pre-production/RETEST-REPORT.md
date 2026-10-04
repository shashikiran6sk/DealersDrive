# Fix verification update

The original certification baseline below remains unchanged: **556 canonical tests, 244 PASS, 7 FAIL and 305 BLOCKED**. Scoped fix retests are recorded separately; no original failure is rewritten as a pass. All 162 original dossier files are preserved, with both reports retaining their complete original baseline beneath this update.

The current verified top is PR #238 at `a52a107e942d55b5137a42a157bc2f1b1fb09e19`: **CI 376 and Security 525 PASS, all five jobs**. The following documentation commit preserves identical product and test files; its actual final checks are recorded in the PR description and final checkpoint. No PR is merged. Main remains `d6ae115359c4d0ae7ab0fd5115336291666cbb08`.

| Layer                | PR   | Branch                                          | Base           | Agent retest / verified CI               |
| -------------------- | ---- | ----------------------------------------------- | -------------- | ---------------------------------------- |
| Branded404 / BUG-007 | #209 | `claude/serene-thompson-yuft81`                 | `main`         | PASS;107a462; CI358/Security507          |
| BUG-001              | #231 | `fix/pre-production-01-invitation-race`         | 404 branch     | PASS;1f38a13; CI361/Security510          |
| BUG-002              | #232 | `fix/pre-production-02-approval-gate`           | BUG-001 branch | PASS;3570dcf; CI363/Security512          |
| BUG-NEW-005          | #233 | `fix/pre-production-new-005-rejection-race`     | BUG-002 branch | PASS;d29d9b9; CI366 attempt2/Security515 |
| BUG-003              | #234 | `fix/pre-production-03-stable-pagination`       | NEW-005 branch | PASS;62b1491; CI368/Security517          |
| BUG-004              | #235 | `fix/pre-production-04-suspended-media`         | BUG-003 branch | PASS;adeb847; CI370/Security519          |
| BUG-005              | #236 | `fix/pre-production-05-membership-commit-guard` | BUG-004 branch | PASS;e80d124; CI372/Security521          |
| BUG-006              | #237 | `fix/pre-production-06-production-storage`      | BUG-005 branch | PASS;c9dfc4d; CI374/Security523          |
| BUG-008              | #238 | `fix/pre-production-08-admin-mobile`            | BUG-006 branch | PASS;a52a107; CI376/Security525          |

All nine PR heads and immediate bases were checked against GitHub. [Full stack map](STACK-MAP.md) records exact branch dependencies. [Next-session handoff](NEXT-SESSION-HANDOFF.md) contains reproduction evidence, runtime setup and the next exact action.

The accumulated automated suite passes **4,516 tests** at `87b462709969d2d75c9ba005435eed8975d18567`: API 2,750 across 132 files, web 1,346 across 99, contracts 420 across 14. API coverage is 97.02% statements, 92.4% branches, 98.37% functions and 97.82% lines; thresholds pass. Existing invitation, activation, rejection, pagination, media, member authorization, RBAC and lifecycle regressions are included. Lint, typecheck, fresh build and committed-history scans pass. Actual remote CI also passes the full suite and build.

[BUG-006](../fixes/BUG-006/README.md) preserves the exact-parent MinIO acceptance failure and verifies R2-only production boot with 61 configuration tests, 177 affected unit tests, 143 adjacent integration tests and 26 isolated process/entrypoint probes. Its final #237 CI374/Security523 proof is carried into BUG-008.

[BUG-008](../fixes/BUG-008/README.md) preserves the 425px Admin overflow at 390px and 320px before source changes. Its final built UI passes 30 geometry checks across six Admin views and five widths, 13 functional scenarios, 20 negative direct endpoints, logout/access-revocation stale-session checks, database ownership/history checks and seven mobile golden checks. Before/after and history screenshots are retained and visually inspected. Automated browser scripts ran locally with the session’s Chromium/Playwright runtime; repository CI does not provide that runtime.

**Remaining confirmed defects: P0 0 confirmed, P1 1, P2 6, P3 1.** NEW-012’s queued enquiry revocation race is the highest-priority next fix. NEW-006 onboarding overflow, NEW-007 inventory pagination, NEW-008 local PDF MIME, NEW-009 suspended yard visibility, NEW-010 warmed vehicle pages, NEW-013 production endpoint validation and NEW-011 media-width prose require separate PRs. NEW-001 logging privacy and BUG-009 dependency reachability/patches remain two provisional P2 assessments. See [open findings](new-bugs.json) and the handoff for individual evidence. No unrelated additional defect was silently fixed in BUG-006/008.

**Human UAT: PENDING. Production: NO GO.** The full 556-test/provider/deployment certification remains incomplete; inert fixtures do not certify live R2, MSG91, Resend, deployed credentials or provider delivery. Scoped automation and Agent retests pass, but known additional defects and blocked gates remain. The user directs handoff after BUG-006/008; no additional PR is started and no merge is authorized.

---

# Retest status

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

No application fix, fix commit, fix PR, merge, or deployment was performed. Every confirmed bug remains OPEN and every fix retest is NOT_RUN. Baseline SHA and final workspace HEAD are identical. No repeated-green suite result supersedes the failed baseline.

Harness follow-ups are documented separately from fix retests: actual mark-sold route and DELETE 204 semantics; independent lock observer; valid allowlist setup; hydration waits and locator disambiguation. Original blocked attempts were retained. These improve evidence accuracy and do not close any product bug.

A later authorized fix phase must give each BUG-### a regression test, concrete fix diff/PR, targeted retest, neighboring lifecycle/role/tenant checks and required CI. Recompute all 556 classifications, provider/browser gaps and human results on the new exact SHA. The current NO GO stays in force.
