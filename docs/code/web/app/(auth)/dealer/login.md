# web / app/(auth)/dealer/login

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(auth)/dealer/login/page.tsx`

### `export const dynamic = 'force-dynamic'`

DESIGN-SPEC §3.9 — dealer sign-in.

One control. There is no password field and no OTP box, because there is no
dealer password and no dealer OTP: Google verifies the identity and the API
verifies Google. A form here would be a second way in, and the second way in
is always the one that gets attacked.

The failure states are query parameters rather than component state — every
one of them arrives as a redirect from the API's OAuth callback, so there is
no client-side error to hold.

### `const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false }`

── Reconstruction slice ────────────────────────────────────────────────────
The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
here. That file is the whole indexing policy in one function and belongs to
**F095**, which brings it and its tests; what it resolves to for a `private`
route is the literal below, and a sign-in screen must be `noindex` from the
day it exists rather than from the day the SEO feature lands.

### `const session = await currentSession()`

Already signed in? The console is the destination, not this screen. The

### `const session = await currentSession()`

question goes to the API rather than to the cookie jar: a cookie that

### `const session = await currentSession()`

exists but no longer works must land here, on a form, and not bounce

### `const session = await currentSession()`

between this screen and a console that will refuse it.
