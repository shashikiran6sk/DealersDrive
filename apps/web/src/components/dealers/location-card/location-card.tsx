import type { DealerPublicProfile } from '@dealers-drive/contracts';

import { LOCATION_CARD_TEXT } from './location-card.constants';

export interface LocationCardProps {
  address: DealerPublicProfile['address'];
  brandName: string;
}

export function LocationCard({ address, brandName }: LocationCardProps) {
  return (
    <section className="card min-w-0 p-[14px]" aria-label={LOCATION_CARD_TEXT.location(brandName)}>
      <h2 className="eyebrow">{LOCATION_CARD_TEXT.heading}</h2>
      <address className="mt-3 text-[14px] not-italic leading-[1.7] [overflow-wrap:anywhere]">
        {address.full || LOCATION_CARD_TEXT.unavailable}
      </address>
      {address.mapsUrl ? (
        <a
          href={address.mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary btn-block mt-[10px]"
        >
          {LOCATION_CARD_TEXT.directions}
        </a>
      ) : (
        <p className="mt-3 text-[13px] ink-secondary">{LOCATION_CARD_TEXT.directionsUnavailable}</p>
      )}
    </section>
  );
}
