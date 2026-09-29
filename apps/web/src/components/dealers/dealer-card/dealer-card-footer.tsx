import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';

import { DEALER_CARD_TEXT } from './dealer-card.constants';

export function DealerCardFooter({ dealer }: { dealer: DealerCardDto }) {
  return (
    <div className="mt-auto flex items-baseline gap-3 border-t border-(--color-divider) px-[18px] py-[12px]">
      <span className="whitespace-nowrap text-[13px] font-bold tnum">
        {DEALER_CARD_TEXT.carsListed(dealer.carCount)}
      </span>
      <span className="ml-auto whitespace-nowrap text-[12px] ink-muted tnum">
        {dealer.fromPriceLabel}
      </span>
    </div>
  );
}
