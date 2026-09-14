# web / components/dealer

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealer/console-nav.tsx`

### `export interface NavItem`

DESIGN-SPEC §3.11 — the console nav.

A client component for one reason: `aria-current` has to follow the route.
Everything else in the shell stays server-rendered.

Below 768 the sidebar becomes a 56px bottom tab bar of five items and the
credits card moves into Billing, so `Dealer profile` drops out of the bar.

### `short?: string`

Shown in the bottom tab bar; items without one are desktop-only.

### `const NOT_YET_BUILT = new Set([`

── Reconstruction slice ────────────────────────────────────────────────────
`DEALER_NAV` is the baseline's list, verbatim, because it is the shell's
shape and the next five features fill it in. Only one of its routes exists
today, and the nav renders only the routes that exist:

/dealer/inventory F050 Dealer inventory list
/dealer/vehicles/new F056 The vehicle wizard
/dealer/enquiries F065 Dealer enquiries
/dealer/billing F051 Credits & billing

A nav item pointing at a 404 is worse than a missing one — it is the console
telling a dealer a page exists and then not having it — so each feature above
deletes its own line from this set as it lands, and the item appears. When
the set is empty the constant goes with it and `DEALER_NAV` is used directly.

**F048 has deleted `/dealer`**, so Dashboard is in the sidebar and is the
first item in the bottom tab bar — which is also the first time the tab bar
renders at all, since it was empty until now.

A `Set` of hrefs rather than a shortened `DEALER_NAV` deliberately: the list
above is what F047 delivers and what the sandbox story renders in full, and a
reviewer comparing this file against the baseline should find the list
identical and the omission stated separately.
────────────────────────────────────────────────────────────────────────────

### `export const LANDED_NAV: NavItem[] = DEALER_NAV.filter((item) => !NOT_YET_BUILT.has(item.href))`

The items whose routes a dealer can actually reach today.

### `return href === '/dealer' ? pathname === '/dealer' : pathname.startsWith(href)`

`/dealer` must not light up for every page beneath it.

### `const FULL_BAR = 5`

How many items the bar carries when the console is complete (§3.11).

Five: Dashboard, Inventory, Add vehicle, Enquiries, Billing. `Dealer profile`
is the sixth item and is deliberately not one of them — the credits card
moves into Billing below 768, and the profile is reached from there.

### `export function ConsoleTabBar({ items }: { items: NavItem[] })`

The 56px bottom tab bar, below 768 (§3.11).

### `const overflow = tabs.length < FULL_BAR ? items.filter((item) => item.short === undefined) : []`

── Reconstruction accommodation (F048) ─────────────────────────────────
§3.11's rule — "the bar is the five items carrying a `short`" — assumes
all five exist. Four of them are still F050, F051, F056 and F065, and
applying the rule literally today gives a phone **one** tab and no way to
reach `/dealer/profile` at all: the sidebar is `hidden md:flex`, so the bar
is the only navigation a narrow viewport has.

A console screen that cannot be reached on a phone is a worse artefact than
a tab bar one item longer than the spec draws, so while the bar is short of
its five the items without a `short` keep a place in it. Each feature that
lands one of the four pushes the bar towards the specified set, and when it
is full this branch yields nothing and the bar is exactly §3.11's.
────────────────────────────────────────────────────────────────────────

### `if (bar.length === 0) return null`

Nothing to show is not the same as an empty bar: a 56px white strip pinned
over the bottom of every console screen with nothing in it is a
reconstruction artefact rather than a state of the product. It cannot
happen now that F048 has landed, and the guard stays because `items` is a
prop and an empty one is a thing a caller can pass.

## `apps/web/src/components/dealer/dashboard-panels.tsx`

### `export function ViewsChart({ chart }: { chart: DashboardResponse['viewsChart'] })`

DESIGN-SPEC §3.12 — the dashboard's two panels (**F048**).

── Deliberate difference from the baseline ─────────────────────────────────
The baseline declares both of these as private functions inside
`app/(dealer)/dealer/page.tsx`. They are their own file here for one reason,
and it is the reconstruction's own rule rather than a preference: **a
component that exists only inside a feature implementation, with no sandbox
entry, is not done** (CLAUDE.md §6). A component cannot have a sandbox entry
if it cannot be imported.

That rule earns its keep here more than most. `ViewsChart` is a hand-rolled
bar chart — the exact shape of thing that gets rebuilt from scratch by the
next feature that wants one, the way `.table` was hand-rolled five separate
times in the baseline. F051's billing screen and F065's enquiries screen both
want a panel like `RecentEnquiries`; making them findable is the whole point
of the sandbox.

Nothing about the markup changed. Both are server components, neither reads
anything, and both are still rendered only by `/dealer`.
────────────────────────────────────────────────────────────────────────────

### `export function ViewsChart({ chart }: { chart: DashboardResponse['viewsChart'] })`

Seven bars and a total.

**The heights are `heightPct` from the API, not a ratio computed here** —
that is the only way the chart cannot disagree with the numbers beside it
(rule 6, §4.11, and the contracts note on `DashboardResponse.viewsChart`).
The service scales them against the week's own maximum, with a floor of 1 so
a quiet week renders flat rather than `NaN%`.

Each bar carries its own `aria-label`, because a chart is the one place where
the information is entirely in the geometry: seven unlabelled boxes tell a
screen reader nothing at all.

### `export function RecentEnquiries(`

The newest four leads, each with a one-tap `tel:`.

The empty state is not a placeholder — it is the state every new dealership
sees, and it says where leads will appear rather than leaving a blank panel.
Until `Enquiry` lands at **F088** it is also the only state the API can
produce.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline's heading row carries an `All enquiries →` ghost button onto
`/dealer/enquiries`, which arrives with **F065**. It is held back rather than
pointed at a 404 — the same rule `console-nav.tsx` applies to the sidebar
item for that route — and both return together.
────────────────────────────────────────────────────────────────────────────
