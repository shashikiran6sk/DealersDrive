# web / features/home

Parent: [web](../README.md)

The homepage as an entry into `/cars` (**R72**, the F081 slice as revised).
There is no homepage search API and no homepage query. The hero is the `/cars`
search box (R79), and each row is an ordinary `/v1/vehicles` request with a
filter.

## `apps/web/src/features/home/load-home.ts`

### `export async function loadHomeInventory()`

The four rows are `DISCOVERY_SECTIONS`: Recently added, SUVs, Automatic cars,
and Under ₹10 lakh. Each is `/v1/vehicles` with its filter and `limit=4`,
cached for 60 seconds under `VEHICLES_TAG`, which the dealer's lifecycle
actions revalidate.

**Promoted rows show only available cars.** Reserved cars sort after every
available one (R71), so the first four are all available whenever four exist.
The row also drops any card that is not `AVAILABLE`, so it may show fewer than
four but never a car a buyer cannot open. Sold and withdrawn cars never reach
it.

**"View all →" carries no number (R78).** How many cars Dealers-Drive holds is
not something the homepage tells a visitor, so the link names the search, not
its size. The rows are fetched on the server, so the counts in the API
response never reach the browser either.

If the API is down, the page still renders the hero search and the static
sections, without the rows.

## `apps/web/src/features/home/discovery-row/discovery-row.tsx`

### `export function DiscoveryRow(props)`

Renders nothing when a row is empty, so the homepage never shows a heading
with an empty grid beneath it.
