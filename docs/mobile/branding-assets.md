# Android branding asset inventory — PR #311

Status: approved masters adopted in resumed F099 after fresh START. Source/raster/component checks pass; Android prebuild/resource inspection passes. Native compilation and installed-device validation remain pending.

## Verified source and provenance

- Website branding is already implemented by merged PR #311; no new branding PR or redesign is needed.
- Main/branding merge: `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`.
- Legal foundation: `6180a4b52522493b884550448d0a84e7d95432df`, containing the original legal head and the branding merge.
- Original F099 commit `bcb1bee7e4db4f999a2081665512471b0266507d` retained. Approved parent-into-child merge `fb02d063fa2d50c0d99505d7adfe15e456f9f826` includes the new foundation without history rewriting.
- Inventory timestamp: 2026-10-14 12:51:40 UTC.

| Master                                                                                                                                                                                | Dimensions / aspect ratio | Fill    | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- | ------------------------------------------------------------------ |
| [dd-icon-black.svg](https://github.com/shashikiran6sk/DealersDrive/blob/6180a4b52522493b884550448d0a84e7d95432df/apps/web/public/brand/dd-icon-black.svg)                             | 651 × 424 / 1.535377      | #000000 | `a13e463d5e03a0e43e7701bcc50e9ac32ac32e14271019efadbb15ff9f8af677` |
| [dd-icon-white.svg](https://github.com/shashikiran6sk/DealersDrive/blob/6180a4b52522493b884550448d0a84e7d95432df/apps/web/public/brand/dd-icon-white.svg)                             | 651 × 424 / 1.535377      | #ffffff | `73fe7172368307e6395e798671a64f47d28464282d8eb9b6d096f08f763aca21` |
| [dealersdrive-wordmark-black.svg](https://github.com/shashikiran6sk/DealersDrive/blob/6180a4b52522493b884550448d0a84e7d95432df/apps/web/public/brand/dealersdrive-wordmark-black.svg) | 1092 × 145 / 7.531034     | #000000 | `06da86d1e1fbb1bc26394aca2c3906274115cb0546d53e9bd0d4e666ec2b459c` |
| [dealersdrive-wordmark-white.svg](https://github.com/shashikiran6sk/DealersDrive/blob/6180a4b52522493b884550448d0a84e7d95432df/apps/web/public/brand/dealersdrive-wordmark-white.svg) | 1092 × 145 / 7.531034     | #ffffff | `6e88752dec4aee0dac09cabcfa18da2678d2cc4be3b984ceb1ba45158cf7ffe3` |

All four masters match main byte-for-byte. Both color pairs have identical SVG path data and raster alpha coverage; each has one path, no text/image/rect/foreignObject embedding, and transparent exterior. The DD artwork consists of the standalone symbol; the wordmark is separate lettering. Do not treat font text as an equivalent wordmark.

Matching source PNGs are present at the same stems. Inspected sizes: symbols 651×424, wordmarks 1092×145, all RGBA with transparent exteriors. These provide web/email raster references; SVG geometry remains authoritative for native preparation.

## Reference assets and components

- Approved primary stems: dd-icon-black/white and dealersdrive-wordmark-black/white under apps/web/public/brand.
- Browser/PWA references: dd-icon-v2-192.png, dd-icon-v2-512.png, dd-icon-v2-maskable-512.png. Use only as appearance references; their canvas/mask/background is not automatically an Android foreground.
- Combined organization/social images and compatibility dealers-drive-light/dark paths are not independent Android logo masters.
- Web primitives: BrandLogo, BrandWordmark, BrandLockup; consumers include HeaderBrand, AuthShell, customer footer, error shell and dark gallery.
- BrandLogo height defaults to 24px with proportional width around 37px. BrandWordmark defaults to 136px width/about 18px height; full lockup uses 10px gap.
- Narrow customer header visually hides wordmark below 640px; drawer/auth/footer use the full lockup. Match source/captures at native 360/393/412dp and suitable tablet widths.
- Brand variant mapping is light surface → black artwork; dark surface → white artwork. Do not reuse obsolete variant naming assumptions.
- Post-branding references: docs/screens/branding/v2/asset-review.png, home-mobile.png, login-mobile.png, customer-mobile-drawer.png and validation.json from the new foundation. These are local synthetic browser evidence, not Android release screenshots.

## Planned Android usage

| Location                           | Required presentation                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Home header                        | Updated compact web-mobile symbol behavior; full lockup only where source/space calls for it |
| Login / OTP / signup / auth errors | Independent DD and wordmark on appropriate light/dark surfaces                               |
| Profile / About                    | Approved identity, correct proportions and accessible label                                  |
| Legal screens                      | Approved brand shell; document text/version/hash/acceptance unchanged                        |
| Launcher / adaptive / Play icon    | DD symbol only; wordmark prohibited                                                          |
| Splash                             | DD symbol only; no stretching/cropping                                                       |
| Dark gallery                       | White symbol, no baked light tile                                                            |
| Store screenshots / graphics       | Actual release screens and separately composed approved assets                               |

## Native asset preparation specification

After fresh START approving the amended plan/restack:

1. Copy the four SVG masters without path/letterform/viewBox modifications and record source hashes in a native asset provenance manifest.
2. Reuse existing react-native-svg/Expo image capability; do not add a branding library or require a font to reconstruct lettering.
3. Where PNG is required, rasterize with existing build tooling at explicit sizes, uniform scale and centered placement. Preserve transparent exteriors for UI, adaptive foreground and splash symbol resources.
4. Use separate foreground/background for adaptive icons. Plan a 108×108dp-equivalent square canvas (for example 1080×1080px source), with actual symbol pixels inside the central 66×66dp safe area. Choose scale through alpha-bounds and OEM-mask checks, without stretching the 651:424 geometry.
5. Use only approved flat light/dark surface treatment. The foreground must not contain an opaque rounded square, baked mask, shadow, wordmark or obsolete tile. Android applies launcher masks.
6. Generate launcher artwork and Play 512×512 icon from the same standalone geometry; use high-resolution source (for example 1024×1024) for sharp scaling. These are planned sizes, not existing Android assets.
7. Configure Expo icon/adaptive foreground/background/optional monochrome and splash plugin only after generation/inspection. Splash uses contain mode and symbol-only source with a matching surface; verify actual Android system splash in release builds.
8. Do not use favicon.ico or its 16/32/48px frames as Android master assets. Do not blindly copy PWA maskable PNG into native foreground.
9. Keep display name/package decisions distinct from path wordmark spelling. Existing display name is Dealers-Drive; legal text, SEO canonicals and customer/dealer names are unchanged.

Platform references: [Android adaptive icon design](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Expo splash and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

## Resumed F099 adoption

The original logo.png, icon.png and icon-maskable.png were removed. Runtime UI uses exact approved XML generated from the four SVG masters, with independent symbol/wordmark and one accessible lockup label. Native raster resources and source hashes are in apps/mobile/src/assets/brand/provenance.json. Launcher is 1024×1024, adaptive foreground/monochrome 1080×1080 with transparent exterior and 600px-wide symbol, and splash 651×424 with transparency. app.json uses only these symbol resources, a flat white launcher background and a light native theme. No wordmark/font substitute is embedded in icon or splash.

## F099 acceptance criteria

- Updated #279 foundation is an ancestor after an owner-approved no-rewrite restack, retaining the existing F099 commit.
- All four native master bytes/path data match the pinned website SVGs and provenance hashes.
- Symbol and wordmark are separate; all icon/splash references resolve to symbol-only resources.
- Light/dark component fixtures select black/white variants correctly; lockup provides one accessible brand label without duplicate announcements.
- Aspect ratios, source viewBoxes, transparency, uniform scale, spacing and centering are verified; no border-radius clipping or font substitution.
- Generated PNG dimensions/alpha bounds, safe-zone containment and mask previews pass; no geometry/letterform change, baked foreground background or wordmark.
- Updated mobile header/auth/Profile/About/legal primitives use current identity; old asset references are absent from runtime/config.
- Native lint/types/tests/SDK/bundle checks and affected web/legal compatibility checks pass; actual screenshot/device gaps are explicitly recorded.
- No extra branding dependency, website reimplementation, policy alteration or API behavior change.

## F108 acceptance criteria

- Validate final launcher/adaptive/monochrome/splash on installed release builds across multiple densities, circular/squircle/themed launchers and supported Android versions.
- Capture release-build Home, authentication, Profile/About, gallery and legal surfaces with correct variants/proportions; no old artwork.
- Validate final app display name, Play icon, feature graphic and store screenshots against approved symbol/wordmark sources.
- Check splash crop/centering/system transition, adaptive safe zones and icon quality on actual devices; emulator/web screenshots are not physical-device proof.
- Inspect release bundle/resources/merged manifest for obsolete references; verify no wordmark in icon foregrounds.
- Preserve authentication, Terms acceptance, Privacy acknowledgment, dealer-scoped consent/withdrawal, enquiries, saves, support, role authorization and website SEO canonical behavior.
- Provide exact build/device/OS/version evidence and disclose any unresolved failure; no GO verdict while critical branding/native/security gates remain blocked.

## Compatibility evidence and limitations

The new foundation delta from 22c9841 contains branding/UI/metadata/image references and the notification email-header artwork. Core legal/consent/identity/enquiry/saved/support code, policy content, shared contracts and migrations are unchanged. Footer legal links remain. No legal conflict markers were found in the 34 inspected files; changed-file overlap with existing F099 is empty. This does not prove a future merge or all runtime regressions pass.

Observed new-foundation GitHub checks are successful. Existing post-#311 web validation/captures were reviewed; no application test suite, production mutation, native resource generation, native screenshot or device test was performed in this documentation-only amendment. Existing branches/commits/protected refs were not restacked or rewritten.

## Approved restack — performed

Fresh START authorized the stated normal merge into the existing child. Merge fb02d063 retained bcb1bee7 and the protected parent, with no conflicts. The ten immediate-parent bases are unchanged. No rebase/force-push, protected-branch edit, main-based branch, GitHub PR merge, production deployment or store upload occurred.

## F099 resource evidence

[Asset proof](../screens/mobile/f099/asset-review.png) shows light/dark masters, generated launcher, transparent adaptive foreground and a circular mask preview. It is a raster proof, not an Android screenshot. Component fixtures mock the native SVG host; exact vector bytes and raster geometry are independently checked by the asset verifier. Android prebuild was generated outside the repository and includes foreground/background/monochrome resources, contain splash mode, the light theme and permission-removal directives. Actual device/system rendering is not yet verified. See the F099 validation report for broader checks and limitations.

## F108 store-artwork checkpoint

The unchanged approved masters now also generate `apps/mobile/src/assets/brand/play-store-icon.png` (512 × 512 symbol only) and `play-feature-graphic.png` (1024 × 500 opaque RGB with separate symbol and wordmark). Their deterministic hashes join existing provenance; no runtime branding dependency is added. The feature graphic was visually inspected from its actual PNG: correct black geometry, uncropped proportions and white background. This is artwork review, not an installed Android screenshot. All densities/system masks/splash transitions, actual Home/auth/Profile/About/legal screens and final Play display name still require release-build visual evidence. Neither old favicon frames nor recreated lettering were used.
