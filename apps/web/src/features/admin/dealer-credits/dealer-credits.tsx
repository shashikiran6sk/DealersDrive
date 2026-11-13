import type { AdminDealerCredits } from '@dealers-drive/contracts';

import { Banner, StatCard } from '@/components/ui/primitives';
import { CreditLedger, CreditOrders } from '@/features/dealer/billing';

import { CreditAdjustForm } from './credit-adjust-form';
import { DEALER_CREDITS_TEXT } from './dealer-credits.constants';

export interface DealerCreditsProps {
  dealerId: string;
  credits: AdminDealerCredits;
}

export function DealerCredits({ dealerId, credits }: DealerCreditsProps) {
  return (
    <section className="card flex flex-col gap-4 p-4" aria-labelledby="dealer-credits-heading">
      <h2 id="dealer-credits-heading" className="text-[16px]">
        {DEALER_CREDITS_TEXT.title}
      </h2>
      {credits.enabled ? null : <Banner tone="warn">{DEALER_CREDITS_TEXT.off}</Banner>}
      <div className="grid grid-cols-3 gap-3">
        <StatCard inverse label={DEALER_CREDITS_TEXT.available} value={String(credits.available)} />
        <StatCard label={DEALER_CREDITS_TEXT.held} value={String(credits.held)} />
        <StatCard label={DEALER_CREDITS_TEXT.balance} value={String(credits.balance)} />
      </div>
      {credits.canAdjust ? <CreditAdjustForm dealerId={dealerId} /> : null}
      <h3 className="text-[14px] font-semibold">{DEALER_CREDITS_TEXT.recent}</h3>
      <CreditLedger entries={credits.ledger} />
      <h3 className="text-[14px] font-semibold">{DEALER_CREDITS_TEXT.orders}</h3>
      <CreditOrders orders={credits.orders} />
    </section>
  );
}
