# web / app/(auth)/admin/login

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(auth)/admin/login/page.tsx`

### `export const dynamic = 'force-dynamic'`

The admin console's only door.

There is no sign-up link because there is no admin sign-up, and there is no
password field because there is no admin password: the console is entered by
signing in with Google as an address the deployment has allow-listed. A form
here would be a second way in, and the second way in is always the one that
gets attacked.

The button is the _same_ button the dealer screen shows, pointed at a
different start URL. What differs is what the API does with the address that
comes back — everybody may click it; almost nobody is let through.

### `const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false }`

── Reconstruction slice ────────────────────────────────────────────────────
The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
here. That file is the whole indexing policy in one function and belongs to
**F095**, which brings it and its tests; what it resolves to for a `private`
route is the literal below, and a sign-in screen must be `noindex` from the
day it exists rather than from the day the SEO feature lands.

### `const ERRORS: Record<string, string> =`

Every code the API's callback can send back here.

`not_authorised` is the new one and the one that matters: the sign-in
_worked_ — Google confirmed the account — and the console still refused it.
Saying so plainly is better than a vague failure, because the person reading
it is usually staff who need to be told to ask for access rather than to try
again.

### `if (await currentAdmin()) redirect('/admin')`

Verified with the API, not read from the cookie jar — see the dealer

### `if (await currentAdmin()) redirect('/admin')`

sign-in screen for why that distinction is load-bearing.
