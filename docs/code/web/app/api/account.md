# web / app/api/account

Parent: [web/app/api](README.md)

## `apps/web/src/app/api/account/route.ts`

### `export async function GET(): Promise<NextResponse>`

The header's one question — who, if anyone, is signed in (**R103**). It replaces
a Server Action the header used to call from an effect after hydration.

Why a `GET` route rather than the action:

- **Actions are queued.** The App Router runs Server Actions one at a time; the
  header's and the saved-cars' lookups ran back to back (≈180ms + ≈170ms locally,
  a Vercel round trip each in production).
- **Actions are POSTs** to the page's own URL, carrying the router state; this is
  a small JSON `GET` the browser can cancel with an `AbortSignal`.
- **`private, no-store`.** The answer is one person's; nothing may cache it.

It answers `{ status: 'signed-in', account }`, `{ status: 'signed-out' }`, or a
`503` when the API cannot be reached. Each definite answer rewrites the readable
`dd_auth` hint ([lib](../../lib.md#appswebsrclibauth-hintts)) the next page paints
from; a `503` leaves the hint alone, because an outage is not a sign-out.
