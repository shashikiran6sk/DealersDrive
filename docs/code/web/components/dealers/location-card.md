# web / components/dealers/location-card

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealers/location-card/location-card.tsx`

### `export function LocationCard({ address, brandName }: LocationCardProps)`

DESIGN-SPEC §3.6 — the third card in the portfolio's info row: a map of the
yard, and the button that opens it in Google Maps.

The **button** is `address.mapsUrl` (**R6**), the link the dealer pasted. The
**map** is `address.embedUrl`, which the API composes from what that link
turned out to carry — a `maps.app.goo.gl` share link carries neither a pin nor
a place until it is followed. So the card renders whichever halves it has, and
the button is never blocked on the map.

Neither is ever composed from the typed address: a typed address is several
pins in one district, and a map confidently centred on the wrong one sends a
buyer to somebody else's gate and looks authoritative doing it.

An iframe rather than a static image because the Static API needs a key in
every environment, billed per view of a page built to be crawled — and the
embed pans and zooms. The frame is Google's, so a visitor is disclosed to
Google on load; `loading="lazy"` keeps that to visitors who scroll to it.

### `src={address.embedUrl}`

Composed by the API — see `embedUrlFor` in `platform/maps/maps-link.ts`.

### `className="h-full min-h-[220px] w-full border-0"`

Tall enough for Google's fixed-size place card to sit above the
pin rather than over the yard it names.

### `<ImageSlot label={LOCATION_CARD_TEXT.mapPlaceholder} />`

The dealer's link carried no pin and no place, and could not be
followed to either. "Get directions" below still works.
