# #297 — genuine Dealer Verified status · independent review

PR: [#297](https://github.com/shashikiran6sk/DealersDrive/pull/297) · branch
`feat/dealer-verification` · base `main`. Original author evidence:
[`../pr-10-dealer-verification`](../pr-10-dealer-verification).

| SHA                  | Value                                              |
| -------------------- | -------------------------------------------------- |
| `main` at review     | `2f16932` (#296 squash)                            |
| Original PR head     | `23c47d1` (parent `cefed41`)                       |
| Reconciled           | `3341f62` — merge commit, byte-identical increment |
| Final validated head | `b5ef50b`                                          |

## Review

Verification is a separate state machine on `dealers` (NOT_VERIFIED → PENDING /
IN_REVIEW → VERIFIED / REJECTED → REVOKED), defaulting every existing dealer to
NOT_VERIFIED — nobody is verified automatically. The database refuses VERIFIED
without reviewer and timestamp. A VERIFIED decision needs: an ACTIVE (approved)
dealer, proven representative phone/email, reviewed PAN/address (and GST when a
GSTIN is supplied) with stored objects, a recorded GST applicability outcome,
registered-dealer authorization where applicable, and a structured evidence
assessment; it is re-authorized inside the transaction, refuses self-review by
the assisting rep or dealership members, uses optimistic versions, and audits
with a policy version. Material identity/contact/address changes and evidence
rejection revoke and send documents back for review. Yard photos never affect
it. Public `isVerified` = ACTIVE ∧ VERIFIED on every surface; unsupported
"verified" marketing claims are removed site-wide (footer, directory, home,
VDP, onboarding). Admins without `admin:document:review` no longer see
GSTIN/PAN/document links.

| Sev | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Resolution                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2  | `decide()` called `storage.head` inside the transaction holding the **shared admin-membership advisory lock** (also used by admin sign-in admission, support replies, member changes) plus the dealer/document row locks. The S3 client has no request timeout, so a slow object store stalled those platform-wide up to the 20 s transaction timeout; a concurrent document write blocked for the whole call (15 s in the regression test on the old code). | the fix commit (final head `b5ef50b`): existence check moved before the transaction (permission-gated so it cannot be used as a probe); inside the lock the required rows are re-read and compared with the checked fingerprint → `409 VERIFICATION_CHANGED` on any change. Two tests (lock/row free during storage calls; evidence race → reload conflict) fail on the old code and pass now. |
| P3  | Verification history shows reviewers as raw user ids.                                                                                                                                                                                                                                                                                                                                                                                                        | Noted.                                                                                                                                                                                                                                                                                                                                                                                         |

No P0/P1.

## Executed checks

| Check                                                    | Result                                                                                                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint + typecheck                                         | PASS on `b5ef50b`                                                                                                                                                                                        |
| tests (commit before, which differs only by test typing) | contracts 475 · web 1,542 · API 3,275                                                                                                                                                                    |
| verification suite on `b5ef50b`                          | 30 / 30                                                                                                                                                                                                  |
| build                                                    | PASS                                                                                                                                                                                                     |
| E2E (real stack)                                         | `e2e-results.json`: VERIFIED refused without evidence files; granted with evidence; public badge on directory + detail; revoke through the admin UI removes it (cache invalidation works); no old claims |

## CI on `b5ef50b`

| Check                           | Result  | Run                                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Vercel Preview Comments         | success | https://github.com/shashikiran6sk/DealersDrive/runs/114604050778                         |
| gitleaks                        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38184555105/job/114603984065 |
| terraform fmt / validate        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38184555100/job/114603983954 |
| dependency audit                | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38184555100/job/114603983876 |
| semgrep                         | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38184555105/job/114603983828 |
| lint · typecheck · test · build | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38184555100/job/114603983659 |
| Vercel                          | success | https://vercel.com/dealers-drive/dealersdrive-prod-web/3f6kZRCqfonsAiykifJCgEUZCVX3      |
