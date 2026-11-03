# web / app/(public)/used-cars

Parent: [web/app/(public)](README.md)

## `apps/web/src/app/(public)/used-cars/[...segments]/page.tsx`

### `export default async function UsedCarsLandingPage(...)`

The SEO landing pages: `/used-cars/{town}` and `/used-cars/{place}/{facet}`,
where a place is a district or a town and a facet is a brand, a brand and
model, a fuel, a body type, a transmission or a price ceiling. Each is a search
`/cars` already answers, given an address and a title a buyer types — "used
diesel cars in Arcot", "used Maruti Suzuki cars in Ranipet". The vocabulary,
the threshold and the counts are in [`lib/landing`](../../lib.md) and the API's
[`search.landing`](../../../api/modules/search.md); this page renders the
answer.

**One catch-all route, not two folders.** `[place]` and `[place]/[facet]` would
share everything but one segment, and a page body shared between two route
files is a component with no sandbox entry. The catch-all takes both shapes and
`resolveLanding` refuses a third segment.

**Behind `feature.seoLandingPages`.** While the switch is off every address here
is a 404, and the landing read is not even asked for: turning it on is the
release, and turning it off withdraws the pages without a deployment.

**What each address answers.**

| Address                                                                                        | Answer                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/used-cars/{district}`                                                                        | **308** to `/cars?district={district}` — the district page that already ranks keeps its address and its canonical |
| `/used-cars/vellore` (a town named like its district)                                          | the same 308: the API folds such a town into its district                                                         |
| `/used-cars/{town}`, `/used-cars/{place}/{facet}`                                              | the page, `index` from two available cars, `noindex, follow` below                                                |
| a fixed facet with no car (`/used-cars/arcot/petrol`)                                          | the page with an empty state, `noindex` — a stale link is not a 404                                               |
| an unknown place, an unknown facet, a model with no car, a third segment, a page past the last | 404                                                                                                               |

**Indexing reads the live count.** The landing read is cached for five minutes;
the page's own search is the fresher of the two, so `index` is decided from its
`available`, not from the list. Every count is _available_ (R71): a page with
one available car and one reserved one says "1 Used Car" and is not indexed.

**The canonical is always the page itself**, `?page=N` included for a later
page, the same rule as the directories. Nothing that existed before this page
changed canonical.

**The breadcrumb is Home → Cars → district → town → the page**, visible and in
JSON-LD alike, so a result in search shows where the page sits. The district
crumb is `/cars?district=`, the page that represents the district.

**The intro is built from the search's own counts** — who lists the cars
(`facets.dealers`) and what is most listed (`facets.brands`, or
`facets.models` on a brand page). A page that only repeated its title would be
the thin page the two-car threshold is there to avoid; these sentences are
different on every page because the inventory is.

**"Filter and sort these cars"** links to the same search on `/cars`, which has
the panel, the sort and the chips. The landing page does not duplicate them:
`/cars` is the tool, this is the answer to one question.
