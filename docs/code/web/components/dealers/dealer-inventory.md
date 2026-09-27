# web / components/dealers/dealer-inventory

Parent: [web/components/dealers](README.md)

## `apps/web/src/components/dealers/dealer-inventory/dealer-inventory.tsx`

### `export function DealerInventory(...)`

The portfolio's inventory (**R48**, DESIGN-SPEC §3.6). It renders the same
`VehicleCard` as `/cars` in its `compact` variant, which is §2.8's portfolio
card: the dealer strip is left off because on the dealer's own page it only
repeats the header above it. Nothing else about the card changes, and there is
no second card component.

It computes nothing: the cards, the total and the paging arrive from the API.
An empty inventory is a plain statement — "No vehicles currently available." —
with a way to the rest of the marketplace, never a count that cannot be
clicked through.

**F086 part 2 — filtered through the same engine.** The inventory is
`GET /v1/dealers/:slug/vehicles`, which runs the marketplace's own `search()`
fixed to this dealership (#168). So the filters, the counts and the sorts are
the ones `/cars` has, and there is no second filtering engine to drift from
the first. The rail is §3.6's — "Filter inventory", 234px, sticky — using the
same `FilterPanel` with `PORTFOLIO_FILTER_GROUPS`; below `lg` it is the same
`MobileFilterSheet`; the heading row carries the sort (no search box, as the
spec and the legacy's `showSearch={false}` had it).

**The place is a fact here, not a filter.** Town, district and state are fixed
by the dealership, so they are not controls — `readVehicleSearch(query,
'dealer')` never reads them, the API refuses them, and the facets carry no
towns or dealers, so no count on this page can describe another yard. What the
page does say is where the cars are: "Every car here is at Arcot, Ranipet,
Tamil Nadu", from the dealership's own address.

### `const total = filtered ? Math.max(liveTotal, page.total) : page.total`

"n of m cars" once something is filtered: `n` is the response's total, `m` the
dealership's live count off its profile — the same predicate, so they agree.
Unfiltered, the page total _is_ the live count and is used directly, so a
profile served from an older cache cannot make the heading disagree with the
grid.

### `hasStock`

A yard with nothing live gets no rail and no sort — filters over nothing are a
control that can only lead to the same empty state.

## `apps/web/src/components/dealers/dealer-inventory/utils.ts`

### `export function pageHref(dealerSlug, params, page)`

Every filter rides along to the next page, and the `#inventory` anchor keeps
the buyer at the grid rather than back at the cover photograph.
