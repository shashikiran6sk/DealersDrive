# #299 — Progressive dealer onboarding (Draft, not for merge)

Head `0e8a6ba` on `feat/progressive-dealer-verification`, fast-forwarded from the
previous draft head `f563188` (no force-push). Base: main `5a89a9f`.
All data is synthetic local seed data. No production system was touched.

## Commits

| Commit | Layer |
| --- | --- |
| `4b4ce72` | Merge of main; retires the previous plan model |
| `49d7130` | Personal / Business Identity Proof categories (contracts, migration, API) |
| `fadce3a` | Controlled manual activation override and revocation |
| `778c2f3` | Moderated portfolio photographs, internal yard visits, yard photo removed from onboarding |
| `e3ae5f7` | Dealer Verified decision reduced to status + reason (owner request) |
| `ed8a2d5` | Web: category uploader, rep notice, admin review/override/visits, portfolio manager, queue, gallery |
| `0e8a6ba` | Test fixture: wider PAN random space |

## Automated checks (final head)

See `logs/test-summary.txt`: API 3,395, web 1,633, contracts 570 tests passing;
lint, typecheck, Prettier and production build green.

## Browser checks (`browser-harness.mjs`, results in `browser-results.json`)

Run against the built API and web on the local dev database, at 390 and 1280 px.

| Check | Result |
| --- | --- |
| Dealer submits a photo: shown "Awaiting review — not public yet"; not on the public page | pass |
| Moderator approves from `/admin/portfolio`; photo appears in the public gallery and loads | pass |
| Replacement pending: public page keeps the original; after approval the replacement takes its place | pass |
| Photo count counts an approved replacement (bug found here, fixed in `ed8a2d5`) | pass (3 of 8) |
| Dealer Verified panel: no text fields for "Dealer Verified"; API refuses without verified documents | pass |
| Yard visit `NO_PHYSICAL_YARD` recorded; photo served only by signed URL | pass |
| Public dealer page contains no yard-visit evidence | pass |
| Draft dealership: override shows the server's blocked reason | pass |
| Sales draft page: rep-scope notice, documents "optional for you", no yard section | pass |
| No horizontal overflow at 390 px (dealer photos, admin dealer, sales) | pass |

## Local dev database migration

`logs/dev-db-before-migrations.txt` / `logs/dev-db-after-migrations.txt`: all 362 seeded
documents filed under their category with status unchanged; 122 ACTIVE dealerships
marked `STANDARD`; no legacy covers present, so no portfolio rows created. The
legacy-cover carry-over is covered by `dealer-portfolio-migration.test.ts`.

## Screenshots

`screenshots/` — dealer photos (empty, pending, replacement pending), admin queue
and replacement comparison, admin dealer page (390/1280), verification panel,
draft override, public dealer page at each portfolio stage, sales draft (390/1280).
