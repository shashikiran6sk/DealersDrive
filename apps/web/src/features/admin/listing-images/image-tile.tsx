import type { AdminVehicleImage } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import {
  removeListingImageAction,
  reorderListingImagesAction,
  setPrimaryImageAction,
} from '@/features/admin/listing-actions';

import { LISTING_IMAGES_TEXT } from './listing-images.constants';

export interface ImageTileProps {
  listingId: string;
  image: AdminVehicleImage;
  editable: boolean;
  earlier: string[] | null;
  later: string[] | null;
}

function MoveButton({
  listingId,
  order,
  label,
  children,
}: {
  listingId: string;
  order: string[];
  label: string;
  children: string;
}) {
  return (
    <form action={reorderListingImagesAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="order" value={order.join(',')} />
      <button type="submit" className="btn btn-ghost px-[6px] text-[12px]" aria-label={label}>
        {children}
      </button>
    </form>
  );
}

export function ImageTile({ listingId, image, editable, earlier, later }: ImageTileProps) {
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
      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
        <span className="ink-subtle tnum">{LISTING_IMAGES_TEXT.position(image.position)}</span>
        {editable ? (
          <div className="flex items-center">
            {earlier ? (
              <MoveButton
                listingId={listingId}
                order={earlier}
                label={LISTING_IMAGES_TEXT.moveEarlierLabel(image.position)}
              >
                {LISTING_IMAGES_TEXT.moveEarlier}
              </MoveButton>
            ) : null}
            {later ? (
              <MoveButton
                listingId={listingId}
                order={later}
                label={LISTING_IMAGES_TEXT.moveLaterLabel(image.position)}
              >
                {LISTING_IMAGES_TEXT.moveLater}
              </MoveButton>
            ) : null}
          </div>
        ) : null}
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-1">
          {image.isPrimary ? (
            <span />
          ) : (
            <form action={setPrimaryImageAction}>
              <input type="hidden" name="listingId" value={listingId} />
              <input type="hidden" name="mediaId" value={image.mediaId} />
              <button
                type="submit"
                className="btn btn-ghost text-[11px]"
                aria-label={LISTING_IMAGES_TEXT.makePrimaryLabel(image.position)}
              >
                {LISTING_IMAGES_TEXT.makePrimary}
              </button>
            </form>
          )}
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
        </div>
      ) : null}
      {image.fileName ? (
        <span className="truncate text-[11px] ink-faint" title={image.fileName}>
          {image.fileName}
        </span>
      ) : null}
    </li>
  );
}
