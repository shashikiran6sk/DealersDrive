# api / modules/search

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

The public marketplace (**F075**, **F077**, as scoped by **R45**) and its
search (**F076**): the list a buyer browses — filtered, sorted, counted — and,
with F082, the page for one car. The `listing_search` read model and similar
cars are still deferred; the search reads the live tables through the two
public predicates below (**R71**).

## `apps/api/src/modules/search/search.repository.ts`

### `export const PUBLIC_VISIBLE_LISTING_WHERE` · `export const PUBLIC_AVAILABLE_LISTING_WHERE`

The only two definitions of what a buyer meets (**R71**, which replaced R47's
single `PUBLIC_LISTING_WHERE`). Both require a public slug and an `ACTIVE`
dealership.

- **Visible** is `ACTIVE` or `RESERVED`: what may appear. The result list and
  the vehicle page use it, and nothing else.
- **Available** is `ACTIVE`: what a buyer can act on. Every count uses it —
  the facets, the response's `available`, suggestions, the directory's and the
  district dialog's car counts — and so does the enquiry guard in another
  module.

The split is rule 6's, with `RESERVED` in the role the baseline gave a sold
car: shown, greyed, sorted last, and never counted. A sold or withdrawn car is
now simply absent. The same rule is `isListingPubliclyVisible` /
`isListingAvailable` in contracts, for code that has a status rather than a
query (the media route, the enquiry links).

`publicListingWhere(rule)` picks one. `listingWhere(dealerIds, rule)` in
`search.filters.ts` defaults to `'available'`, so a new count written without
thinking about it counts stock, and only the result list passes `'visible'`.

## `apps/api/src/modules/search/search.filters.ts`

### `export function orderOf(sort)`

Every sort starts with `status asc`. `RESERVED` is declared right after
`ACTIVE` in the Postgres enum, and Postgres orders an enum by declaration, so
available cars come first and reserved ones after them, whatever the chosen
sort. A reserved card never pushes an available one onto page two.

### `export const cardInclude`

Reads the primary image through `vehicle_media` (`isPrimary`), not the first by
position: the admin chooses the primary separately from the order (F035).

## `apps/api/src/modules/search/search.mapper.ts`

### `export function toVehicleCard(row: CardRow): VehicleCardDto`

Built field by field, never spread from the row: the card carries the public
slug and presentation strings only. No listing, vehicle or dealer id, no
registration number, no decision, audit, photography or checklist field, no
storage key and no phone number reaches it. The image URL is the public media
route by media id and width; `GET /media/by-media/…` serves it only while the
listing is ACTIVE.

The meta row drops what is unknown rather than printing an empty separator.

## `apps/api/src/modules/search/search.service.ts`

### `async vehicles(query)`

Offset pagination, newest approval first (`publishedAt desc, id desc` — the id
breaks ties so a page boundary is stable). The directory is offset-paged for
the same reason: a buyer's list is linked page by page and shared, and a page
number is what a link can carry.

## `apps/api/src/modules/search/routes/get-vehicles.ts`

### `res.set('Cache-Control', 'public, max-age=60')`

A minute, not the directory's five: an approval should appear on the
marketplace promptly. The web app additionally revalidates its `vehicles` tag
when a moderator approves.

### `async vehicle(slug)` — and `toPublicVehicleDetail`

One car's public page (**F082** as scoped by **R45**). The query is the same
`PUBLIC_VISIBLE_LISTING_WHERE` plus the slug, so the page exists exactly when
the card does — a reserved car included, marked with `availability`, because a
buyer holding its link should learn it is reserved rather than meet a 404.
Anything else — a listing in review, sent back, rejected, sold, withdrawn,
one of a suspended dealership, a slug that never existed, or a listing or
vehicle **id** — is the same `404 VEHICLE_NOT_FOUND` with the same sentence: the
response says nothing about whether a car exists behind it.

The gallery is every attached image in the admin's order, with `primaryIndex`
naming the one to open on; order and primary are separate decisions (F035), and
the page honours both. Images are the public media route at 1024 px wide.

The registration is shown only as its RTO ("TN 23"). The full number identifies
an owner, not a car, and nothing about deciding to enquire needs it. As on the
card, there is no phone number: rule 7 keeps it behind the rate-limited reveal
route, which is not built, so the page carries none.

## `apps/api/src/modules/search/search.stats.ts`

### `export function createPublicInventoryStats(prisma)`

The dealer directory's and the portfolio's car counts (**R48**), implementing
the dealers module's `DealerInventoryStats` port. One `groupBy` over vehicles
whose listing matches `PUBLIC_AVAILABLE_LISTING_WHERE` — count and cheapest price per
dealership — and one lookup of the slugs it found: two queries whatever the
number of dealerships, never one per card. It uses the same predicate as the
public list, not a second `status = ACTIVE`, which is the whole point.

