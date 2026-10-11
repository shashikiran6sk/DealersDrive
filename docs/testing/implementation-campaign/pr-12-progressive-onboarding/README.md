# PR 12 — independent progressive onboarding certification (DRAFT)

[PR 299](https://github.com/shashikiran6sk/DealersDrive/pull/299) remains Draft, open and unmerged, targeting main. Final head: `f563188894c4073e350bcd249292a15575595ae3`. Branch point is latest main `d423db1caf9212dab51ee938187234a4660e4f5b`, and no unmerged stack head is an ancestor. No production deployment or migration occurred; automatic Vercel metadata reports Preview / production_environment false.

DRAFT — Independent progressive dealer onboarding and verification. Awaiting product and legal review. Do not merge.

## Implementation

Lightweight proved registration, versioned consent, partial draft saving/resume, sales-assisted consent/OTP/email coordination, individually applicable private evidence review and controlled activation. Existing approved dealers remain unchanged. Actual authorization and evidence checks, optimistic review versions, identity-change invalidation, ownership serialization, restricted progressive document payloads and suspension/reinstatement checks preserve the new lifecycle. Final browser review fixes hide forbidden document mutations and unauthorized reviewer controls. Approval stamps make no unsupported yard verification claim.

## Actual final-head validation

| Category                      | Result                                                 | Evidence                                                      |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Formatting/lint/docs          | PASS                                                   | final-lint-head.txt; initial forced lint post-forced-lint.txt |
| Typecheck                     | PASS                                                   | final-typecheck-head.txt                                      |
| Unit/contracts/integration    | PASS, 5,005 total: API 3,067; web 1,497; contracts 441 | final-tests.txt                                               |
| API coverage                  | PASS, branches 90.49%, lines 96.92%                    | final-tests.txt                                               |
| Lifecycle/security/migrations | PASS, 37 targeted cases plus full suite                | pre-feature-final.txt and final-tests.txt                     |
| Browser/mobile                | PASS, 36 checks                                        | browser-results.json, browser-output.txt, actual screenshots  |
| Production build              | PASS                                                   | final-build.txt                                               |
| Final-SHA CI                  | PASS                                                   | ci.json and security-ci.json                                  |

Executed commands: repository lint, forced workspace typecheck, `TZ=UTC APP_ENV=local pnpm run test --env-mode=loose --force`, forced production build, Prisma validation, targeted integration/migration tests and actual Playwright browser campaign. The test database is isolated localhost PostgreSQL, recreated by the repository's existing global setup; no production customer data is used. Google and SMS are controlled provider adapters only; real application cookies, API routes, database and private local uploads are exercised.

The final browser campaign checks self registration and proof, saved partial drafts and reload, public exclusion before activation, independent admin applicability decisions, applicable evidence subset, actual private upload/submission/approval, no-yard/no-GST activation, read-only approved evidence, assisted consent/mobile/registration and resumed progress, unauthorized review refusal and support document privacy. Responsive widths: 320, 390, 768 and 1280 pixels. Screenshots mask identifiers and private input data at capture and contain synthetic fixtures only.

A previous full rerun timed out in an existing moderation fixture setup after 120 seconds. Its unchanged isolated rerun passed seven cases; the complete final rerun passed every case. That failed run and successful reruns are retained. No timeout, coverage threshold or security policy was relaxed.

[CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38121154790) and [Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38121154764) succeeded on the final head. Required lint/typecheck/test/build, audit, gitleaks and Semgrep all passed. Baseline advisory dependency/static-analysis findings are not represented as absent.

## Representative actual screenshots

- [Basic registration, small phone](screenshots/basic-registration-320.png)
- [Applicable admin review, phone](screenshots/admin-applicable-review-390.png)
- [Uploaded applicable evidence, small phone](screenshots/uploaded-evidence-320.png)
- [Pending activation](screenshots/activation-pending-390.png)
- [Approved read-only evidence](screenshots/activation-approved-390.png)
- [Assisted partial application](screenshots/assisted-progress-390.png)

## Migration, security and remaining review

The additive migration preserves every existing status and ownership and enforces paired registration/consent and nonnegative version. Safe rollback leaves saved applications/evidence intact and disables feature discovery. Production storage/database encryption, protected case access/retention, declaration wording and legal classification must be approved and verified by the owner. No live provider, government registry, real KYC, physical-device/native Safari or production rollout certification is claimed.

The independent main base retains its current free-text location and admin Google/session behavior. Integration with stack owner-email, canonical service locations, optional fields, isolated OTP sessions and independent verification status remains documented in the feature policy. Keep Draft regardless of green tests.

## Owner UAT

1. Register a new dealer with proved Google/mobile identity, essential name/location and consent. Reload and resume saved details.
2. Save partial business details without universal tagline, GSTIN or yard requirements. Confirm public activity remains unavailable.
3. Independently review actual classification and applicable evidence. Refuse stale/self-review and uncertain applicability.
4. Upload synthetic required evidence in a test environment, submit, review and approve; verify read-only approved evidence and public/listing gates.
5. Repeat through sales assistance and actual representative email claim. Typed email alone must not activate or establish ownership.
6. Test corrections, evidence rejection/suspension/reinstatement, role privacy and existing approved dealers at phone/tablet/desktop widths.

Next step: owner-controlled product/legal review; not merge or deployment.
