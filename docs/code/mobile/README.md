# Mobile foundation internals

## Native boundaries

The Expo app depends on platform-neutral contracts through explicit common/public exports. It never imports the package-wide barrel, Next.js, Prisma, Node services or browser account helpers. ESLint and the boundary scanner reject those paths. Server policies/consent are integrated through customer REST routes in later milestones, preserving PR #279's gates and evidence.

## Public environment

Only the three declared public configuration values are read. Validation refuses credentials, endpoint paths, query strings and fragments in origins, and requires HTTPS outside development. Expo compiles public configuration; it is not a server secrets channel. Local emulator defaults support development without modifying web configuration.

## API client

The foundation client is public GET only. It checks service/path boundaries, omits cookies, validates success payloads, maps RFC problem details, redacts server diagnostic messages from displayed 5xx errors, and preserves safe correlation/rate-limit information. One controller bounds transport/body work and links external cancellation. It performs no automatic retry. Query-level retries are separately bounded; mutations default to no retry.

## Navigation and native components

Customer tabs use Expo Router with native safe-area handling. The route shells are intentionally limited to this PR; they do not fabricate inventory, authentication or saved data. Existing visual tokens, logo and Manrope establish the baseline. UI text is centralized; each reusable component has its own folder. Native fixtures validate accessibility and pending actions without modifying the DOM sandbox.

## Bundle and release distinction

The build task exports Android JavaScript/assets so ordinary monorepo checks need no signing service. Native project generation/build/device validation and production AAB/signing remain separate. No EAS account/project or production configuration is created by the foundation. Package-task environment inputs prevent cross-environment cache reuse.
