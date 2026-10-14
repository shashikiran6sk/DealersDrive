# F099 mobile foundation validation

This is an unmerged foundation milestone, not a customer app release or production acceptance verdict. Inventory, native authentication, saves, enquiries, support and deletion belong to the subsequent approved stack.

## Baseline and scope

- PR #279 remains open/draft at 6180a4b52522493b884550448d0a84e7d95432df; base main a969dc2c5223ddb04c23d720ded6a4daccfe33ab.
- PR #311 merged at a969dc2; its four independent SVG masters are reused byte-for-byte.
- Original F099 bcb1bee7 is preserved. Approved parent-into-child merge fb02d063fa2d50c0d99505d7adfe15e456f9f826 made the new foundation an ancestor, with no conflicts or shared-history rewrite.
- No backend routes, database schema/migrations, legal document/publication/enforcement, website UI or identity behavior changed in F099. Platform-neutral common/public contract exports are added.
- Node 24.18.0, pnpm 9.15.9, Expo 57.0.28, React Native 0.86.3, native React 19.2.3 and TypeScript 6.0.3. Web React 19.3.0 and API/web TypeScript 5.9.3 remain unchanged. SDK compatibility is checked, not inferred from version numbers.

## Executed checks

| Check                                | Result              | Evidence/qualification                                                                                                                                                      |
| ------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locked installation                  | PASS                | pnpm install --frozen-lockfile, all seven workspaces                                                                                                                        |
| SDK package compatibility            | PASS                | expo install --check online after system UI addition; dependencies up to date                                                                                               |
| Root formatting/lint/docs references | PASS                | pnpm lint; seven tasks pass, boundary scanner passes                                                                                                                        |
| Full workspace typecheck             | PASS                | pnpm typecheck; all seven tasks, including web/API/sandbox/mobile                                                                                                           |
| Full workspace build                 | PASS                | pnpm build; contracts, API, web and Android export                                                                                                                          |
| Mobile tests                         | PASS                | Four Jest suites, 26 tests; environment, transport/timeouts/cancellation/errors, components and branding                                                                    |
| Contracts tests/coverage             | PASS                | 25 files, 578 tests; statements 98.39%, branches 92.11%, functions 96.26%, lines 98.77%                                                                                     |
| Web tests                            | PASS                | 144 files, 1,727 tests in root suite; current branding, customer/legal/privileged regressions included                                                                      |
| API tests/coverage                   | PASS under UTC      | 175 files, 3,465 tests; statements 95.68%, branches 90.16%, functions 97.97%, lines 96.93%                                                                                  |
| Existing web brand verifier          | PASS                | Source geometry, independent wordmark, alpha, PNG/ICO decoding/active references                                                                                            |
| Native brand verifier                | PASS                | Approved hashes, exact vector/raster generation, transparency, source ratios, centering, 66dp safe zone, 72dp circle containment/configuration                              |
| Temporary Android project generation | PASS                | Expo prebuild Android --no-install outside repository; no tracked native project or cloud resource                                                                          |
| Generated Android resources/config   | PASS for inspection | Foreground/background/monochrome XML and density resources, symbol-only contain splash, light theme, development package, Internet plus removal directives, backup disabled |
| APK/AAB compilation                  | BLOCKED             | No JDK/Android SDK available; JavaScript export is not native compilation                                                                                                   |
| Emulator/physical device/screenshots | BLOCKED             | No emulator/adb/device available; no native screenshot fabricated                                                                                                           |
| Dependency audit                     | FINDINGS            | Zero critical, seven high and nine moderate advisories; not a clean security/launch result                                                                                  |
| GitHub CI/security                   | PENDING PR          | Refresh from GitHub for the exact PR head; local checks are not remote CI                                                                                                   |

The Android Hermes export contains 1,518 modules and a 3.7MB bundle (entry-1243b375a57be9959cec22929f4deadc.hbc). These are artifact sizes, not startup, memory or scrolling measurements.

The first root test run failed one existing R92 migration timestamp fixture under the host Asia/Kolkata timezone (expected 10:00Z, received 04:30Z). The entire API suite subsequently passed with TZ=UTC, matching CI; production migration/application code was not changed. The root command itself initially failed; the table records the successful package rerun rather than claiming that original command passed.

Introducing native React types exposed Next's ambient React.JSX selection: global declarations resolved the native type version while web props used its own version. Adding explicit jsxImportSource=react to the shared Next configuration preserves JSX output, uses each web consumer's resolved React typing, and passes full web/sandbox types and the Next build. No runtime upgrade, React type override, cast, skip-check or UI rewrite was used. Lockfile peer snapshots adjusted by pnpm do not upgrade web/API runtime versions.

## Branding evidence

[Asset proof](../screens/mobile/f099/asset-review.png) shows the approved black/white masters, generated launcher, transparent adaptive foreground and circular mask preview. It is not a native screenshot. Native SVG host rendering is mocked in component tests; exact XML/proportions and raster geometry are independently verified. Installed native/system rendering remains required in F108.

Adaptive foreground and monochrome are 1080×1080 with 600px-wide, uniformly scaled symbol. All nontransparent pixels fit the central 660×660 region and a centered 720px diameter mask. Background is a separate flat white layer. Launcher is 1024×1024; splash is a transparent 651×424 symbol with a 96dp configured width. No wordmark, pre-baked rounded mask or obsolete tile appears in these resources. See [provenance](../../apps/mobile/src/assets/brand/provenance.json) and [inventory](branding-assets.md).

## Dependency findings and release holds

The registry audit found high advisories for PostCSS (two), DeepmergeTS, MySQL2, node-forge, braces and source-map-js. node-forge is newly reached through Expo's Node CLI/certificate tooling; braces is reached through existing lint/glob tools and native tooling. No patched version is reported for node-forge or braces in this audit. These Node-only tool dependencies are not imported by customer app source; that observation alone is not a completed reachability assessment. Do not silently waive advisories or weaken the existing CI gate.

Relevant upstream advisory references: [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Review compatible fixes/upstream SDK patches and affected execution paths before F108 can pass. The root audit remains critical-blocking/high-reporting as on the foundation. Local API/web dependency advisories are recorded, not fixed with unrelated upgrades in this foundation.

Legal drafts/production enforcement remain unapproved. Native OTP/provider, authentication, Play account/package/signing, real-device release validation and deletion retention/fulfillment approval remain later launch gates. Nothing here authorizes merging, deploying, legal publication, production migrations or Play submission.

## Rollback and review

F099 is bounded against the immediate legal branch; its incremental diff excludes PR #279/#311 parent changes. Reject/close the unmerged child to leave production unchanged, or revert specific child commits through normal history. Do not delete unmerged branches, rewrite bcb1bee7, force-push or edit the protected foundation. Record exact head/base/checks in the stack manifest and PR summary. F100 must start from F099's verified remote head and target its branch.
