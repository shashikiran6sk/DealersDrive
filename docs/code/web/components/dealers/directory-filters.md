# web / components/dealers/directory-filters

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealers/directory-filters/directory-filters.tsx`

### `city?: string[]`

The slugs currently toggled on.

### `locations: PublicLocations`

Every district on the platform — what the picker offers.

### `export function DirectoryFilters({ cities, city, district, q, locations }: DirectoryFiltersProps)`

DESIGN-SPEC §3.5 — a 260px name search, and the row that narrows the grid.
Like every other filter in the product this writes to the URL rather than to
a store, so the result is shareable, server-renderable and survives a back
button (ARCHITECTURE §15.2).

## The row has two shapes (R23)

**Within a district** it is the towns in it, as toggle chips. **With no
district chosen** it is a `Select district` button plus only the towns
_already_ applied — the full row rendered every town on the platform, which is
forty-four chips five rows deep at 120 dealerships and gets monotonically
worse with every signup.

An applied town always shows, district or not: `indexPolicy` names
`/dealers?city=vellore` as an indexable canonical, so hiding the row there
would apply a filter the buyer can neither see nor clear. The grid underneath
is unchanged either way — no district still means every dealership.

A button rather than a default district because the districts arrive
busiest-first with ties broken alphabetically, so `districts[0]` is not "the
busiest" but the earliest-named — and a visitor in Wayanad would be told, in
the page's own H1, that they were looking at Bengaluru Urban. Not a modal on
arrival either: an interstitial over the one indexed dealers URL, with the
document inert behind it, leaves a visitor who cannot find their district with
no way forward at all.

### `const districtName = locations.districts.find((entry) => entry.slug === district)?.name`

The district's _name_, for the dropdown's heading and placeholder. Read off
the list the picker already has rather than added as a prop: a second copy
of that pairing is the thing D6 removed a table to avoid.

### `const visible = district ? cities : cities.filter((entry) => selected.has(entry.slug))`

Every town in the district, or — with no district to bound them — only the
ones already applied. Never the platform's whole list.

### `<DealerSearchBox`

Keyed on the applied search so that a navigation — a chip, the back
button, a shared link — resets what is in it: the box owns what is typed
between searches, and the URL owns what has been searched for (**R43**).

### `{selected.size > 0 ?`

The way out of a multi-select: with several chips on, un-pressing each in
turn is not discoverable. It follows the selection and not the district,
so a buyer who arrived on `/dealers?city=vellore` from a search result
has the same way out as one who toggled the chip themselves.

### `{selected.size === 0 ?`

What the button is for, and only where there is room for it to be
read — once a town is applied the chips beside it say what is going
on and this would be a third thing competing to.

## `apps/web/src/components/dealers/directory-filters/utils.ts`

### `export function directoryHref({ district, city, q }: DirectoryQuery): string`

The directory URL for a set of filters. Towns are sorted, so picking the same
two in either order produces the same URL — one cache entry and one link,
rather than two of each.
