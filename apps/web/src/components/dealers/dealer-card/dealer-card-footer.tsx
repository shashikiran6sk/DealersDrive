import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';

import { DEALER_CARD_TEXT } from './dealer-card.constants';

export function DealerCardFooter({ dealer }: { dealer: DealerCardDto }) {
  return (
    <div className="mt-auto flex items-baseline gap-3 border-t border-(--color-divider) bg-neutral-100/60 px-[18px] py-[10px]">
      <span className="whitespace-nowrap text-[13px] font-semibold tnum">
        {DEALER_CARD_TEXT.carsListed(dealer.carCount)}
      </span>
      <span className="whitespace-nowrap text-[12px] ink-subtle tnum">{dealer.fromPriceLabel}</span>
      <span className="btn btn-ghost ml-auto text-[12px]">
        {DEALER_CARD_TEXT.viewInventory}{' '}
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-[2px]">
          {DEALER_CARD_TEXT.arrow}
        </span>
      </span>
    </div>
  );
}
