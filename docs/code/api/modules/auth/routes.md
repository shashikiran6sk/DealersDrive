# api / modules/auth/routes

Parent: [api](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/auth/routes/by-user.ts`

### `export function byUser(req: Request): string`

Counted per person, not per address: a dealership is often one office NAT.

## `apps/api/src/modules/auth/routes/get-customer-me.ts`

### `export const getCustomerMe: CustomerAuthRoute = (router, { customers }) =>`

**R62** — the name and the proved number an enquiry will carry, derived from
the session and never typed. Mounted at `/v1/auth/customer` **before** the
dealer's signed-in router, because that router's guard runs for every path
under `/v1/auth` and would answer a customer with a 401.

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

## `apps/api/src/modules/auth/routes/get-google-link-start.ts`

### `export const getGoogleLinkStart: SessionAuthRoute = (router, { service }) =>`

**R61** — starts the same Google round trip as sign-in, behind the session,
sealing the signed-in user's id into the transaction so the callback can link
the Google account to that user and nobody else.

## `apps/api/src/modules/auth/routes/get-phone-widget.ts`

### `export const getPhoneWidget: SessionAuthRoute = (router, { phone, rateLimit }) =>`

B8a — the widget configuration.

Rate-limited even though it is a read. Each call is a licence to send SMS
from a browser, so the limit is on _starting_ verifications rather than on
reading a config: thirty an hour is far more than a person signing up
needs and far less than a script would want.

## `apps/api/src/modules/auth/routes/get-sign-in-phone-widget.ts`

### `export const getSignInPhoneWidget: PublicAuthRoute = (router, { phoneSignIn, rateLimit }) =>`

**R60** — the widget configuration for somebody not signed in yet.

The same payload `GET /v1/auth/phone/widget` serves behind a session, and the
reason it now exists without one is unavoidable: a phone sign-in has no
session before it starts. It means the session is no longer the gate on MSG91
spend that R39 made it. What is left is the per-address limit here, MSG91's
per-number limits and widget captcha (configured on the MSG91 dashboard), and
the limits on the sign-in that spends the token. The session route is left
exactly as it was, so onboarding and its tests do not change.

## `apps/api/src/modules/auth/routes/phone-otp-limit.ts`

### `export function phoneOtpLimit(limit: number, windowSeconds: number)`

The shared shape of the three phone limits; only the window and cap differ.

## `apps/api/src/modules/auth/routes/phone-sign-in-limit.ts`

### `export function byClaimedPhone(req: Request): string`

Counts the number a sign-in claims, normalised, so `98400 12345` and
`098400 12345` share one bucket. It runs before validation, so it must answer
for any body at all and never throw — a throw inside the limiter would be an
unhandled rejection and a request that never answers. Anything that is not a
number shares one bucket, which validation then refuses.

### `export function byIp(req: Request): string`

There is no session to count by before a sign-in. Address and number are the
two things a caller cannot avoid presenting, and both are counted: by address
alone a botnet can try one number, by number alone one address can walk a
list.

## `apps/api/src/modules/auth/routes/post-admin-logout.ts`

### `export const postAdminLogout: PublicAuthRoute = (router, { service }) =>`

Revokes whatever session the caller presents and clears the cookie. No
guard: signing out must work even when the session is already dead, and it
can only ever revoke the token in the caller's own cookie.

## `apps/api/src/modules/auth/routes/post-customer-logout.ts`

### `export const postCustomerLogout: PublicAuthRoute = (router, { customers }) =>`

**R62** — unguarded, like the admin sign-out: it must work on an expired
session, and it can only ever revoke the token in the caller's own cookie.

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

## `apps/api/src/modules/auth/routes/post-sign-in-phone-dealer.ts`

### `export const postSignInPhoneDealer: PublicAuthRoute = (router, { phoneSignIn, rateLimit }) =>`

**R60** — sets `dd_session` exactly as the Google callback does, and answers
`{ next, returnTo }` rather than redirecting, because the caller is a form on
the page, not a browser navigation. The token is only ever in the cookie.

## `apps/api/src/modules/auth/routes/post-sign-in-phone-customer.ts`

### `export const postSignInPhoneCustomer: PublicAuthRoute = (router, { customers, rateLimit }) =>`

**R62** — the same two limits as the dealer's phone sign-in, by address and by
number, under their own names so one door's traffic does not spend the
other's allowance.

## `apps/api/src/modules/auth/routes/post-sign-up-customer.ts`

### `export const postSignUpCustomer: PublicAuthRoute = (router, { customers, rateLimit }) =>`

**R62** — ten an hour per address. Each call needs a ticket that only a proved
code produces, so this limit is on account creation rather than on sends.

## `apps/api/src/modules/auth/routes/start-google.ts`

### `export function startGoogle(service: AuthService, audience: OAuthAudience)`

`/google/start` and `/admin/google/start` are the same handler with one value
changed, and that value is the only difference between the two consoles'
sign-ins: it is sealed into the transaction cookie and decides the scope of the
session the callback issues.
