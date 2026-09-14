import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';

import { DEALER_CARD_TEXT } from './dealer-card.constants';

/**
 * Pinned to the card's bottom edge, running to its own edges rather than sitting
 * inside the body's padding (**R28**), with a tint off the ground colour — which
 * is what makes it read as the card's base rather than the last row of content.
 */
export function DealerCardFooter({ dealer }: { dealer: DealerCardDto }) {
  return (
    <div className="mt-auto flex items-baseline gap-3 border-t border-(--color-divider) bg-neutral-100/60 px-[18px] py-[10px]">
      <span className="whitespace-nowrap text-[13px] font-semibold tnum">
        {DEALER_CARD_TEXT.carsListed(dealer.carCount)}
      </span>
      <span className="whitespace-nowrap text-[12px] ink-subtle tnum">{dealer.fromPriceLabel}</span>
      {/*
        Not lifted above the heading's overlay (**R29**). It carried `relative
        z-[2]`, which raised the one part of the card that most obviously invites
        a click above the anchor stretched over everything else — so clicking
        "View inventory" did nothing while clicking the white space beside it
        opened the portfolio. It is an affordance for the card's own link, so it
        belongs under that link's overlay.
      */}
      <span className="btn btn-ghost ml-auto text-[12px]">
        {DEALER_CARD_TEXT.viewInventory}{' '}
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-[2px]">
          {DEALER_CARD_TEXT.arrow}
        </span>
      </span>
    </div>
  );
}
