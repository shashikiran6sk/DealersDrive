# #294 — mobile admin access · independent review

PR: [#294](https://github.com/shashikiran6sk/DealersDrive/pull/294) · branch
`feat/mobile-admin-access` · base `main`. Original author evidence:
[`../pr-07-mobile-admin`](../pr-07-mobile-admin).

| SHA                  | Value                                              |
| -------------------- | -------------------------------------------------- |
| `main` at review     | `367c0b2` (#293 squash)                            |
| Original PR head     | `a17b4a4` (parent in stack `e481bb0`)              |
| Reconciled           | `304b241` — merge commit, byte-identical increment |
| Final validated head | `2c60ca4`                                          |

## Owner requirement — Admin Login link (`2e4ef64`)

The branch had added "Admin login" to the **public marketplace drawer** and to
**every signed-in account menu**. The owner's final decision is a single subtle
link on `/login`, **Dealer tab only**, below "Trouble signing in? Contact
support", in-app navigation to `/admin/login`; no gesture, no third tab,
Customer view unchanged. Implemented via `LoginTabs` `footer` (always; same
markup and position the page rendered before) and `dealerFooter` (Dealer only).
The drawer and account-menu admin entries were removed (account menu files are
byte-identical to `main`); the drawer keeps Dealer login and Help and support.
12px, `ink-subtle` (#6f6d68 ≈ 5.1:1 on white), underline on hover/focus, 40px
tap target. Sandbox story, registry, component map and design note updated.

Browser (`browser-results.json`), 320/360/390/428/768/1280:
Customer tab 0 admin links; Dealer tab 1, below the support link; 40px tap
height; no overflow; keyboard focus + Enter → `/admin/login`; Back → `/login`.

## Mobile admin usability defect (`2c60ca4`)

A phone sweep of 9 admin pages found controls collapsed below 80px — Support
search 26px (320), Enquiries search 26px (390), Members invite fields with
overlapping labels, and every Members **role select at 46px showing no current
role**. Root cause: `min-w-[N] max-md:min-w-0 max-md:max-w-full flex-N` keeps a
zero flex basis on phones. Added `max-md:basis-full` to the 16 admin fields with
that pattern (including the approve/suspend/request-changes/close/reinstate
reason boxes used to approve a dealer from a phone) and `min-w-[140px]!` to the
table role select (the global unlayered mobile `.input { min-width: 0 }` rule
outranks layered utilities). Re-scan: **0** squeezed controls
(`squeeze-scan-results.json`); see `_admin_members-390.png`.

## Other findings

| Sev | Finding                                                                                     | Resolution |
| --- | ------------------------------------------------------------------------------------------- | ---------- |
| P3  | Back from `/admin/login` returns to `/login` on the Customer tab: tab state is client-only. | Noted.     |
| P3  | Design note carried PR numbering and DO-NOT-MERGE.                                          | Rewritten. |

Table swipe hint (opt-in), 44px dialog close buttons on phones and drawer
close-on-navigate were reviewed and kept.

## Executed checks (`2c60ca4`)

| Check                                   | Result                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| lint + typecheck                        | PASS                                                               |
| tests                                   | contracts 468 · web 1,532 · API 3,212                              |
| build                                   | PASS                                                               |
| Admin pages 200, no overflow at 320/390 | dashboard, dealers, listings, support, enquiries, config, security |

Chromium viewport emulation only; installed-PWA and physical-device behaviour
need owner UAT.

## CI on `2c60ca4`

| Check                           | Result  | Run                                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Vercel Preview Comments         | success | https://github.com/shashikiran6sk/DealersDrive/runs/114591579737                         |
| terraform fmt / validate        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38180345979/job/114591373985 |
| lint · typecheck · test · build | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38180345979/job/114591373966 |
| gitleaks                        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38180345990/job/114591373915 |
| dependency audit                | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38180345979/job/114591373693 |
| semgrep                         | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38180345990/job/114591373656 |
| Vercel                          | success | https://vercel.com/dealers-drive/dealersdrive-prod-web/CaotiWRzPSAcSi5ajZgunHUddbCD      |
