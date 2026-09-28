# web / components/search/search-toolbar

Parent: [web](../../../README.md)

## `apps/web/src/components/search/search-toolbar/search-field.tsx`

### `export function SearchField(...)`

The free-text search (**F080**), written to `?q=` like every other filter.
It searches the grid directly rather than offering a dropdown: the dealer
directory's typeahead (**R43**) chooses one dealership, but a car search is a
filter over the grid the buyer is already reading.

Three defences, the same three R43 names for the directory's box:

1. **Debounce** — `useDebouncedValue`, 350 ms, within the brief's 250–400. Seven
   characters typed steadily are one request, not seven.
2. **Replace, then push.** A settled pause _replaces_ the history entry; Enter
   _pushes_ one. Back then leaves the search, rather than un-typing it one pause
   at a time.
3. **The URL wins.** Navigations are transitions, and a newer one supersedes an
   older one in flight, so an answer for a query the buyer has typed past is
   never what renders.

### `if (applied !== seen)`

The box follows the URL when it changes underneath — Back, Forward, a chip
removed — by resetting its text during render (React's "adjust state when a
prop changes"), not in an effect that would first paint the stale text.

### `requested.current`

What was last asked for. The effect runs on every render and compares against
this rather than against the URL, which still carries the previous search
while the navigation renders — otherwise the pending render would ask again.

## `apps/web/src/components/search/search-toolbar/sort-select.tsx`

### `export function SortSelect(...)`

The five orders the API sorts by, labelled from `VEHICLE_SORT_LABELS` in
contracts. `newest` is written as no parameter, so the default has one URL.
An unknown value in a hand-edited link reads as the default.

## `apps/web/src/components/search/search-toolbar/search-toolbar.tsx`

### `leading`

A slot before the sort, which is where the mobile _Filters_ button (F079) sits
— side by side with the sort at 375px, as §3.3 draws it.
