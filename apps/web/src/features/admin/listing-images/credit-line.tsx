import { PhotoCredit, type AdminVehicleImage } from '@dealers-drive/contracts';

import { setImageCreditAction } from '@/features/admin/listing-actions';

import { CREDIT_TEXT, LISTING_IMAGES_TEXT } from './listing-images.constants';

export interface CreditLineProps {
  listingId: string;
  image: AdminVehicleImage;
  editable: boolean;
}

export function CreditLine({ listingId, image, editable }: CreditLineProps) {
  const others = PhotoCredit.options.filter((credit) => credit !== image.credit);
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      {image.credit ? (
        <span className="ink-subtle">{CREDIT_TEXT[image.credit].tile}</span>
      ) : (
        <span className="font-semibold text-(--color-warn)">
          {LISTING_IMAGES_TEXT.creditUnknown}
        </span>
      )}
      {editable
        ? others.map((credit) => (
            <form key={credit} action={setImageCreditAction}>
              <input type="hidden" name="listingId" value={listingId} />
              <input type="hidden" name="mediaId" value={image.mediaId} />
              <input type="hidden" name="credit" value={credit} />
              <button
                type="submit"
                className="btn btn-ghost px-[6px] text-[11px]"
                aria-label={CREDIT_TEXT[credit].markAsLabel(image.position)}
              >
                {CREDIT_TEXT[credit].markAs}
              </button>
            </form>
          ))
        : null}
    </div>
  );
}
