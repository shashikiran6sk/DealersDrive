# PR #274 — Assisted listing creation (R114)

Driven in Chromium against a local API + web with `pnpm db:seed` and
`pnpm db:seed:dev:sales`, using real ADMIN session cookies for the seeded Sales
representative (Arun), the Operations reviewer (Priya) and the bootstrap Super
admin.

| File | What it shows |
| --- | --- |
| `01-sales-dealer-listings.png` | Approved assisted dealership: "Listings I prepared", with a submitted one in review |
| `02…05` | The dealer's own wizard in the Sales workspace at 390 px: registration → basics → review → submitted |
| `06-unapproved-dealer-mobile.png` | A draft dealership: drafts allowed, submission explained as waiting for approval |
| `07-moderator-sees-provenance.png` | Operations reviewer: "Prepared by / Submitted by Dealers-Drive Sales: Arun", actions available |
| `08-assistant-rerolled-blocked.png` | Arun re-roled to Operations opens the same listing: warning banner, checklist and decisions disabled |
| `integration-tests.txt` | `apps/api/tests/sales-assisted-listings.test.ts`, verbose |
| `web-tests.txt` | Sales list, wizard (incl. Sales scope), actions and listing-review tests |

## API checks during the run

- The listing submitted in the browser: `status = PENDING_REVIEW`,
  `submittedByMemberId` and `vehicles.createdByMemberId` both set to Arun's
  member id; its history reads "Submitted for review · Dealers-Drive Sales, for the dealer".
- With Arun re-roled to MODERATOR, `POST /v1/admin/listings/:id/approve` answered
  `403 SELF_REVIEW_FORBIDDEN`: "You prepared or submitted this listing for the dealer,
  so another reviewer has to decide on it." The role was then restored.

## Found and fixed during manual verification

- The assistant, once re-roled, could still tick the verification checklist; the
  checklist route now refuses them too (`SELF_REVIEW_FORBIDDEN`), with a test.
