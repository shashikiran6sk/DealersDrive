# web / lib

Parent: [web](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/lib/api.ts`

### `export const SESSION_COOKIE = 'dd_session'`

The session cookie the API issues. Named here so one file forwards it.

### `export const SERVER_ERROR_MESSAGE =`

What a 5xx is allowed to say. Never the bug's own words.

### `export class ApiError extends Error`

The one place the web app talks to the API.

Every call is server-side by default (Rule 8): RSC fetches through
`apiGet`, and mutations go through Server Actions that call `apiSend`. The
browser only reaches the API directly for the two things that genuinely
cannot be expressed as a navigation — the direct-to-storage upload and the
enquiry-inbox tab switch — and those go through `/api/*` BFF handlers so no
`NEXT_PUBLIC_*` variable is ever needed (Rule 9, ARCHITECTURE §15.3).

Because the fetch happens on the Next server rather than in the browser, the
dealer's `dd_session` cookie is not attached automatically — this file
forwards it. It does so only for uncached requests, which is not a
convenience: reading a cookie makes a route dynamic, and attaching a session
to a _cached_ fetch is how one dealer's console ends up in another's browser
(ARCHITECTURE §18). Public pages therefore stay anonymous and cacheable, and
anything behind a session is `revalidate: false` and never shared.

### `userMessage(fallback: string = SERVER_ERROR_MESSAGE): string`

The one line of this error a person may be shown.

A 4xx `detail` is written _for_ the person who made the request — "That
email and password do not match", "This car is no longer listed" — and
putting it on screen is the whole point of RFC 9457.

A 5xx `detail` is the opposite: it is a bug describing itself. The API
fills it only outside production (`apps/api/src/middleware/error-handler.ts`
— `env.isProduction ? undefined : error.message`), so on a laptop it
carries text like "Invalid `tx.dealerDocument.create()` invocation …
Transaction API error". That is a stack trace wearing a sentence, it names
our internals, and there is nothing in it a buyer or a dealer can act on.
So every 5xx gets the same neutral line, in every environment — the detail
is still in the server log, addressed by `traceId`, where it belongs.

### `fieldErrors(): Record<string, string>`

Per-field messages, keyed by the field name the form uses.

### `const field = entry.field.replace(/^(body|query|params)\./, '')`

`validate()` prefixes the source: "body.pricePaise" -> "pricePaise".

### `revalidate?: number | false`

Public pages cache; anything behind a session must not (§18).

### `headers?: Record<string, string>`

Extra request headers. Used by Server Actions to forward the buyer's IP:
without it every reveal and every enquiry would arrive from the Next
server's single address and the per-IP limits protecting dealer phone
numbers would count one bucket for the whole internet (ARCHITECTURE §14.1).

### `async function sessionCookie(): Promise<string | undefined>`

The session token, or undefined outside a request scope.

`cookies()` throws during static generation — the sitemap and the cached
public pages are rendered with no request at all — and that is a legitimate
state, not an error: those pages have no session to forward.

### `export function apiGet<T>(path: string, options?: RequestOptions): Promise<T>`

`apiSignIn` and `sessionFrom` used to live here — a POST whose _response
headers_ mattered, because the admin sign-in returned a `Set-Cookie` that had
to be re-issued by this origin.

There is no such call any more. Both consoles sign in by navigating the
browser to the API, which sets the cookie itself on the OAuth callback, so
nothing in this app ever relays one. Keeping the helper would have meant
keeping the only code path that copies a session cookie between two
processes, for no caller.

### `export async function apiGetParsed<T>`

`apiGet`, but the payload is **checked** against the contract it claims to be.

## Why this exists (R22)

`apiGet<T>` is a cast. `T` is a promise the compiler cannot keep, because the
bytes come off a socket from a process built at a different time — and the
failure that taught us this is worth writing down, because it did not look
like a failure.

R22 added `state` to each district in `/v1/locations`. Between the API
restarting and Next's ten-minute fetch cache expiring, the header was handed
the _old_ payload: districts with no `state` key. Nothing threw. `undefined`
flowed into the selector and every district in the country was filed under
**"State not recorded"** — which is not a rendering glitch a reader dismisses
but a **factual claim**, in the product's own voice, that the platform does
not know where Chennai is. Version skew wearing the costume of data.

`schema.parse` turns that into a throw, and a throw the caller can degrade
from. Losing the dropdown for the few minutes a deploy is skewed is a cost
worth paying; telling a buyer something false for the same few minutes is
not.

## When to reach for it

Not everywhere, and not as a rule pending on the other call sites. Use it
where a **missing or changed field renders as a plausible sentence rather
than as an obvious break** — that is the class this catches and type
assertions cannot. A payload whose absence yields an empty list or a blank
card is already loud enough to need no help.

Zod objects ignore unknown keys by default, so an additive API change still
parses. Only a field this app _requires_ going missing is an error, which is
exactly the skew direction that hurts.

### `throw new Error`

Named, and loud. The caller degrades — that is its business — but a
silent degrade is how a skewed deploy looks identical to an empty
platform for as long as nobody thinks to check.

### `const payload = method === 'DELETE' ? body : (body ?? {})`

An action with no input still sends `{}`. Several endpoints declare an

### `const payload = method === 'DELETE' ? body : (body ?? {})`

all-optional body (`POST /listings/:id/approve` takes an optional note),

### `const payload = method === 'DELETE' ? body : (body ?? {})`

and `.strict()` Zod rejects `undefined` — which is correct of it. Sending

### `const payload = method === 'DELETE' ? body : (body ?? {})`

nothing at all is what would be wrong.

### `export function qs(params: Record<string, string | number | undefined | null>): string`

Builds a query string from a partial record, dropping empty values.

## `apps/web/src/lib/cache-tags.ts`

### `export const DEALERS_TAG = 'dealers'`

The cache tags the public pages are built from, and the one function that
clears them.

## The problem this solves

A dealer changed their Maps link, or their name, or their opening hours, and
watched their own portfolio for five to ten minutes before it caught up. Two
caches were stacked and neither was ever invalidated:

· every public `apiGet` asks for `revalidate: 600`, so Next's Data Cache
holds the API's answer for ten minutes;
· `/dealers/[slug]` is `export const revalidate = 600`, so the rendered
page is held for ten minutes as well.

Both are right. A directory changes at the pace of onboarding and a portfolio
at the pace of a dealer editing it, so time-based expiry is the wrong lever
to reach for — the answer is not a shorter window, which would cost every
anonymous visitor a round trip to make one dealer's edit land sooner. The
answer is to say _when_ the thing has changed, which is exactly what a write
path knows and a timer never will.

The API's own `Cache-Control: public, max-age=300` is a third window, and it
is not a factor: nothing between the Next server and the API caches — an ALB
does not — and no browser reaches these routes directly. It matters the day a
CDN is put in front of the API, and on that day this file is where the note
belongs.

## Why tags rather than `revalidatePath`

`revalidatePath('/dealers/[slug]', 'page')` would need no slug, which is
tempting for the admin paths below. But the guarantee wanted here is that the
_fetch_ is re-issued, and a tag is the mechanism that says so directly: every
Data Cache entry carrying the tag is dropped, and every route that rendered
from one is dropped with it. Reasoning about which cache a path expression
reaches is how a cache fix ships that does not fix anything.

### `export const DEALERS_TAG = 'dealers'`

Everything that lists dealerships: the directory grid, its chips, and the
header's district selector in the public layout.

One tag rather than three, because the three change together. A dealership
being approved, suspended or renamed moves the grid, the counts beside the
chips and the count beside the district in one write.

### `export const CONFIG_TAG = 'public-config'`

`GET /v1/config/public` — the payload every public page's footer is built
from (**R44**).

Its own tag rather than `DEALERS_TAG`, because it changes for an entirely
different reason and at an entirely different rate: a dealership is approved
several times a day, and a social link is corrected twice a year. Sharing a
tag would mean every approval re-fetched a payload that had not moved, and —
the half that actually matters — an operator correcting a dead Instagram link
would have to wait for an unrelated write to clear it.

### `export function dealerTag(slug: string): string`

One dealership's public page.

### `export function revalidatePublicDealer(slug?: string | null): void`

Every public page a change to this dealership can be seen on.

Called from Server Actions and route handlers, never from a render. The slug
is optional because not every write path knows one — and the listing pages
are cleared either way, so the worst case is a portfolio that lags rather
than a directory that does.

### `export function revalidatePublicConfig(): void`

Every public page that renders a value from `/v1/config/public` — which, via
the footer, is all of them.

Called from the admin config action. Without it a corrected social link waits
out the ten-minute window on a page the operator is looking at while they fix
it, which reads as the save not having worked.

## `apps/web/src/lib/cn.ts`

### `export function cn(...inputs: ClassValue[]): string`

Tailwind-aware class joining, so a caller's override actually wins.

## `apps/web/src/lib/config.ts`

### `export interface ServerConfig`

Runtime configuration, read on the server.

`NEXT_PUBLIC_*` is banned (ARCHITECTURE §15.3, Rule 9): those variables are
inlined at build time, which would force one image per environment and break
build-once-promote-many. Anything the browser needs is read here, in a server
component, and passed down as props — see `ConfigProvider` in the root
layout.

### `export interface ClientConfig`

The subset that is safe, and useful, in the browser.

## `apps/web/src/lib/fetch-json.ts`

### `export async function readJson<T>(response: Response): Promise<T>`

Reads a JSON body as the shape the caller expects.

The single type assertion at the browser's fetch boundary, so the three BFF
calls that need one do not each carry their own. `Response.json()` is untyped
by construction; where a wrong shape would render as a plausible sentence
rather than an obvious break, parse the contract instead — see `apiGetParsed`.

## `apps/web/src/lib/locations.ts`

### `export const NO_LOCATIONS: PublicLocations = { districts: [], total: 0 }`

The districts the platform trades in — A12, `GET /v1/locations`.

## Why it is a helper rather than two fetches (R23)

The public layout has always read this for the header's button. R23 gives the
directory a second reason to want it: with no district chosen it draws a
`Select district` button instead of a row of every town on the platform, and
that button opens the same dialog off the same list.

Two callers is where the fetch _options_ start to matter. `revalidate` and
the cache tag are not incidental — they are what makes the second read a
cache hit rather than a second round trip to the API, and what makes both
callers agree about how stale the list may be. Written twice they would
eventually differ by a digit, and the symptom would be a header and a page
disagreeing about which districts exist.

## Why it is parsed rather than cast (R22)

`apiGet<PublicLocations>` is an assertion, and this is the one read in the
product where an assertion that turns out to be false renders as a **sentence
a buyer believes** rather than as an obvious break.

It happened. R22 added `state` to each district; for the ten minutes between
the API restarting and the fetch cache expiring, the header was handed the
previous payload, `state` was `undefined`, and the selector filed every
district in the country under "State not recorded" — the product asserting,
in its own voice, that it did not know which state Chennai is in.

`apiGetParsed` makes that a throw, and `getPublicLocations` turns the throw
into an empty list. An empty selector for the length of a skewed deploy is a
cost worth paying; a false statement for the same minutes is not.

## The cache is why the skew outlives the deploy

`revalidate: 600` means a payload fetched before a deploy can be served for
ten minutes after it. `DEALERS_TAG` clears it when a dealership changes, and
a dealership does not change because the API was rebuilt — so this window is
real, expected, and exactly when the parse earns its place.

### `export async function getPublicLocations(): Promise<PublicLocations>`

The list, or an empty one.

It never throws, and that is the point: this is read from a **layout**, and a
throw in a layout escapes every error boundary below the root to land on
`global-error.tsx`, which replaces the whole document. Losing one dropdown is
not worth losing the page under it.

### `tags: [DEALERS_TAG]`

Tagged, so approving or suspending a dealership moves the header's counts

### `tags: [DEALERS_TAG]`

at once rather than within ten minutes (`lib/cache-tags.ts`).

### `console.error('[locations] unavailable', error)`

Named rather than swallowed: an empty header and a skewed deploy look

### `console.error('[locations] unavailable', error)`

identical from the outside, and only one of them is worth waking up for.

## `apps/web/src/lib/msg91-widget.ts`

### `interface Msg91Configuration`

The MSG91 OTP widget, wrapped in promises (**R39**).

The provider ships a script that attaches `sendOtp`, `retryOtp` and
`verifyOtp` to `window` when `initSendOTP` is called with
`exposeMethods: true`. That flag is what suppresses MSG91's own modal, which
is the whole reason this integration is worth doing by hand: the product's
sign-up screen keeps its own design, its own copy and its own error states,
and the provider supplies only the send and the check.

Everything here is browser-side and deliberately shallow. **None of it is
trusted.** The token these calls produce is meaningless until the API takes
it to MSG91 with the server-only auth key; a page that decided for itself
that a number was verified would be a page that could be told to.

── Why a module-level promise ──────────────────────────────────────────────
`initSendOTP` configures one widget per page, and the callbacks it is given
are the ones it keeps. Loading the script twice, or re-initialising it on a
re-render, produces two widgets racing over the same globals — which shows up
as duplicated success events and an OTP sent twice. It is loaded once, and
the second caller waits on the same promise.

### `interface Msg91Configuration`

What `initSendOTP` is handed. Only the fields this product sets.

### `interface Window`

What the widget script puts on `window` once `initSendOTP` has run.
Declared on `Window` rather than asserted at each use: the members are
optional, so `typeof target.sendOtp !== 'function'` is still the check that
decides whether the widget is usable.

### `const READY_TIMEOUT_MS = 15_000`

How long the widget has to attach its methods after `initSendOTP` returns.

`initSendOTP` is synchronous but what it _starts_ is not: the widget fetches
its configuration from MSG91 before it puts `sendOtp`, `retryOtp` and
`verifyOtp` on `window`. Fifteen seconds is generous for one request and far
short of a dealer's patience.

### `const CALL_TIMEOUT_MS = 20_000`

How long one widget call has to invoke either of its callbacks.

**The whole point is that there is a limit.** These are callback APIs wrapped
in promises, and a callback that is never invoked is a promise that never
settles — which is a spinner nobody can get out of, with no error anywhere.
A provider that goes quiet has to become a visible failure.

### `export function loadMsg91Widget(config:`

Load and initialise the widget, once.

The configuration's own `success` and `failure` are given no-ops on purpose.
`verifyOtp` takes its own pair, and MSG91's documentation is explicit that
listening to both produces duplicate events — so the per-call callbacks are
the ones this module uses, and the widget-level pair exists only because the
configuration requires it.

### `whenExposed(target).then`

**Not resolved here.** `initSendOTP` returning means the widget has
been _asked_ to start, not that it is ready: it fetches its
configuration from MSG91 first, and only then attaches `sendOtp`,
`retryOtp` and `verifyOtp` to `window`.

Resolving on the synchronous return let a caller invoke `sendOtp`
while it was still undefined — which did nothing at all, and left the
promise wrapping it waiting for a callback that could never come.

### `const fail = (error: unknown): void =>`

Lets a dealer press the button again rather than be stuck for the page's life.

### `waitFor(() => typeof target.initSendOTP === 'function', READY_TIMEOUT_MS).then`

Already on the page — but possibly still downloading, in which case

### `waitFor(() => typeof target.initSendOTP === 'function', READY_TIMEOUT_MS).then`

`initSendOTP` is not there yet and initialising now would fail for a

### `waitFor(() => typeof target.initSendOTP === 'function', READY_TIMEOUT_MS).then`

reason that is about timing rather than about anything being wrong.

### `function whenExposed(target: Msg91Window): Promise<void>`

Resolves once the widget has put its methods on `window`.

Polled, because the widget announces readiness in no other way — there is no
event and no promise, only the methods appearing. `getWidgetData()` is the
documented way to read the fetched configuration and would do as a signal
too; the methods themselves are the more direct precondition, because they
are exactly what the next call needs.

### `function waitFor(ready: () => boolean, timeoutMs: number): Promise<void>`

Polls `ready` until it is true, or rejects at the deadline.

### `export function sendMsg91Otp(identifier: string): Promise<void>`

`sendOtp`. `identifier` is digits with the country code and no `+`.

### `export function retryMsg91Otp(identifier: string): Promise<void>`

Resend, by whichever route the widget will actually take.

`retryOtp` is the documented one, and `null` is the documented channel value
for a default configuration. It is also the one that fails on a widget whose
settings name no retry channel — `retry method not provided` — and that is a
dashboard setting, not something the page can fix or the dealer should care
about. A resend that does nothing is worse than a resend that takes the long
way round.

So the long way round is the fallback: `sendOtp` again, which is the same
operation from the dealer's side and is known to work, because it is how the
first code got there. MSG91 issues a fresh request and `verifyOtp` checks
against the latest, which is exactly what "send it again" means.

The failure is logged rather than swallowed — a deployment that falls back on
every resend has a widget to configure, and that should be visible.

### `export function verifyMsg91Otp(code: string): Promise<string>`

`verifyOtp`, resolved to the access token the API will check.

The token's location in the success payload is not something to guess at, and
MSG91 has shipped it under more than one key — so every plausible one is
looked at and a failure to find it is an error rather than an empty string
posted to the API.

### `function call<T>`

One widget call, as a promise that is guaranteed to settle.

Three things have to be true for that guarantee, and the first two were the
bug this function exists in its current shape to prevent:

· **the method is there.** `target.sendOtp?.(…)` on an undefined `sendOtp`
is not an error — it is nothing at all, and "nothing at all" inside a
promise executor is a promise that never settles. The method is checked
for by name, and its absence is a rejection.
· **the widget has finished starting.** `initSendOTP` existing says the
script arrived, not that the widget is usable; `whenExposed` is what
waits for the difference.
· **the provider answers.** These are callback APIs. A callback that is
never invoked has to become a rejection at some point, or the caller
waits forever — which, from a dealer's side, is a spinner that never
stops and an error message that never appears.

### `let done = false`

Settled once, by whichever of the three gets there first.

### `console.error(`[msg91] ${method} failed`, error)`

The provider's own payload, which is the only place the real reason

### `console.error(`[msg91] ${method} failed`, error)`

ever appears — it is not a string and does not survive `catch {}`.

### `export function resetMsg91Widget(): void`

Test-only: forget the loaded widget so the next call re-initialises.

## `apps/web/src/lib/nav.ts`

### `export function isCurrentPath(pathname: string, href: string, rootHref: string): boolean`

Whether a nav item is the page being viewed.

A console root — `/dealer`, `/admin` — must not light up for every page
beneath it, so it matches exactly while every other item matches its subtree.

## `apps/web/src/lib/plural.ts`

### `export function pluralLabel(count: number, singular: string, plural = `${singular}s`): string`

The noun for a count: "district" at one, "districts" otherwise.

### `export function countLabel(count: number, singular: string, plural?: string): string`

The count and its noun — "1 district", "4 districts".

## `apps/web/src/lib/public-config.ts`

### `export const NO_PUBLIC_CONFIG: PublicConfig =`

The public bootstrap payload — A14, `GET /v1/config/public` (**R44**).

## Why the web app reads this at all

Everything on it could have been an environment variable, and every one of
them would then have been a `NEXT_PUBLIC_*` baked into the image at build
time — which is exactly what Rule 9 and ARCHITECTURE §15.3 forbid, because it
makes one image per environment and ends build-once-promote-many. Support
contacts and the social links move on a marketing timescale rather than a
release one; reading them at request time is what lets an operator correct a
dead link from `/admin/config` and see it on the next page load.

## Why it is parsed rather than cast

The same reason `getPublicLocations` is. `apiGet<PublicConfig>` is an
assertion, and a false one here renders as an `href` — a link a buyer clicks
that goes somewhere unintended reads as the product's own recommendation.
`apiGetParsed` makes a skewed payload a throw instead.

## Why it never throws

It is read from a **layout**, and a throw in a layout escapes every error
boundary below the root to land on `global-error.tsx`, which replaces the
whole document. Losing the footer's contact row is not worth losing the page
above it, so an unreachable API degrades to `NO_PUBLIC_CONFIG` — support
contacts absent, no social icons, and a footer that still renders its links
and its trust line.

### `revalidate: 600`

Ten minutes, like the rest of the public shell — but the tag is what

### `revalidate: 600`

actually governs it: `revalidatePublicConfig()` clears this the moment an

### `revalidate: 600`

admin saves a key, so the window only ever applies to a value nobody has

### `revalidate: 600`

touched.

### `console.error('[public-config] unavailable', error)`

Named rather than swallowed: an empty footer and an unreachable API look

### `console.error('[public-config] unavailable', error)`

identical from the outside, and only one of them is worth waking up for.

## `apps/web/src/lib/seo.ts`

### `export type SeoRoute =`

ARCHITECTURE §17.2 — the whole indexing policy, in one function.

"Implement as a single function — given a route and its result count, return
`{index, follow, canonical}` — called by every `generateMetadata`. One place,
so the policy cannot drift between routes."

The rules it encodes, in full:

| Route                              | Policy                         |
| ---------------------------------- | ------------------------------ |
| `/`, `/cars`, `/dealers`           | index, follow · self canonical |
| `/cars?page=2..40`                 | index, follow · self canonical |
| any URL with filter query params   | noindex, follow · clean path   |
| `/car/{slug}` live                 | index · self                   |
| `/car/{slug}` sold > 30 days       | noindex, follow (API decides)  |
| `/dealers/{slug}` active + ≥1 live | index · self (API decides)     |
| `/saved`, `/enquiry-sent`          | noindex                        |
| `/dealer/*`, `/admin/*`, `/api/*`  | noindex + robots.txt disallow  |

Where the API already resolved indexability (`seo.isIndexable` on A5 and A9),
that answer wins: it knows the sold-30-days and live-listing-count facts this
layer does not.

── Reconstruction slice ────────────────────────────────────────────────────
**F095** owns this file and lands the table above in full. **F085** brings it
into existence with the two cases the dealer directory needs — `dealers` and
`resolved` — because a searchable directory that is indexable at every `?q=`
permutation is exactly the thin-page problem this policy was written to
prevent, and deferring it would mean shipping the harm and fixing it later.

The shape is the baseline's, not a sketch of it: F095 adds `home`, `cars` and
`private` to the same union and the same switch. `hasFilterParams` and
`NON_FILTER_KEYS` arrive with `/cars` (**F077**), which is the only route
that has filters to ask about.
────────────────────────────────────────────────────────────────────────────

### `const NOINDEX_FOLLOW: SeoPolicy['robots'] = { index: false, follow: true }`

Still `follow`: the links out of a filtered page are how deep pages get crawled.

### `const canonical = route.city ? `/dealers?city=${route.city}` : '/dealers'`

A city is a facet we deliberately index; a name search is not. It is an

### `const canonical = route.city ? `/dealers?city=${route.city}` : '/dealers'`

unbounded surface — one URL per string anybody has ever typed — and

### `const canonical = route.city ? `/dealers?city=${route.city}` : '/dealers'`

every one of them is a near-duplicate of the page above it.

### `export function seoMetadata(route: SeoRoute): Pick<Metadata, 'robots' | 'alternates'>`

The `Metadata` fragment, ready to spread into a `generateMetadata` return.

## `apps/web/src/lib/services.ts`

### `export function servicesOf(value: string): string[]`

The services list, as the wire carries it and as the schema wants it.

`specialities` is `string[]` in the contract and one comma-separated string
on the wire, because that is what a form field can hold. This is the single
parse between the two, and it is a module rather than a private function
because it had been written **three** times — in `auth/actions.ts`, in
`dealer/profile-actions.ts` and in `admin/dealer-profile-editor.tsx` — which
is exactly how two screens start disagreeing about what
`In-house workshop, RC transfer` means.

Repeats and case are **not** handled here. Merging is a read-side rule
(**R18**) and de-duplication is an editing affordance the chip input owns
(**R37**); a parse that silently dropped entries would make the box the
dealer is looking at disagree with the value it submits.

## `apps/web/src/lib/session.ts`

### `export async function hasSession(): Promise<boolean>`

Whether this request carries a session cookie at all.

Deliberately _not_ an authorization check: it says a cookie is present, not
that it is valid, and nothing may be shown or hidden on the strength of it.
It is used in exactly one place — to decide whether a 401 from the console
means "signed out" or "signed in, still onboarding".

### `export async function currentSession(): Promise<AuthSession | null>`

The session the API recognises, or null.

The sign-in screens ask _this_ rather than `hasSession`, and the difference
is what stops a redirect loop: a cookie that exists but no longer works would
otherwise bounce sign-in → console → sign-in forever. A page that verifies
with the API instead renders the form and lets the person sign in again.

### `export async function currentAdmin(): Promise<AdminOverview | null>`

The same question for the admin console, whose sessions are a separate scope.

### `export function destinationFor(session: AuthSession): string`

Where a signed-in dealer belongs, given what the API says about them.

## `apps/web/src/lib/state-codes.ts`

### `const CODES: Record<string, string> =`

The RTO code for an Indian state or union territory — `Tamil Nadu` → `TN`.

## What this is, and what it is not

It is **not** location data. It adds no place, holds no count and decides
nothing: the states the location dialog shows are whatever the dealerships on
the platform typed, and this only says how to abbreviate one on a plate. The
precedent is `apps/api/src/platform/rc/rc-aliases.ts` — a committed constant
mapping VAHAN's maker strings to brands, which **D1** kept precisely because
a fixed public constant is not a catalogue.

The codes are the first two characters of every registration plate issued in
that state, which is why the dialog can wear them as plates without inventing
a motif: `TN 09 BX 4412` starts with the same two letters this returns.

## Unknown is a real answer

`state` on a dealership is free text somebody typed into an onboarding form.
It can be misspelt, abbreviated, or a state this list does not know. So the
lookup is normalised — case, spacing and punctuation folded — and returns
`null` rather than a guess when nothing matches. The state header renders
without a plate in that case: no code is better than a wrong one on something
shaped like a number plate.

### `'andaman and nicobar islands': 'AN'`

Union territories.

### `function normalise(state: string): string`

Folds case, punctuation and repeated spaces, so `TAMIL-NADU` still matches.

### `export function stateCode(state: string | null): string | null`

`Tamil Nadu` → `TN`, and `null` for anything this list does not recognise.

## `apps/web/src/lib/upload.ts`

### `export interface FileRule`

The browser half of the presign → PUT → commit pipeline (ARCHITECTURE §12.1).

The file never passes through the Next server: only the signing and commit
calls are proxied, because those need the session. The yard photograph and the
three KYC documents both walk it, so the steps live here rather than twice
over — the messages stay each caller's, because "we could not record that
photo" and "we could not record that document" are what the dealer reads.

### `export function fileRejection(file: File, rule: FileRule): string | null`

The message to show, or `null` when the file is acceptable.

### `export async function putToStorage(signed: PresignResponse, file: File): Promise<void>`

The one step the bytes actually travel on — straight to object storage.

### `export function failureMessage(caught: unknown, fallback: string): string`

What an upload or removal failed with, as a sentence a dealer can read.

## `apps/web/src/lib/url.ts`

### `export type SearchParamsInput = Record<string, string | string[] | undefined>`

Search state lives in the URL and nowhere else.

That is free SEO, free sharing and a free back button, and it is why every
filter in the product is a client component that writes to the URL rather
than a store the server has to be told about (ARCHITECTURE §15.2).

── Reconstruction slice ────────────────────────────────────────────────────
The baseline's version of this file is mostly `FACET_ORDER` — the canonical
ordering of the thirteen vehicle facets — plus `toApiQuery` and
`buildSearchUrl`, which walk it. All three belong to `/cars` (**F077**) and
arrive with it. The dealer directory has two parameters and a page number, so
what it needs from here is the type.
────────────────────────────────────────────────────────────────────────────

### `export function one(params: SearchParamsInput, key: string): string | undefined`

Next hands a repeated parameter as an array. The API takes one value.

### `export function many(params: SearchParamsInput, key: string): string[]`

A comma-separated parameter, as the list it stands for.

`?city=vellore,katpadi` rather than `?city=vellore&city=katpadi`: the API
takes one value per key, the shorter form survives being pasted into a chat
window intact, and a single slug still reads as a list of one — so every
link shared before the chips became toggles keeps working.

## `apps/web/src/lib/use-debounced-value.ts`

### `export function useDebouncedValue<T>(value: T, delay: number): T`

A value, held back until it stops changing (**R43**).

## Why the value and not the callback

The usual shape of this is `useDebouncedCallback` — wrap the handler, call it
on every keystroke, let the wrapper decide. It is the wrong shape for React,
and the reason is closures: the wrapped function captures the render it was
created in, so the call that finally fires 300 ms later is holding whatever
state that render could see. The standard fix is a ref holding the latest
callback, which is a moving part in every consumer.

Debouncing the _value_ has no such problem. The consumer reads it in an
effect that lists it as a dependency, so the effect body is always the
current render's — and React's own rules about when that effect re-runs, and
when its cleanup fires, are the same rules as for any other dependency.

```tsx
const [typed, setTyped] = useState('');
const search = useDebouncedValue(typed, 300);
useEffect(() => { ... fetch(search) ... }, [search]);
```

## What it does not do

It does not cancel the request that the previous value started — an effect
cleanup and an `AbortController` do that, and they belong to the consumer
that owns the request. Debouncing is about _not asking_; aborting is about
having asked and changed your mind. `useAutocomplete` does both, and keeping
them separate is what makes each one legible.

## `delay` is read once per change, not captured

It is in the dependency list, so changing it mid-flight restarts the timer
rather than letting a stale one fire. Nothing in the product changes it, but
a hook whose behaviour depends on a prop it ignores is a trap for whatever
does.

### `if (Object.is(value, settled)) return`

Nothing is scheduled when the value has not actually moved. Without this,
a parent re-render that happens to pass the same string restarts the
timer, and a buyer typing steadily while something else re-renders around
them would never see the request fire at all.
