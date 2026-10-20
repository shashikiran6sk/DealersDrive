# web / components/search/search-navigation

Parent: [web](../../../README.md)

## `apps/web/src/components/search/search-navigation/search-navigation.tsx`

### `export function SearchNavigationProvider(...)`

One `useTransition` for every search control on the page. The page is a
server component; a filter change is a navigation, and inside a transition
React keeps the current results on screen until the next ones are ready
instead of blanking the page. `pending` is what lets the results region say so.

### `optimistic?.()`

Called inside the transition, which is where `useOptimistic` requires its
update — so a control can show its new state for exactly as long as the
navigation is in flight.

### `export function useSearchNavigation()`

Falls back to a plain `router.push` outside a provider, so a control keeps
working when it is rendered on its own (a story, a test, a page that has not
adopted the provider).

## `apps/web/src/components/search/search-navigation/search-results-region.tsx`

### `export function SearchResultsRegion(...)`

Dims the grid and sets `aria-busy` while a filter change renders, with a
polite status for a screen reader. The page's total is itself a
`role="status"`, so the new count is announced when it arrives.

## `apps/web/src/components/search/search-navigation/utils.ts`

### `export function resultsRegionClass(pending, className)` — R57

The results fade to 60% while the next page renders, **after a 200 ms delay**,
and come back with no delay. The delay is on the pending class only, so it
applies on the way in and not on the way out.

Measured on `/cars` (Playwright, dev seed): a filter change is pending for
about 200–230 ms. With the old immediate 50% fade, every tick flashed the whole
grid. With the delay the lowest opacity reached was 0.987, which is not
visible. When the server's answer was held back 900 ms, the fade still reached
0.6, so a slow update still says something is happening.

### Why nothing else changed — the measurement (R57)

A filter change is already a partial update, and R57 measured that rather than
adding `memo` to every component:

- The rail, the panel, the mobile sheet and the results region are **the same
  DOM elements** after a navigation. The server sends new props to the same
  client components; nothing is keyed on the URL.
- The rail's scroll position survived (900 → 901px). A "Show all" list stayed
  open. The sheet stayed open with its scroll position unchanged (951px) and
  its CTA count updated live. The search box kept focus after an Enter search.
- Cards are keyed by slug: after a sort, 18 of 18 were the same elements,
  moved rather than recreated.
- The grid never emptied between the old and the new results (tracked every
  frame: 24 → 18, 18 → 18, 18 → 6). There is no `loading.tsx` under the
  public segment to swap the page for a skeleton.

`result-updates.test.tsx` holds those properties in place: each control is
re-rendered with the next page's props, as a navigation does, and must keep
its element and its state.
