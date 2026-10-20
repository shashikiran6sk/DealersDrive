# web / components/dealers/location-card

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealers/location-card/location-card.tsx`

### `export function LocationCard({ address, brandName }: LocationCardProps)`

DESIGN-SPEC §3.6: the third card in the portfolio's info row, with the yard's
address and the button that opens it in Google Maps.

**Since #279 there is no embedded map.** The card used to frame `address.embedUrl`
in a Google iframe. A Google frame discloses every visitor to Google on page load,
before they ask for anything. The legal consolidation removed it
(`docs/legal/CONSOLIDATION_AND_CONSENT.md`), and the API keeps `embedUrl: null` for
response compatibility. The address is printed as text instead. Directions are a
user-tapped external link, so Google learns about the visit only when the buyer
asks for directions.

The **button** is `address.mapsUrl`. The API builds it from the dealership's
validated coordinates, then from a complete public address, then from the dealer's
own validated share link, and never from a guessed pin. With none of these, the
card says directions are unavailable rather than inventing a location.

See [`docs/mobile/remediation/maps-investigation.md`](../../../../mobile/remediation/maps-investigation.md)
for the owner's §7.6 question about the Android app.
