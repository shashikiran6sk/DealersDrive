# Mobile UX corrections and dealer console readiness

This document records the original pre-merge readiness checkpoint. The subsequent enquiry/address fixes and the owner-authorized sequential merges are recorded in [the follow-up evidence](follow-up-enquiry-address/README.md) and the final merge report.

Both product PRs remain open and unmerged. The console branch is independent
of the mobile branch. The only feature-to-feature merges are in a local
verification worktree; that branch is not pushed and has no PR. The existing
`testing_evidence` archive holds the screenshots, recordings, manifests and
diagnostic logs, following its existing `docs/testing/fixes/` convention.

## A. Repository and Git audit

| Item                   | Verified value                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Existing mobile PR     | [#285](https://github.com/shashikiran6sk/DealersDrive/pull/285)                       |
| Existing mobile branch | `feat/mobile-ui-responsive-revamp`                                                    |
| Initial mobile head    | `2b5561b2e36e175fee97e2b65fec28b9637e260e`                                            |
| Final mobile head      | `fb48fa656ab5146bb638a870e9e74a686b34d775`                                            |
| Latest fetched main    | `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566`                                            |
| New console PR         | [#286](https://github.com/shashikiran6sk/DealersDrive/pull/286)                       |
| New console branch     | `feat/dealer-console-cleanup`                                                         |
| Final console head     | `382bcc9b74604d2f7645a816b4996a83e972da43`                                            |
| Console branch base    | Main `2a1845a`; its merge base with the final mobile head is exactly this main commit |

Mobile corrections are normal commits `1a14c8f` and `fb48fa6` on the existing
branch; its original history is preserved. Console commits `156594a` and
`382bcc9` were created separately from main and contain no mobile commits.
`git-preservation-audit.json` records the source audit and branch checks.

## B. Existing mobile PR corrections

1. **Public hamburger:** `CustomerHeader` renders `MobileNav` before the brand
   at phone widths. Its district/account group can shrink at 320px, including
   the smaller content width caused by a classic scrollbar.
2. **Car-detail ordering:** the car page uses the same component instances in
   gallery → identity/price/highlights/save → specifications → description →
   dealership → similar-car order below 1024px. Responsive `display: contents`
   preserves the original desktop column boxes.
3. **One mobile enquiry CTA:** `EnquiryPanel` hides the desktop entry button and
   introductory login note on mobile. The existing sticky entry point and its
   login, OTP, availability and submission handlers remain intact. Opening the
   enquiry form removes that sticky entry point.
4. **Dealer portfolio:** its identity grid aligns a 60px logo with name and
   location, places the description below, and uses a responsive 16:9 yard
   region on phones. Desktop sizes and order remain intact.
5. **Dealer bottom navigation:** `DealerLayout` removes only its own
   `ConsoleTabBar` usage and the main padding reserved for it.
6. **Drawer status:** the drawer heading shows the actual API dealer name and
   status above shared `ConsoleNav`. Mobile credit indicators are absent;
   desktop status and credit indicators remain intact.
7. **First-tap filters:** `RangePresets` prefixes native radio group names with
   each panel's existing ID prefix. The simultaneously mounted hidden desktop
   and mobile radios previously shared `price`/`km` names; the applied desktop
   update silently unchecked the optimistic mobile radio. Query keys, preset
   values, results, facet dependencies and navigation are unchanged.

Two permanent radio coexistence tests fail on the untouched mobile baseline.
Native before/after first-tap recordings show the same 76 matching cars; the
checked appearance is now immediate and remains checked after the result
update. The checks distinguish selected appearance from URL correctness.

**Additional gallery preservation fix:** short-height verification found the
fullscreen image stage's intrinsic minimum height pushing its rail 34px below
a 320×360 viewport. `GalleryViewer` adds only `max-md:min-h-0`. Six permanent
browser cases across three gallery fixtures fail before this change and pass
after it at 320×360 and 375×360. Native last-thumbnail selection, keyboard
advance, rail visibility and Escape focus pass. All six matched desktop
gallery screenshots are pixel-identical.

Mobile evidence: `mobile-before/`, `mobile-after/`, `mobile-components/`,
`mobile-interactions/`, `mobile-extra-interactions-a.json`,
`filter-first-tap-before/`, `filter-first-tap-after/`, `gallery-short-before/`,
`gallery-short-after/` and `gallery-desktop-comparison.json`.

## C. Independent console PR

`DashboardMetrics` renders exactly **Active listings, Pending review, New
enquiries and Vehicle views** in that order: desktop 4×1, phone/tablet 2×2.
It uses the existing summary API's formatted values, labels and deltas and the
existing pending-review count and inventory link. Reporting periods and
backend metric definitions are unchanged. Missing fields say **Unavailable**;
loading renders four honest skeleton cards. Large values wrap within the card
and the rows stretch evenly.

The redundant dealer header `HeaderAccount` avatar is removed. Public account
menus remain available, verified through real local sign-in and workspace
entry. `ConsoleNav.footer` hosts `ConsoleUtilities` for the desktop sidebar and
the mobile drawer when integrated with PR #285. `WorkspaceSwitcher` reuses the
existing workspace items and action, retaining current, alternative,
suspended and invitation capabilities and pending/disabled behavior.

Both existing logout modes are preserved:

- Account present: existing `customerLogoutAction`, auth hint and home `/`
  destination; button **Logout**.
- Account unavailable: existing dealer `SignOutButton`/`signOutAction` and
  `/dealer/login` destination; button **Sign out**.

Both backend logout endpoints revoke the current session. The server actions,
endpoints and cookie handling are unchanged. Real local desktop and integrated
mobile checks observe authentication before logout, removal of the browser
cookie, rejection of the previous token with HTTP 401 and protected-route
redirection afterward. Session values are never recorded in evidence.

The actual nested drawer check exposed a keyboard integration defect: Radix's
document capture handler handled Escape before the disclosure's React bubble
handler. A scoped, cleaned-up window capture listener now closes an open
workspace disclosure only when its own focused descendant receives Escape.
The first Escape restores disclosure focus; the second closes the drawer and
restores trigger focus. Its permanent actual-Radix regression fails before the
fix and passes afterward.

Only primary dashboard metric cards are simplified. Inventory lifecycle
filters, charts, enquiries, alerts and desktop shell credit indicators remain.
Main does not contain the mobile drawer; standalone console mobile logout
placement depends precisely on PR #285's shared navigation host. No mobile
revamp code is copied into the console branch.

The independent console inherits main's 11px chart-panel overflow at 320px with
a 15px classic scrollbar. The new metric section fits its 273px content width.
Matched main and console measurements are in `console-baseline-overflow.json`.
The mobile PR already fixes this panel; integrated checks fit at all widths.

Console evidence: `console-before/`, `console-after/`, `console-authenticated/`,
`console-components/`, `console-interactions/` and `console-edge-states/`.

## D. Combined integration verification

Local branch: `local/mobile-console-integration`.
Worktree: `/tmp/dealersdrive-ux-integration`.
Final local head: `6a825fc0e95e438854193bfb3c5a570c099bd6ea`.

The first local merge combined mobile `1a14c8f` and console `156594a`. It had
three text conflicts:

| File             | Local resolution                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Dealer layout    | Keep the mobile heading and shared navigation host; add the console utility footer and remove the dealer avatar |
| Dealer dashboard | Use the four-card metrics; retain mobile-safe chart/enquiry grid sizing                                         |
| `ConsoleNav`     | Combine mobile link touch height with the optional utility footer and scrolling behavior                        |

Subsequent normal console and mobile fix commits merged cleanly into the local
verification branch. The nested Escape fix belongs to the console PR; the
short-height gallery fix belongs to the mobile PR. Neither product branch was
merged into the other. The local branch is never pushed or used as a PR base.

**Owner merge order:** approve and merge #285 first, then update #286 from the
new main and resolve these three known text conflicts using the documented
combination. Re-run the checks before separately approving #286. The local
combined implementation has no known remaining functional conflict; this does
not claim Git will merge the two independent branches without text conflicts.
No future merge step is executed in this campaign.

## E. Quality verification

| Verification                  | Mobile #285                       | Console #286                                                      | Local combination                                               |
| ----------------------------- | --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Formatting, lint, docs        | Pass                              | Pass                                                              | Pass                                                            |
| Production build              | Pass                              | Pass                                                              | Pass                                                            |
| Type checks                   | Pass                              | Pass                                                              | Pass                                                            |
| Full tests                    | Pass: 4,919                       | Pass: 4,922                                                       | Pass: 4,928                                                     |
| Web / contracts / API         | 1,478 / 427 / 3,014               | 1,481 / 427 / 3,014                                               | 1,487 / 427 / 3,014                                             |
| Component visuals             | 516 passed                        | 60 passed                                                         | 576 unique cases verified incrementally                         |
| Page visuals                  | 330 captured, no content overflow | 50 matched affected routes; inherited narrow chart issue recorded | 330 captured, no content overflow                               |
| Native/browser assertions     | 91 corrections and filter checks  | 145 live metrics, edge and authenticated checks                   | 260 correction, metrics, edge, gallery and authenticated checks |
| GitHub exact-head CI/Security | Six checks passed                 | Six checks passed                                                 | Local only; no PR/remote branch                                 |

Widths: **320, 360, 375, 390, 430, 440, 768, 1024, 1280, 1440**. Short-height,
landscape and 200% computed text-size fixtures supplement these widths.
Matched desktop evidence includes 66 page pairs before/after the seven mobile
corrections and six further gallery pairs; all 72 are pixel-identical.

Combined component verification is explicitly incremental: the full 570-case
matrix passed at `740c26b`. After the only subsequent product change (the
gallery sizing class), all 36 gallery cases were rerun, including six new
short-height cases. The final independent mobile run additionally repeated
all 516 cases. `integrated-components/results.json` identifies the head
actually checked for every record; `matrix-sources.json` records 606 executed
checks and 576 unique cases. Unchanged components are not described as having
been rerun at the final head.

Combined browser checks cover first-tap appearance and result application,
clear/reopen behavior, all filter kinds, model dependencies, location/dealer
scoping, back/forward history, rapid taps with network delay, pending and
disabled states, long facets, gallery controls, real OTP/workspace entry,
saved-car persistence and restoration, enquiry submission and complete mobile
logout. Guest/restricted sales redirects are recorded separately from requested
routes. Error pages are rejected and actual content width is checked.

**Failed during investigation:** the radio, nested Escape and short-gallery
regressions deliberately fail on their respective prior source. Transient
resource failures and browser transport/readiness/scroll-coordinate mistakes
were corrected and successful checks repeated. One existing portfolio test
timed out while browser capture competed with the full suite; the unchanged
53-test file passed after previews stopped. Its failed full-run log is retained,
and the final full integration rerun passed all 4,928 tests with previews
stopped. No test, timeout, coverage threshold or branch protection is weakened.

**Not run:** real-device keyboards/safe-area hardware, production SMS and real
Google OAuth. Browser emulation, the existing local fake OTP driver and the
full existing auth/role tests provide complementary coverage. 200% text checks
are computed-size fixtures, not a claim of hardware accessibility testing.

No required GitHub check is blocked. Local API/database fixtures are isolated;
jobs are disabled and no production records or external messages are changed.

## F. Preservation verification

Actual source diffs for both complete product branches show no API endpoint,
contract, migration, backend business logic, infra, dependency or auth-action
changes. Existing server guards and permission-derived navigation remain.
Both logout modes and workspace endpoints are reused. Existing inventory
states and transitions are retained. Source audit and functional tests show no
new unauthorized role behavior. Mobile desktop output remains unchanged, and
the original mobile revamp functionality is preserved and checked together
with the console implementation.

## G. Final Git state

Both product PRs are ready for review, OPEN and unmerged, with
auto-merge disabled and all six exact-head checks passing. Main remains
`2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566`. Product worktrees are clean. Only
one new product PR (#286) was created; no integration/evidence PR was created,
and existing unrelated PRs and the existing archive reference were preserved.

The owner will review and authorize merges separately. Stop after publishing
this completed evidence and verifying these states.
