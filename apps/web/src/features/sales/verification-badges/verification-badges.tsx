import type { SalesDealerSummary } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import { SALES_TEXT } from '@/features/sales/sales.constants';

export function VerificationBadges({
  dealer,
}: {
  dealer: Pick<SalesDealerSummary, 'phoneVerified' | 'emailVerified' | 'claimed'>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusTag tone={dealer.phoneVerified ? 'ok' : 'err'}>
        {dealer.phoneVerified ? SALES_TEXT.phoneVerified : SALES_TEXT.phoneUnverified}
      </StatusTag>
      <StatusTag tone={dealer.emailVerified ? 'ok' : 'warn'}>
        {dealer.emailVerified ? SALES_TEXT.emailVerified : SALES_TEXT.emailPending}
      </StatusTag>
      {dealer.claimed ? <StatusTag tone="neutral">{SALES_TEXT.claimed}</StatusTag> : null}
    </div>
  );
}
