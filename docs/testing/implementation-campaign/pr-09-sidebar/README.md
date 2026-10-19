# PR 9 — Public mobile navigation heading

- PR: https://github.com/shashikiran6sk/DealersDrive/pull/296
- Branch: `fix/mobile-sidebar-navigation`
- Base: `feat/ticket-message-limits` / PR 295, `98a5b786f8b7b8903a08c8d2d9bf3f5aa478e1df`
- Head: `cefed41177086685bb56423522bfd67d2ea9e7dc`
- Incremental diff: four files, six added lines, one removed line, one commit
- State: OPEN; MERGED: NO; no production deployment
- Next: PR 10, `feat/dealer-verification`, creation follows this passing final-head gate

## Implementation

The public header renders the mobile drawer's existing Radix dialog title as screen-reader
text, removing the visible Main heading. It uses the existing custom-header slot. The
accessible name and close button remain. Dealer/admin/sales navigation keeps visible titles
by default. Marketplace, customer account, dealer/admin login and help links remain.
No route, API, schema, dependency, environment, authorization or desktop-design change.

## Executed tests

The full suite was executed before PR creation and repeated after creation. Counts are one
current suite, not repeated-run totals or the historical 556-case manual certification.

| Category              | Result                                                                  | Evidence                                                        |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Formatting/lint/docs  | PASS before and after; post lint forced to execute                      | pre-lint.txt, post-lint.txt                                     |
| Typecheck             | PASS before and forced after                                            | pre-typecheck.txt, post-typecheck.txt                           |
| Unit/integration      | 5,215 PASS before and after: API 3,216, web 1,530, contracts 469        | pre-tests.txt, post-tests.txt                                   |
| Focused navigation    | 13 existing cases passed, including preserved dialog naming             | Full web suite                                                  |
| API coverage          | Post branches 90.15%, lines 96.95%; unchanged 90% branch gate           | post-tests.txt                                                  |
| Database              | Existing complete isolated PostgreSQL suite passes; no new migration    | post-tests.txt                                                  |
| Production builds     | PASS before and after, forced                                           | pre-build.txt, post-build.txt                                   |
| Browser               | 26 actual checks PASS                                                   | browser-results.json, browser-output.txt, browser.sanitized.mjs |
| Mobile/tablet/desktop | 320/360/390/414 and 768/1280px                                          | screenshots/                                                    |
| Security              | Final-head scans pass; existing authorization/session regression passes | security-ci.json, security-log.txt                              |

Commands: `pnpm lint`, post `pnpm exec turbo run lint --force`,
`pnpm run typecheck` (post `--force`),
`TZ=UTC APP_ENV=local pnpm run test --env-mode=loose --force`,
`pnpm build --force`.

The browser checks verify an accessible named dialog with a title that has the actual
screen-reader-only clipping/geometry; preserved links and active states; 44px close target;
no horizontal overflow; Escape/focus return; close button; backdrop dismissal; background
scroll locking and release; same-page closure; Buy cars/Dealers/help/dealer routes; focus
trap and resize cleanup; desktop navigation; real synthetic customer sign-in/account controls;
and the preserved admin entry through the controlled Google provider to the admin dashboard.
An initial script sent a raw coordinate click without waiting for the opened portal. The
repeated script targets the visible overlay and passes all checks. No product workaround or
security relaxation was made.

## Screenshots

`before-menu-390.png` is the actual parent implementation captured before editing.
`after-menu-{320,360,390,414}.png` and `desktop-{768,1280}.png` are the final built application.
Only synthetic local fixtures are used; footer contacts are masked. No conceptual mockup.

## CI

[CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38060204088) and
[Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38060204099) completed
SUCCESS on `cefed41177086685bb56423522bfd67d2ea9e7dc`. Required checks and preview build pass.
Preview deployment metadata confirms `production_environment: false`. Exact-SHA JSON records
are included. The owner updated the execution cadence to allow analysis/implementation of
the next branch while parent CI runs, with checks about every five minutes. PR 10 creation
still follows successful parent certification. No failing check was bypassed.

## Owner UAT

1. Open the homepage menu on a small phone: Main is not visually displayed; Home, Buy cars
   and Dealers remain, with their correct active indication.
2. Check dealer login, admin login and Help and support. As a signed-in customer, confirm
   account controls still expose saved cars, enquiries, support, admin entry and logout.
3. Close via button, outside backdrop and Escape. Escape returns focus to the trigger;
   keyboard focus remains in the open drawer and background scrolling resumes on closure.
4. Navigate Home while already on Home; the menu still closes. Navigate to cars/dealers.
5. Resize an open drawer to tablet/desktop. It closes and desktop links remain available.
6. Inspect its accessible dialog name with browser accessibility tooling. Native screen-reader
   software and physical devices were not tested in this campaign.

## Limitations and deployment

Controlled local Google/OTP boundary, real app/server actions/browser/local PostgreSQL.
No live provider or native-device claim. Optional API-fetch fallback warnings appear when
building with the runtime API stopped; builds exit successfully and actual pages were tested
with the local API afterwards. Existing dependency advisories remain. No production GO.
There is no database migration or new configuration. Leave open for owner review; do not
merge or deploy automatically.
