# PR 6 — verified admin mobile authentication

- PR: [#293](https://github.com/shashikiran6sk/DealersDrive/pull/293)
- Branch: `feat/admin-mobile-otp`
- Base: `feat/optional-dealer-tagline` (parent #292)
- Final head: `38f1ccc38d89b539afe9f6c8af19217f1a3bbc82`
- State: OPEN, not Draft; MERGED: NO; auto-merge: disabled.

## Implementation

Google remains available and controls initial enrollment and recovery. Separate verified admin
mobile credentials never create an administrator, merge a customer/dealer identity or mutate
person phones. Admin and person session/OAuth cookies are isolated. Browser/session/purpose-bound
challenges expire after five minutes, persist five attempts, and enforce cooldown, phone quota,
fail-closed IP limiting and durable one-use hashes. Authorization, credential mutation, session
rotation and success audit are transactional. Member disabling shares the admission lock.
Suspended admin seats remain suspended during Google step-up. Google recovery revokes the mobile
credential and all admin sessions before another number can be enrolled. New mutations require
trusted Origin and JSON. Private status returns masked metadata only.

57 incremental files across two feature commits. Two additive transactional migrations:
`20261010100000_admin_session_assurance` and `20261010101000_admin_phone_credentials`.
No package dependencies, production migration or production deployment.

## Executed checks

| Check                                 | Result                                                                    | Evidence                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Formatting, lint, documentation       | PASS                                                                      | post-creation-lint.txt                                                   |
| Workspace typecheck                   | PASS                                                                      | post-creation-typecheck.txt                                              |
| Full local pre-creation tests         | PASS, 5,167                                                               | pre-creation-full-tests.txt                                              |
| Final constraint and migration checks | PASS, 50                                                                  | pre-creation-final-database.txt                                          |
| Full local post-creation tests        | PASS, 5,167                                                               | post-creation-full-tests.txt                                             |
| API unit/integration                  | PASS, 3,176 included in total                                             | Full test log; real PostgreSQL and cookie middleware                     |
| Web                                   | PASS, 1,523 included in total                                             | Full test log                                                            |
| Contracts                             | PASS, 468 included in total                                               | Full test log                                                            |
| Browser/mobile                        | PASS, 22 explicit checks                                                  | browser-results.json and actual PNGs                                     |
| Database                              | PASS                                                                      | Clean migrations and three legacy upgrade/constraint/rollback rehearsals |
| Prisma validation                     | PASS                                                                      | prisma-validate.txt                                                      |
| Production build                      | PASS                                                                      | post-creation-build.txt                                                  |
| Gitleaks                              | PASS, 584 commits, zero leaks                                             | local-gitleaks.txt and successful CI                                     |
| Semgrep                               | PASS under existing policy, 40 nonblocking findings, zero blocking/errors | local-semgrep.txt and CI                                                 |

Local post-creation API coverage: lines 96.89%, branches 90.07%. GitHub API branch coverage:
90.17%. All existing 90% thresholds remain enforced. Counts are totals for a single full run;
repeated executions and the focused 50 cases are not added together to inflate coverage.

## Final-head CI

[CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38035815394) and
[Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38035815358) completed
successfully at the final SHA above. Required lint/typecheck/test/build, dependency audit,
gitleaks and semgrep are successful. Terraform and Vercel checks also passed. GitHub CI executed
the same 5,167 automated cases. Successful audit is not a claim of zero dependency advisories.
Deployment metadata records Preview with `production_environment: false`.

## Actual browser evidence

Chromium runs used isolated contexts at 320, 390, 768 and 1280 pixels. The actual application
performed controlled Google login, phone enrollment, same-number customer/admin login, real
60-second cooldown, OTP login, refresh/second tab, Google step-up, revocation and lost-phone
recovery. Extra checks exercise customer/dealer logout, forged cross-scope logout cookies and
OTP rotation rejecting the old token. Token values were never printed or published. Harness files are sanitized reference copies;
replace contact/path placeholders with approved local fixtures before replaying them.

Before images show the actual parent build with local Google configuration absent; after images
use a controlled configured Google provider. This is an environment difference, not a claimed
change to Google availability. Dark or magenta masks intentionally cover synthetic contact/OTP
fields. Images are screenshots, not mockups. The initial external redirect interception timed
out; the controlled adapter was changed to loopback callbacks and the complete campaign passed.

## Limits and rollout

Live Google accounts, real SMS, production tenant `iat`/`exp` compatibility, native Safari and
physical-device testing are NOT RUN. Admin verification fails closed without fresh provider
claims. Provider-side attempt/resend protection and CAPTCHA remain deployment prerequisites;
application challenge limiting does not exclusively control direct widget delivery. Existing
advisory dependency findings remain. No blanket production GO is issued.

Coordinate API/web cookie rollout; existing admins reauthenticate through Google. Legacy session
methods remain unknown and person phones are not copied into admin credentials. Retention and
recycled-number handling require reviewed operational procedures. Security policy and owner UAT
are documented in the feature branch's `docs/project/admin-mobile-otp.md`.

A flaky sale-notification timestamp assertion discovered by the campaign now compares delivery
IDs before/after the sale, preserving the no-new-email invariant.

## Owner UAT

Sign in with Google → Profile · Security → link a synthetic approved test number. Sign out →
Mobile OTP → dashboard. Keep a customer session in parallel; each logout must preserve the
other scope. Mobile sessions require Google step-up for credential changes. Revoke, sign in
again with Google, and verify another number. Confirm suspended/disabled/removed admins,
unknown/customer/dealer-only numbers and replayed proofs cannot access the console.

Next planned PR: 7, `feat/mobile-admin-access`, only after evidence publication and final gate.
DO NOT MERGE. No production deployment.
