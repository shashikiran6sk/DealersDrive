# web / components/dealers/dealer-search-box

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealers/dealer-search-box/dealer-search-box.tsx`

### `export function DealerSearchBox(`

DESIGN-SPEC §3.5 — the directory's search box, with recommendations (**R43**).

It replaces a plain 260px input that submitted the raw typed text as `?q=` and
offered nothing on the way: on a platform where a yard may be registered as
"Sri Lakshmi Motors" or "Sree Lakshmi Motors", spelling it unaided is a coin
toss between the grid and an empty state.

**The grid's `?q=` filter is unchanged** — this is a better way to arrive at a
search term, not a different kind of search. It does not navigate to the
dealership: this box sits above a grid the buyer is reading, and a control
that replaces that page is a link pretending to be a filter. The card in the
grid is the way to the portfolio.

The interaction — debounce, abort, the stale guard, the keys, the ARIA — is
`components/ui/autocomplete`, which knows nothing about dealerships. This file
is the source, the row, and what selecting one means.

### `const source = useMemo<AutocompleteSource<DealerSuggestion>>`

Rebuilt only when the filters move. `useAutocomplete` holds it in a ref so
an unstable reference would not refetch, but a memo keeps the fetch closure
honest about which district it is asking within.

### `if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`)`

Any non-2xx is a failed suggestion and the panel says so: a 429 and a

### `if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`)`

502 both mean "not right now", and the grid behind is unaffected

### `if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`)`

either way because it was rendered from a different call.

### `valueOf: (item) => item.brandName`

What lands in the input, and — via `onSearch` — what filters the grid:

### `valueOf: (item) => item.brandName`

the dealership's exact trading name, which is what `?q=` matches on.

## `apps/web/src/components/dealers/dealer-search-box/dealer-search-box.types.ts`

### `q?: string`

The search currently applied to the grid — the box opens holding it.

### `district?: string`

The page's own filters, passed through so suggestions match the grid.

### `districtName?: string`

"Vellore", for the dropdown's heading. Absent on the unfiltered page.

### `onSearch: (term: string | null) => void`

Apply a search term, or clear it. `DirectoryFilters` owns the URL.

## `apps/web/src/components/dealers/dealer-search-box/dealer-suggestion-row.tsx`

### `export function DealerSuggestionRow(`

One row of the dropdown: monogram, name, the place, and what Enter will do.

### `{item.matchedOn === 'brandName' ?`

Marked only when the name is _why_ this row is here: a dealership
offered because its town matched has none of the typed characters
in its name, and underlining nothing is the honest rendering.

### `<span`

Hidden rather than absent on the other rows: rendering it only on the
highlighted row takes ~70px from that row alone, so the meta line
truncates on whichever row the buyer is on and the list appears to
reflow under the arrow keys.
