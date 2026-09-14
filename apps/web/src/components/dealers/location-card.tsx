import type { DealerPublicProfile } from '@dealers-drive/contracts';

import { Blueprint, ImageSlot } from '@/components/ui/primitives';

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
            src={address.embedUrl}
            title={`Map showing ${brandName}${address.city ? ` in ${address.city}` : ''}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full min-h-[220px] w-full border-0"
          />
        ) : (
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
