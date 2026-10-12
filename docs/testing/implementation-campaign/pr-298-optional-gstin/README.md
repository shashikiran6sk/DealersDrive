# #298 — optional GSTIN · independent review

PR: [#298](https://github.com/shashikiran6sk/DealersDrive/pull/298) · branch
`feat/optional-gstin` · base `main`. Original author evidence:
[`../pr-11-optional-gstin`](../pr-11-optional-gstin).

| SHA                  | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `main` at review     | `91e3533` (#297 squash)                                                                     |
| Original PR head     | `b500bd5` (parent `23c47d1`)                                                                |
| Reconciled           | `139324b` — merge commit; increment identical apart from the `max-md:basis-full` #294 added |
| Final validated head | `8310fba`                                                                                   |

## Review

GSTIN becomes optional across self-registration, assisted onboarding, the
dealer profile editor and admin edits. Blank input is stored as `NULL`, never
as an empty string. When a GSTIN is supplied it is validated (15-character
format), canonicalized to upper case and unique (409
`GSTIN_ALREADY_REGISTERED`). The GST certificate is required only when a GSTIN
is present (`requiredDealerDocuments`), and the same rule decides completeness,
`allDocumentsVerified` and approval.

What holds up:

- **Fail-closed migration** `20261010153000_optional_gstin`. The preflight
  aborts on blank, malformed or case-duplicate GSTINs and reports counts only.
  It then canonicalizes the column and adds a `CHECK` on the format. It is
  additive: no row is deleted. `optional-gstin-migration.test.ts` covers clean
  data, legacy data, aborts and retry.
- **A blank GSTIN is not treated as an exemption.** Approving a dealer without
  a GSTIN needs a recorded applicability review of 20–1000 characters, and the
  review is written to the `dealer.approved` audit row. Without one the API
  answers 422 `GST_APPLICABILITY_REVIEW_REQUIRED`. Dealer Verified (#297) still
  requires its own recorded GST outcome.
- The onboarding documents step hides the GST certificate uploader only when it
  is irrelevant: no GSTIN and status still `REQUIRED`. An uploaded or rejected
  certificate stays visible.
- The dealer profile form keeps an explicitly cleared GSTIN as a deliberate
  clear rather than restoring the stored value. This follows the same pattern
  as the tagline in #292.

| Sev | Finding                                                                                                                                                                                                             | Resolution                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3  | New user-facing sentences were written inline in JSX: the approve-block review label and hint, and the onboarding GST obligation note. The 20/1000 bounds were repeated in the contract and the UI (CLAUDE.md §4b). | `8310fba`: text moved to `DEALER_ACTIONS_TEXT` and `ONBOARDING_TEXT`; `GST_REVIEW_MIN_LENGTH` / `GST_REVIEW_MAX_LENGTH` exported once from `dealer-gstin.ts`. Behaviour unchanged. |
| P3  | `docs/project/optional-gstin.md` named the policy "PR 10" and carried a campaign sentence.                                                                                                                          | `72f8d8f`: names the dealer verification policy instead.                                                                                                                           |
| P3  | The admin dealer page still has pre-existing inline strings, such as "required documents verified".                                                                                                                 | Left as is: that file's existing pattern, outside this PR's scope.                                                                                                                 |

No P0/P1/P2.

## Executed checks (Node 24.21.0, PostgreSQL 16.15)

| Check                                        | Result                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint + typecheck                             | PASS on `139324b` and `8310fba`                                                                                                                                                  |
| full tests on `139324b`                      | contracts 485 · web 1,544 · API 3,296 (`logs/test-summary.txt`)                                                                                                                  |
| affected tests on `8310fba`                  | contracts 485 · web dealer-actions + onboarding-wizard 76 · API optional-gstin + dealer-approval-gate 37                                                                         |
| build                                        | PASS on `139324b`; contracts/API/web rebuilt PASS on `8310fba`                                                                                                                   |
| migration on the local dev database          | applied cleanly over the seeded data                                                                                                                                             |
| E2E (real stack, 390 px, `e2e-results.json`) | API: 422 without review, 400 for a short one. UI: field shown, Approve disabled until review ≥ 20 chars, approval succeeds, dealer Active, audit carries the review, no overflow |

`72f8d8f` changes Markdown only. `8310fba` moves strings and constants. CI ran
the full suite on `8310fba`.

## Rollout

The migration must run before the new API. A database holding blank, malformed
or case-duplicate GSTINs fails the migration safely: it changes nothing and the
rollout stops. Old web code against the new API still sends a GSTIN, which is
accepted. New web code against the old API would fail on a blank GSTIN, so
deploy the API with or before the web.

## CI on `8310fba`

See `ci.md`.
