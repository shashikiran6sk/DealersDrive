# Dealers Drive reference logo replacement

The user supplied [reference.png](reference.png) on 2026-10-04 and requested
black on white and white on black variants. A follow-up specified white on
black for the favicon; Apple touch and manifest icons use that same treatment.
The attachment contains a joined DD monogram, with no additional wordmark.
Existing adjacent brand text, links and navigation remain unchanged.

## Assets and reproduction

The final optimized PNGs are both 2048 × 2048:

- [Black on white](../../apps/web/public/brand/dealers-drive-light.png), 62,551 bytes.
- [White on black](../../apps/web/public/brand/dealers-drive-dark.png), 60,383 bytes.

The corresponding SVG files contain the same traced path, with the background
and foreground colors reversed. The app consumes the PNGs. Colors are pure
black and white with antialiasing shades along the contour. Both exported variants now use a 32% corner radius and transparent outer
corners, matching the shared component clipping. This follow-up rounds the
background further at the user’s request without changing the DD contour.

Built-in ImageGen editing was used for two candidates. The prompt intent was
to reproduce only the supplied joined DD mark, remove the screenshot border,
retain its typography, proportions and spacing, and export clean square
black-on-white and white-on-black variants without extra text. Visual
inspection found that generated candidates changed the overlap and second D
stem, so neither candidate is shipped. No ImageGen CLI fallback was used.

The final faithful vector contour was traced from the attachment instead of
using a substitute font. The 184 × 184 tile starts at screenshot coordinate
(26, 31); screenshot surround and rounded outer corners were excluded from
the glyph mask. Tracing used an 8× raster with 0.5 source-pixel smoothing,
threshold 135 and curve optimization tolerance 2. Thresholded glyph overlap
against the original crop was 98.65%. Both variants share this exact contour
and viewBox, preserving the monogram's placement and aspect ratio. This
measurement accounts for smoothing of a low-resolution screenshot; it does
not claim a recovered original vector master. Sharp rasterization produced
optimized palette PNGs without adding project dependencies.

Favicon frames are 16, 32 and 48 px. The app icon is 512 px, Apple touch icon
180 px, manifest icons 192/512 px, and maskable icon 512 px. Small icons use
a tighter symbol crop; the maskable icon retains safe internal padding. All
are white DD on black. The existing 1200 × 630 social preview changes only
the old logo tile; its copy and composition are retained.

The Organization logo now points to the 2048 px light PNG through the existing
absolute-URL helper. With the existing production origin it is
`https://www.dealers-drive.com/brand/dealers-drive-light.png`. It is a public
static asset on deployment; local HTTP checks returned 200. The schema test
verifies the production URL and dimensions. Titles, descriptions, canonical
URLs, contact data, robots and other schema fields were preserved.

## Usage audit

| Location                                                     | Actual surface                          | Variant and sizing                                      |
| ------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------- |
| CustomerHeader, desktop/mobile, signed-in and anonymous      | White, including sticky scrolling state | Light, existing 30 px slot                              |
| CustomerFooter                                               | Off-white `#fbfbfa`                     | Light rounded tile, 30 px                               |
| AuthShell, customer/dealer/admin sign-in and onboarding      | White                                   | Light, 30 px                                            |
| StatusShell, root/global errors and standalone missing pages | White                                   | Light, 30 px                                            |
| ComingSoon                                                   | Pale `#f7f7f5`                          | Light rounded tile, 30 px                               |
| Dealer console sidebar                                       | Light sidebar                           | Light, 30 px; sidebar remains hidden on mobile          |
| Admin console navigation                                     | Dark `#0c0c0b`                          | Dark, 23 px square centered in original 29 × 23 px slot |
| Fullscreen vehicle GalleryViewer                             | Dark dialog `#0d1017`                   | Dark rounded tile, original 29 × 23 px slot             |
| Browser/installed icons                                      | Black tile                              | White symbol crop                                       |
| Open Graph/Twitter shared preview                            | Dark `#0c0c0b`                          | Dark rounded tile                                       |

The app has fixed page surfaces, with no global light/dark switch or
scroll-dependent header color. Both brand variants were also inspected on
white, off-white, pale, dark and black backgrounds in the sandbox. Loading
routes contain skeletons rather than separate platform logos and inherit the
updated shells. Dealer LogoTile initials identify individual dealerships;
they are separate from platform branding. Generic Plate variants remain
available, but no UI consumer renders DD through Plate anymore. The unused
`.dd-brand-mark` text-logo CSS was removed.

## Visual evidence

The before screenshots show the original homepage and standalone error shell.
The after evidence includes real component stories and local pages. Console
pages use temporary local fixture responses with `example.test` identities;
these fixtures are not committed. The homepage and login display their
existing unavailable-service fallbacks. Screenshots verify branding and
layout, not a live authentication or inventory service.

