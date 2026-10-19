# PR #277 — Enquiry and support emails (R117)

| File | What it shows |
| --- | --- |
| `01-delivery-log-desktop.png` | Super admin delivery log after the journey: the enquiry, ticket and status emails at the top, ticket rows with no dealership (`—`) |
| `02-delivery-log-mobile.png` | Same at 390 px |
| `emails/*.html`, `emails/*.txt`, `emails/*.png` | The four new templates, rendered |
| `journey.sh`, `journey.log` | The manual journey against the local stack, and its output |
| `tests.txt` | `tests/enquiry-support-emails.test.ts` + notification unit tests, verbose (137 passed) |

## Manual journey (local API + pg-boss worker, console mail driver)

| Step | Who | Emails |
| --- | --- | --- |
| A car goes live | Sri Lakshmi (dealer), priya (MODERATOR) | listing emails (R116) |
| Asha enquires, with a message | customer | `dealer.enquiry.received` → owner. The body names "Asha" and quotes the message. **Asha's phone number appears nowhere in the API log, which records every email body under the console driver** (the message itself appears once) |
| Asha raises `DD-1001` | customer | `admin.support.ticket-created` → Super admin, priya (`admin:support:manage`). **Not** arun or kavya (SALES_REP). `customer.support.ticket-received` → Asha |
| Ravi (no verified email) raises `DD-1002` | customer | support desk only. Log: `email skipped — no recipient` (ticket id only) |
| priya: waiting for customer, then priority high | MODERATOR | `customer.support.ticket-status` "Awaiting your reply" → Asha. Priority: none |
| Asha replies (reopens it), then priya resolves | customer, MODERATOR | reply: none. Resolve: "Resolved" → Asha |

All 8 deliveries were SENT on the first attempt, and every ticket delivery has
`dealerId` null.

Links fetched as their readers: `/dealer/enquiries` (dealer) 200, and
`/admin/support/<id>` (MODERATOR) 200. Signed out, `/support-requests/<id>`
renders only the page skeleton and no ticket data. That is existing behaviour,
not changed here.

Local-only shortcuts, both disclosed:

- Asha's verified email was set with SQL. Phone sign-up has no email step; a
  Google-linked customer has one verified.
- The car's six photos were seeded with the suite's `seedImages` helper.
