import type { DealerPublicProfile } from '@dealers-drive/contracts';

import { Blueprint, ImageSlot } from '@/components/ui/primitives';

import { LOCATION_CARD_TEXT } from './location-card.constants';

export interface LocationCardProps {
  address: DealerPublicProfile['address'];
  brandName: string;
}

export function LocationCard({ address, brandName }: LocationCardProps) {
  return (
    <section className="card p-[14px]">
      <h2 className="eyebrow">{LOCATION_CARD_TEXT.heading}</h2>

      <Blueprint className="min-h-[310px] flex-1 overflow-hidden bg-(--color-surface)">
        {address.embedUrl ? (
          <iframe
            src={address.embedUrl}
            title={LOCATION_CARD_TEXT.mapTitle(brandName, address.city ?? undefined)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full min-h-[220px] w-full border-0"
          />
        ) : (
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
