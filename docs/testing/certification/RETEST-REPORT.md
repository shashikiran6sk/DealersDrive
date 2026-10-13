# Retest report — fix stack and post-merge certification

## Merge ledger (sequential, squash per repository convention, `expectedHeadSha` pinned)

| PR   | Purpose                                                             | Review | Evidence moved                             | Exact-head CI / Security                      | Final head | Merge → main |
| ---- | ------------------------------------------------------------------- | ------ | ------------------------------------------ | --------------------------------------------- | ---------- | ------------ |
| #209 | Branded 404 + safe error handling (ORIG-BUG-007)                    | PASS   | 35 files (`fixes/404`)                     | CI 381 ✔ / Security ✔ (37202728142)           | `1ba2fdb`  | `e0c4518`    |
| #231 | Invitation lock order (BUG-001, NEW-002)                            | PASS   | `fixes/BUG-001` + Agent 2 dossier (162)    | CI 383 ✔ / Security ✔ (37203706092)           | `a808dad`  | `a3660b2`    |
| #232 | Approval prerequisites, suspend/reinstate guards (ORIG-BUG-002/003) | PASS   | `fixes/BUG-002`                            | CI 385 ✔ / Security ✔ (37204502859)           | `70b44e5`  | `38c5122`    |
| #233 | Destructive rejection race (NEW-005)                                | PASS   | `fixes/BUG-NEW-005`                        | CI ✔ (37205206647) / Security ✔ (37205206610) | `6901a8c`  | `43ef2ff`    |
| #234 | Stable keyset pagination (BUG-003)                                  | PASS   | `fixes/BUG-003`                            | CI ✔ (37205919941) / Security ✔ (37205919978) | `153e75e`  | `9f29117`    |
| #235 | Suspended dealer vehicle media (BUG-004)                            | PASS   | `fixes/BUG-004`; 3 test fixtures relocated | CI 394 ✔ / Security ✔ (37206716655)           | `d41eb72`  | `508b58a`    |
| #236 | Vehicle write commit guard (BUG-005)                                | PASS   | `fixes/BUG-005`                            | CI ✔ (37207669059) / Security ✔ (37207669068) | `899c419`  | `73fc42f`    |
| #237 | Production requires r2 (BUG-006; ORIG-BUG-006 partial)              | PASS   | `fixes/BUG-006`, `BUG-NEW-013`             | CI ✔ (37208455912) / Security ✔ (37208455972) | `91be6ef`  | `1831386`    |
| #238 | Admin mobile header/tabs (BUG-008)                                  | PASS   | `fixes/BUG-008`                            | CI ✔ (37209442168) / Security ✔ (37209442179) | `6b33e4d`  | `f74401a`    |

