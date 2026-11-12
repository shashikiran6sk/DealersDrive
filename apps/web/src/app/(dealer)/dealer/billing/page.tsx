import {
  BillingSummary,
  CreditLedgerResponse,
  CreditOrdersResponse,
  CreditPacksResponse,
  canDealer,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Banner } from '@/components/ui/primitives';
import {
  BILLING_TEXT,
  CreditBalance,
  CreditLedger,
  CreditOrders,
  CreditPacks,
} from '@/features/dealer/billing';
import { apiGetParsed } from '@/lib/api';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: BILLING_TEXT.pageTitle };

const FRESH = { revalidate: false } as const;

export default async function BillingPage() {
  const session = await currentSession();
  if (!canDealer(session?.permissions, 'billing:read')) notFound();

  const [summary, packs, ledger, orders] = await Promise.all([
    apiGetParsed(BillingSummary, '/v1/dealer/billing/summary', FRESH),
    apiGetParsed(CreditPacksResponse, '/v1/dealer/billing/packs', FRESH),
    apiGetParsed(CreditLedgerResponse, '/v1/dealer/billing/ledger?limit=50', FRESH),
    apiGetParsed(CreditOrdersResponse, '/v1/dealer/billing/orders', FRESH),
  ]);

  return (
    <div className="flex max-w-[960px] flex-col gap-[22px] px-4 py-[22px] md:px-8 md:py-[30px]">
      <div>
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{BILLING_TEXT.pageTitle}</h1>
        <p className="mt-1 max-w-[68ch] text-[13px] ink-muted">{BILLING_TEXT.intro}</p>
      </div>
      {summary.enabled ? null : (
        <Banner tone="ok" title={BILLING_TEXT.disabledTitle}>
          {BILLING_TEXT.disabledBody}
        </Banner>
      )}
      <CreditBalance summary={summary} />
      <section className="flex flex-col gap-3">
        <h2 className="text-[19px]">{BILLING_TEXT.packsTitle}</h2>
        <CreditPacks packs={packs} canPurchase={summary.canPurchase} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-[19px]">{BILLING_TEXT.ledgerTitle}</h2>
        <CreditLedger entries={ledger.data} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-[19px]">{BILLING_TEXT.ordersTitle}</h2>
        <CreditOrders orders={orders.data} />
      </section>
    </div>
  );
}
