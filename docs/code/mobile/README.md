# Mobile foundation internals

## Native boundaries

The Expo app depends on platform-neutral contracts through explicit common/public exports. It never imports the package-wide barrel, Next.js, Prisma, Node services or browser account helpers. ESLint and the boundary scanner reject those paths. Server policies/consent are integrated through customer REST routes in later milestones, preserving PR #279's gates and evidence.

## Public environment

Only the three declared public configuration values are read. Validation refuses credentials, endpoint paths, query strings and fragments in origins, and requires HTTPS outside development. Expo compiles public configuration; it is not a server secrets channel. Local emulator defaults support development without modifying web configuration.

## API client

The foundation client is public GET only. It checks service/path boundaries, omits cookies, validates success payloads, maps RFC problem details, redacts server diagnostic messages from displayed 5xx errors, and preserves safe correlation/rate-limit information. One controller bounds transport/body work and links external cancellation. It performs no automatic retry. Query-level retries are separately bounded; mutations default to no retry.

## Navigation and native components

Customer tabs use Expo Router with native safe-area handling. The route shells are intentionally limited to this PR; they do not fabricate inventory, authentication or saved data. Existing neutral tokens and Manrope establish the baseline. Approved PR #311 path geometry supplies independent native symbol/wordmark components; lettering is never reconstructed with a font. The phone header uses the compact symbol. Raster generation is build-only and uses the existing Sharp dependency, not the web favicon. Transparent adaptive artwork is 600 pixels wide in a 1080 canvas, inside the central 660 safe zone and a 720 circular mask. Splash is transparent symbol-only artwork. Provenance fixes master hashes and renderer; the check regenerates expected resources in memory and compares their pixels/bytes. UI text is centralized; each reusable component has its own folder. Native fixtures validate accessibility and pending actions without modifying the DOM sandbox.

## Bundle and release distinction

The build task exports Android JavaScript/assets so ordinary monorepo checks need no signing service. Native project generation/build/device validation and production AAB/signing remain separate. No EAS account/project or production configuration is created by the foundation. Package-task environment inputs prevent cross-environment cache reuse.

## React typing across workspaces

Native and web retain their compatible runtime/type versions. Next JSX remains preserved for its compiler; explicit jsxImportSource binds JSX typing to React resolved from the consuming web workspace. Without it, introducing native React types causes the global React.JSX namespace from a hoisted Next declaration to disagree with web HTML props. Full web typecheck/build verifies this configuration change without changing web components or weakening type checks.

## Saved cars and account agreements

See [saved/account](saved-account.md) for full hydration, confirmed mutations, interruption handling and authoritative policy history.

## Enquiries and dealership sharing

See [enquiries](enquiries.md) for authoritative receiver checks, separate explicit consent, uncertain submission handling, history and withdrawal.

## Customer support

See [support](support.md) for private conversations, quota/reopen, native UUID retries and the optional compatible create migration.
