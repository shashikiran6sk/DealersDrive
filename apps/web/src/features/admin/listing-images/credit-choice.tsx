import type { PhotoCredit } from '@dealers-drive/contracts';

import { CREDIT_OPTIONS, LISTING_IMAGES_TEXT } from './listing-images.constants';

export interface CreditChoiceProps {
  value: PhotoCredit | null;
  disabled: boolean;
  onChange: (credit: PhotoCredit) => void;
}

export function CreditChoice({ value, disabled, onChange }: CreditChoiceProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-[6px] border-0 p-0" disabled={disabled}>
      <legend className="mb-[4px] text-[12px] font-bold">{LISTING_IMAGES_TEXT.creditLegend}</legend>
      <div className="grid gap-[6px] sm:grid-cols-2">
        {CREDIT_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-[8px] rounded-[10px] border border-(--color-divider) p-[10px] has-[:checked]:border-(--color-ink)"
          >
            <input
              type="radio"
              name="photo-credit"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-[3px] accent-(--color-ink)"
            />
            <span className="flex flex-col">
              <span className="text-[13px] font-bold">{option.label}</span>
              <span className="text-[12px] ink-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
