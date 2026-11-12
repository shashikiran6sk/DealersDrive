import type { CreditOrderRow } from '@dealers-drive/contracts';

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
          </td>
        </tr>
      ))}
    </Table>
  );
}
