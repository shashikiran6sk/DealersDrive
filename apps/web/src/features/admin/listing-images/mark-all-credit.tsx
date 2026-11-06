import { PhotoCredit, type AdminVehicleImage } from '@dealers-drive/contracts';

import { Button } from '@/components/ui/button';

import { CREDIT_TEXT, LISTING_IMAGES_TEXT } from './listing-images.constants';

export interface MarkAllCreditProps {
  items: readonly AdminVehicleImage[];
  disabled: boolean;
  marking: PhotoCredit | null;
  onMark: (credit: PhotoCredit) => void;
}

export function MarkAllCredit({ items, disabled, marking, onMark }: MarkAllCreditProps) {
  const choices = PhotoCredit.options.filter((credit) =>
    items.some((image) => image.credit !== credit),
  );
  if (items.length === 0 || choices.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="ink-subtle">{LISTING_IMAGES_TEXT.markAll(items.length)}</span>
      {choices.map((credit) => (
        <Button
          key={credit}
          type="button"
          size="sm"
          loading={marking === credit}
          disabled={disabled}
          aria-label={CREDIT_TEXT[credit].markAllLabel(items.length)}
          onClick={() => onMark(credit)}
        >
          {CREDIT_TEXT[credit].markAll}
        </Button>
      ))}
    </div>
  );
}
