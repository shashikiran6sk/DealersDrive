import {
  CREDIT_ORDER_STATUS_LABELS,
  CREDIT_ORDER_STATUS_TONES,
  CREDIT_REASON_LABELS,
  formatDate,
  formatRupees,
  type CreditLedgerEntry,
  type CreditOrderRow,
  type CreditReason,
  type StatusTone,
} from '@dealers-drive/contracts';
import type { CreditOrder, CreditTransaction } from '@prisma/client';

const MINUS = '−';

const REASON_TONES: Record<CreditReason, StatusTone> = {
  PURCHASE: 'ok',
  ADMIN_GRANT: 'ok',
  ADMIN_DEDUCT: 'err',
  HOLD_SUBMIT: 'warn',
  HOLD_ADJUST: 'warn',
  RELEASE_REJECT: 'ok',
  CONSUME_APPROVE: 'neutral',
};

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : `${MINUS}${String(Math.abs(value))}`;
}

export function changeLabel(row: Pick<CreditTransaction, 'delta' | 'heldDelta'>): string {
  if (row.delta !== 0) return signed(row.delta);
  return row.heldDelta > 0 ? `${String(row.heldDelta)} held` : `${String(-row.heldDelta)} returned`;
}

export function toLedgerEntry(row: CreditTransaction): CreditLedgerEntry {
  return {
    id: row.id.toString(),
    reason: row.reason,
    label: CREDIT_REASON_LABELS[row.reason],
    delta: row.delta,
    heldDelta: row.heldDelta,
    changeLabel: changeLabel(row),
    tone: REASON_TONES[row.reason],
    balanceAfter: row.balanceAfter,
    availableAfter: row.balanceAfter - row.heldAfter,
    listingId: row.listingId,
    orderId: row.orderId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    dateLabel: formatDate(row.createdAt),
  };
}

export function toOrderRow(order: CreditOrder): CreditOrderRow {
  return {
    id: order.id,
    credits: order.credits,
    totalPaise: Number(order.totalPaise),
    totalLabel: formatRupees(order.totalPaise),
    status: order.status,
    statusLabel: CREDIT_ORDER_STATUS_LABELS[order.status],
    statusTone: CREDIT_ORDER_STATUS_TONES[order.status],
    failureReason: order.failureReason,
    createdAt: order.createdAt.toISOString(),
    dateLabel: formatDate(order.createdAt),
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}
