# api / modules/search

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

The public marketplace (**F075**, **F077**, as scoped by **R45**). Search,
filters and facets (**F076**), the `listing_search` read model and similar
cars are deferred; what is here is the list a buyer browses and, with F082,
the page for one car.

## `apps/api/src/modules/search/search.repository.ts`

### `export const PUBLIC_LISTING_WHERE`

The only definition of "a buyer may see this": an `ACTIVE` listing, with a
public slug, of an `ACTIVE` dealership. Every public query in the module goes
through it, so a listing in review, sent back, rejected, sold or removed — and
every listing of a suspended dealership — is **absent**, never greyed.

In this phase a sold car is not public either. Rule 6's "a sold car stays on
the marketplace, greyed" belongs to the search read model, which is deferred;
until it exists the product says only what it is sure of: ACTIVE means
available.

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
`PUBLIC_LISTING_WHERE` plus the slug, so the page exists exactly when the card
does. Anything else — a listing in review, sent back, rejected, sold, removed,
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
whose listing matches `PUBLIC_LISTING_WHERE` — count and cheapest price per
dealership — and one lookup of the slugs it found: two queries whatever the
number of dealerships, never one per card. It uses the same predicate as the
public list, not a second `status = ACTIVE`, which is the whole point.

### `export function publicListingsOf(scope)` — and `async dealerVehicles(slug, query)`

One dealership's cars (**R48**), for the portfolio. The predicate is
`PUBLIC_LISTING_WHERE` narrowed by the dealership's slug — the dealer clause is
extended, not replaced, so "the dealership is ACTIVE" still holds — and the
page and its total come from the same code path as `GET /v1/vehicles`. A slug
that is not a listed dealership is `404 DEALER_NOT_FOUND`, so a suspended
dealership's portfolio cannot be read through this route either; a listed one
with nothing live is an empty page.

**R50** made the argument a `ListingScope` — `{ dealerSlug?, districts? }` —
because the marketplace list gained a scope of its own. Both narrow the same
dealer clause; neither replaces it.

### `async districtNames(slug)` — and the district scope on `vehicles(query)`

`GET /v1/vehicles?district=ranipet` (**R50**). A district is where the
dealership is; a car has no location of its own, and none is copied onto it.

The URL carries a **slug** and the column holds the name the dealer typed
(normalised on write by `normaliseLocality`). The slug is `slugify(name)`,
which is also what `/v1/locations` and the directory key their chips by, so
the way back is to ask which district names the listed dealerships carry and
keep the ones whose slug matches — the same derivation, run the other way,
rather than a second slug rule written in SQL that could disagree with it
(`slugify` normalises Unicode, which a `regexp_replace` would not).

An unknown district resolves to **no names**, and `district IN ()` is an empty
page. It must never resolve to "no filter": `?district=atlantis` answering with
every car on the platform would be a scope that silently does nothing.

`DealerVehicleQuery` is the portfolio's own schema and has no `district`: the
dealership already fixes where its cars are, so a district there could only
agree with it or empty the page, and `.strict()` turns it into a 400.
