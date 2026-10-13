# PR #273 — Assisted dealer email verification and claim (R113)

Driven end to end against a local API + web (`MAIL_DRIVER=console`, fake OTP
driver, no SMS or email sent). A Sales representative created *Ramesh Car Bazaar*
in the browser; the verification email was emitted by the console mailer; a fresh,
signed-out Chromium at 390 px then opened the link and claimed the dealership.

| File | What it shows |
| --- | --- |
| `01-claim-confirm-email.png` | Step 1: the masked address and a **Confirm** button (a POST — opening the link verifies nothing) |
| `02-claim-verify-phone.png` | Step 2: OTP to the dealership's verified number, shown masked |
| `03-claim-wrong-number-refused.png` | A different number is refused before any OTP is sent |
| `04-claim-otp.png` | Code entry (dev driver) |
| `05-owner-lands-in-onboarding.png` | Signed in as OWNER, the dealer continues their own draft |
| `06-link-after-claim.png` | The same link afterwards: "already has an owner", no form |
| `07-sales-view-claimed.png` | Sales view: phone verified, email verified, claimed; read-only |
| `integration-tests.txt` | `apps/api/tests/dealer-claims.test.ts`, verbose |
| `web-tests.txt` | Claim page, claim actions, Sales panel tests |

## Checks after the run

- `users` row for +91 96622 55504: `fullName = V. Ramesh`, `email = NULL` (the
  dealership's email was not copied onto the account), membership `OWNER`.
- API request logs record the route pattern `/v1/dealer-claims/:token`, never the
  token. The token appears once in the log — inside the console mailer's printed
  email body, which `env.ts` refuses in production.
- `dealer_email_verifications` holds only the SHA-256 of the token.

## Found and fixed during manual verification

- The Sales "read-only" notice said *submitted* for a dealership that was only
  claimed — now distinguishes the two.
