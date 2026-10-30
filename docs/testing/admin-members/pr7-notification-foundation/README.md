# PR #275 — Notification foundation (R115)

| File | What it shows |
| --- | --- |
| `01-delivery-log-desktop.png` | Super admin: the delivery log (status tabs with counts, search, template, attempts) |
| `02-delivery-log-mobile.png` | Same at 390 px |
| `03-operations-direct-url-404.png` | An Operations member typing the URL: a 404, not an error page or the data |
| `tests.txt` | `tests/notification-foundation.test.ts` + notification and outbox unit tests, verbose |

## Checks against the local API

- `GET /v1/admin/notifications` as the Super admin: 200; as Operations (MODERATOR): 403.
- Integration suite (real Postgres, real outbox, recording mailer):
  - `DealerApplied` admin mail reached the MODERATOR member and the bootstrap
    Super admin — not SUPPORT, not SALES_REP, not an INVITED member.
  - Replaying the same outbox event sent nothing new (one SENT row per recipient).
  - A dealer submit followed by a request for changes left exactly
    `ListingSubmitted`, `ListingChangesRequested` in the outbox, the second
    carrying the reason.

## Found and fixed while running the full suite

Listing transitions now publish events, and many test files submit listings
without ever draining the outbox. The publisher claims the oldest 50 rows per
pass, so a backlog of events nobody subscribed to delayed other files'
application emails past their assertions. The same head-of-line delay would
exist in production, so the fix is in the publisher: unsubscribed events are
marked published in bulk before the batch is claimed (unit-tested).
