# Mobile responsive audit

Baseline: `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566` (verified remote main).
Fetched remote main and created `feat/mobile-ui-responsive-revamp` from this commit.

## Findings before implementation

| Surface                 | Issue / root cause                                                                             | Mobile presentation                                                        | Desktop impact                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| Dealer navigation       | Five-slot bottom bar drops Team; header's brand, status, credits and account compete for space | Full permission-filtered drawer; concise app bar; status/credits in drawer | Sidebar and header at 768px+ unchanged |
| Admin navigation        | Sidebar turns into a row but nested nav remains vertical, crowding brand and destinations      | Drawer with all permitted sections and active destination                  | Existing sidebar unchanged             |
| Sales workspace         | Reuses dealer shell; narrow email/app bar needs a menu                                         | Reuse drawer with existing sales items                                     | Existing sidebar unchanged             |
| Public header           | Cars and Dealers nav is hidden below md with no menu                                           | Compact brand, location/account, menu                                      | Existing desktop nav unchanged         |
| OTP (all consumers)     | Six 52px fields plus five 10px gaps wrap; nested panel is even narrower                        | Single-row grid sized from available width and configured length           | Original dimensions/gaps at 768px+     |
| Dealer dashboard        | 178px stat minimum stacks all metrics; 300px panel minimum overflows 288px content             | Two-column metrics and shrinking single-column panels                      | Original auto-fit grids                |
| Admin overview/details  | 158px metric minimum stacks; 290px panels exceed inner viewport                                | Two-column metrics and bounded detail columns                              | Original grids                         |
| Home                    | 500px hero, spacious journey cards and stacked feature sections create long scrolling          | Shorter hero and compact cards; readable descriptions retained             | Original spacing and typography        |
| Public grids            | Fixed auto-fill minimums can exceed nested containers                                          | Minmax constrained to available width                                      | Original minimums above mobile         |
| Vehicle detail/gallery  | Values can push labels; vertical lightbox rail takes scarce image width                        | Wrapping values, bottom thumbnail strip, clear touch targets               | Original rail and detail UI            |
| Forms/config/moderation | 220–280px minimums exceed nested card widths; review columns don't shrink                      | Mobile minimum resets, bounded values, single-column review                | Original controls and form handlers    |
| Search                  | Sort's 180px minimum competes with filter trigger                                              | Shrinkable sort; keep existing live URL-driven filter sheet                | Search semantics unchanged             |
| Tables                  | Existing wrappers scroll, but intrinsic sizes and hidden columns need attention                | Bounded focusable scroll regions; retain data in mobile queues             | Original table rendering               |
| Footer/loading          | One-column links waste space; skeleton/detail grids inherit minimums                           | Two-column link groups and bounded skeletons                               | Original desktop footer                |

## Route inventory

Every page below was reviewed in source, together with its layout and rendered
feature components. Source coverage is separate from the browser execution results below. API/BFF routes are excluded from presentation changes.

