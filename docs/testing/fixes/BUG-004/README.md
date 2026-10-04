# BUG-004 — vehicle images follow dealer suspension

Additional baseline probe SEC-DISC-002 retains its original FAIL. It is separate from the 556 canonical rows. Before code changes, two regressions at unchanged parent `62b14915dec43118994b11f88f8a00191d2e55d8` reproduced an image HTTP200 after actual Admin suspension, while the listing returned404 and the authoritative dealer was SUSPENDED. Successful images also declared immutable caching for a year. [Reproduction](REPRODUCTION.md) and `evidence/ci/bug004-baseline-red.log` retain the failures.

Branch `fix/pre-production-04-suspended-media` must target `fix/pre-production-03-stable-pagination` (#234). Product/test commit `3aa48c47ee6992169f2d2e56e543fbf9c5d2767e`. PR creation and actual remote CI are pending. No merges.

## Root correction

The media service checked READY state, attachment and ACTIVE/RESERVED listing state, but never read the attached listing dealer status. It now applies the shared public ACTIVE dealer rule as well. The public derivative route sets Cache-Control no-store before validation on successes and denials, preventing new cache reuse from bypassing mutable visibility and preventing a cached404 surviving reinstatement. Storage files, listing states, memberships, enquiries, saved history and audit records are preserved. No schema or frontend changes. Signed private previews retain their existing authority and expiry. OpenAPI and code facades describe the visibility and cache policy.

Previously downloaded bytes cannot be withdrawn. Existing deployed cache entries require an explicit operational invalidation/migration check before launch; no live CDN or production deployment was inspected or modified. This origin change does not prove that old production cache entries are gone.

## Verification

- Nine real-cookie HTTP/DB regressions in `apps/api/tests/public-media-visibility.test.ts`: original same-URL suspension/reinstatement, all four stored derivative widths, conditional GET304 before suspension versus404 after it, HEAD, fallback variants/original, anonymous/owner/Admin direct requests, forged IDs and invalid widths, non-READY and detached media, and an unrelated ACTIVE dealer.
- ACTIVE/RESERVED/SOLD/WITHDRAWN lifecycle intersections exercise actual Admin transitions, public listing/search/profile/portfolio, stale owner inbox denial, Saved image suppression, customer enquiry link suppression, Admin history and signed Admin previews. Database snapshots compare listing/vehicle/media/attachments/memberships/saved/enquiry rows and timestamps; decision audit actions and actors are verified. Reinstatement restores only ACTIVE/RESERVED public images.
- Real owner yard and PAN_CARD upload/commit/private-preview flows verify private authority, ownership, UPLOADED state, exact bytes and tampered-link denial. Existing signed private links retain their limited validity after suspension; protected owner endpoints return401. These checks do not certify the separately recorded private PDF MIME defect.
- Targeted lifecycle suites: 160 PASS; final expanded security suite: nine PASS. Affected units: 117 PASS across ten files. Early metadata records parent HEAD with uncommitted implementation; committed full-suite and browser runs use `3aa48c4`.
- Full accumulated suite: **4,440 PASS** at `3aa48c4`: API2674/130 files, web1346/99, contracts420/14. Coverage statements96.97%, branches92.32%, functions98.36%, lines97.81%; thresholds PASS. Complete sanitized [API assertions](evidence/ci/api-assertions.json), [web assertions](evidence/ci/web-assertions.json), [contract assertions](evidence/ci/contracts-assertions.json) and `bug004-full-tests.log` are retained.
- Final root lint, typecheck and fresh production build: PASS at `3aa48c4`, all Turbo tasks forced. History secret scan: PENDING. Actual final-head remote CI: PENDING.

## Browser evidence

[Baseline](browser-baseline.json) reproduced vehicle image200 and same-tab refresh200 after actual Admin UI suspension. Its live API was the preceding BUG-003 product process with media source byte-equivalent to parent62; this qualification is separate from the exact-parent automated red run. [Fixed browser](browser-fixed.json) passes vehicle-media checks at1440/768/390 pixels against current `3aa48c4`: listing404, image404, existing image-tab refresh404, no-store, same URL200 and decoded pixels after reinstatement. Actual UI decisions, real sessions/API/PostgreSQL and history/audit preservation are exercised. Inert marked JPEG fixtures, fake providers and local-only guards prevent live messaging or production access. Private session data remains outside Git.

All six baseline and18 fixed screenshots were visually inspected. Visual review covers the fixed image denials, reinstated photographs, Saved history and public page state at all three widths. The suspended car screenshots deliberately expose the separate cached-page defect: content remains with broken image slots, while media/API denial succeeds. Functional media UAT PASS does not imply the entire page, mobile layout or full lifecycle certification passes. Human UAT PENDING; Chromium is not real-device certification.

## Separate findings and retained attempts

BUG-NEW-008 (P2): actual local PAN_CARD PDF upload/commit/read returns exact PDF bytes with image/jpeg MIME. [HTTP/DB diagnostic](evidence/private-pdf-finding.json); deployed S3/R2 not tested. BUG-NEW-009 (P2): known public yard image remains200 after suspension while dealer profile404. BUG-NEW-010 (P2): refreshing a warmed public vehicle page remains200 after actual Admin UI suspension while listing API404. All three are recorded in [new findings](../../pre-production/new-bugs.json) for separate later layers. No unrelated corrections are bundled here.

Retained failed attempts include a portfolio oracle expecting200 where existing suspended policy returns404, guessed KYC enum/path corrected to the actual PAN_CARD/storage contract, and a diagnostic module-resolution failure before any write corrected using the API dependency context. Actual schema accepts integer widths1..4000, with derivative fallback; negatives use invalid/out-of-range widths rather than inventing a four-width-only validation rule. The original diagnostic logger uses a legacy canonical field name for SEC-DISC-002; the traceability report correctly classifies it as an additional probe. Original baseline evidence remains unchanged.

[Traceability](canonical-retests.json) distinguishes additional baseline FAIL from each related canonical row's original status. Fresh API visibility checks pass, but warmed browser visibility remains FAIL under NEW-010. Full556 certification and complete-stack/provider/deployment gates remain pending. Production GO has not been established.
