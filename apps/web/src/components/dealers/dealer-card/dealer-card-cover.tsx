import {
  STANDARD_DEALER_COVER_PATH,
  type DealerCard as DealerCardDto,
} from '@dealers-drive/contracts';
import Image from 'next/image';

import { cn } from '@/lib/cn';

import { COVER_HEIGHT, DEALER_CARD_TEXT } from './dealer-card.constants';

export function DealerCardCover(_props: { dealer: DealerCardDto }) {
  return (
    <div
      className={cn(
        'relative w-full shrink-0 overflow-hidden border-b border-(--color-divider) bg-(--color-surface)',
        COVER_HEIGHT,
      )}
    >
      <Image
        src={STANDARD_DEALER_COVER_PATH}
        alt={DEALER_CARD_TEXT.coverAlt}
        width={960}
        height={420}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
