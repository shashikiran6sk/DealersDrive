import type { BillingSummary } from '@dealers-drive/contracts';
import { creditsLabel } from '@dealers-drive/contracts';

import { StatCard } from '@/components/ui/primitives';

import { BILLING_TEXT } from './billing.constants';

export function CreditBalance({ summary }: { summary: BillingSummary }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <StatCard inverse label={BILLING_TEXT.available} value={String(summary.available)} />
        <StatCard
          label={BILLING_TEXT.held}
          value={String(summary.held)}
          delta={BILLING_TEXT.heldDelta(summary.held)}
        />
        <StatCard label={BILLING_TEXT.balance} value={String(summary.balance)} />
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-[12px] border border-(--color-divider) p-[14px] text-[13px]">
        <dt className="col-span-2 font-semibold">{BILLING_TEXT.costsTitle}</dt>
        <dt className="ink-muted">{BILLING_TEXT.costDealer}</dt>
        <dd className="font-medium tnum">{creditsLabel(summary.costs.DEALER)}</dd>
        <dt className="ink-muted">{BILLING_TEXT.costStudio}</dt>
        <dd className="font-medium tnum">{creditsLabel(summary.costs.DEALERS_DRIVE)}</dd>
      </dl>
    </div>
  );
}
