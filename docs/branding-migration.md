# Approved identity migration

Base: `origin/main` at `69bf798b8cbfb62263d05244d15d0bf41861398e`.
The initial working tree was clean. Inventory recorded before implementation.

## Initial inventory

| File/component                                                                     | Current brand usage                                 | Background                     | Replacement                           | Action                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------ | ------------------------------------- | -------------------------------------------------------- |
| `apps/web/src/components/brand-logo/`                                              | Old opaque rounded DD tile                          | Caller dependent               | Independent transparent DD SVG        | Reuse shared component                                   |
| `apps/web/src/components/layout/customer-header/header-brand.tsx`                  | Old tile + ordinary text wordmark                   | White, including mobile drawer | Black icon + path wordmark            | Replace; retain compact mobile header                    |
| `apps/web/src/components/layout/customer-footer/customer-footer.tsx`               | Old tile + text wordmark                            | `#fbfbfa`                      | Black icon + path wordmark            | Replace                                                  |
| `apps/web/src/components/errors/status-shell/status-shell.tsx`                     | Old tile + text wordmark                            | White                          | Black icon + path wordmark            | Replace                                                  |
| `apps/web/src/components/auth/auth-shell/auth-shell.tsx`                           | Old tile beside contextual eyebrow                  | Light                          | Black icon only                       | Replace via shared component; retain context             |
| `apps/web/src/components/public/coming-soon.tsx`                                   | Old tile                                            | Light                          | Black icon only                       | Replace via shared component                             |
| `apps/web/src/components/ui/photo-gallery/gallery-viewer.tsx`                      | Old tile                                            | `#0c0c0b`                      | White icon only                       | Replace via shared component                             |
| `apps/web/src/app/(dealer)/dealer/layout.tsx`                                      | Old tile beside Dealer console                      | `#fbfbfa`                      | Black icon only                       | Replace via shared component                             |
| `apps/web/src/app/(admin)/admin/layout.tsx`                                        | Old tile beside Admin console                       | `#0c0c0b`                      | White icon only                       | Replace via shared component                             |
| `apps/web/src/app/(sales)/sales/layout.tsx`                                        | Old tile beside Sales workspace                     | `#fbfbfa`                      | Black icon only                       | Replace via shared component                             |
| `apps/web/src/app/{favicon.ico,icon.png,apple-icon.png}`                           | Old DD geometry                                     | Black                          | White standalone DD on black          | Regenerate; retain file-based Next metadata              |
| `apps/web/src/app/manifest.ts`, `apps/web/public/brand/icon*.png`                  | Old DD installation icons                           | Black                          | New standalone DD on black            | Regenerate, version URLs, preserve maskable safe area    |
| `apps/web/public/brand/dealers-drive-{light,dark}.{svg,png}`                       | Old rounded tile masters/rasters                    | Opaque light/dark              | Four independent SVG masters          | Keep compatibility URLs with new artwork                 |
| `apps/web/public/og/dealers-drive.png`, `apps/web/src/lib/seo/seo.constants.ts`    | Old tile and text in default social card            | Dark                           | White icon + separate wordmark        | Replace branding, retain useful copy; version active URL |
| `apps/web/src/lib/seo/schemas/site.ts`                                             | Organization logo points at old tile                | Light                          | Public full-brand PNG                 | Update path and dimensions                               |
| `apps/api/src/modules/notifications/templates.ts`                                  | Ordinary text in HTML email header                  | White                          | Separate black PNG icon + wordmark    | Replace header only; preserve text emails and legal copy |
| `scripts/generate-favicon.mjs`                                                     | Generates obsolete contour                          | Black                          | Render approved icon master           | Update generator                                         |
| `apps/sandbox/src/stories/ui/brand-logo.stories.tsx`                               | Shared logo preview                                 | Light/dark                     | Approved variants and lockup previews | Update preview                                           |
| `apps/sandbox/src/mocks/{portfolio,admin-dealer}.ts`                               | Old OG URL used as placeholder                      | Image                          | Updated compatibility card            | Preserve references                                      |
| `docs/seo.md`                                                                      | Documents obsolete icon crop and logo URL           | N/A                            | Current asset conventions             | Update                                                   |
| `docs/screens/`, `docs/Dealers-Drive-UI/`                                          | Historical screenshots and static design references | Mixed                          | Historical records                    | Preserve; not served by app                              |
| `apps/web/public/brand/dealer-directory-cover.svg`, `public/images/home-hero.webp` | Generic dealership illustration / car photo         | Mixed                          | No brand artwork                      | Preserve                                                 |