### `async dealerVehicles(slug, query)`

One dealership's cars (**R48**), for the portfolio — and since **F076** through
**the same `search()`** as the marketplace, with the location scope fixed to
that one dealership (`oneDealerScope`). There is no second filtering engine to
drift from the first. A slug that is not a listed dealership is
`404 DEALER_NOT_FOUND`, so a suspended dealership's portfolio cannot be read
through this route either; a listed one with nothing live is an empty page.
`cities` and `dealers` are never computed for it: a count of the town or of the
dealership would be a count of itself, and computing either at all would be a
query that could only leak another dealership.

## `apps/api/src/modules/search/search.service.ts` — the search (F076)

### `async function search(query, scope, location)`

One query shape for both routes: resolve the slugs, build one `where`, then
read the page, the total and the facets in parallel. The total is its own
`count` over exactly the page's `where`, never the page's length.

The number of queries is **fixed, not proportional to anything**: the page,
the total, one grouped read per facet, one count per range preset, plus the
public dealerships (for the location scope) and — only when a brand, model or
colour is being filtered — the vocabulary. No query per dealership, per card
or per option: the town and dealer facets both come out of one grouped read
by `dealerId`.

### `async function facetsOf(...)`

Standard faceted-search semantics, and deliberately so: **each group is
counted under every filter except its own** (`inventoryWhere(filters, ids,
[key])`). Counting a group under itself would zero every sibling of the first
box ticked, and a multi-select would be unusable after one click.

The two dependent exceptions:

- **brands** is counted without the model filter too (`['brand', 'model']`) —
  a model belongs to one brand, so ticking Creta must not hide Kia;
- **models** is counted _with_ the brand filter, and not at all until a brand
  (or a model, arriving by a shared link) is in the query. A list of every
  model on the platform is not a filter anybody can read.

The **town and dealer facets** come from one grouped read by dealership over
the _district_ (`scopeIds`), not over the result: the town counts apply the
dealer filter, and the dealer counts apply the town filter, in memory. Towns
are offered only once a district is chosen — with every district in scope they
would be every town on the platform, which is R23's argument about the
directory's chips.

## `apps/api/src/modules/search/search.filters.ts`

### `export function resolveFilters(query, vocabulary)`

The URL carries **slugs**; make, model, colour, town and district are columns
of text a dealer typed. The way back is to ask which spellings are live and
keep the ones whose `slugify` matches — the same function that keys the
facets, so whatever a facet offers is exactly what the filter accepts. Two
consequences worth keeping:

- spellings that differ only in case or punctuation (`Maruti Suzuki`,
  `MARUTI SUZUKI`) are **one** brand to a buyer, which is the write-time
  normalisation (F060) finished at read time rather than left to fragment;
- a slug nobody carries resolves to **no spellings**, and `make IN ()` is an
  empty page. It must never resolve to "no filter".

It is not a second slug rule written in SQL: `slugify` normalises Unicode,
which a `regexp_replace` would not, and two rules would eventually disagree.

### `function wordMatch(word)`

Every word of `q` must match the make, model, variant or the dealership's name,
case-insensitively (`ILIKE`, parameterised by Prisma). Words rather than the
whole string, so spacing does not matter and `creta sx` is a Creta in an SX
trim rather than the literal substring. The registration, the description and
anything else private is never searched — a public search over the plate would
be a lookup of whose car it is.

### `export function vehicleWhere(filters, omit)`

`omit` is how a facet leaves its own group out. Owners' fourth bucket is
**four or more** (`ownerCount >= 4`), so a fifth-owner car is found somewhere.

### `export function orderOf(sort)`

Every sort ends on `publishedAt desc, id desc`, so two cars with the same price
cannot swap places between page 1 and page 2. A car missing the sort key
(`nulls: 'last'`) comes after every car that has one — "cheapest first" should
not open on the cars whose price is on request.

## `apps/api/src/modules/search/search.facets.ts`

### `export function locationScope(dealers, query)`

Location is always **the dealership's**: a car has no location of its own, and
none is copied onto it. So district, town and dealer all reduce to one set of
dealership ids, and the listing query is `dealerId IN (…)`. With none of the
three in the query there is no set at all (`null`) — "every dealership" is not
spelled as a list of every dealership.

A town or dealer from another district is excluded by construction: the result
set is filtered from the district's dealerships, never added to it.

### `function withSelected(options, selected)`

A ticked value with nothing behind it is still offered, at zero — it arrives by
a shared link, or its last car sells — so it can be seen and unticked instead
of silently filtering the page to nothing.

### `function mostCommon(spellings)`

