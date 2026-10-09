# PR 2 — canonical dealer email ownership

PR: [#288](https://github.com/shashikiran6sk/DealersDrive/pull/288).
Branch: `fix/dealer-email-uniqueness` · Base: `feat/dd-favicon-sizing` (#287).
Head: `9ad0c9e35c8a4c1e5018725c0cdee97fde9dd611`.
State: OPEN; unmerged; auto-merge disabled. No production deployment.

## Implementation

Private database-derived primary email metadata, canonical user/contact/OAuth
emails, unique primary identity and one-active-owner constraints. Typed assisted
email remains unverified and creates no user or OWNER relationship. Staff
memberships remain valid. Conflicts return useful field/banner feedback.
Assisted contact edit, verification reset, fresh request and audit are atomic.
Generic owner email reassignment is blocked. Existing Google subject sign-in
survives a conflicting email update, which is recorded for review without
changing ownership. Conflicting primary ownership merges roll back.

Verification/claim transactions re-read after acquiring locks. A deterministic
queued-request test proves an obsolete email link cannot mark a changed address
verified. Claims recheck current phone, expiry, ownership and account admission;
user-before-dealer-before-proof lock order is consistent with identity writes.

## Actual executed results

| Category             | Result                               | Artifact                                                                        |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| Formatting/lint/docs | PASS before and after PR             | `pre-pr-lint.txt`, `post-pr-lint.txt`                                           |
| Typecheck            | PASS all packages/sandbox            | Pre/post typecheck logs                                                         |
| Contracts            | PASS — 428                           | Pre/post full test logs                                                         |
| Frontend             | PASS — 1,489                         | Pre/post full test logs                                                         |
| API unit/integration | PASS — 3,043                         | Pre/post full test logs; real PostgreSQL                                        |
| Complete suite       | PASS — 4,960                         | Existing coverage gates retained                                                |
| API coverage         | PASS — 96.97% lines, 90.35% branches | Post-PR test log                                                                |
| Production build     | PASS uncached before/after           | Pre/post build logs                                                             |
| Migration rehearsal  | PASS five scenarios                  | `migration-rehearsal.txt` and full suite                                        |
| Security boundaries  | PASS                                 | `security-boundaries.txt`; extended full suite                                  |
| Browser/UAT          | PASS actual cookie-auth sales route  | `post-pr/browser-results.json`                                                  |
| Responsive           | PASS 320/390/768/1280px              | No overflow; actual field error and proof renewal, values retained              |
| Required GitHub CI   | PASS final head                      | All required checks, Terraform and Vercel preview successful on this exact head |

Local read-only inventory: 126 development dealer records; zero canonical-user,
multiple-active-owner and primary-dealer conflict groups. Only counts were
collected, no personal identifiers; no production access. See `legacy-audit.json`.
Production duplicates still require a restricted operator inventory before
rollout. Migration errors disclose counts and roll back completely rather than
selecting an owner or deleting/merging records. Representative migration tests
preserve identity, membership and listing IDs, and rehearse reviewed forward retry.

Original development failure in `initial-test-fixture-failure.txt` came from a
UUID/text binding in the new migration fixture, then was corrected and passed.
Browser harness initially needed input IDs/actual widget endpoint correction;
the final script exercises live local API results. These were harness issues,
not reported as product successes before correction.

## Screenshots and privacy

Actual screenshots under `pre-pr/` and `post-pr/`; final captures include full
pages and real viewport captures so fixed mobile navigation is shown correctly.
All data is synthetic in `dealersdrive_test`; cookie authorization is real.
KYC identifier inputs and contact text are masked before capture. Local session
token/OTP values are excluded. Logs redact email/phone/path values, terminal
colors and trailing whitespace. `browser-harness.mjs` contains no credential;
its private session fixture path is intentionally outside evidence. Read-only
inventory script is included for reproducibility with restricted local guards.

The historical 556-case certification, live Google/MSG91 delivery and production
data validation are not claimed. Existing ordinary Google/OTP/role regressions
run in the full suite with controlled providers and real database boundaries.

## Post-PR quality record

Migration: `20261009160000_dealer_primary_email`, additive, transactional; table
locks/ordinary unique indexes require production sizing and a planned window.
API changes: conflict responses, guarded identity updates and fresh proof checks.
UI changes: feedback and retained details through renewed mobile proof.
Security: no raw email in rejection events, no inferred ownership from typed email.
Final local failures: zero. Checks not executed: real provider/production/device UAT.
Final CI and Security run/HEAD verified in `ci-run.json`, `security-run.json` and `github-status.json`. PR 3 may now start from this head.
MERGED: NO.

Owner UAT: enter a case/whitespace variant of a registered primary email as a
representative, verify rejection and no new membership, then correct and retry.
Check conflicting draft edit rollback and continued staff access. Renew expired
mobile proof, confirming saved values remain. Keep application/data migrations
under owner-controlled review; do not deploy or merge from this campaign.
