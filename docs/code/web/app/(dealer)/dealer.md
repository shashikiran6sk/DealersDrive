# web / app/(dealer)/dealer

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(dealer)/dealer/layout.tsx`

**R100 — the account is asked for alongside the guard.** The top bar's account
menu does not depend on the session check or the dealership, so it no longer
waits for them: a full console load is one API round trip shorter (350–672 ms →
222–371 ms at 150 ms per call). The guard itself stays sequential — the
dealership is never requested without a session (that test is unchanged).
`currentSession` is not wrapped in `cache()`: layout and page already share one
`/v1/auth/me` per request through Next's fetch memoisation, measured.

### `export const dynamic = 'force-dynamic'`

DESIGN-SPEC §3.11 — the dealer console shell.

The dealer comes from `GET /v1/dealer`, which the API resolves from the
session — this layout never sends an id and there is no id in any URL below
it (Rule 1). Nothing here is cached: it is per-session data (§18).

It is also the console's guard, and that is the half worth reading. A page
beneath this layout is unreachable without a dealership, and the check is not
repeated per page, so it cannot be forgotten on a new one. Authorization
itself still happens at the API on every request; this only decides which
screen a signed-out person sees.

### `const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false }`

── Reconstruction slice ────────────────────────────────────────────────────
The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
here. That file exists but its `private` arm belongs to **F095**; what it
resolves to for a private route is the literal below. The same substitution
was made at the admin shell, at both sign-in screens and at the onboarding
wizard — an authenticated console must be `noindex` from the day it exists.
────────────────────────────────────────────────────────────────────────────

### `<aside className="hidden w-[214px] flex-none flex-col gap-[18px] border-r border-(--color-divider) bg-white px-3 py-[18p`

Sidebar — 214px, white, right divider.

### No listing-credits panel or top-bar balance (UPD-4, BUG-110)

The sidebar used to end in a "Listing credits" panel and the top bar said
"14 credits". Billing (F050–F054) has not shipped: there is no way to buy a
credit and publishing does not spend one, so a new dealer read "0 credits" as
the thing stopping them. The product owner decided (2026-10-21) to hide credits
until billing exists. Both come back with the billing pages; `creditBalance`
and `creditsHeld` stay on `DealerProfile`, and the admin dealer pages still
show them.

### `<header className="sticky top-0 z-[15] flex h-[58px] flex-none items-center gap-3 border-b border-(--color-divider) bg-w`

Top bar — sticky, 58px, white, bottom divider.

### `<SignOutButton />`

The baseline's `Add vehicle` button sits here, onto
`/dealer/vehicles/new` — the wizard, **F056**. Held back with the
nav item that points at the same route.

### `async function requireDealer(): Promise<DealerProfile>`

The dealership on this session, or the screen this visitor belongs on.

`GET /v1/dealer` answers 401 to two quite different visitors and deliberately
does not distinguish them — that would tell an unauthenticated caller which
of the two it was. So the question is asked of `/v1/auth/me` first, which is
answering about the caller's own session and may therefore say:

· nobody signed in at all → the sign-in screen;
· signed in, no dealership yet → the onboarding wizard, because there is no
console to show until there is a dealership.

── Reconstruction slice ────────────────────────────────────────────────────
This guard was written on `(dealer)/dealer/profile/page.tsx` at **F046**,
with a note saying **F047 should lift it here** once one route stopped being
the whole segment. That is what has happened: it is on the layout now, the
page has none, and a console page added later inherits it rather than
remembering to repeat it.

The baseline asks `hasSession()` — a cookie is present — and catches the 401
from `/v1/dealer`. The cheaper question is the weaker one: a cookie that
exists but no longer works would land on onboarding, which would bounce it
back here. `currentSession()` costs one call and cannot loop.
────────────────────────────────────────────────────────────────────────────

## `apps/web/src/app/(dealer)/dealer/page.tsx`

### `export const dynamic = 'force-dynamic'`

DESIGN-SPEC §3.12 — the console landing page (**F048**).

**Every number here is C18's — none is computed on screen.** That is rule 6
(§4.11) at its most literal: the greeting, the four deltas, the bar heights
and the relative times all arrive formatted, so this file has no arithmetic
in it and cannot disagree with the API about what a dealer's week looked
like.

It is also the route the buyer header's primary button points at. Before this
feature `/dealer` was a 404 with a layout and no page under it, so "Dealer
login" in the public header led nowhere. The layout's guard sends a signed-out
visitor to sign-in and a half-onboarded one to the wizard; this is the page it
has been guarding all along.

── Reconstruction slice ────────────────────────────────────────────────────
The markup is the baseline's. What differs is what the API can answer with:
views, enquiries, the expiry alert and the two activity deltas read models
that do not exist yet, so the chart draws a flat week, the panel is empty and
`alerts` is `[]`. `activeListings`, `creditBalance` and `creditsHeld` are
real. Nothing on this page needs changing when those models land — which is
the point of the numbers being the API's.

The two panels are their own file rather than private functions here, so both
can have a sandbox entry (AGENTS.md §6). See `dashboard-panels.tsx`.
────────────────────────────────────────────────────────────────────────────

## `apps/web/src/app/(dealer)/dealer/enquiries/page.tsx`

### `export default async function EnquiriesPage(...)`

The inbox (**R66**). `force-dynamic` and read with `revalidate: false`, like the
inventory: it carries customers' numbers and must never be served from a cache.
A `status` it does not know falls back to New rather than being sent; only the
tab and the cursor reach the API.

## `apps/web/src/app/(dealer)/dealer/enquiries/calls/page.tsx`

### `export default async function DealerCallLeadsPage(...)`

Customer calls: who revealed the dealership's number, for which car. Read with
`revalidate: false` and `force-dynamic` for the same reason as the inbox — it
carries customers' numbers. Only the cursor reaches the API; the dealership is
the session's. Linked from the inbox header rather than added as an inbox tab,
because a lead has no status and is not an enquiry.
