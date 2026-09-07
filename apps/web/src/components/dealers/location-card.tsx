import type { DealerPublicProfile } from '@dealers-drive/contracts';

import { Blueprint, ImageSlot } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §3.6 — the third card in the portfolio's info row: a map of the
 * yard, and the button that opens it in Google Maps.
 *
 * ## Two independent things, and neither implies the other
 *
 * The **button** is `address.mapsUrl` (**R6**) — the link the dealer pasted,
 * rendered as an anchor and nothing more. The **map** is `address.embedUrl`,
 * which the API composes from what that link turned out to carry. A dealership
 * can have the link and no map: a `maps.app.goo.gl` share link carries neither
 * a pin nor a place until it is followed, and following it is best-effort. So
 * the card renders whichever halves it has, and the button is never blocked on
 * the map.
 *
 * Neither is ever composed from the typed address. A typed address is several
 * pins in one district, and a map confidently centred on the wrong one is
 * worse than the slot it would replace — it sends a buyer to somebody else's
 * gate and looks authoritative doing it.
 *
 * ## What is in the frame, and the size it needs (R22)
 *
 * When the dealer's link named a place, the embed *can* come back as Google's
 * own **place card** — the dealership's name, its address, its rating and
 * review count, and a directions control, all inside the map. That is the whole
 * reason the URL is composed on the server (**R14**).
 *
 * It is not enough to ask for it. **Google draws the card only in a frame of at
 * least 400 × 300 CSS pixels**, and collapses it to a small "Open in Maps"
 * button in anything smaller. Those two numbers are measured, not documented:
 * the same place embed was rendered at a ladder of sizes and the card appears
 * at 400 × 300 and disappears at 384 × 320 and at 400 × 295.
 *
 * That is why this is a full-width block rather than the third card in the
 * info row. At a third of a 1280px page the frame is 372px wide — 400px of
 * column less this card's own 14px of padding on each side — so **every**
 * dealership on the platform got the button, whatever their link said. The map
 * was correct, the place id was correct, and the one thing R14 exists to show
 * was the thing the layout made impossible.
 *
 * Below `md` the frame is narrower than 400 whatever we do, so the button is
 * what a phone gets. That is Google's fallback and a reasonable one: it opens
 * the listing, rating and all, in the app that has it.
 *
 * A dealership whose link only ever gave coordinates gets the plain pin
 * instead, at any size. The card does not distinguish between them — it renders
 * the frame it is handed — because there is nothing useful it could do
 * differently.
 *
 * ## Why an iframe rather than a picture
 *
 * A static image would need the Maps Static API and therefore a key in every
 * environment, billed per view of a page built to be crawled. The embed is
 * keyless, and it pans and zooms — which is what somebody trying to work out
 * whether they can park actually wants.
 *
 * The frame is Google's, so a visitor to a portfolio is disclosed to Google.
 * That is true of the "Get directions" button the moment it is pressed; the
 * map makes it true on load instead, which is the cost of drawing one at all.
 * `loading="lazy"` at least keeps it to visitors who scroll to it.
 */
export function LocationCard({
  address,
  brandName,
}: {
  address: DealerPublicProfile['address'];
  brandName: string;
}) {
  return (
    <section className="card p-[14px]">
      <h2 className="eyebrow">Location</h2>

      {/*
        360px, not 220 (**R22**). The frame has to clear 400 × 300 for Google to
        draw the place card at all — see the note above — and 360 leaves the
        card room to sit above the pin rather than over it. Below `md` no width
        clears 400, so the height comes back down to something a thumb can
        scroll past.
      */}
      <Blueprint className="h-[360px] flex-1 overflow-hidden bg-(--color-surface) max-md:h-[260px]">
        {address.embedUrl ? (
          <iframe
            /* Composed by the API, not here — see `embedUrlFor` in
               `platform/maps/maps-link.ts` for which of its shapes this is. */
            src={address.embedUrl}
            title={`Map showing ${brandName}${address.city ? ` in ${address.city}` : ''}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            /* Fills the frame the `Blueprint` sets, which is what carries the
               400 × 300 minimum (R22). */
            className="h-full w-full border-0"
          />
        ) : (
          /* Nothing to draw: the dealer's link carried no pin and no place, and
             could not be followed to either. The slot names what is missing,
             and "Get directions" below still works. */
          <ImageSlot label="Map — dealership location" />
        )}
      </Blueprint>

      {address.mapsUrl ? (
        <a
          href={address.mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          /* `max-w` so the button does not stretch to the full width of the
             page now that the card is one (R22) — a 1232px "Get directions" is
             a target nobody is going to miss and nobody wants to look at. */
          className="btn btn-secondary btn-block mt-[10px] md:max-w-[280px]"
        >
          Get directions
        </a>
      ) : null}
    </section>
  );
}
