# web / components/search/car-search-box

Parent: [web/components/search](README.md)

## `apps/web/src/components/search/car-search-box/car-search-box.tsx`

### `export function CarSearchBox({ params, basePath, districtName, className })`

The marketplace's search with suggestions (**R54**) — the second consumer of
`components/ui/autocomplete`, so the debounce, the abort, the stale guard, the
keyboard and the click-away are the dealers' box's, not a copy of them.

**Typing only asks.** Until R54 the box wrote `q` to the URL 350 ms after every
pause, so each word re-ran the search and re-rendered the page under the
buyer's fingers. Now nothing is written until a buyer chooses: a row, Enter, or
×.

### `useEffect(() =>` — following the URL

The box shows the URL's `q`. When it changes from outside — the search chip
removed, Clear all, Back — the box is `reset` to it without opening. A
comparison with `seen` rather than a `key` on the component, because a key
would remount the box on its own Enter and take the focus away.

### `function submit()`

Enter with nothing to take — no rows, or the list closed — searches the words
as typed, collapsed, as a new history entry. With rows showing, Enter takes the
highlighted one, the first by default: the same promise the dealers' box makes.

### `valueOf: (item) => item.variant ?? ''`

What the box reads after a choice is what the URL now searches: a brand or a
model is a filter chip, not a search, so the box empties; a variant is the
search, so the box shows it.

## `apps/web/src/components/search/car-search-box/utils.ts`

### `export function suggestionParams(params, suggestion)`

A row writes canonical filters. A brand **replaces** `brand` and drops `model`;
a model sets both; a variant sets both and puts the variant in `q`, because a
variant has no filter of its own and `q` already matches it. The district,
towns, dealers and every other filter are kept, and the page is dropped like
any other filter change.
