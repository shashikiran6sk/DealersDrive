# PR #269 — customer ↔ dealer identity linking (R109)

Run locally against Postgres 16 with the `fake` OTP driver (the production code
path except the MSG91 round trip, which is replaced by development tokens).

- `integration-tests.txt` — verbose run of `tests/account-linking.test.ts` and
  `tests/dealer-identity-completion.test.ts` (33 cases).
- `full-api-suite.txt` — the full API suite summary and coverage.

## Matrix covered

| Case | Result |
| --- | --- |
| customer phone + new Google dealer identity, OTP proved | linked; session rotated; old cookie 401 |
| saved cars / enquiries / dealer membership | preserved on the survivor |
| dealership onboarding after linking | OWNER membership on the survivor |
| wrong OTP / provider-refused (expired) / replayed / other handset | 422, nothing merged |
| holder already has its own Google account | 409, nothing merged |
| Google account already holds another phone | 409 |
| operator account | 409 at availability and verify |
| two verifications at once | one account, one audit row |
| repeat after linking | plain verification, no new session |
| phone session → Google link of a Google-only account | merged (`GOOGLE_OAUTH` proof) |
| suspended seat on the absorbed account | carried onto the survivor |