Customer home, car listings/details, dealer listings/details, saved cars, enquiries,
support/contact and legal pages inherit the customer shell. Dealer onboarding,
registration, OTP and admin authentication use the shared auth shell. Other
dealer/admin screens inherit their console shells. Loading and empty states use
generic skeletons, spinners, illustrations or dealership initials, not DD artwork.
Dealer `LogoTile` values and business names are customer data and remain intact.
No native Android project, branded PDF generator or dynamic branded OG generator
exists in the tracked repository. Vehicle/dealer photographic social overrides
must remain intact. Existing API notification text and legal entity names are not
wordmark artwork.

## Artwork source

The user selected Image #2 (light background) as the shared geometry source for
both colors. Trace the icon and lettering independently; never substitute a font.
Image #1 is a contrast reference: its proportions differ from Image #2, so one
geometry cannot exactly match both. Original raster references stay outside the
production tree. SVG masters contain paths, no raster embedding or background.

## Delivered asset inventory

All paths below are under `apps/web/` unless otherwise stated.

| Asset                                                                                                        | Format / size                         | Purpose                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------- |
| `public/brand/dd-icon-black.svg`, `dd-icon-white.svg`                                                        | 651 × 424 viewBox, transparent paths  | Standalone symbol, identical geometry                               |
| `public/brand/dealersdrive-wordmark-black.svg`, `dealersdrive-wordmark-white.svg`                            | 1092 × 145 viewBox, transparent paths | Approved lettering, no font dependency                              |
| `public/brand/dd-icon-{black,white}.png`                                                                     | 651 × 424, RGBA                       | Transparent raster symbol variants; black used by email             |
| `public/brand/dealersdrive-wordmark-{black,white}.png`                                                       | 1092 × 145, RGBA                      | Transparent lettering variants; black used by email                 |
| `src/app/favicon.ico`                                                                                        | 16, 32, 48 square PNG frames          | Smaller white DD on rounded black, transparent corners, no wordmark |
| `src/app/icon.png`                                                                                           | 512 square                            | Next file-based browser icon                                        |
| `src/app/apple-icon.png`                                                                                     | 180 square                            | Apple touch icon                                                    |
| `public/brand/dd-icon-v2-192.png`, `dd-icon-v2-512.png`                                                      | 192 / 512 square                      | Manifest installation icons                                         |
| `public/brand/dd-icon-v2-maskable-512.png`                                                                   | 512 square, opaque                    | Android/PWA maskable safe area                                      |
| `public/brand/dealersdrive-organization-v2.png`                                                              | 1024 square, white background         | Organization ImageObject; separate masters composed at generation   |
| `public/og/dealersdrive-v2.png`                                                                              | 1200 × 630, black background          | Default Open Graph and Twitter card                                 |
| `public/brand/dealers-drive-{light,dark}.{svg,png}`, `public/brand/icon*.png`, `public/og/dealers-drive.png` | Compatibility outputs                 | Updated artwork at existing public URLs                             |

`BrandLogo` retains the existing `light` (black artwork) / `dark` (white artwork)
interface. It renders only the DD symbol without the obsolete rounded tile.
`BrandWordmark` is independently reusable. `BrandLockup` composes both assets,
reserves intrinsic space, and exposes one accessible brand label. The customer
mobile header retains its icon-only presentation; its drawer shows the wordmark.
Dealer, admin and sales console labels remain contextual text beside the icon.
Their mobile drawers previously contained console titles without brand artwork;
that structure is preserved.

## Extraction fidelity

