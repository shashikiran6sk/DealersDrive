# Assisted onboarding and publication gate — 25 October 2026

The confirmed workflow separates internal dealer approval from listing publication:
staff can save details, optionally supply available documents, submit completed
applications, and submit cars for an approved dealership without recording dealer
agreement. Standard document checks and the manual exception's existing safeguards
remain. The owner accepts once through their own authenticated account on entry,
without document uploads. Admin publication requires that agreement.

## Validation

| Check                                             | Result                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full API unit/integration suite                   | 177 files, 3,479 tests passed; all coverage thresholds passed (branches 90.18%, lines 96.98%). Run against a separate PostgreSQL 16 container; only the test connection port was changed to avoid other work. |
| Full frontend suite                               | 147 files, 1,792 tests passed.                                                                                                                                                                                |
| Contracts                                         | 25 files, 589 tests passed; published V1 source checksum unchanged.                                                                                                                                           |
| Production builds                                 | API, frontend and sandbox builds passed.                                                                                                                                                                      |
| Static checks                                     | API/web/sandbox typechecks, API/web/contracts lint, changed story lint, formatting and documentation references passed. Existing classify-photo unused-directive warning and pg deprecation notices remain.   |
| Matched API/Next production-bundle browser checks | 37 passed using synthetic local accounts and fake authentication; external HTTPS blocked.                                                                                                                     |
| Admin review preview                              | Passed at 375, 768, 1024 and 1280 px, without overflow; owner acceptance blocker visible and Publish disabled.                                                                                                |

Regression coverage includes manual activation with no documents or agreement;
standard approval after document review without agreement; staff submission before
owner login; rejection of staff-forged acceptance; blocked publication through a
direct API call; approval after owner agreement; and atomic refusal of reserved/
withdrawn reactivation while agreement is missing. Customer and owner account
acceptance, existing permissions, suspension and self-review restrictions remain.
No tests were skipped, no production records were changed, and no agreement was
backfilled. Only temporary isolated test databases were initialized.

## Evidence

[Browser results](browser-results.json) · [Responsive review checks](sandbox-results.json)

| Screen                    | Mobile                                | Desktop                                 |
| ------------------------- | ------------------------------------- | --------------------------------------- |
| Owner acceptance gate     | [375 px](owner-acceptance-375.png)    | [1280 px](owner-acceptance-1280.png)    |
| Admin publication blocked | [375 px](publication-blocked-375.png) | [1280 px](publication-blocked-1280.png) |

The admin screenshots use existing synthetic sandbox fixtures, including their
other unfinished checks. API regressions separately verify that agreement alone
blocks publication when all other listing requirements are complete.

## Release and rollback

No new migration, dependency, policy version or production environment setting is
required. The legal schema from #350 must already exist. Release matching frontend
and API revisions because the existing blockers enum now includes
DEALER_TERMS_NOT_ACCEPTED. Existing live inventory is not retroactively removed;
new publication and re-publication transitions require owner acceptance. Acceptance
never publishes automatically: an authorized reviewer must still approve.

Rollback redeploys the previous matched frontend/API pair, retains all receipts
and restores its stricter onboarding behavior and earlier publication behavior.
This work does not merge or deploy the change. See the PR for remote CI results.
