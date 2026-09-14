import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';

import { ImageSlot } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { COVER_HEIGHT, DEALER_CARD_TEXT } from './dealer-card.constants';

export function DealerCardCover({ dealer }: { dealer: DealerCardDto }) {
  return (
    <div
      className={cn(
        'relative w-full shrink-0 overflow-hidden border-b border-(--color-divider) bg-(--color-surface)',
        COVER_HEIGHT,
      )}
    >
      {dealer.coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"
          />
        </>
      ) : (
        <ImageSlot label={DEALER_CARD_TEXT.coverAlt(dealer.brandName)} />
      )}

      {dealer.isVerified ? (
        <span className="absolute right-[10px] top-[10px] bg-ink/75 px-[7px] py-[2px] font-mono text-[10px] tracking-[0.08em] text-white backdrop-blur-[2px]">
          {DEALER_CARD_TEXT.yardVerified}
        </span>
      ) : null}
    </div>
  );
}