Image #2 was cropped at `(314, 324, 651, 424)` for the icon and
`(88, 804, 1092, 145)` for the wordmark. Both were traced using Potrace at a
128 luminance threshold, `turdSize=3`, `alphaMax=1`, `optTolerance=0.15`.
Thresholded silhouette intersection-over-union versus the original source crop
is 99.789% for the symbol and 98.572% for the lettering. This measures binary
silhouette coverage, not a claim of pixel-identical edge recovery. Black and
white variants share exactly the same paths and alpha coverage. No ordinary
text, substituted font, background rectangle or embedded raster is in a master.
The source rasters' antialiasing and slight texture cannot be recovered exactly;
Image #1 has different geometry and is used only to review white-on-black
contrast, following the user's explicit choice of Image #2 as the common source.

## Browser and SEO validation

Evidence lives in [the screenshot directory](screens/branding/v2/README.md).
The built Next.js app was exercised at 1440 × 1000 and 390 × 1000 using a temporary
Playwright harness and isolated API fixtures. Sixteen route/viewport/drawer
captures plus footer, asset review, social card and email previews are retained.
The fixture data is synthetic; authentication and SMS were not sent to external
services. The repository's unit/integration suites validate business behavior
separately. No authentication or API logic was changed.

All captured routes returned 200. The browser report records no runtime errors,
missing brand requests, or horizontal overflow. Visual review covered symbol
shape, negative space, wordmark weight/spacing, contrast, compact console icons,
mobile header/drawer alignment, footer, email, icon centering and social imagery.
The favicon is shown at native 16/32/48 sizes and enlarged for inspection in the
asset review sheet; native browser tab chrome was not captured.

Rendered HTML was checked for a single conventional favicon link, Next's
fingerprinted icon/apple links, manifest references, matching OG/Twitter images,
and the Organization JSON-LD ImageObject. Its logo points to the public full-brand
PNG with matching 1024 × 1024 dimensions. Updated and compatibility image URLs,
as well as manifest URLs, returned 200 with valid image or manifest MIME types.
The local validation report is [available as JSON](screens/branding/v2/validation.json).
Production public access, CDN state and search engine recrawling cannot be
verified before deployment. The existing absolute-URL helper, canonical paths,
robots/indexing rules, schema semantics and photographic social overrides remain.

## Cache and release considerations

Active social, organization and manifest paths are versioned. Next supplies
content fingerprints for file-based PNG icons. Conventional `favicon.ico` and
legacy public URLs retain normal browser/CDN cache behavior; no cache policy,
infrastructure setting or arbitrary cache-busting query parameter was added.
Compatibility URLs serve new artwork, and no historical reference was deleted.
Original full-size source rasters and temporary test harnesses/logs are outside
the production tree. Review the PR's CI result before merging; deployment and
post-deployment public URL/cache checks remain release-owner actions.

**Follow-up — the favicon in search results.** Keeping the conventional
`favicon.ico` URL turned out to be the gap: after release, Google kept showing
the old `DD` lettering, because the page still linked `/favicon.ico`, the URL
it had cached the old mark under. The other link was `icon.png` at 512px,
which is not the square multiple of 48px that Google uses. The favicon now
follows the same rule as the other assets: versioned URLs declared in root
metadata (`favicon-v2.ico`, `dd-favicon-v2-48/96.png`, `dd-icon-v2-192.png`,
`dd-apple-icon-v2-180.png`), with no icon files left in `src/app/`.
`/favicon.ico` still serves the new mark from `public/`, but is no longer
linked. The `src/app/` icon rows in the inventories above and the file list
below describe the release as it shipped; see `docs/seo.md` for the current set.

## Validation commands and results

