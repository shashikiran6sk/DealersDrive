# api / modules/dealers/public-routes

Parent: [api](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/dealers/public-routes/get-dealers.ts`

### `res.set('Cache-Control', 'public, max-age=300')`

A directory changes at the pace of onboarding, not of trading.

## `apps/api/src/modules/dealers/public-routes/get-locations.ts`

### `export const getLocations: PublicDealersRoute = (router, { service, publicReads }) =>`

The places, for the header's location button.

Mounted before `/dealers/:slug` is irrelevant — it is a different path —
but it is deliberately **not** `/dealers/locations`, which would be: Express
matches in definition order, and a resource whose correctness depends on
sitting above a wildcard is one line away from becoming a dealership called
"locations".

### `res.set('Cache-Control', 'public, max-age=300')`

The same five minutes the directory gets, and for the same reason:

### `res.set('Cache-Control', 'public, max-age=300')`

this changes at the pace of onboarding, not of trading.

## `apps/api/src/modules/dealers/public-routes/get-search-dealers.ts`

### `export const getSearchDealers: PublicDealersRoute = (router, { service, publicReads }) =>`

A8b — the dealer typeahead (**R43**).

Mounted at `/v1/search/dealers` rather than `/v1/dealers/suggest`, and the
namespace is the point: `/v1/search/vehicles` arrives at **F076** with the
same query grammar and the same response shape, and a buyer typing into
two boxes on two pages should be hitting one family of endpoints rather
than a dealer-shaped one and a vehicle-shaped one.

It still lives in this module, for the reason the file docblock gives: it
calls `dealersPublic` and nothing else. The path is about the audience, not
about the folder.

**`Cache-Control: public, max-age=60`**, a fifth of what the directory
gets. The rows are the same rows, but this is answered while somebody is
typing — every extra character is another request, so the cache is doing
more work per unit of staleness here than anywhere else in the product, and
a minute is short enough that a newly-approved dealership appears in the
dropdown at about the same time it appears in the grid.

## `apps/api/src/modules/dealers/public-routes/route.ts`

### `publicReads: RequestHandler`

The window the public reads share, and the same name, so that when F076
mounts `/v1/vehicles` beside these the two count against one bucket rather
than two — a scraper walking the directory and the catalogue is one scraper.
It goes through the `CachePort` rather than a module-level Map (rule 10).
