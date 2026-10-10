# PR 10 — Genuine dealer verification

- PR: https://github.com/shashikiran6sk/DealersDrive/pull/297
- Branch: `feat/dealer-verification`
- Base: `fix/mobile-sidebar-navigation` / PR 296, `cefed41177086685bb56423522bfd67d2ea9e7dc`
- Final head: `23c47d14cd39f0effc59f5327d42661efa411edd`
- Incremental diff: 59 files, two commits, one additive migration
- State: OPEN; MERGED: NO; no production deployment
- Next: PR 11, `feat/optional-gstin`, implemented in an isolated worktree; opening follows passing parent certification

## Implementation and security

Approval, verification, physical location, vehicle inspection and listing moderation remain
separate. New independent statuses are NOT_VERIFIED, PENDING, IN_REVIEW, VERIFIED, REJECTED
and REVOKED. Only an explicit genuine verification decision on an ACTIVE approved business
produces the public Dealer Verified flag. Yard ownership and photos are never a criterion;
every directory card still uses the same shared conceptual image.

Current admitted authorized MODERATOR/SUPER_ADMIN membership is rechecked in the transaction.
Dealer members and the onboarding assistant cannot self-review. Dealer/document locks and
expected version protect concurrent decisions. Verified contacts must be actually proved and
match the current owner for self onboarding. Applicable reviewed private documents must have
reviewer/time/file metadata and actual bytes in protected storage. Supplied GSTIN has its own
registration assessment; reviewed non-requirement is separate. Format is never registration proof.

The administrator records checks actually performed, references, legal classification and
regulatory/GST outcomes. Unresolved legal applicability must remain in review. Rejection and
revocation require reasons. Every decision atomically records actor/time/status/evidence/policy
in the existing private audit log. Latest 100 decisions render in the admin panel; full records
remain. Core identity/contact/address/tax changes and reviewed-document rejection revoke the
badge and invalidate document reviews while preserving bytes. Public APIs omit assessment,
KYC documents, PAN and reviewer identifiers. Existing public GSTIN business contact display
remains, without a registration-proof claim. SUPPORT does not receive private KYC signed URLs,
filenames/rejection notes or PAN/GST identifiers in admin dealer detail.

This is accountable manual business verification, not automatic government-registry validation
or a guarantee of yard/vehicle ownership or vehicle condition. See the feature branch policy
`docs/project/dealer-verification.md`, with final official G.S.R.901(E) and qualified GST sources.

## Executed results

Pre-creation validation was executed; full local gates and browser UAT were executed again
**after PR creation**, including the final fix. These are unique current suite counts, not
summed reruns or the historical 556-case manual certification.

| Category             | Result                                                                                                               | Evidence                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Formatting/lint/docs | PASS                                                                                                                 | final-lint2.txt                                                       |
| Typecheck            | PASS, forced workspace check                                                                                         | final-typecheck2.txt                                                  |
| Unit/integration     | 5,256 PASS: API 3,247; web 1,535; contracts 474                                                                      | final-tests2.txt                                                      |
| API coverage         | Branches 90.34%, lines 96.99%; unchanged 90% threshold                                                               | final-tests2.txt                                                      |
| Feature integration  | 28 actual API/PostgreSQL cases: states, proof, roles/self-review, stale membership, concurrency, revocation, privacy | Feature test file and full tests log                                  |
| Database             | Three isolated clean/legacy/constraint/rollback cases; valid Prisma schema, model index matches migration            | Full tests; final-prisma.txt                                          |
| Production builds    | PASS before and final post-creation fix                                                                              | pre-build.txt, final-build.txt                                        |
| Browser              | 17 actual checks PASS, controlled providers and synthetic protected documents                                        | browser-results.json, final-browser-output.txt, browser.sanitized.mjs |
| Mobile/desktop       | Admin and public pages at 320/390/768/1280px; no horizontal overflow                                                 | screenshots/                                                          |
| Security             | Final-head Semgrep/gitleaks checks pass; no configured blocking findings/no leaks                                    | security-ci.json, final-security-log.txt                              |

Commands: `pnpm lint`, `pnpm run typecheck --force`,
`TZ=UTC APP_ENV=local pnpm run test --env-mode=loose --force`, `pnpm build --force`,
Prisma generation and `pnpm --filter @dealers-drive/api exec prisma validate`.

Actual browser UAT found a persisted verification decision did not invalidate the existing
cached public badge. Same-PR fix `23c47d14` uses existing dealer **and vehicle** cache tags;
the regression checks both and the repeated browser workflow visits public pages before
verification/revocation, then confirms the changed badge. Existing core-edit/document actions
already invalidate those tags. Also aligned the Prisma model's index with SQL and removed old
onboarding copy implying a required yard or equating approval with Dealer Verified.

Browser flows include: approved/no fabricated badge, active legacy non-GST business, separate
admin review, actual no-yard verification, restricted history/reload, genuine public badge,
shared directory asset, revocation, rejection, corrected re-review, and a real rendered verified
directory card. Initial select-label matching was corrected to reflect the existing control's
accessible option text; no product/security workaround was added.

## CI

[CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38080684496) and
[Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38080684488) completed
SUCCESS against `23c47d14cd39f0effc59f5327d42661efa411edd`. Required checks and the preview
build pass; exact-SHA JSON records are included. The deployment is Preview with
`production_environment: false`. Existing configured advisory reports remain, without any
control changes. No prior SHA is used as final proof.

## Migration and rollout

`20261010150000_dealer_verification` adds status/version/time/reviewer and constraints. Existing
businesses start NOT_VERIFIED without changing approval, ownership, memberships, listings or
private document bytes. No fabricated ACTIVE/yard backfill. Schema first, compatible APIs/web
next; drain old writers before enabling review because old code cannot revoke a new badge on
business evidence changes. Reviewer IDs retain historical meaning after account removal,
consistent with the existing audit model. Rollback before writes was rehearsed; after real
verification decisions prefer a forward fix preserving history. No production DB operation.

## Owner UAT

1. An approved business initially has no badge. Its directory/detail/car/suggestion flag must
   reflect actual verification, and the shared conceptual directory image remains constant.
2. Use an authorized reviewer, start IN_REVIEW, inspect protected business/contact evidence,
   and record performed checks/classification/authorization/GST applicability. Yard is optional.
3. Save VERIFIED and inspect the already-visited public page. Badge appears without stale cache.
4. Revoke/reject with a reason, inspect restricted actor/time/history, and verify public removal.
   Corrected evidence can enter a fresh review. Approval stays independent.
5. Change core identity or reject a reviewed document: badge revokes and document reviews require
   reassessment; protected bytes remain. Marketing edits do not revoke.
6. Try staff, sales, SUPPORT, assisting/self reviewer, revoked membership, forged and concurrent
   API requests. Confirm authorization, proof checks and expected-version refusal.
7. Inspect public JSON for assessment/KYC/PAN/reviewer leakage. Check all representative widths.

## Limits

No live government document validation, real customer data, production migration, native Safari
or physical-device certification. Controlled identity providers with real app/API/transactions/
local storage/browser; all protected documents are explicitly synthetic. Screenshots mask contact,
PAN/GSTIN values. Build API-fetch fallback warnings occur with the runtime API stopped; builds
exit successfully and runtime pages were tested afterwards. Existing dependency/security
advisories remain. Product/legal owner must establish actual applicable obligations before
awarding real badges. No production GO; leave open for owner review and do not merge/deploy.
