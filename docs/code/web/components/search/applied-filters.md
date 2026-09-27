# web / components/search/applied-filters

Parent: [web](../../../README.md)

## `apps/web/src/components/search/applied-filters/applied-filters.tsx`

### `export function AppliedFilters(...)`

§3.3's chip row: each applied filter as a `tag-outline` chip with a ✕, named
for a screen reader as "Remove filter: Petrol". Labels come from the facets,
so a chip says what the panel says; a range shows its preset's label, or its
bounds when it is custom. The district is not a chip — it is the page's scope,
with its own control.

_Clear all_ is the panel's `clearFilters`, and appears only when there is a
filter to clear: the search text chip is removed by its own ✕.
