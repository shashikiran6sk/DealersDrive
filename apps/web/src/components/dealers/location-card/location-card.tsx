import type { DealerPublicProfile } from '@dealers-drive/contracts';

import { Blueprint, ImageSlot } from '@/components/ui/primitives';

import { LOCATION_CARD_TEXT } from './location-card.constants';

export interface LocationCardProps {
  address: DealerPublicProfile['address'];
  brandName: string;
}

/**
 * DESIGN-SPEC §3.6 — the third card in the portfolio's info row: a map of the
 * yard, and the button that opens it in Google Maps.
 *
 * The **button** is `address.mapsUrl` (**R6**), the link the dealer pasted. The
 * **map** is `address.embedUrl`, which the API composes from what that link
 * turned out to carry — a `maps.app.goo.gl` share link carries neither a pin nor
 * a place until it is followed. So the card renders whichever halves it has, and
 * the button is never blocked on the map.
 *
 * Neither is ever composed from the typed address: a typed address is several
 * pins in one district, and a map confidently centred on the wrong one sends a
 * buyer to somebody else's gate and looks authoritative doing it.
 *
 * An iframe rather than a static image because the Static API needs a key in
 * every environment, billed per view of a page built to be crawled — and the
 * embed pans and zooms. The frame is Google's, so a visitor is disclosed to
 * Google on load; `loading="lazy"` keeps that to visitors who scroll to it.
 */
export function LocationCard({ address, brandName }: LocationCardProps) {
  return (
    <section className="card p-[14px]">
      <h2 className="eyebrow">{LOCATION_CARD_TEXT.heading}</h2>

      <Blueprint className="min-h-[310px] flex-1 overflow-hidden bg-(--color-surface)">
        {address.embedUrl ? (
          <iframe
            /* Composed by the API — see `embedUrlFor` in `platform/maps/maps-link.ts`. */
            src={address.embedUrl}
            title={LOCATION_CARD_TEXT.mapTitle(brandName, address.city ?? undefined)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            /* Tall enough for Google's fixed-size place card to sit above the
               pin rather than over the yard it names. */
            className="h-full min-h-[220px] w-full border-0"
          />
        ) : (
          /* The dealer's link carried no pin and no place, and could not be
             followed to either. "Get directions" below still works. */
          <ImageSlot label={LOCATION_CARD_TEXT.mapPlaceholder} />
        )}
      </Blueprint>

      {address.mapsUrl ? (
        <a
          href={address.mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary btn-block mt-[10px]"
        >
          {LOCATION_CARD_TEXT.directions}
        </a>
      ) : null}
    </section>
  );
}
