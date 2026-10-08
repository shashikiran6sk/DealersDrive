'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DealerPublicProfile } from '@dealers-drive/contracts';

import { Blueprint, ImageSlot } from '@/components/ui/primitives';

import { LOCATION_CARD_TEXT } from './location-card.constants';

export interface LocationCardProps {
  address: DealerPublicProfile['address'];
  brandName: string;
}

export function LocationCard({ address, brandName }: LocationCardProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <section className="card p-[14px]">
      <h2 className="eyebrow">{LOCATION_CARD_TEXT.heading}</h2>

      <Blueprint className="min-h-[310px] flex-1 overflow-hidden bg-(--color-surface)">
        {address.embedUrl && loaded ? (
          <iframe
            src={address.embedUrl}
            title={LOCATION_CARD_TEXT.mapTitle(brandName, address.city ?? undefined)}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full min-h-[220px] w-full border-0"
          />
        ) : address.embedUrl ? (
          <div className="flex min-h-[310px] flex-col items-start justify-center gap-4 p-5">
            <p className="text-[13px] leading-[1.8]">
              Load the map to share your browser and network information with Google. Google may use
              its own cookies. You can use directions below instead.
            </p>
            <Button variant="secondary" onClick={() => setLoaded(true)}>
              Load Google Maps
            </Button>
          </div>
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
