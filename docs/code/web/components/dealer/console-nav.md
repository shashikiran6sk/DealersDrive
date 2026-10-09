# web / components/dealer/console-nav

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealer/console-nav/console-nav.constants.ts`

### `const NOT_YET_BUILT = new Set([`

── Reconstruction slice ────────────────────────────────────────────────────
`DEALER_NAV` is the baseline's list, verbatim, because it is the shell's
shape and the next five features fill it in. The nav renders only the routes
that exist:

/dealer/billing F051 Credits & billing

A nav item pointing at a 404 is worse than a missing one, so each feature
above deletes its own line from this set as it lands. When the set is empty
the constant goes with it and `DEALER_NAV` is used directly.

`/dealer/vehicles/new` left it with the wizard (F063) and `/dealer/inventory`
with R48: the inventory page landed with F066, but its line was left in this
set, so the one screen that lists a dealer's cars had no way in from the
sidebar or the tab bar. It is the second item, as §3.11 draws it.
`/dealer/enquiries` left it with the inbox (**R66**).

A `Set` of hrefs rather than a shortened `DEALER_NAV` deliberately: a
reviewer comparing this file against the baseline should find the list
identical and the omission stated separately.
────────────────────────────────────────────────────────────────────────────

### `export const LANDED_NAV: NavItem[] = DEALER_NAV.filter((item) => !NOT_YET_BUILT.has(item.href))`

The items whose routes a dealer can actually reach today.

### `export const FULL_BAR = 5`

How many items the bar carries when the console is complete (§3.11): Dashboard,
Inventory, Add vehicle, Enquiries, Billing. `Dealer profile` is deliberately
not one of them — the credits card moves into Billing below 768.

## `apps/web/src/components/dealer/console-nav/console-nav.tsx`

### `export function ConsoleNav({ items }: { items: NavItem[] })`

DESIGN-SPEC §3.11 — the console nav. A client component for one reason:
`aria-current` has to follow the route. Everything else in the shell stays
server-rendered.

## `apps/web/src/components/dealer/console-nav/console-tab-bar.tsx`

### `export function ConsoleTabBar({ items }: { items: NavItem[] })`

The 56px bottom tab bar, below 768 (§3.11).

### `const overflow = tabs.length < FULL_BAR ? items.filter((item) => item.short === undefined) : []`

── Reconstruction accommodation (F048) ─────────────────────────────────
§3.11's rule — "the bar is the five items carrying a `short`" — assumes all
five exist. Four are still F050, F051, F056 and F065, and applying the rule
literally today gives a phone one tab and no way to reach `/dealer/profile`
at all: the sidebar is `hidden md:flex`, so the bar is the only navigation a
narrow viewport has. So while the bar is short of its five, the items
without a `short` keep a place in it; when it is full this branch yields
nothing and the bar is exactly §3.11's.
────────────────────────────────────────────────────────────────────────

### `if (bar.length === 0) return null`

Nothing to show is not the same as an empty bar: a 56px white strip pinned
over every console screen with nothing in it is a reconstruction artefact
rather than a state of the product. The guard stays because `items` is a
prop and an empty one is a thing a caller can pass.

## Optional shared utilities

`ConsoleNav.footer` accepts a server-rendered utility slot. Dealer callers
supply `ConsoleUtilities`; other callers retain the original link-only nav.
The navigation scrolls at short heights when utilities are present. The same
navigation element can be supplied to PR #285's mobile drawer so sign out and
workspace switching have one implementation across viewport sizes.
