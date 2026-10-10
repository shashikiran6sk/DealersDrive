# PR #272 — Sales workspace and assisted dealer onboarding (R112)

Captured from a local API + web against a migrated, seeded database
(`pnpm db:seed` + `pnpm db:seed:dev:sales`), signed in with real ADMIN session
cookies for a Sales representative and the bootstrap Super admin. The OTP is the
fake driver's dev code; no SMS was sent.

The onboarding journey (03 → 07) was driven end-to-end in Chromium at 390 px:
consent → OTP → verified → details → **Create dealership** → the new draft.

| File | What it shows |
| --- | --- |
| `01-sales-dashboard-desktop.png` | Dashboard: only this representative's 3 dealerships (the other rep's is absent) |
| `02-sales-dashboard-mobile.png` | Same at 390 px |
| `03-consent-mobile.png` | Step 1: the dealer's mobile and the consent sentence, before any OTP |
| `04-dealer-otp-mobile.png` | Code entry (dev driver) |
| `05-phone-verified-mobile.png` | Phone verified; continue to details |
| `06-details-mobile.png` | Step 2 form, filled |
| `07-created-draft-mobile.png` | The created ASSISTED draft: phone verified, email pending |
| `08-draft-desktop.png` | Draft detail: details, KYC documents, yard photo, submit gate naming what is missing |
| `09-my-dealerships.png` | List of the representative's dealerships |
| `10-other-reps-dealer-404.png` | Another representative's dealership by URL → 404 (API scope) |
| `11-admin-provenance.png` | Admin dealer page: onboarding source, Sales representative, verification state |
| `integration-tests.txt` | `apps/api/tests/sales-assisted-onboarding.test.ts`, verbose (18) |
| `web-tests.txt` | Sales components/actions + uploader tests, verbose (23) |

## Database checks after the browser run

```
legalName     | status | onboardingSource | phone_ok | email_ok | consent
Ramesh Motors | DRAFT  | ASSISTED         | t        | f        | t
```

Audit rows: `dealer.assisted.phone_verified` carries `phoneLast4` and `consent`
only; `dealer.assisted.created` carries `assistedByMemberId`. A grep of the API
log for the dev code and the `dev-otp:` token prefix returned 0 matches.

## Found and fixed during manual verification

1. The draft page passed a function prop (`commit: (type) => url`) from a server
   component into `DocumentUploader` → render error. Now a `basePath` string;
   regression test `document-uploader.test.tsx`.
2. The create form omitted empty required fields, so Zod answered "expected
   string, received undefined". Required fields are now sent empty and the
   schema's own sentences appear; tests in `assisted-dealer-form.test.tsx` and
   `sales-actions.test.ts`.
