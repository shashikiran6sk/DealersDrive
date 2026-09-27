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
