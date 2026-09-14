# api / modules/auth

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/auth/admin-allowlist.ts`

### `export function isAllowlistedAdmin(email: string | null | undefined): boolean`

Who is allowed to hold an admin session.

One function, consulted in two places that must never disagree: when a
session is _issued_ (the Google callback) and every time one is _resolved_
(`resolveAdmin`). Checking only at issue time would leave a console open for
up to twelve hours after an address was taken off the list, which is exactly
the window that matters when somebody leaves.

The comparison is case-insensitive and trimmed on both sides, because the
value on the left came out of a `.env` file typed by a human and the value on
the right came out of a Google identity token. Neither is canonical.

Everything else about the address is Google's problem: this function is asked
only about a `claims.email` that arrived inside a token Google signed, never
about a string a client sent.

## `apps/api/src/modules/auth/auth.docs.ts`

### `export const authDocs: ModuleDocs =`

PART B — authentication.

Three of these operations are browser redirects rather than API calls, and
are documented as such: a client library never calls `/google/start`, a
person's browser navigates to it. They are in the reference because leaving
the only routes that issue a session undocumented would be the worst possible
omission (§32).

There is no `POST /v1/auth/admin/login` here because there is no such route
any more: the admin console's session comes out of the same Google callback,
and the operation was removed in the PR that removed the endpoint. The
openapi test fails in both directions, which is what keeps that true.

### `example:`

The token is described rather than illustrated. A JWT-shaped literal
in source is a thing every secret scanner has to treat as a leak —
correctly, since none of them can tell a sample from a real one — and
an example that says what the value _is_ reads better in Swagger UI
than sixty characters of base64 that decode to nothing useful.

## `apps/api/src/modules/auth/auth.facade.ts`

### `export type`

`auth` as other modules see it (ARCHITECTURE §5.5 rule 3).

The principal types, because every scoped service takes one, and the
permission helpers. Note what is absent: no way to _construct_ a principal.
Identity is resolved by the session resolver at the edge and passed inward —
a service can read who is calling and can never decide it.

### `export`

Per-role seats (**R41**). Exported because the admin console closes a
dealership's members' dealer seats when it suspends them, and that write
belongs to auth rather than to moderation — `users.status`, sessions and
seats are one model, and it has one owner.

### `export { isAllowlistedAdmin } from './admin-allowlist.js'`

Who the deployment says may hold an admin seat (**R42**).

Exported because the settings screen has to _show_ the difference between an
allow-listed address and a granted one, and refuse to withdraw the first. The
list itself is still read only here, from `env` — this hands out the question,
never the answer's source.

### `export { assertPhoneVerified } from './verified-phone.js'`

The one rule every write that stores a dealer's number obeys (**R39**).

Exported because the profile edit is a _dealers_ write and the column it
would otherwise touch belongs to auth: `users.phone` holds a number somebody
proved, and `POST /v1/auth/phone/verify` is the only thing that may put one
there. This hands out the assertion, never the write.

## `apps/api/src/modules/auth/auth.routes.ts`

### `const PUBLIC_ROUTES: PublicAuthRoute[] = [`

PART B — the only routes that may be reached without a session.

Three of them are browser navigations rather than API calls:
`/google/start`, `/admin/google/start` and the one `/google/callback` they
both come back through. They answer with a 302 because they are steps in a
redirect flow the browser is driving; everything else here is ordinary JSON.

**One callback, two consoles.** Google requires every redirect URI to be
registered against the OAuth client, so a second callback path would be a
second thing to register and a second thing to get wrong in an environment.
Which console a round trip belongs to travels in the sealed `dd_oauth`
cookie instead — see `OAuthAudience`.

There is no `POST /admin/login` any more. Admin sign-in is this same Google
flow, and the address it produces is checked against `ADMIN_ALLOWLIST`; the
API holds no password to verify and no rate limiter guarding one.

The callback never renders an error itself. A failed sign-in sends the person
back to the sign-in screen with a code in the query string, so they see the
product's own error state rather than a JSON body in an address bar.

### `const SESSION_ROUTES: SessionAuthRoute[] = [`

B4–B8 — the routes behind `requireSignedIn`: a verified identity, with or
without a dealership.

The two phone routes are here rather than on the public router, and that is
a deliberate spend control (**R39**). MSG91's widget sends the SMS from the
browser, so whoever holds `widgetId` and `tokenAuth` can spend the account's
balance — which makes "who may read them" the only gate the API still owns.
Behind a session that gate is the set of people who have completed a Google
sign-in; on `GET /v1/config/public` it would have been the internet, and
that response is additionally `Cache-Control: public`.

## `apps/api/src/modules/auth/auth.service.ts`

### `export interface AuthDeps`

Sign-in, sign-up and sign-out — the whole of Part B.

Three claims this file has to keep true:

1.  **Identity is established here, never accepted.** No method takes an email
    as an argument and returns a session. `completeGoogle` takes an
    authorization code and a sealed transaction cookie, and the only email it
    will ever act on is the one Google put in a token it signed.
2.  **A dealership is created by onboarding, not by signing in.** A verified
    Google account with no `DealerMember` row is a `PendingPrincipal`: a real
    session that can reach exactly one endpoint.
3.  **Admins are a separate world.** Same provider now — an admin signs in
    with Google like everybody else — but a different session scope, a
    different lifetime, and no path between the two. What separates them is
    `ADMIN_ALLOWLIST`: a verified address that is not on it gets a dealer
    session and a closed door, never an admin one.

### `maps: MapsPort`

Where the new yard is, out of the link the dealer pastes on step 2.

### `audience: OAuthAudience`

Which console the session is for — it decides where a failure sends the browser.

### `async function identityFor(userId: string): Promise<AuthSession['identity']>`

The Google account on a session — for the onboarding screen, which shows
the verified address rather than asking for it again.

### `async function me(principal: DealerPrincipal | PendingPrincipal): Promise<AuthSession>`

B4. One shape for both states — with a dealership and without one — so a
client has one thing to read and one field to branch on.

### `startGoogle`

Step one: mint the transaction, hand back where to send the browser.

`state`, `nonce` and the PKCE verifier are generated here and sealed into
a cookie the caller sets. Nothing about this request influences them.

### `throw new ConfigurationError`

The one error in this module written for a developer rather than a

### `throw new ConfigurationError`

dealer: it names the variables and the redirect URI to register.

### `async completeGoogle(input:`

Step two: verify the round trip, find or create the person, issue a
session.

The state check comes first and compares what Google echoed back against
what this browser was given. A callback with no cookie, a stale cookie or
somebody else's state is refused before the code is worth anything.

### `if (transaction.audience === 'ADMIN')`

The audience came out of the sealed cookie this browser was given at

### `if (transaction.audience === 'ADMIN')`

`/start`, never off the callback URL — so a dealer sign-in cannot be

### `if (transaction.audience === 'ADMIN')`

turned into an admin one by editing a query parameter on the way back.

### `if (isSeatSuspended(existing.user.roles, 'DEALER'))`

The dealer seat (**R41**). Closed by a dealership suspension, and

### `if (isSeatSuspended(existing.user.roles, 'DEALER'))`

closed here rather than at the account, which is what leaves the same

### `if (isSeatSuspended(existing.user.roles, 'DEALER'))`

person's admin sign-in — a different start URL, a different scope and

### `if (isSeatSuspended(existing.user.roles, 'DEALER'))`

a different seat — working.

### `email: claims.email`

Refreshed, never looked up by: the account is the `sub`.

### `if (membership?.dealer.status === 'SUSPENDED')`

The seat check above handles suspensions performed by the current admin

### `if (membership?.dealer.status === 'SUSPENDED')`

workflow. This dealer-status guard also blocks legacy or manually

### `if (membership?.dealer.status === 'SUSPENDED')`

suspended rows whose member seat was never closed.

### `await ensureSeat(prisma, { userId, role: 'DEALER' })`

Everyone who signs in as a dealer holds a dealer seat. The upsert never

### `await ensureSeat(prisma, { userId, role: 'DEALER' })`

reopens a closed one — the refusal above has already left, so reaching

### `await ensureSeat(prisma, { userId, role: 'DEALER' })`

this line means the seat is open or has never existed.

### `async onboard(principal: PendingPrincipal, input: OnboardingInput): Promise<AuthSession>`

Onboarding — one transaction that turns a verified person into a tenant:
the user's own details, the dealership in DRAFT, the OWNER membership and
the three KYC rows the review screen expects.

Deliberately refused for anyone who already has a dealership. A second
call must not be able to create a second tenant under one session.

### `const city = normaliseLocality(input.city)`

Case and spacing settled once, on the way in. Everything downstream —

### `const city = normaliseLocality(input.city)`

the uniqueness read below, the index behind it, the admin console's

### `const city = normaliseLocality(input.city)`

city filter — then compares the same string rather than five spellings

### `const city = normaliseLocality(input.city)`

of one town.

### `const nameOwner = await prisma.dealer.findFirst(`

One registered name per city.

The unique index on `(legalName, city)` is the real guarantee — this
read is what turns it into a message against the two fields the dealer
just typed, and it compares case-insensitively because "Sri Lakshmi
Motors" and "SRI LAKSHMI MOTORS" in one town are the same business
applying twice.

Scoped to the city rather than global, because the same name in
another town is a different family's business, not a collision.

### `const phone = toE164(input.phone)`

The number has to have been proved before it can be built into a
dealership (**R39**).

This used to be a uniqueness lookup: any number nobody else held was
accepted, and onboarding then wrote it onto the user row. Both halves
moved to `POST /v1/auth/phone/verify` — see `verified-phone.ts` for why
`users.phone` now has exactly one writer — and what is left here is the
assertion that the number on this request is the one the session
already proved.

The uniqueness refusal moved with it, which is also where it belongs:
the collision is now reported on the step that owns the field, at the
moment the claim is made, instead of two steps later when the dealer
has finished typing their address.

### `const place = await maps.placeFor(input.mapsUrl)`

The yard's pin and the place it names, out of the link the dealer just

### `const place = await maps.placeFor(input.mapsUrl)`

pasted. Best-effort and bounded, and read _before_ the transaction

### `const place = await maps.placeFor(input.mapsUrl)`

opens: an interactive transaction's budget is wall-clock, and a request

### `const place = await maps.placeFor(input.mapsUrl)`

to Google is not something to spend it on. See

### `const place = await maps.placeFor(input.mapsUrl)`

`platform/maps/maps-link.ts`.

### `await tx.user.update(`

`fullName` only. `users.phone` was written here and is not any more:
it already holds this number, because `assertPhoneVerified` above
refused the request otherwise, and a second writer is exactly what
`verified-phone.ts` exists to prevent.

### `slug: await uniqueSlug({ legalName: input.legalName, city, district, state })`

Name _and_ place. The slug is the portfolio's URL and the name of

### `slug: await uniqueSlug({ legalName: input.legalName, city, district, state })`

the dealership's folder in object storage, and both are read by

### `slug: await uniqueSlug({ legalName: input.legalName, city, district, state })`

people — see `dealerSlug` in the contracts package.

### `brandName: input.legalName`

One name, asked for once. `brandName` is the display mirror —

### `brandName: input.legalName`

written here, and only ever by the server (`UpdateDealerInput`

### `brandName: input.legalName`

does not carry it).

### `status: 'DRAFT'`

DRAFT, always. Becoming ACTIVE is the admin's decision, reached

### `status: 'DRAFT'`

through `POST /v1/dealer/submit` and the moderation queue — never

### `status: 'DRAFT'`

by a field on this request (CLAUDE.md rule 5).

### `mapsUrl: input.mapsUrl`

Stored exactly as pasted. The host was checked by the schema;

### `mapsUrl: input.mapsUrl`

what is inside the link is Google's business, and rewriting it

### `mapsUrl: input.mapsUrl`

would break the short links the Share sheet produces.

### `lat: place.coordinates?.lat ?? null`

Read out of that link, not geocoded from the address above. Null

### `lat: place.coordinates?.lat ?? null`

when it could not be read, which is a portfolio without a map

### `lat: place.coordinates?.lat ?? null`

rather than a portfolio with the wrong one.

### `tagline: input.tagline`

Both required by the schema (**R26**), so neither is ever ''

### `tagline: input.tagline`

and neither is ever absent. The columns stay nullable / empty-able

### `tagline: input.tagline`

for the rows that predate the question — `completeness` is what

### `tagline: input.tagline`

names those.

### `specialities: input.specialities`

Not de-duplicated on write. Repeats are merged on read (R18),

### `specialities: input.specialities`

which is the single place that rule lives.

### `await tx.dealerDocument.createMany(`

One statement, not three. Every statement inside an interactive

### `await tx.dealerDocument.createMany(`

transaction is a round-trip, and the transaction budget is wall-clock:

### `await tx.dealerDocument.createMany(`

three sequential creates spend three of them on rows that have no

### `await tx.dealerDocument.createMany(`

dependency on each other.

### `return me(`

The principal the _next_ request will resolve to, built here so the

### `return me(`

response body is the same shape `GET /v1/auth/me` would return — right

### `return me(`

down to the permissions the new OWNER seat carries.

### `async logout(token: string | undefined, userId?: string): Promise<void>`

`userId` is for the log line only — the token decides which row is
revoked, so a caller cannot sign anybody else out by naming them.

### `async function createIdentity(claims:`

A first sign-in.

The refusal in the middle is the account-linking policy, written out: an
email that already belongs to an account is _not_ enough to take it over.
Google verifying `owner@example.com` today says nothing about who held that
address when the dealership was created, and silently merging on a matching
string is how an expired domain becomes somebody else's inventory.

### `emailVerifiedAt: new Date()`

Google is the verifier. There is no separate email round trip, and

### `emailVerifiedAt: new Date()`

no OTP: the identity token _is_ the proof.

### `async function completeAdminGoogle`

B7 — the admin console's sign-in, which is now the same round trip as the
dealer's with one extra question asked of it.

The question is the whole authorization model: **is this verified address
on `ADMIN_ALLOWLIST`?** Note what it is asked about — `claims.email`, out of
a token Google signed seconds ago — and not about anything a client sent, a
column on a row, or the address a session once had. A refusal here is a
refusal to _issue_; `resolveAdmin` asks the same question again on every
subsequent request, so taking a name off the list closes a console that is
already open rather than waiting twelve hours for it to expire.

The account-linking rule that `createIdentity` enforces is deliberately
relaxed for exactly these addresses. There, an existing user row with no
linked identity is a refusal, because a matching email string is not proof
that the same person still holds it. Here the platform team wrote the
address into its own deployment configuration, which is a stronger claim
than the email match — and without the relaxation the seeded admin row and
the Google identity could never be joined at all.

### `const granted = await prisma.user.findFirst(`

The second way in (**R42**).

A grant is a `user_roles` row with `grantedBy` set, made by a SUPER_ADMIN
on the settings screen — usually for somebody who has never signed in, so
it is looked up by address here rather than by Google's subject. The
allow-list remains the first answer and is still checked on every request
afterwards.

### `if (identity && isSeatSuspended(identity.user.roles, 'ADMIN'))`

The operations seat, which a dealership suspension does not touch

### `if (identity && isSeatSuspended(identity.user.roles, 'ADMIN'))`

(**R41**). Nothing closes this one yet; the check is here so that when

### `if (identity && isSeatSuspended(identity.user.roles, 'ADMIN'))`

something does, it is refused at the door rather than one screen in.

### `const user =`

By `sub` first, by address second. The subject is what does not move

### `const user =`

when somebody renames their Google account; the address is only how a

### `const user =`

row seeded before this flow existed is found the first time.

### `adminRole: user.adminRole ?? 'SUPER_ADMIN'`

Only ever _granted_, never downgraded: an admin the platform team

### `adminRole: user.adminRole ?? 'SUPER_ADMIN'`

has narrowed to MODERATOR by hand must not be widened back to

### `adminRole: user.adminRole ?? 'SUPER_ADMIN'`

SUPER_ADMIN by the act of signing in.

### `async function uniqueSlug(parts:`

`Sri Lakshmi Motors` in Katpadi →
`sri-lakshmi-motors-katpadi-vellore-tamil-nadu`, `-2` if that is taken.

With the place in it a collision is rare — it now takes two dealerships of
the same registered name in the same town, which the `(legalName, city)`
unique index has already refused by the time this runs. The suffix stays
for the case that index cannot see: a dealership that was renamed, or one
whose town was corrected, leaving its old slug behind.

## `apps/api/src/modules/auth/cookie-session.adapter.ts`

### `export function createCookieSessionResolver`

The production session resolver: cookie → `sessions` row → principal.

Two properties are worth naming, because the rest of the security model rests
on them.

**The principal is rebuilt from the database on every request.** Nothing is
cached in the token. Suspending a dealership, changing a member's role or
revoking a session takes effect on the very next call, with no window in
which a stale claim is still honoured.

**The request is read for exactly one thing — the cookie.** There is no
header, body field or query parameter that can influence who the caller is,
which is the property that keeps tenant isolation intact no matter what a
route handler does afterwards.

### `if (isSeatSuspended(session.user.roles, 'DEALER')) return null`

The dealer seat, and only the dealer seat (**R41**). An admin session

### `if (isSeatSuspended(session.user.roles, 'DEALER')) return null`

held by the same person is resolved by `resolveAdmin` below, against its

### `if (isSeatSuspended(session.user.roles, 'DEALER')) return null`

own seat, and is unaffected by whatever happened to this one.

### `if (membership.dealer.status === 'SUSPENDED') return null`

Account status is the primary block, and this dealer-status check is the

### `if (membership.dealer.status === 'SUSPENDED') return null`

backstop if a legacy or manually changed row was suspended before its

### `if (membership.dealer.status === 'SUSPENDED') return null`

member account was updated.

### `async resolveAdmin(req): Promise<AdminPrincipal | null>`

A separate scope, not a separate check: an admin session is a different
row with `scope = 'ADMIN'`, so a dealer's cookie cannot reach an admin
route even if that same human is also a platform admin.

The ADMIN seat is asked about here and nowhere else, for the same reason
(**R41**): a dealership suspension closes a DEALER seat, and this line is
the one that has to keep reading ACTIVE afterwards for a person who holds
both.

The allow-list is asked again here, on every request, and not only when
the session was issued. That is what makes removing an address from
`ADMIN_ALLOWLIST` a revocation rather than a note for next time: a
console already open stops answering on the next click, twelve hours
before the session would have expired on its own.

### `if (!isAllowlistedAdmin(user.email) && !hasGrantedSeat(user.roles, 'ADMIN')) return null`

Two ways in, and no third (**R42**). The allow-list is the

### `if (!isAllowlistedAdmin(user.email) && !hasGrantedSeat(user.roles, 'ADMIN')) return null`

deployment's answer; a _granted_ seat is one a SUPER_ADMIN handed over

### `if (!isAllowlistedAdmin(user.email) && !hasGrantedSeat(user.roles, 'ADMIN')) return null`

on the settings screen, and `grantedBy` is what tells it from the seat

### `if (!isAllowlistedAdmin(user.email) && !hasGrantedSeat(user.roles, 'ADMIN')) return null`

every admin sign-in leaves behind. Reading mere existence as permission

### `if (!isAllowlistedAdmin(user.email) && !hasGrantedSeat(user.roles, 'ADMIN')) return null`

would make the allow-list vacuous — an address taken off it would keep

### `if (!isAllowlistedAdmin(user.email) && !hasGrantedSeat(user.roles, 'ADMIN')) return null`

working forever on the strength of its own last visit.

## `apps/api/src/modules/auth/dev-session.adapter.ts`

### `export function createDevSessionResolver(prisma: PrismaClient): SessionResolver`

The local development session (CLAUDE.md §5, §17).

The identity is _server-configured_ — `DEV_DEALER_SLUG` and the first entry
on `ADMIN_ALLOWLIST` — and re-read from the database on every request, so the
principal always carries a real dealer id, role and current status. That
last part matters: suspending the dealer from the admin console takes effect
on the very next request, exactly as a revoked session will.

Nothing about the request influences who you are. There is no header, cookie
or body field a client could set to become another dealer, which is the
property that keeps tenant isolation intact while sign-in is bypassed.

Swapping this for `CookieSessionResolver` is one line in `container.ts`.

### `roles: { none: { role: 'DEALER', status: 'SUSPENDED' } }`

The dealer seat, matching what the cookie resolver checks

### `roles: { none: { role: 'DEALER', status: 'SUSPENDED' } }`

(**R41**). A suspension closes this one and leaves an admin

### `roles: { none: { role: 'DEALER', status: 'SUSPENDED' } }`

seat the same person holds open — which `resolveAdmin` below

### `roles: { none: { role: 'DEALER', status: 'SUSPENDED' } }`

asks about separately.

### `resolveSignedIn: resolveDealer`

The configured dealer always exists, so there is no pending state to

### `resolveSignedIn: resolveDealer`

model here: `AUTH_MODE=dev` skips sign-up as well as sign-in.

### `const email = env.adminAllowlist[0]`

The same list production checks, read for its first entry rather than

### `const email = env.adminAllowlist[0]`

asked about an address. An empty allow-list has no admin to resolve —

### `const email = env.adminAllowlist[0]`

here as everywhere else, it closes the console rather than opening it.

## `apps/api/src/modules/auth/google.provider.ts`

### `const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'`

Google OAuth 2.0 / OpenID Connect — authorization code flow with PKCE.

The endpoints are pinned rather than discovered. Google's discovery document
has not moved in a decade, and a network round trip on every sign-in to be
told the same three URLs buys nothing but a new failure mode.

### `const LEEWAY_SECONDS = 60`

Clock skew allowed when checking `exp`.

### `url.searchParams.set('access_type', 'online')`

No refresh token is wanted: the application session is the thing that

### `url.searchParams.set('access_type', 'online')`

outlives the sign-in, and a stored Google refresh token would be a

### `url.searchParams.set('access_type', 'online')`

long-lived credential this product has no use for.

### `throw new UnauthorizedError('Google could not verify that sign-in. Please try again.'`

`error_description` is Google's, and safe to log — it describes the

### `throw new UnauthorizedError('Google could not verify that sign-in. Please try again.'`

request, not the code. The code itself is never logged anywhere.

### `function decodeIdToken(idToken: string): IdTokenClaims`

The ID token's payload, without signature verification — and that is correct
here, not a shortcut.

OpenID Connect Core §3.1.3.7 item 6: a token received directly from the token
endpoint over a TLS connection whose server certificate has been validated
may be trusted without checking its signature. This code holds exactly that
position — it POSTed to `oauth2.googleapis.com` itself, with a client secret,
over Node's TLS stack. The token never passed through a browser, so there is
no untrusted hop between Google and this function.

The claims are still checked below: issuer, audience, expiry and nonce.

### `if (claims.nonce !== expected.nonce)`

The nonce is what ties this identity token to _this_ browser's sign-in, and

### `if (claims.nonce !== expected.nonce)`

is the reason a replayed token from elsewhere cannot be used here.

### `function challengeFor(codeVerifier: string): string`

PKCE S256: `BASE64URL(SHA256(verifier))` (RFC 7636 §4.2).

## `apps/api/src/modules/auth/oauth-transaction.ts`

### `export const OAUTH_COOKIE = 'dd_oauth'`

The half of the OAuth round trip that has to survive a redirect to Google
and back, without the API keeping server state for every abandoned sign-in.

It is sealed into one short-lived HttpOnly cookie: the CSRF `state`, the OIDC
`nonce`, the PKCE verifier and where to land afterwards. HMAC-signed, so the
browser holding it cannot edit any of those; ten-minute lifetime, so a
captured cookie is worthless by the time anyone reads it.

Why a cookie and not a `oauth_states` table: the row would exist only between
two requests seconds apart, and would need its own expiry sweep. The cookie is
already scoped to exactly the browser that must present it.

### `export const OAUTH_TRANSACTION_TTL_SECONDS = 600`

Longer than any human takes at Google's account chooser, short enough to be useless later.

### `export type OAuthAudience = 'DEALER' | 'ADMIN'`

Which console this sign-in is for.

It is decided at `/start` and sealed, rather than being read off the callback
— because it selects the _scope of the session that gets issued_, and a value
the browser could change on the way back would be a way to ask for an admin
session from the dealer button. Google's redirect URI is registered once and
shared by both flows; this field is what tells them apart when it returns.

### `returnTo: string`

A _path_ on the web app, never an absolute URL — see `safeReturnTo`.

### `export const DEFAULT_RETURN_TO: Record<OAuthAudience, string> =`

Where each console lands when nothing else was asked for.

### `codeVerifier: randomBytes(32).toString('base64url')`

RFC 7636 §4.1 — 43-128 characters of unreserved ASCII. 32 random bytes

### `codeVerifier: randomBytes(32).toString('base64url')`

base64url-encoded lands at 43.

### `export function sealTransaction(transaction: OAuthTransaction): string`

`<base64url(json)>.<hmac>`

### `export function openTransaction(sealed: string | undefined): OAuthTransaction | null`

Null for anything tampered with, unreadable or expired. Never throws.

### `(audience !== 'DEALER' && audience !== 'ADMIN')`

Unrecognised is not "assume admin" and not "assume dealer": it is a

### `(audience !== 'DEALER' && audience !== 'ADMIN')`

cookie this build did not mint, and the callback has nothing to do with

### `(audience !== 'DEALER' && audience !== 'ADMIN')`

it. Refusing here costs a person one click on a sign-in page.

### `return { state, nonce, codeVerifier, returnTo, issuedAt, audience }`

Rebuilt from the checked fields rather than handed back whole: the six that

### `return { state, nonce, codeVerifier, returnTo, issuedAt, audience }`

were validated are the six the transaction is.

### `export function safeReturnTo(candidate: string | undefined, fallback = '/dealer'): string`

An open redirect is the classic way an OAuth callback leaks a session, so
`returnTo` is reduced to a same-site path or dropped entirely. `//evil.com`
is a protocol-relative URL, which is why the second character is checked too.

## `apps/api/src/modules/auth/oauth.port.ts`

### `export interface OAuthClaims`

The seam between "who is this person" and Google.

Everything above this interface deals in a verified subject, an email and a
flag saying Google checked it. Nothing above it knows about authorization
codes, PKCE verifiers, JWTs or `accounts.google.com` — which is what lets the
whole sign-in flow be tested without a network, by passing a fake in at the
container (ARCHITECTURE §5.1, §5.3).

### `export interface OAuthClaims`

What the provider asserts once the round trip has been verified.

### `subject: string`

The provider's stable identifier for the account — Google's `sub`.

### `emailVerified: boolean`

Google's `email_verified`. A false here is a refused sign-in, not a warning.

### `prompt?: 'select_account' | 'consent'`

Forces the account chooser rather than silently reusing one Google session.

### `readonly id: 'GOOGLE'`

Matches `OAuthIdentity.provider`.

### `isConfigured(): boolean`

Whether this deployment holds the credentials to perform a sign-in.

Asked rather than assumed so the sign-in screen can render an explanation
instead of a button that fails on click — and so the route never has to
know which environment variables a particular provider needs.

### `authorizationUrl(request: AuthorizationRequest): string`

Where to send the browser. Never called with anything a client supplied.

### `exchange(input: { code: string; codeVerifier: string; nonce: string }): Promise<OAuthClaims>`

Redeems the authorization code and returns the verified claims.

Throws rather than returning null: a failure here is either a
misconfiguration or an attack, never an ordinary outcome the caller should
branch on.

## `apps/api/src/modules/auth/phone.service.ts`

### `export interface PhoneServiceDeps`

B8 — proving the mobile number (**R39**).

── Where the work happens, and what that costs ─────────────────────────────
MSG91's OTP widget does the sending and the collecting **in the dealer's
browser**. The API never sees the six digits, never calls a send endpoint,
and therefore cannot rate-limit the sending. That is a real consequence of
the widget design and it is worth stating plainly rather than papering over:
the two controls this module _does_ hold are

1. **who gets the widget credentials at all** — `widget()` is behind
   `requireSignedIn`, so an SMS can only be provoked by somebody who has
   already completed a Google sign-in, not by the open internet; and
2. **how often a token may be presented** — the route is rate-limited per
   session, and a token that has been accepted once is never accepted
   again.

The provider's own per-identifier limits are the third, and they are the only
thing standing between a signed-in account and repeated sends. If that proves
too loose in practice the answer is an API-side send endpoint, which is a
different integration, not a tightening of this one.

── What a verification is, and is not ──────────────────────────────────────
It issues no session, grants no permission and unlocks no screen. Identity is
the Google account and was before the code was sent. What it buys is that the
number printed on a public portfolio rings the dealership that published it —
so the write it performs is a contact detail, not a credential.

### `const TOKEN_SPENT_WINDOW_SECONDS = 15 * 60`

How long an accepted token is remembered as spent.

Longer than any access token MSG91 issues, which is what makes the guard
total rather than probabilistic: a token that outlives its entry here would
be one that could be replayed. Fifteen minutes is comfortably past the
widget's own expiry and costs one short-lived counter row per verification.

### `widget(): PhoneOtpWidget`

What the browser needs to initialise the widget — and nothing else.

`MSG91_AUTH_KEY` is conspicuously absent. It is the credential that can
spend the account's balance and the reason `verify` below is a
server-to-server call; it must never appear in a response.

### `if (!widgetId || !tokenAuth)`

Unreachable as configured — `env.ts` refuses to boot on `msg91`
without both — and answered rather than thrown anyway. A sign-up
screen that renders an explanation is better than one that renders a
500, and this is the same shape `GET /v1/auth/providers` takes for a
deployment with no Google client.

### `async assertAvailable(userId: string, input: PhoneAvailabilityInput): Promise<void>`

B8b — is this number free for this account to claim?

Called before the widget sends anything, which is the only reason it
exists as its own endpoint: the send happens in the browser, so the API
cannot refuse one in flight. The alternative — letting the refusal arrive
with the verification — spends an SMS to tell a dealer their number
belongs to somebody else, and delivers it to a handset whose owner did
not ask for it.

The read is not the guarantee and is not pretending to be one. Two people
can pass this check for the same number at the same instant; the unique
index on `users.phone` decides, and `verify` below answers the loser with
the same refusal. This is the cheap, early copy of a question that is
asked again where it can actually be enforced.

Deliberately says nothing about who holds a taken number — see
`PhoneAvailabilityInput` for why that matters.

### `async verify`

Take the widget's access token to MSG91, and record what comes back.

Four things have to hold, in this order, and each of them refuses
differently:

1. MSG91 recognises the token — otherwise there is no verification.
2. The identifier it names is **the number this request claims**.
   Without this a dealer could verify a handset they hold and then
   register a number they do not.
3. The token has not been presented before.
4. The number is not already somebody else's.

### `const claimed = phone.replace(/\D/g, '')`

MSG91 states identifiers as digits with the country code and no `+`.

### `logger.info`

One message for both, deliberately. "That code was for a different
number" would confirm to whoever is holding a stolen token which
number it belongs to, and there is no legitimate flow in which the
page sends a token for a number the dealer did not just type.

### `const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } })`

The read is the message; the unique index on `users.phone` is the
guarantee. Two people verifying one number at the same instant race
past this check and the second one's write fails — which is the right
way round, because the index is the thing that cannot be wrong.

### `async function consumeToken(cache: CachePort, accessToken: string): Promise<void>`

One token, one verification.

Checked _after_ the provider has accepted the token rather than before, so a
vendor timeout does not burn the dealer's only attempt: a token that never
verified was never spent, and pressing the button again has to work.

A cache failure does not deny the request, for the same reason
`createRateLimiter` does not: this is a replay guard, not a spend control,
and turning a database blip into "nobody can finish signing up" converts a
degraded dependency into an outage. The token is hashed because it is a
bearer credential and cache keys are not a place to keep one.

## `apps/api/src/modules/auth/roles.ts`

### `type Db = PrismaClient | Prisma.TransactionClient`

Per-role seats — who may enter which console (**R41**).

`users.status` is the account: one switch for the whole person, every door.
This module is the per-seat layer beneath it, and the split exists because
one human can be two things. A dealership owner who also moderates the
platform holds a DEALER seat and an ADMIN seat; suspending their dealership
is a decision about a yard, and it must not take the operations console with
it.

**The rule, in one sentence:** a seat row refuses its role when it is
`SUSPENDED`, and an absent row says nothing. It can only close a door, never
open one — which is what makes this table safe to introduce beneath checks
that already exist (the dealership's own status, `isPlatformAdmin`, the admin
allow-list). Those still decide; this is a veto laid over them.

### `type Db = PrismaClient | Prisma.TransactionClient`

A `PrismaClient` or a transaction handle — every helper here takes either.

### `export interface RoleSeat`

The shape a seat is read in. Nothing here needs the whole row.

### `grantedBy?: string | null`

The admin who handed the seat over, where one did (**R42**).

Null for a seat the product created on its own — `ensureSeat` writes one on
every sign-in. That distinction is load-bearing for the admin console: see
`hasGrantedSeat` below.

### `export function isSeatSuspended(seats: readonly RoleSeat[], role: PlatformRole): boolean`

Is this seat closed?

Pure, and given the seats already loaded rather than a database handle: the
session resolver reads `user.roles` in the same query that reads the session,
so asking this question costs nothing per request.

### `export function seatSuspensionReason`

The reason a seat was closed, for the message the person is shown.

### `export function hasGrantedSeat(seats: readonly RoleSeat[], role: PlatformRole): boolean`

Is this seat one an admin **granted** (**R42**)?

Deliberately not "does an active seat exist". Every admin sign-in leaves an
ADMIN seat behind, so existence means only "has signed in once" — and reading
it as permission would make `ADMIN_ALLOWLIST` vacuous: an address taken off
the list would keep working forever on the strength of its own last visit.

`grantedBy` is set by exactly one thing, `grantSeat`, called by exactly one
caller: a SUPER_ADMIN on the settings screen. That is what makes it an
authorization fact rather than a footprint.

### `export async function ensureSeat`

Record that somebody holds a seat, without disturbing one they already have.

Called on every successful sign-in, which is what makes the table complete
for anyone the product has actually seen — and deliberately an _upsert with
an empty update_: a DEALER seat closed by a suspension must not be reopened
by the act of signing in, or the suspension would last exactly as long as it
took the dealer to press the button again.

### `export async function setSeatStatus`

Close or reopen a seat for several people at once — what a dealership
suspension does to its members.

The two writes are one logical operation and both are needed: `createMany`
covers a member who has never signed in and so has no row, `updateMany` the
ones who have. Ordering matters only in that the create must come first.

### `export async function grantSeat`

Hand a seat over deliberately (**R42**).

The difference from `ensureSeat` is `grantedBy`, and it is the whole
difference: this is an authorization fact — somebody decided — where the
other is a footprint. It also **reopens** a closed seat, because granting
access to somebody whose access was withdrawn is the same act as granting it
the first time, and a SUPER_ADMIN is doing both on purpose.

## `apps/api/src/modules/auth/session.cookie.ts`

### `export const SESSION_COOKIE = 'dd_session'`

The cookies, and only the cookies.

Separated from `session.service.ts` because that file is a _service_: it
takes a user id and returns a token, and can be tested without an HTTP
request in sight. Everything on this side of the line needs `req` or `res`,
which is exactly what belongs at the edge (ARCHITECTURE §5.4).

### `function cookieOf(req: Request, name: string): string | undefined`

`cookie-parser` populates `req.cookies`; this narrows it back to a string
without an assertion, because a repeated cookie header arrives as an array.

### `function baseAttributes(): CookieAttributes`

`SameSite=Lax`, not `Strict`, and that is required rather than lax thinking:
the OAuth callback is a top-level cross-site GET from Google, and `Strict`
would withhold the cookie on exactly that navigation.

Lax also does the CSRF work here — the browser will not attach this cookie to
a cross-site POST — which, together with a CORS allow-list that names one
origin, is what protects the state-changing routes.

## `apps/api/src/modules/auth/session.port.ts`

### `export interface DealerPrincipal`

Who is making this request.

The only thing the current build bypasses is the _identity verification
mechanism_ — the OTP round-trip (CLAUDE.md §5). Everything downstream still
behaves exactly as it will in production: `dealerId` is a property of the
resolved principal, never a field a client can send, and every permission
check runs unchanged.

### `export interface PendingPrincipal`

A verified human with no dealership yet.

This is the state between "Google says this is really them" and "they have
told us about their business" — the only state in which `POST /v1/auth/
onboarding` may be called, and one that carries no permissions at all, so a
half-finished sign-up can reach nothing a dealer can reach.

### `phoneVerified: boolean`

Whether `phone` was proved rather than typed (**R39**).

Carried on the principal because it decides what `POST /v1/auth/onboarding`
may do, and a guard that has to go back to the database for it is a guard
somebody will forget. `users.phone` is written only by a completed OTP
round trip now, so in practice a non-null `phone` implies this — the flag
is here so nothing has to rely on that implication holding forever.

### `permissions: readonly string[]`

Always empty. Present so `requirePermission` reads one shape, not two.

### `export interface SessionResolver`

The seam that decides identity. `CookieSessionResolver` reads the
`dd_session` cookie, looks up the `sessions` row and hydrates these shapes;
`DevSessionResolver` reads a server-configured identity instead, for a
developer with no Google credentials (`AUTH_MODE=dev`).

Note what the signature does _not_ offer: no way to pass an identity in.
The request is available only so a cookie can be read from it.

### `resolveSignedIn(req: Request): Promise<DealerPrincipal | PendingPrincipal | null>`

Anyone holding a valid dealer-scope session, whether or not they have a
dealership. `resolveDealer` is this, narrowed — which is why a route that
needs a tenant can never accidentally be satisfied by a pending account.

### `export const PERMISSIONS =`

ARCHITECTURE §8.3, verbatim.

### `'admin:access:manage': ['SUPER_ADMIN']`

Who may open this console (**R42**). SUPER_ADMIN only, and separate from
`admin:config:write` even though the two currently name the same seat: one
changes what the platform does, the other changes who may change it, and a
future SUPPORT-plus role should be able to hold the first without the
second.

## `apps/api/src/modules/auth/session.service.ts`

### `export const DEALER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60`

Sessions — opaque tokens in Postgres, not JWTs (ARCHITECTURE §8.2).

The value in the cookie is 32 random bytes and means nothing on its own; only
its SHA-256 is stored, so a leaked database dump does not hand anyone a live
session. The reason for the whole design is one line of SQL: suspending a
dealer, or signing them out everywhere, is an UPDATE that takes effect on the
very next request. A JWT would need a denylist — which is a database, only
slower to consult and easier to forget.

### `export const DEALER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60`

§8.2 — 30 days for a dealer, 12 hours for an admin.

### `export function createSessionService(prisma: PrismaClient)`

The token is returned exactly once, here. It is never stored or logged.

### `async resolve(token: string | undefined, scope: SessionScope)`

The live session behind a token, or null. Expiry and revocation are part
of the query rather than a check afterwards, so there is no window where
a revoked row is read and then acted on.

The user's seats come back with it (**R41**). They are read on every
request — a closed DEALER seat has to stop answering on the next click,
the way a revoked session does — and pulling them here costs nothing: it
is the same round trip that was already fetching the user.

### `async revoke(token: string | undefined): Promise<void>`

Idempotent: signing out twice is not an error, and must not be.

### `async revokeAllForUser(userId: string, scope?: SessionScope): Promise<void>`

Every session this person holds, or only the ones for one console.

The scope argument is **R41**: closing a dealership seat must end the
dealer's browser sessions and leave an admin session they hold alone.
Omitting it keeps the old meaning — every seat, everywhere — which is
what an account-level suspension still wants.

## `apps/api/src/modules/auth/verified-phone.ts`

### `export async function assertPhoneVerified`

The one rule every write that stores a dealer's number has to obey (**R39**).

**`users.phone` is written by `phone.service.ts` and by nothing else.** It is
the same shape of invariant as rule 5 — a listing's status changes only
through `transition()` — and it exists for the same reason: a column that
several call sites may set is a column whose meaning drifts. Here the meaning
is specific and worth protecting. `users.phone` holds a number somebody
proved they hold; a number somebody typed is not the same fact, and once both
can land in the column there is no way to tell them apart afterwards.

So onboarding and the profile edit no longer _set_ the number. They assert
that the number they were handed is already the one on the session's user
row, verified — and refuse if it is not. That makes the OTP round trip
unskippable by construction rather than by a check somebody has to remember
to add to the next write path.

The uniqueness refusal moved with it. A number another user holds can never
become this user's verified number, so `PHONE_ALREADY_REGISTERED` is raised
where the claim is made — on step 1, against the box the dealer typed into —
rather than two steps later when the dealership is created.
