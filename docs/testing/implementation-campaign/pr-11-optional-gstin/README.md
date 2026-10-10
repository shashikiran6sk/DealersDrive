# PR 11 — Optional GSTIN

- PR: https://github.com/shashikiran6sk/DealersDrive/pull/298
- Branch: `feat/optional-gstin`
- Base: `feat/dealer-verification` / PR 297, `23c47d14cd39f0effc59f5327d42661efa411edd`
- Head: `b500bd5ae6bd026f8f0e9b0d7b3a6cd5fc7c531e`
- Incremental diff: 27 files, one commit, one safe additive constraint migration
- State: OPEN; MERGED: NO; no production deployment
- Next: combined-stack regression, then independent Draft PR 12 from latest main

## Implementation

General registration permits omitted, null, empty and whitespace GSTIN without fabrication.
Omission preserves a patch; blank/null clears to NULL. Supplied values trim/uppercase and must
match format. Format is not active-registration verification. Existing unique tax identity
semantics remain; precheck and race errors return GSTIN_ALREADY_REGISTERED with a field error.

GST_CERTIFICATE is applicable when GSTIN is supplied. PAN/address checks remain; uploaded
optional certificates and their bytes are retained. Admin approval of a no-GST business
requires a performed non-requirement review and protected case reference, audited with the
approval. Blank GSTIN is not a legal exemption. Unresolved applicability remains under review.
PR 10's genuine badge requires its separate applicable verification assessment; core tax
changes/clearing revoke it and require evidence review again without disabling the business.
Active dealer self-edit permissions are not relaxed. Conditional public GSTIN disappears when
cleared, without exposing PAN or private certificates.

## Actual execution

Pre-creation full validation and separate mandatory post-creation full validation executed
against this branch. Counts are one suite, not accumulated repeats or the historical 556 cases.

| Category             | Result                                                                                                                                                                           | Evidence                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Formatting/lint/docs | PASS before and after                                                                                                                                                            | pre-lint-final.txt, post-lint.txt                                 |
| Typecheck            | PASS, forced                                                                                                                                                                     | pre-typecheck-final.txt, post-typecheck.txt                       |
| Unit/integration     | 5,289 PASS: API 3,268; web 1,537; contracts 484                                                                                                                                  | pre-tests4.txt, post-tests.txt                                    |
| API coverage         | Post branches 90.42%, lines 97.02%; unchanged 90% gate                                                                                                                           | post-tests.txt                                                    |
| Feature/database     | 16 API cases plus five isolated migration cases, including real no-GST approval, sales assistance, concurrent duplicate, protected-byte preservation and verification revocation | Full tests log and feature test files                             |
| Production builds    | PASS before and after, forced                                                                                                                                                    | pre-build.txt, post-build.txt                                     |
| Browser              | 13 actual workflow checks PASS: nine profile/admin/public, four draft onboarding                                                                                                 | browser-results.json, onboarding-browser-results.json and outputs |
| Mobile/desktop       | 320/390/768/1280px, no overflow                                                                                                                                                  | screenshots/                                                      |
| Security             | Relevant negative cases, existing authentication/authorization regressions; final-head scans                                                                                     | security-ci.json, security-log.txt                                |

Commands: `pnpm lint`, `pnpm run typecheck --force`,
`TZ=UTC APP_ENV=local pnpm run test --env-mode=loose --force`, `pnpm build --force`.

Old tests that universally expected GSTIN and three required certificates were updated to
assert optional collection and a meaningful applicability review, preserving PAN checks.
An exact-label test was corrected for the existing field hint. No test or threshold was disabled.
The real API test confirms refusing no-GST approval without its review, then accepting an
actual reviewed case; no bypass credential or fake production mode was introduced.

Browser UAT covers actual approved business without GSTIN, existing dealer OTP login,
optional profile at four widths, invalid supplied GSTIN error, persist/update/clear/reload,
public cache invalidation, actual draft document step at four widths, absence of the empty
GST certificate requirement and no horizontal overflow. All text inputs and contact/tax
values are masked at screenshot capture. Evidence is the actual built app, not mockups.

## Database and rollout

`20261010153000_optional_gstin` preflights canonical duplicate identities and invalid legacy
values, reports counts only, and aborts without changing records. Valid casing/outer ASCII
whitespace normalizes; blank becomes NULL. A lowercase checksum ending in v is covered so
vertical-tab trimming cannot accidentally strip a legitimate character. Ambiguous/Unicode
legacy formatting requires private correction rather than silent guessing. Format CHECK and
existing unique index protect raw writes and races while many NULLs remain legitimate.
The tests rehearse clean migration, normalization/data preservation, duplicate/corrupt abort,
constraints and pre-rollout rollback. Owners, business status, PAN, listings and document bytes
are preserved. Schema first, compatible writers next; no production DB operation was executed.

Optional collection does not remove GST obligations. The qualified source/legal-policy notes
are in `docs/project/optional-gstin.md`. No universal turnover/exemption rule is hard-coded;
current law and actual business facts require accountable review.

## CI

[CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38081826917) and
[Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38081826913) completed
SUCCESS against `b500bd5ae6bd026f8f0e9b0d7b3a6cd5fc7c531e`. All required checks and preview build
pass. Exact-SHA results are included; deployment metadata is Preview, production_environment=false.
No previous green SHA was used. Existing configured advisory reports remain, with no control changes.

## Owner UAT

1. Self/sales/admin draft creation/edit: no GSTIN, blank/null and omitted patches behave correctly.
2. Complete applicable PAN/address evidence and submit without a universal GST certificate.
   Before approval, admin records actual GST non-requirement; uncertainty stays under review.
3. Supply valid-format lowercase/outer whitespace GSTIN: canonical storage, certificate requirement.
   Invalid supplied values show a meaningful error. Exact/case duplicates and racing assignments
   must allow only one business to receive the unique tax identity.
4. Authorized admin changes/clears existing GSTIN; document bytes remain, genuine verification
   revokes for reassessment, and public GSTIN row disappears. Approval remains independent.
5. Verify existing dealer OTP/Google and role boundaries, mobile/desktop forms and private documents.

## Limitations

Synthetic protected documents and controlled identity provider boundaries; real application,
server actions, API, local PostgreSQL and browser. No live government verification, native Safari,
physical-device or production migration certification. Optional API-fetch fallback build warnings
occur with API stopped; successful builds are followed by actual runtime browser UAT. Existing
dependency/security advisories remain. No production GO; owner controls review/merge/deployment.
