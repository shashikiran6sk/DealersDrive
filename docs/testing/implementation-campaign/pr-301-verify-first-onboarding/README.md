# #301 — verify-first assisted onboarding

Head `2366250` (stacked on #299). Local development database only; no
production system or data was used. Email codes were read from the console
mailer's log; phone OTPs used the fake driver's dev code.

## Results

| Check | Result |
| --- | --- |
| API tests | 3,394 passed (173 files) |
| Web tests | 1,639 passed (141 files) |
| Contract tests | 574 passed |
| Lint · typecheck · Prettier · web build | green |

## Browser checks (`checkl6.mjs`, `checkl6b.mjs`)

| Check | Result |
| --- | --- |
| Step 1: Continue hidden before verification and after phone only | 0 buttons, 0 buttons |
| Step 1: Continue shown once phone and email are verified | shown |
| Step 2 has no email field | 0 email fields |
| Save and continue lands on Step 3 | `/sales/dealers/:id/documents` |
| Dealer phone sign-in → same dealership, same account | `sameDealer: true`, `email: true`, next `ONBOARDING` |
| Verify now on an owner-less draft | owner linked, verified phone and email, panel gone |
| Horizontal overflow at 390 / 1280 px | none |

Google sign-in auto-link is covered by integration tests (no Google client is
configured locally). Real delivery through Resend must be checked in an
authorised environment before launch.
