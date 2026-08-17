import type { AdminPaymentsResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { EmptyState, StatusTag } from '@/components/ui/primitives';
import { apiGet, qs } from '@/lib/api';
import type { SearchParamsInput } from '@/lib/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Payments' };

/** D13 — the payment ledger. Gross is captured; net is recognised after GST. */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : undefined;

  const payments = await apiGet<AdminPaymentsResponse>(
    `/v1/admin/payments${qs({ status, limit: 50 })}`,
    { revalidate: false },
  );

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[26px]">Payments</h1>
        <span className="text-[13px] ink-muted">{payments.totals.periodLabel}</span>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]">
        {[
          ['Gross captured', payments.totals.grossLabel],
          ['GST collected', payments.totals.taxLabel],
          ['Net recognised', payments.totals.netLabel],
          ['Payments', String(payments.totals.count)],
        ].map(([label, value]) => (
          <div key={label} className="border border-(--color-divider) bg-white p-[14px]">
            <div className="eyebrow">{label}</div>
            <div className="font-heading text-[28px] font-bold leading-[1.15] tnum">{value}</div>
          </div>
        ))}
      </div>

      {payments.data.length === 0 ? (
        <EmptyState title="No payments yet" message="Captured credit purchases appear here." />
      ) : (
        <div className="overflow-x-auto border border-(--color-divider) bg-white">
          <table className="table">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Dealer</th>
                <th>Invoice</th>
                <th>Credits</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.data.map((payment) => (
                <tr key={payment.id}>
                  <td className="whitespace-nowrap font-mono text-[12px]">
                    {payment.gatewayPaymentId}
                  </td>
                  <td>{payment.dealer.brandName}</td>
                  <td className="whitespace-nowrap font-mono text-[12px]">
                    {payment.invoiceNumber ?? '—'}
                  </td>
                  <td className="tnum">{payment.credits}</td>
                  <td className="tnum">{payment.amountLabel}</td>
                  <td>{payment.method ?? '—'}</td>
                  <td>
                    <StatusTag tone={payment.statusTone}>{payment.statusLabel}</StatusTag>
                  </td>
                  <td className="whitespace-nowrap tnum">{payment.dateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
