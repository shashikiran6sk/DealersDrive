# Integrated regression on merged `main`

Run after all eleven stacked PRs (#287–#298) were squash-merged.

| Item        | Value                                                                              |
| ----------- | ---------------------------------------------------------------------------------- |
| `main`      | `6f4f040` (#298 squash)                                                            |
| Environment | local worktree, Node 24.21.0, PostgreSQL 16.15, built API + `next start`           |
| Data        | local dev database, migrated forward and seeded with `pnpm db:seed:dev`; synthetic |
| Production  | nothing deployed, no production database touched                                   |

## Static checks, tests and build

| Check                                      | Result                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`           | PASS                                                                                |
| `pnpm lint` (prettier, eslint, docs check) | PASS                                                                                |
| `pnpm typecheck`                           | PASS                                                                                |
| `pnpm test`                                | contracts 485 · web 1,544 · API 3,296 — **5,325 / 5,325** (`logs/test-summary.txt`) |
| `pnpm build`                               | PASS (contracts, API, Next production build)                                        |

The API suite runs every migration from an empty database, so all eleven
migrations the stack introduced are applied in order on each run. The first
test attempt failed before running any test (`Cannot find module
'.prisma/client/default'`) because the fresh worktree had no generated Prisma
client. `prisma generate` fixed it and the suite was re-run in full. This was
an environment problem, not a product defect.

## Browser sweep (`sweep-results.json`)

70 page loads, 35 routes × 390 px and 1,280 px, under five sessions: public,
customer, dealer owner, sales representative and super admin. For every load
the sweep recorded the HTTP status, any redirect, horizontal overflow, console
errors, page errors and 5xx responses.

- **Results:** every load returned 200, with no overflow, no console or page
  errors and no 5xx.
- **The one redirect:** `/dealer/login` → `/login`, which is the intended
  legacy redirect.
- **Screenshots:** the 390 px views are in `screenshots/sweep-390/`.

## Owner requirements re-checked on `main`

| Requirement                                               | Result                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #294 "Admin Login" link (`admin-login-link-results.json`) | At 320, 360, 390, 428, 768 and 1,280 px the link is on the Dealer tab only, below "Trouble signing in?". It has a 40 px tap target, is keyboard-focusable and goes to `/admin/login`; Back returns to `/login`. The Customer tab has none. 14 admin routes return 200 with no overflow at 320 px.                                                            |
| #295 ticket messaging (`ticket-reopen-results.json`)      | The sixth message hits the limit. A resolved ticket hides the composer and offers Reopen; a forged message gets `SUPPORT_TICKET_RESOLVED`. Reopen sets it OPEN, keeps all 5 messages and leaves the quota at 0. A genuine support reply restores 5. A closed ticket has neither composer nor Reopen; reopening or messaging it gets `SUPPORT_TICKET_CLOSED`. |
| #293 admin mobile OTP                                     | Covered by the API suite: untimed MSG91-shaped proofs link and sign in; replays are refused. A real MSG91 handset UAT is still outstanding (launch item).                                                                                                                                                                                                    |
| #297 / #298                                               | Covered by their suites plus the per-PR E2E records; the sweep loads the admin dealer page cleanly.                                                                                                                                                                                                                                                          |

## Not covered here

- Real MSG91 SMS delivery, real Google OAuth, real S3, physical devices and
  Safari.
- Production deployment and production migrations: none was performed.
