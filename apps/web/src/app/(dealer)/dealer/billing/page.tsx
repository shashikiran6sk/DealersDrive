import type {
  BillingSummary,
  CreditPacksResponse,
  InvoicesResponse,
  LedgerResponse,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { Blueprint, EmptyState, StatusTag } from '@/components/ui/primitives';
import { CreditPacks } from '@/features/billing/credit-packs';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Billing & credits' };

/** DESIGN-SPEC §3.16. */
export default async function DealerBillingPage() {
  const [summary, packs, ledger, invoices] = await Promise.all([
    apiGet<BillingSummary>('/v1/dealer/billing/summary', { revalidate: false }),
    apiGet<CreditPacksResponse>('/v1/dealer/billing/packs', { revalidate: false }),
    apiGet<LedgerResponse>('/v1/dealer/billing/ledger?limit=20', { revalidate: false }),
    apiGet<InvoicesResponse>('/v1/dealer/billing/invoices?limit=20', { revalidate: false }),
  ]);

  return (
    <div className="flex flex-col gap-[20px] p-[22px]">
      <h1 className="text-[26px]">Billing &amp; credits</h1>

      <Blueprint className="bg-white p-[18px]">
        <div className="text-[11px] uppercase tracking-[0.1em] ink-muted">{summary.label}</div>
        <div className="my-1 font-heading text-[44px] font-bold leading-none tnum">
          {summary.creditsAvailable}
        </div>
        <div className="text-[13px] ink-secondary">
          {summary.note}
          {summary.creditsHeld > 0 ? (
            <>
              {' '}
              <span className="tnum">{summary.creditsHeld}</span> held for cars under review.
            </>
          ) : null}
        </div>
      </Blueprint>

      <CreditPacks packs={packs} />

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))]">
        <CreditHistory ledger={ledger} />
        <PaymentHistory invoices={invoices} />
      </div>
    </div>
  );
}

/**
 * The append-only ledger, exactly as stored. Note the `CONSUME_APPROVE` rows
 * with a delta of 0: approving a listing spends the credit that submitting
 * already held, and the movement is still written so the history is complete
 * (ARCHITECTURE §9.1).
 */
function CreditHistory({ ledger }: { ledger: LedgerResponse }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[21px]">Credit history</h2>

      {ledger.data.length === 0 ? (
        <EmptyState
          title="No credit movements yet"
          message="Buying a pack, publishing a car and having one rejected all show up here."
        />
      ) : (
        <div className="border border-(--color-divider) bg-white">
          {ledger.data.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border-b border-(--color-divider) px-[13px] py-[10px] last:border-b-0"
            >
              <span
                className={cn(
                  'w-[38px] flex-none font-mono text-[13px] tnum',
                  row.tone === 'ok'
                    ? 'text-(--color-ok)'
                    : row.tone === 'err'
                      ? 'text-(--color-err)'
                      : 'ink-subtle',
                )}
              >
                {row.deltaLabel}
              </span>
              <span className="min-w-0 flex-1 text-[13px]">{row.label}</span>
              <span className="whitespace-nowrap text-[11px] ink-faint tnum">{row.dateLabel}</span>
              <span className="whitespace-nowrap text-[12px] ink-muted tnum">
                {row.balanceLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentHistory({ invoices }: { invoices: InvoicesResponse }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[21px]">Payment history</h2>

      {invoices.data.length === 0 ? (
        <EmptyState
          title="No payments yet"
          message="Every credit purchase produces a GST invoice you can download here."
        />
      ) : (
        <div className="overflow-x-auto border border-(--color-divider) bg-white">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.data.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="whitespace-nowrap font-mono text-[12px]">{invoice.number}</td>
                  <td className="whitespace-nowrap tnum">{invoice.dateLabel}</td>
                  <td className="tnum">{invoice.amountLabel}</td>
                  <td>
                    <StatusTag tone={invoice.statusTone}>{invoice.statusLabel}</StatusTag>
                  </td>
                  <td className="text-right">
                    {invoice.pdfReady && invoice.pdfUrl ? (
                      <a
                        href={`/api/dealer/invoices/${invoice.id}`}
                        className="btn btn-ghost text-[12px]"
                      >
                        PDF
                      </a>
                    ) : (
                      <span className="text-[11px] ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