Desktop checks used 1280 × 900, mobile 375 × 812, and intermediate widths
768/1024. The standalone error-shell desktop shot is 1024 × 900. Inspecting
scrolled headers confirmed the same light variant. Logo assets loaded with
explicit dimensions, retained alignment, showed no clipping or distortion,
and reserved their original footprints before loading. The favicon frames
were decoded and inspected at native 16/32/48 sizes.

| Surface           | Desktop evidence                                           | Mobile evidence                                           |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| Before homepage   | [Before](../screens/branding/before-home-desktop.jpg)      | [Before](../screens/branding/before-home-mobile.jpg)      |
| Homepage          | [After](../screens/branding/after-home-desktop.jpg)        | [After](../screens/branding/after-home-mobile.jpg)        |
| Header story      | [After](../screens/branding/after-header-desktop.jpg)      | [After](../screens/branding/after-header-mobile.jpg)      |
| Footer story      | [After](../screens/branding/after-footer-desktop.jpg)      | [After](../screens/branding/after-footer-mobile.jpg)      |
| AuthShell story   | [After](../screens/branding/after-auth-desktop.jpg)        | [After](../screens/branding/after-auth-mobile.jpg)        |
| Login page        | [After](../screens/branding/after-login-desktop.jpg)       | [After](../screens/branding/after-login-mobile.jpg)       |
| ComingSoon story  | [After](../screens/branding/after-coming-soon-desktop.jpg) | [After](../screens/branding/after-coming-soon-mobile.jpg) |
| Admin console     | [After](../screens/branding/after-admin-desktop.jpg)       | [After](../screens/branding/after-admin-mobile.jpg)       |
| Dealer console    | [After](../screens/branding/after-dealer-desktop.jpg)      | [After](../screens/branding/after-dealer-mobile.jpg)      |
| Photo viewer      | [After](../screens/branding/after-gallery-desktop.jpg)     | [After](../screens/branding/after-gallery-mobile.jpg)     |
| Not-found page    | [After](../screens/branding/after-status-desktop.jpg)      | [After](../screens/branding/after-status-mobile.jpg)      |
| StatusShell story | [After](../screens/branding/after-error-shell-desktop.jpg) | [After](../screens/branding/after-error-shell-mobile.jpg) |
| Sticky header     | [After](../screens/branding/after-sticky-desktop.jpg)      | [After](../screens/branding/after-sticky-mobile.jpg)      |

Additional evidence: [768 px](../screens/branding/after-tablet.jpg),
[1024 px](../screens/branding/after-medium.jpg),
[all surfaces](../screens/branding/after-surfaces.jpg),
[icon frames](../screens/branding/after-icon-sizes.png),
[browser icon source](../screens/branding/after-icon.jpg), and social
[before](../screens/branding/before-social.png) /
[after](../screens/branding/after-social.png).

## Validation

- `pnpm lint`, including formatting, ESLint and documentation links.
- `pnpm typecheck`.
- `pnpm build` and sandbox `build:sandbox`.
- Web: 99 files / 1,346 tests passed; contracts: 14 files / 420 tests passed.
- Direct API unit tests with `APP_ENV=local TZ=UTC`: 84 files / 1,755 tests passed.
- The initial root test runs exposed existing environment assumptions: logger
  expects `local` while `.env` supplies `dev`, and the membership migration test
  expects UTC. Turbo's strict environment does not pass the APP_ENV override.
  Final full gate passed (4 tasks; API 132 files / 2,740 tests) using `APP_ENV=local TZ=UTC pnpm exec turbo run test --env-mode=loose`.
- Local public asset URLs returned 200 with the expected MIME types. Metadata
  included favicon, app icon, Apple touch, manifest, and absolute Organization
  logo URL with 2048 dimensions. UI logos expose “Dealers Drive” alt text.
- A final source search found no old platform DD text-logo consumer; residual
  DD identifiers and generic Plate/dealership identity APIs are unrelated.

## Rounded-background follow-up

The user requested softer black/white tile corners after reviewing PR #240.
The background radius increased from 25% to 32% in shared UI, exported
PNGs/SVGs, the social preview tile, favicon frames and regular app/touch/manifest
icons. The glyph path is byte-identical to the previous revision. Maskable
icons remain opaque with safe padding because the launcher applies their shape.

Updated evidence: [desktop surfaces](../screens/branding/rounded-surfaces-desktop.jpg),
[mobile surfaces](../screens/branding/rounded-surfaces-mobile.jpg),
[mobile footer](../screens/branding/rounded-footer-375.jpg),
[desktop gallery](../screens/branding/rounded-gallery-desktop.jpg),
[mobile gallery](../screens/branding/rounded-gallery-mobile.jpg), and
[icon sizes](../screens/branding/after-icon-sizes.png). Shared header, footer,
authentication, coming-soon and status shells were inspected at desktop and
mobile widths with loaded images and retained dimensions. Earlier screenshots
above document the first revision; files prefixed `rounded-` show this follow-up.

Web tests passed again: 99 files / 1,346 tests. Lint, type checks, production
build and sandbox build also passed for this follow-up.
