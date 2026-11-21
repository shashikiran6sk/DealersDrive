import { creditsLabel, type CreditOrderRow } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import { Table } from '@/components/ui/table';

import { BILLING_TEXT } from './billing.constants';

const COLUMNS = [
  { key: 'date', label: BILLING_TEXT.columns.date },
  { key: 'credits', label: BILLING_TEXT.columns.credits, align: 'right' as const },
  { key: 'amount', label: BILLING_TEXT.columns.amount, align: 'right' as const },
  { key: 'status', label: BILLING_TEXT.columns.status },
];

export function CreditOrders({ orders }: { orders: readonly CreditOrderRow[] }) {
  if (orders.length === 0)
    return <p className="text-[13px] ink-muted">{BILLING_TEXT.ordersEmpty}</p>;
  return (
    <>
      <div className="max-md:hidden">
        <Table columns={COLUMNS} caption={BILLING_TEXT.ordersTitle}>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="whitespace-nowrap tnum">{order.dateLabel}</td>
              <td className="text-right tnum">{order.credits}</td>
              <td className="text-right tnum">{order.totalLabel}</td>
              <td>
                <StatusTag tone={order.statusTone}>{order.statusLabel}</StatusTag>
                {order.failureReason ? (
                  <span className="block text-[12px] ink-muted">{order.failureReason}</span>
                ) : null}
                {order.gatewayPaymentId ? (
                  <span className="block font-mono text-[11px] ink-subtle break-all">
                    {BILLING_TEXT.paymentId(order.gatewayPaymentId)}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden" aria-label={BILLING_TEXT.ordersTitle}>
        {orders.map((order) => (
          <li key={order.id} className="card flex-row items-start gap-3 p-[12px] text-[13px]">
            <div className="min-w-0 flex-1">
              <span className="block font-medium tnum">
                {BILLING_TEXT.orderSummary(creditsLabel(order.credits), order.totalLabel)}
              </span>
              <span className="block text-[12px] ink-subtle tnum">{order.dateLabel}</span>
              {order.failureReason ? (
                <span className="block text-[12px] ink-muted">{order.failureReason}</span>
              ) : null}
              {order.gatewayPaymentId ? (
                <span className="mt-1 block font-mono text-[11px] ink-subtle break-all">
                  {BILLING_TEXT.paymentId(order.gatewayPaymentId)}
                </span>
              ) : null}
            </div>
            <StatusTag tone={order.statusTone}>{order.statusLabel}</StatusTag>
          </li>
        ))}
      </ul>
    </>
  );
}