| Command / check                                                                                                      | Result                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                     | Passed; lockfile unchanged. Initial offline attempt lacked a cached tarball; online installation restored the exact dependencies.                                                                         |
| `pnpm --filter @dealers-drive/api db:generate`                                                                       | Passed; required Prisma client regenerated after installation.                                                                                                                                            |
| `node scripts/generate-favicon.mjs`                                                                                  | Passed; all derivatives generated from approved masters.                                                                                                                                                  |
| `node scripts/verify-brand-assets.mjs`                                                                               | Passed; geometry, independent artwork, alpha, raster decoding, ICO sizes/centering and active reference checks.                                                                                           |
| `pnpm format:check`                                                                                                  | Passed.                                                                                                                                                                                                   |
| `pnpm lint` (includes `pnpm docs:check`)                                                                             | Passed; pre-existing sandbox pages-directory advisory only.                                                                                                                                               |
| `pnpm typecheck`                                                                                                     | Passed across all six tasks, including sandbox.                                                                                                                                                           |
| `pnpm --filter @dealers-drive/web test`                                                                              | Passed: 142 files, 1,697 tests.                                                                                                                                                                           |
| Contracts tests via `pnpm test`                                                                                      | Passed: 24 files, 576 tests.                                                                                                                                                                              |
| `pnpm test`                                                                                                          | Initial local run failed two unrelated environment-sensitive API tests (timezone and inherited APP_ENV); 3,420 API tests passed.                                                                          |
| `TZ=UTC APP_ENV=local pnpm test`                                                                                     | Timezone issue resolved; one logger test still failed because Turbo strict mode removed APP_ENV and dotenv loaded local dev settings.                                                                     |
| `TZ=UTC APP_ENV=local pnpm --filter @dealers-drive/api test`                                                         | Passed: 173 files, 3,422 tests, full unit/integration suite and coverage gate. Statements 95.77%, branches 90.02%, functions 97.92%, lines 96.93%. No assertions or unrelated tests changed.              |
| `pnpm --filter @dealers-drive/api exec vitest run --project unit tests/unit/modules/notifications/templates.test.ts` | Passed: 103 tests, including independent PNG branding in every HTML template.                                                                                                                             |
| `pnpm build`                                                                                                         | Passed: all three build tasks; optimized Next build and route generation completed.                                                                                                                       |
| `pnpm --filter @dealers-drive/sandbox build:sandbox`                                                                 | Passed.                                                                                                                                                                                                   |
| Temporary Playwright route, image and SEO checks                                                                     | Passed: 16 route/viewport/drawer captures, 20 total screenshots, zero runtime errors/missing brand requests/overflow. Metadata, compatibility and manifest image URLs returned 200 with valid MIME types. |
| `git diff --check` and staged secret-pattern review                                                                  | Passed; no secrets found in changed text assets/code.                                                                                                                                                     |

The installation initially exposed a stale duplicate React type installation and
missing generated Prisma client; those setup issues were resolved without
changing dependency versions, lockfiles, project configuration or source types.
Local root-suite environment failures are recorded above rather than represented
as passes. The explicit API run proves all affected and unaffected API tests pass
with the suite's expected local/UTC environment. CI runs without this machine's
untracked dev `.env` and must be checked independently before release.

## Requested size refinement

The user requested a smaller DD symbol across the home page and other pages,
plus a smaller favicon symbol and rounded black background. Shared page symbols
now default to 24 px high (previously 30 px), while the wordmark stays 136 px wide.
Compact admin/sidebar and photo-viewer symbols are 18 px high (previously 23 px).
The icon and wordmark master geometry is unchanged.

Browser favicon/icon tiles now use the symbol at 68% of tile width (previously
86%) and a rounded black rectangle with a 22% corner radius and transparent
outer corners. Apple touch and PWA/maskable icons retain full-bleed backgrounds.
The ICO test verifies transparent corners, opaque black edges, centering, smaller
symbol bounds and decodable 16/32/48 frames. Screenshots and browser metadata
fingerprint evidence were refreshed after this refinement. The full 1,697-test
web suite, lint, type checking, production build, asset verification and browser
checks all passed again. The preceding revision also passed every GitHub CI check.

## Exact file changes

No files were removed. Compatibility URLs and historical documentation assets are retained.

<details>
<summary>Added files</summary>

