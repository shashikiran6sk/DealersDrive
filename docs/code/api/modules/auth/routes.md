# api / modules/auth/routes

Parent: [api](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/auth/routes/by-user.ts`

### `export function byUser(req: Request): string`

Counted per person, not per address: a dealership is often one office NAT.

## `apps/api/src/modules/auth/routes/get-google-callback.ts`

### `let signInPath = '/dealer/login'`

Resolved before the try, because a failure has to know which sign-in

### `let signInPath = '/dealer/login'`

screen to send the browser back to — and the audience is in the cookie,

### `let signInPath = '/dealer/login'`

not in anything the callback carries.

### `clearOAuthCookie(res)`

Single-use, whatever happens next: the state and verifier inside are

### `clearOAuthCookie(res)`

spent the moment Google sends the browser back.

### `if (typeof req.query.error === 'string')`

Google's own refusal — a closed account chooser, a denied consent.

### `const code = errorCode(error)`

A failed sign-in is a screen, not a JSON body — but a bug is still a

### `const code = errorCode(error)`

bug, so anything unexpected goes to the error handler.

### `if (code === 'ADMIN_NOT_ALLOWLISTED' || code === 'ADMIN_ACCESS_REVOKED')`

Both refusals of an operations seat land on the same screen: one is

### `if (code === 'ADMIN_NOT_ALLOWLISTED' || code === 'ADMIN_ACCESS_REVOKED')`

"you were never on the list", the other "your seat was closed"

### `if (code === 'ADMIN_NOT_ALLOWLISTED' || code === 'ADMIN_ACCESS_REVOKED')`

(**R41**), and neither is worth telling an unauthenticated caller

### `if (code === 'ADMIN_NOT_ALLOWLISTED' || code === 'ADMIN_ACCESS_REVOKED')`

apart from the other.

## `apps/api/src/modules/auth/routes/get-phone-widget.ts`

### `export const getPhoneWidget: SessionAuthRoute = (router, { phone, rateLimit }) =>`

B8a — the widget configuration.

Rate-limited even though it is a read. Each call is a licence to send SMS
from a browser, so the limit is on _starting_ verifications rather than on
reading a config: thirty an hour is far more than a person signing up
needs and far less than a script would want.

## `apps/api/src/modules/auth/routes/phone-otp-limit.ts`

### `export function phoneOtpLimit(limit: number, windowSeconds: number)`

The shared shape of the three phone limits; only the window and cap differ.

## `apps/api/src/modules/auth/routes/post-admin-logout.ts`

### `export const postAdminLogout: PublicAuthRoute = (router, { service }) =>`

Revokes whatever session the caller presents and clears the cookie. No
guard: signing out must work even when the session is already dead, and it
can only ever revoke the token in the caller's own cookie.

## `apps/api/src/modules/auth/routes/post-phone-availability.ts`

### `export const postPhoneAvailability: SessionAuthRoute = (router, { phone, rateLimit }) =>`

B8b — may this account claim this number?

The first of the two calls step 1 makes, and the cheap one. It is asked
before the browser sends anything, because the send is the browser's and
the API cannot refuse one that is already on its way — so a number
somebody else holds has to be caught here or not at all, and "not at all"
means paying for a message to tell a dealer they cannot have their own
number.

**Rate-limited because it is a lookup about other people's numbers.** A
yes/no about whether the platform knows a number is a yes/no somebody
could walk a list through, so it is behind the session like everything
else here and capped at the same order as the widget itself. It never says
who holds one.

## `apps/api/src/modules/auth/routes/post-phone-verify.ts`

### `export const postPhoneVerify: SessionAuthRoute = (router, { phone, rateLimit }) =>`

B8c — the widget's access token, checked with MSG91 and recorded.

The tighter of the two limits, because this is the one that writes. Ten
presentations in ten minutes covers a dealer who mistypes a code twice and
asks for a fresh one; it does not cover walking a stolen token through a
list of numbers.

## `apps/api/src/modules/auth/routes/start-google.ts`

### `export function startGoogle(service: AuthService, audience: OAuthAudience)`

`/google/start` and `/admin/google/start` are the same handler with one value
changed, and that value is the only difference between the two consoles'
sign-ins: it is sealed into the transaction cookie and decides the scope of the
session the callback issues.
