# web / app/(public)/cars

Parent: [web](../../README.md)

## `apps/web/src/app/(public)/cars/page.tsx`

### `export default async function CarsPage(...)`

The marketplace list (**F077** as scoped by **R45**): the approved cars,
newest first, a page at a time. No filters, sort or search yet — those are
F076/F078/F080 and deferred — so the page takes one query parameter, `page`,
and ignores anything that is not a positive integer rather than passing it to
the API.

The response is parsed with `PublicVehiclesResponse` (`apiGetParsed`), and the
fetch is tagged `vehicles` so an approval in the admin console revalidates it
at once rather than after the minute's cache.

It is indexable now that it lists real cars; it replaced a coming-soon page.

**R50 — one district at a time.** The page reads `?district=` too, the same
slug the directory and the header's selector use, and passes it to
`GET /v1/vehicles`. A value that is not a slug is dropped here rather than sent
on, like a bad `page`. The heading names the district (`Cars in Ranipet`), the
count is the response's `page.total` — never the length of the page — and every
pagination link carries the district. An empty district says so and offers
every district, rather than pointing at the directory.

The district's name comes from `GET /v1/locations`, which the public layout has
already fetched for the header under the same cache tag, so it costs no second
round trip.

**F078 — the filters.** Every search parameter is read with
`readVehicleSearch` (the contract's own schema, pruned rather than refused),
passed to `GET /v1/vehicles` in one canonical order, and drawn back as the
`FilterPanel` rail (sticky, 250px, desktop only until F079 brings the sheet)
and the `AppliedFilters` chips — both from the facets in the same response,
so a count on screen is always the count of the page it leads to. The results
sit in a `SearchResultsRegion` inside one `SearchNavigationProvider`, so a
filter change dims the grid rather than blanking the page. An empty result
with filters applied says so and offers _Clear filters_, which keeps the
district.

**F080 — search and sort.** `SearchToolbar` sits in the title row, per §3.3:
the search box (debounced, written to `?q=`) and the sort select. Both keep
every filter and go back to page one; the total beside the heading is the
response's `page.total`, never the length of the page.
