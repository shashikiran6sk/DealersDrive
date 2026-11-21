import { creditsLabel, type CreditOrderRow } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import { Table } from '@/components/ui/table';

import { DEALER_CREDITS_TEXT } from './dealer-credits.constants';
import { RecheckOrderButton } from './recheck-order-button';

const COLUMNS = [
  { key: 'date', label: DEALER_CREDITS_TEXT.columns.date },
  { key: 'credits', label: DEALER_CREDITS_TEXT.columns.credits, align: 'right' as const },
  { key: 'amount', label: DEALER_CREDITS_TEXT.columns.amount, align: 'right' as const },
  { key: 'status', label: DEALER_CREDITS_TEXT.columns.status },
  { key: 'razorpay', label: DEALER_CREDITS_TEXT.columns.razorpay },
];

export interface AdminCreditOrdersProps {
  dealerId: string;
  orders: readonly CreditOrderRow[];
  canRecheck: boolean;
}

export function AdminCreditOrders({ dealerId, orders, canRecheck }: AdminCreditOrdersProps) {
  if (orders.length === 0)
    return <p className="text-[13px] ink-muted">{DEALER_CREDITS_TEXT.ordersEmpty}</p>;
  return (
    <>
      <div className="max-md:hidden">
        <Table columns={COLUMNS} caption={DEALER_CREDITS_TEXT.ordersCaption}>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="whitespace-nowrap tnum">{order.dateLabel}</td>
              <td className="text-right tnum">{order.credits}</td>
              <td className="text-right tnum">{order.totalLabel}</td>
              <td>
                <div className="flex flex-col items-start gap-1">
                  <StatusTag tone={order.statusTone}>{order.statusLabel}</StatusTag>
                  {order.failureReason ? (
                    <span className="text-[12px] ink-muted">{order.failureReason}</span>
                  ) : null}
                  {canRecheck && order.status !== 'PAID' ? (
                    <RecheckOrderButton
                      dealerId={dealerId}
                      orderId={order.id}
                      label={DEALER_CREDITS_TEXT.recheckLabel(order.dateLabel, order.totalLabel)}
                    />
                  ) : null}
                </div>
              </td>
              <td className="font-mono text-[12px] break-all">
                <span className="block">
                  {DEALER_CREDITS_TEXT.orderIdLabel}: {order.gatewayOrderId}
                </span>
                <span className="block ink-muted">
                  {DEALER_CREDITS_TEXT.paymentIdLabel}:{' '}
                  {order.gatewayPaymentId ?? DEALER_CREDITS_TEXT.noPayment}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden" aria-label={DEALER_CREDITS_TEXT.ordersCaption}>
        {orders.map((order) => (
          <li key={order.id} className="card gap-2 p-[12px] text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block font-medium tnum">
                  {DEALER_CREDITS_TEXT.orderSummary(creditsLabel(order.credits), order.totalLabel)}
                </span>
                <span className="block text-[12px] ink-subtle tnum">{order.dateLabel}</span>
              </div>
              <StatusTag tone={order.statusTone}>{order.statusLabel}</StatusTag>
            </div>
            {order.failureReason ? (
              <span className="text-[12px] ink-muted">{order.failureReason}</span>
            ) : null}
            <div className="font-mono text-[11px] break-all">
              <span className="block">
                {DEALER_CREDITS_TEXT.orderIdLabel}: {order.gatewayOrderId}
              </span>
              <span className="block ink-muted">
                {DEALER_CREDITS_TEXT.paymentIdLabel}:{' '}
                {order.gatewayPaymentId ?? DEALER_CREDITS_TEXT.noPayment}
              </span>
            </div>
            {canRecheck && order.status !== 'PAID' ? (
              <RecheckOrderButton
                dealerId={dealerId}
                orderId={order.id}
                label={DEALER_CREDITS_TEXT.recheckLabel(order.dateLabel, order.totalLabel)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
