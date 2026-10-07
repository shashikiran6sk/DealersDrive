# PR #276 — Listing lifecycle emails (R116)

| File | What it shows |
| --- | --- |
| `01-delivery-log-desktop.png` | Super admin delivery log after the journey below: every listing email, who it went to, SENT on the first attempt |
| `02-delivery-log-mobile.png` | Same at 390 px |
| `emails/*.html`, `emails/*.txt` | All eight new templates rendered (HTML and plain-text part) |
| `emails/*.png` | Four of them as a mail client shows them |
| `journey.sh`, `journey.log` | The manual journey against the local stack, and its output |
| `tests.txt` | `tests/listing-emails.test.ts` + notification unit tests, verbose (120 passed) |

## Manual journey (local API + pg-boss worker, console mail driver)

Sri Lakshmi Motors (an ordinary, owner-run dealership), `KA 05 MR 8801`:

| Step | Who | Emails |
| --- | --- | --- |
| Submit | Dealer | `admin.listing.submitted` → Super admin, priya (MODERATOR). **Not** the dealer, **not** arun/kavya (SALES_REP) |
| Request changes | priya | `dealer.listing.changes-requested` → owner, with the reason and the review-step link |
| Resubmit | Dealer | `admin.listing.resubmitted` → Super admin, priya |
| Approve | priya | `dealer.listing.approved` → owner, with `/car/<slug>` |
| Reserve, request reactivation | Dealer | reserve: none; request: `admin.listing.reactivation-requested` → Super admin, priya, with the dealer's reason |
| Approve reactivation | priya | `dealer.listing.reactivation-approved` → owner |
| Mark sold | Dealer | **none** — `deliveries after mark-sold: 0` |

Kaveri Auto Hub (assisted, ACTIVE, unclaimed, contact email **unverified**),
`TN 73 SR 5501` prepared by arun (Sales):

| Step | Who | Emails |
| --- | --- | --- |
| Submit | arun (Sales) | `admin.listing.submitted` → Super admin, priya |
| Reject | priya | none — API log: `email skipped — no recipient` (`dealerId` redacted). R113: an unverified address gets only the claim email |

Every link in the emails was fetched as its reader and returned 200:
`/dealer/vehicles/<id>/edit?step=review` (dealer), `/admin/listings/<id>`,
`/admin/listings?view=reactivation` (admin), `/car/<slug>` (public).

The six photos approval requires were seeded with the suite's own
`seedImages` helper (rows only): the admin uploader needs MinIO, which this
container does not run. Nothing else in the journey bypasses the API.

## Found and fixed while running the full suite

With listing events now subscribed, other test files' listing events sit in the
shared outbox, and the harness's `drainEmails()` — one 50-row batch, oldest
first — could publish none of the calling file's rows (8 failures across 6
files, all passing alone). Production is unaffected: its poller ticks every 2 s
and works through the backlog. The harness now runs ticks until a batch comes
back short (bounded at 40), which is what successive poller ticks do; the
listing-email assertions match the listing they are about rather than "the
first email to Operations". Full suite: 150 files, 2991 tests, green.
