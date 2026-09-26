import type { AdminVehicleImage } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import { removeListingImageAction } from '@/features/admin/listing-actions';

import { LISTING_IMAGES_TEXT } from './listing-images.constants';

export interface ImageTileProps {
  listingId: string;
  image: AdminVehicleImage;
  editable: boolean;
}

export function ImageTile({ listingId, image, editable }: ImageTileProps) {
  return (
    <li className="flex min-w-0 flex-col gap-[6px] border border-(--color-divider) bg-white p-[6px]">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={LISTING_IMAGES_TEXT.alt(image.position, image.isPrimary)}
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
        {image.isPrimary ? (
          <span className="absolute top-[6px] left-[6px]">
            <StatusTag tone="ok">{LISTING_IMAGES_TEXT.primary}</StatusTag>
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="ink-subtle tnum">{LISTING_IMAGES_TEXT.position(image.position)}</span>
        {editable ? (
          <form action={removeListingImageAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="mediaId" value={image.mediaId} />
            <button
              type="submit"
              className="btn btn-ghost text-[11px] text-(--color-err)"
              aria-label={LISTING_IMAGES_TEXT.removeLabel(image.position)}
            >
              {LISTING_IMAGES_TEXT.remove}
            </button>
          </form>
        ) : null}
      </div>
      {image.fileName ? (
        <span className="truncate text-[11px] ink-faint" title={image.fileName}>
          {image.fileName}
        </span>
      ) : null}
    </li>
  );
}
