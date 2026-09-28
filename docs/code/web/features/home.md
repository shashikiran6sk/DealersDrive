# web / features/home

Parent: [web](../README.md)

The homepage as an entry into `/cars` (**R72**, the F081 slice as revised).
There is no homepage search API and no homepage query. The hero builds the same
`/cars` URL the results page reads, the model list is the marketplace's own
facet, and each row is an ordinary `/v1/vehicles` request with a filter.

## `apps/web/src/features/home/hero-search/hero-search.tsx`

### `export function HeroSearch({ locations, brands, loadFacets })`

**District** is the header's `LocationDialog`, used through its `onSelect`
rather than navigating, with `unit="car"` so it counts cars, as it does on
`/cars`. Reusing it means the homepage offers the same districts, grouped the
same way and searched the same way.

**Model depends on Brand** because the facet does. `/v1/vehicles` returns
`facets.models` only when a brand is in the query. So choosing a brand calls
`heroFacetsAction(district, brand)`, which asks exactly that, and the model
select stays disabled until the answer arrives. A slower, stale answer is
discarded (`latest`), so a quick brand change cannot show the previous brand's
models. Changing the brand clears the model.

The submit pushes `heroHref()`, which is `searchHref('/cars', …)`: the builder
`/cars` uses for its own links. The parameters and their order are therefore the
canonical ones, and a model without a brand is dropped.

It is still a real `<form action="/cars" method="get">` with named fields, so
the search works before the script loads.

**Budget** is a ceiling (`maxPrice`), in lakh. A buyer states a budget as a top,
and `/cars` shows the matching price chips once they arrive.

## `apps/web/src/features/home/actions.ts`

### `export async function heroFacetsAction(district?, brand?)`

A Server Action rather than a route handler, because it is only ever called
from the hero. Both values are parsed with `PublicVehicleQuery` first, so
nothing the API would refuse is sent. A failure answers with empty lists, so
the hero degrades to "any brand" instead of breaking the page.

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
it. "View all N" uses the response's `available`.

The brands for the hero come from the first response's facets, so the page makes
no fifth request for them. If the API is down, the page still renders the hero
and the static sections, without the rows.

## `apps/web/src/features/home/discovery-row/discovery-row.tsx`

### `export function DiscoveryRow(props)`

Renders nothing when a row is empty, so the homepage never shows a heading
with an empty grid beneath it.