- `apps/web/public/brand/dd-icon-black.png`
- `apps/web/public/brand/dd-icon-black.svg`
- `apps/web/public/brand/dd-icon-v2-192.png`
- `apps/web/public/brand/dd-icon-v2-512.png`
- `apps/web/public/brand/dd-icon-v2-maskable-512.png`
- `apps/web/public/brand/dd-icon-white.png`
- `apps/web/public/brand/dd-icon-white.svg`
- `apps/web/public/brand/dealersdrive-organization-v2.png`
- `apps/web/public/brand/dealersdrive-wordmark-black.png`
- `apps/web/public/brand/dealersdrive-wordmark-black.svg`
- `apps/web/public/brand/dealersdrive-wordmark-white.png`
- `apps/web/public/brand/dealersdrive-wordmark-white.svg`
- `apps/web/public/og/dealersdrive-v2.png`
- `apps/web/src/components/brand-logo/brand-lockup.tsx`
- `apps/web/src/components/brand-logo/brand-wordmark.tsx`
- `apps/web/tests/unit/components/brand-identity.test.tsx`
- `docs/branding-migration.md`
- `docs/screens/branding/v2/README.md`
- `docs/screens/branding/v2/admin-dashboard-desktop.png`
- `docs/screens/branding/v2/admin-dashboard-mobile.png`
- `docs/screens/branding/v2/admin-mobile-drawer.png`
- `docs/screens/branding/v2/asset-review.png`
- `docs/screens/branding/v2/car-detail-desktop.png`
- `docs/screens/branding/v2/car-detail-mobile.png`
- `docs/screens/branding/v2/contact-desktop.png`
- `docs/screens/branding/v2/customer-mobile-drawer.png`
- `docs/screens/branding/v2/dealer-dashboard-desktop.png`
- `docs/screens/branding/v2/dealer-dashboard-mobile.png`
- `docs/screens/branding/v2/dealer-detail-desktop.png`
- `docs/screens/branding/v2/dealer-detail-mobile.png`
- `docs/screens/branding/v2/dealer-mobile-drawer.png`
- `docs/screens/branding/v2/email-preview.png`
- `docs/screens/branding/v2/footer.png`
- `docs/screens/branding/v2/home-desktop.png`
- `docs/screens/branding/v2/home-mobile.png`
- `docs/screens/branding/v2/login-desktop.png`
- `docs/screens/branding/v2/login-mobile.png`
- `docs/screens/branding/v2/og-preview.png`
- `docs/screens/branding/v2/validation.json`
- `scripts/verify-brand-assets.mjs`

</details>

<details>
<summary>Modified files</summary>

- `apps/api/src/modules/notifications/templates.ts`
- `apps/api/tests/unit/modules/notifications/templates.test.ts`
- `apps/sandbox/src/stories/ui/brand-logo.stories.tsx`
- `apps/web/public/brand/dealers-drive-dark.png`
- `apps/web/public/brand/dealers-drive-dark.svg`
- `apps/web/public/brand/dealers-drive-light.png`
- `apps/web/public/brand/dealers-drive-light.svg`
- `apps/web/public/brand/icon-192.png`
- `apps/web/public/brand/icon-512.png`
- `apps/web/public/brand/icon-maskable-512.png`
- `apps/web/public/og/dealers-drive.png`
- `apps/web/src/app/apple-icon.png`
- `apps/web/src/app/favicon.ico`
- `apps/web/src/app/icon.png`
- `apps/web/src/app/manifest.ts`
- `apps/web/src/app/(admin)/admin/layout.tsx`
- `apps/web/src/components/auth/auth-shell/auth-shell.tsx`
- `apps/web/src/components/brand-logo/brand-logo.constants.ts`
- `apps/web/src/components/brand-logo/brand-logo.tsx`
- `apps/web/src/components/brand-logo/index.ts`
- `apps/web/src/components/ui/photo-gallery/gallery-viewer.tsx`
- `apps/web/src/components/errors/status-shell/status-shell.tsx`
- `apps/web/src/components/layout/customer-footer/customer-footer.tsx`
- `apps/web/src/components/layout/customer-header/header-brand.tsx`
- `apps/web/src/lib/seo/seo.constants.ts`
- `apps/web/tests/unit/components/dealers/portfolio-page.test.tsx`
- `apps/web/tests/unit/components/layout/customer-header.test.tsx`
- `apps/web/tests/unit/components/ui/photo-gallery.test.tsx`
- `apps/web/tests/unit/lib/seo/schemas.test.ts`
- `docs/seo.md`
- `scripts/generate-favicon.mjs`

</details>
