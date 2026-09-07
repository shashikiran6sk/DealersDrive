import type { DealerPublicProfile } from '@dealers-drive/contracts';

import { Blueprint, ImageSlot } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §3.6 — the third card in the portfolio's info row: a map of the
 * yard, and the button that opens it in Google Maps.
 *
 * ## Two independent things, and neither implies the other
 *
 * The **button** is `address.mapsUrl` (**R6**) — the link the dealer pasted,
 * rendered as an anchor and nothing more. The **map** is `address.geo`, the
 * coordinates the API read out of that link at write time. A dealership can
 * have the link and no coordinates: a `maps.app.goo.gl` share link carries
 * none until it is followed, and following it is best-effort. So the card
 * renders whichever halves it has, and the button is never blocked on the map.
 *
 * Neither is ever composed from the typed address. A typed address is several
 * pins in one district, and a map confidently centred on the wrong one is
 * worse than the slot it would replace — it sends a buyer to somebody else's
 * gate and looks authoritative doing it.
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

      <Blueprint className="min-h-[120px] flex-1 overflow-hidden bg-(--color-surface)">
        {address.geo ? (
          <iframe
            // `q` is the pin and `z` the zoom; `output=embed` is the keyless
            // renderer. Coordinates rather than a place name, because the
            // coordinates are what was resolved and a name would be re-searched.
            src={`https://www.google.com/maps?q=${address.geo.lat},${address.geo.lng}&z=16&output=embed`}
            title={`Map showing ${brandName}${address.city ? ` in ${address.city}` : ''}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full min-h-[120px] w-full border-0"
          />
        ) : (
          /* No coordinates: the dealer's link carried none and could not be
             followed to any. The slot names what is missing, and "Get
             directions" below still works. */
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
