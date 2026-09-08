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
 * ## What is in the frame
 *
 * When the dealer's link named a place, the embed comes back as Google's own
 * **place card** — the dealership's name, its address, its rating and review
 * count, the zoom controls and a directions control, all inside the map. That
 * is the whole reason the URL is composed on the server (**R14**): the card is
 * what a buyer working out whether to drive there actually wants, and it costs
 * a place id rather than a plain `lat,lng`.
 *
 * A dealership whose link only ever gave coordinates gets the plain pin
 * instead. The card does not distinguish between them — it renders the frame it
 * is handed — because there is nothing useful it could do differently.
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

      <Blueprint className="min-h-[310px] flex-1 overflow-hidden bg-(--color-surface)">
        {address.embedUrl ? (
          <iframe
            /* Composed by the API, not here — see `embedUrlFor` in
               `platform/maps/maps-link.ts` for which of its shapes this is. */
            src={address.embedUrl}
            title={`Map showing ${brandName}${address.city ? ` in ${address.city}` : ''}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            /* Tall enough for the place card to sit above the pin without
               covering it. Google draws the card at a fixed size, so a 120px
               frame renders the name over the top of the yard it names. */
            className="h-full min-h-[220px] w-full border-0"
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
          className="btn btn-secondary btn-block mt-[10px]"
        >
          Get directions
        </a>
      ) : null}
    </section>
  );
}
