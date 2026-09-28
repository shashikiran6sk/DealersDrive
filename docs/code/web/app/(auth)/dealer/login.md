# web / app/(auth)/dealer/login

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(auth)/dealer/login/page.tsx`

### `export default async function DealerLoginPage({`

**R63** — the dealer sign-in screen moved into the unified `/login`, as its
Dealer tab. This route stays, as a redirect, because three things still send
people here: the API's Google callback (every refusal arrives as
`/dealer/login?error=…`), the console's own session-expired bounce, and the
sign-out action. Rewriting all three would spread one decision across three
files; a redirect keeps it here.

### `const CARRIED = ['error', 'returnTo'] as const`

Only the two parameters the old screen understood are carried across. Anything
else in the query string is dropped rather than forwarded, so this cannot be
used to smuggle arbitrary parameters onto the login page.