For every layer: the evidence was copied to `testing_evidence` (draft #239) before it was
removed; `main` was merged in; the patch against `main` was checked **byte-identical** to
the reviewed layer diff (original parent tip → layer tip); the regression test was run
**red on the parent** before green; full local gates (format, lint, docs references,
typecheck, test, build) passed; and CI + Security passed on the exact pushed head before
merging. `main` contains no `docs/testing/**` after the stack.

Deliberate deviations from the stack as Agent 2 left it, each in its own commit:

- **#209** carries the stack's two exact, anchored gitleaks allowlists. gitleaks scans every
  branch, and Agent 2's evidence branches contain a `reproducibility=` keyword and four
  screenshot checksums; Security was red for every PR and for `main` without them
  (local proof: main's config 5 findings, ported config 0).
- The **stacked-base CI trigger** change (#231) was dropped: every PR targeted `main`.
- **#235**: the regression test's three inert fixtures moved from the evidence folders to
  `apps/api/tests/fixtures/media/` (byte-identical), four paths updated, Prettier-formatted.
- **#209**: `feature-map.md` component IDs corrected to C131–C135.

The Release workflow ran on each merge: it builds the images and discards them
(`AWS_DEPLOY_ENABLED` is not `true`; ECR login/push skipped; `deploy-dev` commented out).
**Nothing was deployed.**

## Original findings retested per layer (my own reproductions, not Agent 2's tests)

| Probe                                           | Baseline                       | After                                | Where      |
| ----------------------------------------------- | ------------------------------ | ------------------------------------ | ---------- |
| LIFE-DISC-001a approve DRAFT (no GSTIN/PAN)     | FAIL (200 ACTIVE)              | PASS (422 NOT_UNDER_REVIEW)          | #232       |
| LIFE-DISC-001b approve SUSPENDED                | FAIL                           | PASS (422)                           | #232       |
| LIFE-DISC-002a reinstate never-approved PENDING | FAIL                           | PASS (422 INVALID_DEALER_TRANSITION) | #232       |
| LIFE-DISC-002b suspend/reinstate DRAFT          | FAIL                           | PASS (422/422)                       | #232       |
| LIFE-DISC-002c reinstate ACTIVE                 | FAIL                           | PASS (422)                           | #232       |
| Valid approve → suspend → reinstate             | —                              | PASS, `approvedAt` preserved         | #232       |
| VERIFY-011 (canonical)                          | FAIL                           | PASS                                 | #232       |
| PROD-002 (canonical)                            | FAIL                           | PASS                                 | #237       |
| PUBLIC-021 / SEO-009 (canonical)                | not run (default 404 observed) | PASS                                 | #209       |
| SEC-DISC-001a/b/c forged storage links          | FAIL                           | **FAIL**                             | still open |
| API-DISC-001/002/003 document lifecycle         | FAIL                           | **FAIL**                             | still open |
| API-DISC-004 yard photo moderation              | FAIL                           | **FAIL**                             | still open |

## Harness corrections made during the retest (never reported as product failures)

| Check                                                                             | What happened                                                                                                                                                                                                     | Correction                                                   |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| MODERATION-008                                                                    | Queue grew to 66 pending items; harness read only page 1 (48, oldest first).                                                                                                                                      | Walk all pages — listing on page 2; PASS.                    |
| CONCURRENCY-005                                                                   | After #236 the suspension wins the race: submit 401, listing stays DRAFT. Predicate only accepted PENDING_REVIEW.                                                                                                 | DRAFT and PENDING_REVIEW are both safe (never public); PASS. |
| PUBLIC-002 / UX-003 / UX-004 / UX-007 / UX-009 / BROWSER-012 / GOLDEN-006/008/010 | Selector or timing errors (unnamed input, autofocused field, duplicate control names, focus check before restore, "Logout" not "sign out", wrong profile path, inline suspend reason, network-idle on 404 pages). | Each re-run against the real UI; outcomes recorded.          |
| #209 browser retest                                                               | Local `APP_ENV` makes every page noindex by design; BFF takes `search`, not `q`.                                                                                                                                  | Production-config web server with a public origin.           |

## Final canonical totals (556)

| Status         | Baseline (d6ae115) | Final (main f74401a)               |
| -------------- | ------------------ | ---------------------------------- |
| PASS           | 497                | **543**                            |
| FAIL           | 2                  | **1**                              |
| BLOCKED        | 6                  | **10**                             |
| NOT_APPLICABLE | 2                  | **2**                              |
| Not run        | 49                 | **0**                              |
| **Accounted**  | 507 / 556          | **556 / 556** — `COMPLETENESS: OK` |

Transitions: VERIFY-011 FAIL→PASS (#232); PROD-002 FAIL→PASS (#237); the 49 browser,
UX, SEO, GOLDEN and PUBLIC scenarios not run at baseline → 43 PASS, 5 BLOCKED, 1 FAIL
(BROWSER-009). All 507 previously classified scenarios were re-run on `main`; none regressed.

Agent 2's separate dossier (archived at `docs/testing/pre-production`) recorded
244 PASS / 7 FAIL / 305 BLOCKED for the same 556 IDs. It is a different execution of the
same registry, mostly API-integration-test attribution with large BLOCKED sets; this
dossier is the original auditor's live execution and is the one reconciled here. Both are
kept unmodified.
