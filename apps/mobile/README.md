# Dealers-Drive Android customer app

Mobile PR 1 introduces the Expo SDK 57 customer navigation shell, native theme/branding, environment validation, public REST client and native tests. Inventory, authentication and private account screens arrive in the subsequent approved stack. This development foundation is not a release candidate.

## Workspace commands

From the repository root, install with `pnpm install --frozen-lockfile`, then build contracts with `pnpm --filter @dealers-drive/contracts build`.

- `pnpm dev:mobile` starts Metro for a development build.
- `pnpm --filter @dealers-drive/mobile android` generates/runs the local Android development project when Android Studio, the SDK and a compatible JDK are installed.
- `pnpm --filter @dealers-drive/mobile typecheck`
- `pnpm --filter @dealers-drive/mobile lint`
- `pnpm --filter @dealers-drive/mobile test`
- `pnpm --filter @dealers-drive/mobile build` exports Android JavaScript/assets; it does not create or submit an APK/AAB.
- `pnpm --filter @dealers-drive/mobile check:expo` validates SDK package versions.

The regular repository dev command is unchanged; it does not start a new mobile dev task implicitly. Node 24 and pnpm 9.15.9 remain the repository tools. Mobile resolves its SDK-supported React independently of web.

## Environment and security

Copy the adjacent `.env.example` to `.env` inside this app. Only EXPO_PUBLIC_APP_ENV, EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_WEB_BASE_URL are accepted. Those values are public configuration. Never copy the root server environment, MSG91 key, database connection, cloud credentials or session secret into this app.

Android emulators reach local services through 10.0.2.2. Physical devices require a reachable development origin. Preview/production origins require HTTPS; credentials, query strings, fragments and non-root paths are refused. The existing public API production origin is api.dealers-drive.com; the web host is a separate service.

The initial API client performs public GET requests only, omits cookies and contains no native session implementation. It validates shared contracts, bounds timeouts, supports cancellation, maps problem details and makes no automatic mutation retry. Private bearer transport belongs to Mobile PR 2 and must remain restricted to customer APIs.

No policy drafts are rendered or acceptance collected by this foundation. Existing PR #279 publication/enforcement remains untouched. The mobile package ID has a development suffix; final production identity/signing requires owner approval.

## Branding and verification

Logo/icon assets are copies of the existing web brand assets. Manrope is bundled from the official Google Fonts repository under the accompanying SIL OFL. Tokens follow web globals.css. Native component fixtures run in RN Testing Library because the existing web sandbox renders DOM primitives; its components were searched and remain unchanged. Page and ActionButton fixtures cover headings, text and pending/disabled controls.

This environment currently has no Android SDK/emulator or attached physical device. Android bundle validation is separate from native compilation and screenshots; those results must be recorded when available. Do not report web or test-renderer output as physical Android evidence.

See [the approved stack plan](../../docs/mobile/README.md) and [the stack manifest](../../docs/mobile/stack-manifest.json). No merge, deployment, legal activation or Play submission is authorized.