A facet's label is the spelling most of its cars carry, ties broken
alphabetically so the label cannot flicker between requests.

## `apps/api/src/modules/search/search.repository.ts` — the search reads

### `publicDealers()`

Every listed dealership's id, slug, name, town and district: the location scope
is worked out from these rather than by joining text columns in SQL. It is the
same read the directory already makes per request (`listActive`).

### `vocabulary()`

The live make/model pairs and colours, read only when a brand, model or colour
filter has to be resolved. Its size is the catalogue's, not the inventory's.

### `byMake(where)` … `byDealer(where)`

One method per column rather than one generic `group(field)`: Prisma's
`groupBy` does not type a `by` that is a type parameter, and the alternative is
an assertion on every row.

### `colorFacet(rows)` — R52

Colour is no longer text a dealer typed but one of twelve families
(`VehicleColor`), so the colour filter is an enum like fuel: the URL carries
`color=white,red`, no vocabulary is read to resolve it, and the facet lists
**all twelve families, in one fixed order, zeros included**. The panel then
shows the same twelve options the listing form offers, whatever the inventory
holds — a zero is a family nothing is in right now, not a missing option.

## `apps/api/src/modules/search/search.suggest.ts` — the car typeahead (R54)

### `export function suggestWhere(search, dealerIds)`

Every typed word must appear in the make, the model or the variant of a public
car in scope. The dealership's name is deliberately not searched, unlike `q`:
a row names a make, model or variant, and a car found by its yard's name would
put a row in the list whose label does not contain what was typed.

### `export function rankSuggestions(rows, search, limit)`

One `groupBy` over make, model and variant gives every distinct triple with its
count, and the brand, model and variant rows are folded from those in memory.
The rows are bounded by the distinct models in scope, not by the cars.

Spellings that slug alike are **one row** (`Maruti Suzuki`, `MARUTI SUZUKI`),
labelled with the commonest spelling, because the filter a row writes is the
slug and the slug already treats them as one. Model and variant labels use the
brand's label for the make, so one brand reads one way down the list.

A row matches only if every word is in its **label** — "hyundai cre" is Hyundai
Creta, never Hyundai alone. Label-prefix beats word-prefix beats anywhere, then
brand beats model beats variant, then more cars, then alphabetical: the order is
total, so the same request always answers in the same order.

Only the place narrows it, never the other filters: choosing a row _replaces_
the brand and model, so counting under the current ones would hide exactly what
a buyer is typing to reach.

## `apps/api/src/modules/search/search.similar.ts`

### `export function similarityScore(source, candidate)`

Similar vehicles (**R73**, landing F084) are a small deterministic score, not
a model:

| Trait in common               | Weight |
| ----------------------------- | ------ |
| Same model (of the same make) | +4     |
| Same make                     | +3     |
| Same body type                | +3     |
| Same district                 | +2     |
| Price within ±20%             | +2     |
| Same fuel                     | +1     |
| Same transmission             | +1     |
| Manufacturing year within ±2  | +1     |

A model name only counts under the same make, so a "Creta" typed by another
brand's dealer scores nothing. Make and model compare case-insensitively
because they are dealer-typed text (D1, R46). An unknown value never matches
anything, not even another unknown.

The weights come from the brief. The domain data gives no reason to move them:
make, model and body type are the fields a buyer filters on first, and district
is the only location a car has. They sit in one exported table, so tuning them
is one line, and the tests assert each weight separately.

### `export function rankSimilar(source, candidates, traitsOf, limit)`

Ties are broken by the closer price, then the newer listing, then the id, so
the same inputs give the same order in any arrival order. A test reverses the
pool to prove it. The source itself is skipped even if the pool returns it.

## `apps/api/src/modules/search/search.repository.ts` — similar vehicles

### `export function similarPoolWhere(source)`

The candidate pool is **available** cars only (`PUBLIC_AVAILABLE_LISTING_WHERE`):
a suggestion must lead somewhere a buyer can act, so reserved, sold and
withdrawn cars are never candidates. The pool excludes the source and takes
anything sharing the make, the body type, the district, or a ±35% price band.
That is wider than the ±20% that scores, so a car scoring on price is always
in the pool. It keeps the newest 120, then ranks in memory: one indexed query,
no per-candidate work, and no full scan of the marketplace.

### `async similarSource(slug)` · `async newestAvailable(excludeIds, take)`

The source may be `ACTIVE` or `RESERVED`, because a reserved car's page still
shows suggestions. Anything else is the same 404 the page gives. When fewer
than four candidates exist, the service fills the rest with the newest other
available cars, excluding the source and those already chosen. That is the
last step of broadening: same model, then same make, body type, price and
district through the score, then anything on sale. So the section is never
empty while the marketplace is not.
