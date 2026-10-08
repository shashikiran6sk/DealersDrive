import { Blueprint } from '@/components/ui/primitives';

import { PRICE_BLOCK_TEXT } from './price-block.constants';

export interface PriceBlockProps {
  priceLabel: string | null;
  negotiabilityLabel: string | null;
}

export function PriceBlock({ priceLabel, negotiabilityLabel }: PriceBlockProps) {
  return (
    <Blueprint className="flex flex-col gap-[6px] bg-white p-5">
      <span className="text-[11px] font-bold tracking-[0.12em] uppercase ink-subtle">
        {PRICE_BLOCK_TEXT.eyebrow}
      </span>
      <span className="font-heading text-[36px] leading-none max-md:text-[30px] max-md:[overflow-wrap:anywhere] font-extrabold tnum">
        {priceLabel ?? PRICE_BLOCK_TEXT.onRequest}
      </span>
      {negotiabilityLabel ? (
        <span className="text-[13px] ink-secondary">{negotiabilityLabel}</span>
      ) : null}
    </Blueprint>
  );
}