| Route source                                                                     | Audit coverage                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `apps/web/src/app/(admin)/admin/config/page.tsx`                                 | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/dealers/[id]/page.tsx`                           | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/dealers/page.tsx`                                | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/enquiries/[id]/page.tsx`                         | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/enquiries/page.tsx`                              | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/listings/[id]/page.tsx`                          | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/listings/page.tsx`                               | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/members/[id]/page.tsx`                           | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/members/page.tsx`                                | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/notifications/page.tsx`                          | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/page.tsx`                                        | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/support/[id]/page.tsx`                           | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(admin)/admin/support/page.tsx`                                | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(auth)/admin/login/page.tsx`                                   | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(auth)/dealer/login/page.tsx`                                  | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(auth)/dealer/onboarding/page.tsx`                             | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(auth)/login/page.tsx`                                         | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(dealer)/dealer/enquiries/page.tsx`                            | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(dealer)/dealer/inventory/page.tsx`                            | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(dealer)/dealer/page.tsx`                                      | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(dealer)/dealer/profile/page.tsx`                              | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(dealer)/dealer/team/page.tsx`                                 | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(dealer)/dealer/vehicles/[id]/edit/page.tsx`                   | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(dealer)/dealer/vehicles/new/page.tsx`                         | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/car/[slug]/page.tsx`                                  | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/cars/page.tsx`                                        | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/claim/[token]/page.tsx`                               | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/contact/page.tsx`                                     | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/dealers/[slug]/page.tsx`                              | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/dealers/page.tsx`                                     | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/enquiries/page.tsx`                                   | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/invitations/page.tsx`                                 | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/page.tsx`                                             | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/saved/page.tsx`                                       | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/support-requests/[id]/page.tsx`                       | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/support-requests/new/page.tsx`                        | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(public)/support-requests/page.tsx`                            | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(sales)/sales/dealers/[id]/page.tsx`                           | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(sales)/sales/dealers/[id]/vehicles/[vehicleId]/edit/page.tsx` | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(sales)/sales/dealers/[id]/vehicles/new/page.tsx`              | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(sales)/sales/dealers/new/page.tsx`                            | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(sales)/sales/dealers/page.tsx`                                | Layout, grids, forms, navigation, loading/error consumers |
| `apps/web/src/app/(sales)/sales/page.tsx`                                        | Layout, grids, forms, navigation, loading/error consumers |

## Validation boundaries

Browser evidence uses real components in the established Storybook sandbox,
with its existing deterministic action/data fixtures. It does not establish
live OAuth, SMS delivery, backend authorization, or production mutation success.
An isolated Postgres 16 database, seeded API, and production web builds supply
page-level browser comparisons. Existing development authorization renders
dealer/admin/sales routes; a separate cookie-auth API exercises customer OTP
with the existing fake driver. No production records are changed. Hardware virtual keyboard behavior
requires a real mobile device; small-height viewport emulation is supplemental.

No documented `testing_evidence` branch workflow was found in the checkout.
Visual artifacts stay outside production source and are linked from the PR.

## Reproducing responsive component checks

Run the established Storybook sandbox and a local headless Chromium with a
remote debugging port. Then run:

```sh
CHROME_DEBUG_URL=http://127.0.0.1:9222 \
SANDBOX_URL=http://127.0.0.1:6006 \
RESPONSIVE_EVIDENCE_DIR=/tmp/dealersdrive-responsive \
node apps/web/tests/responsive/browser-check.mjs
```

The script captures nine widths (320, 360, 375, 390, 430, 768, 1024, 1280,
1440), checks document overflow, and asserts equal-width, noncollapsed OTP
fields in one row with numeric input modes. Missing or failed fixtures fail
the run. Intentional scrolling in tables, vehicle strips, and thumbnail rails
is excluded from element diagnostics, but document overflow is never excluded.
Use `RESPONSIVE_STORIES` to select comma-separated fixture IDs.

Use a dedicated Chromium with background throttling disabled for long sweeps.
Evidence includes both actual pages and deterministic component fixtures;
redirected guest pages are identified in the page report rather than counted
as successful authenticated journeys.

## Recorded verification

- Repository lint and typecheck passed.
- All 4,916 repository tests passed: 1,475 web, 427 contracts, 3,014 API.
- Production build passed. Local Turbo build/test used `--env-mode=loose` to
  preserve the managed proxy; tests used two workers to avoid resource contention.
- 459 component viewport checks passed across 51 fixtures and nine widths.
- 297 actual-page viewport checks passed across 33 requested paths. Expected
  authentication redirects are recorded explicitly; 24 distinct destinations
  rendered. Sales pages used a seeded local sales cookie session.
- All 66 desktop comparisons at 1280px and 1440px are pixel-identical to main.
- Native Chromium checks passed OTP typing, backspace, paste, drawer focus
  trapping, Escape, focus return, and a short 320px viewport. Customer OTP
  checks passed wrong-code feedback, retry, resend cooldown, and successful
  verification using the existing fake driver.
- Gallery checks passed mobile opening, bottom thumbnails, keyboard arrows,
  last-photo selection, bounded rail scrolling, Escape, and focus return.
- Backend endpoints, schema/migrations, contracts, auth/business handlers,
  and dependency lockfile have no diff from the main baseline.

Full screenshots and machine-readable reports live on the separate
[evidence branch](https://github.com/shashikiran6sk/DealersDrive/tree/evidence/mobile-ui-responsive-revamp/mobile-ui-revamp),
linked from [PR #285](https://github.com/shashikiran6sk/DealersDrive/pull/285).
This branch is for review artifacts and is not part of the production PR.

Initial baseline/client-generation mismatches were resolved by rebuilding
local generated contracts and Prisma clients. Early browser fixtures exposed
an outdated action mock and an artificial fixed-width decorator; both fixtures
were repaired. Guest redirects were recaptured after settling; blinking carets
were blurred; exhausted isolated OTP request counters were reset by restarting
the local API. The passing reports reflect the final recaptures. No application
rate limits or existing tests were weakened.
