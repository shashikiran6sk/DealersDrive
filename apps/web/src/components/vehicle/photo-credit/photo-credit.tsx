import type { PhotoCreditSummary } from '@dealers-drive/contracts';

import { PHOTO_CREDIT_COPY, PHOTO_STANDARD_TEXT } from './photo-credit.constants';

export interface PhotoCreditProps {
  credit: PhotoCreditSummary | null;
  dealerName: string;
  className?: string;
}

export function PhotoCredit({ credit, dealerName, className }: PhotoCreditProps) {
  const copy = PHOTO_CREDIT_COPY[credit ?? 'UNRECORDED'](dealerName);
  return (
    <div className={className}>
      <div className="flex flex-col gap-[2px] text-[13px] leading-[1.5]">
        {copy.title ? <p className="m-0 font-bold ink-body">{copy.title}</p> : null}
        <p className="m-0 ink-muted">{copy.body}</p>
      </div>
      <details className="mt-[6px] text-[13px]">
        <summary className="cursor-pointer py-[4px] font-semibold underline underline-offset-[3px]">
          {PHOTO_STANDARD_TEXT.summary}
        </summary>
        <ul className="mt-[6px] flex max-w-[66ch] list-disc flex-col gap-[4px] pl-[20px] leading-[1.6] ink-muted">
          {PHOTO_STANDARD_TEXT.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="mt-[8px] max-w-[66ch] leading-[1.6] ink-muted">
          {PHOTO_STANDARD_TEXT.advice}
        </p>
      </details>
    </div>
  );
}
