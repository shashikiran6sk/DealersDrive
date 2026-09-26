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
