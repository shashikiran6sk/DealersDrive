import type { PhotoCreditSummary } from '@dealers-drive/contracts';

import { cn } from '@/lib/cn';

import { PHOTO_CREDIT_COPY } from './photo-credit.constants';

export interface PhotoCreditProps {
  credit: PhotoCreditSummary | null;
  dealerName: string;
  className?: string;
}

export function PhotoCredit({ credit, dealerName, className }: PhotoCreditProps) {
  const copy = PHOTO_CREDIT_COPY[credit ?? 'UNRECORDED'](dealerName);
  return (
    <div className={cn('flex flex-col gap-[2px] text-[13px] leading-[1.5]', className)}>
      {copy.title ? <p className="m-0 font-bold ink-body">{copy.title}</p> : null}
      <p className="m-0 ink-muted">{copy.body}</p>
    </div>
  );
}
