import type { AdminDealerCredits, CreditOrderRow } from '@dealers-drive/contracts';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealerCredits } from '@/features/admin/dealer-credits';

const actions = vi.hoisted(() => ({
  rechecked: [] as string[][],
  answer: { ok: true, message: 'Razorpay confirmed the payment. The credits have been added.' },
}));

vi.mock('@/features/admin/credit-actions', () => ({
  adjustDealerCreditsAction: () => Promise.resolve({ ok: true }),
  recheckCreditOrderAction: (dealerId: string, orderId: string) => {
    actions.rechecked.push([dealerId, orderId]);
    return Promise.resolve(actions.answer);
  },
}));

const DEALER = '11111111-1111-4111-8111-111111111111';

function order(overrides: Partial<CreditOrderRow>): CreditOrderRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    credits: 5,
    totalPaise: 265_500,
    totalLabel: '₹2,655',
    status: 'PAID',
    statusLabel: 'Paid',
    statusTone: 'ok',
    failureReason: null,
    createdAt: '2026-11-09T09:00:00.000Z',
    dateLabel: '09 Nov 2026',
    paidAt: '2026-11-09T09:01:00.000Z',
    gatewayOrderId: 'order_paid',
    gatewayPaymentId: 'pay_paid',
    ...overrides,
  };
}

function credits(overrides: Partial<AdminDealerCredits> = {}): AdminDealerCredits {
  return {
    enabled: true,
    balance: 5,
    held: 0,
    available: 5,
    ledger: [],
    orders: [
      order({}),
      order({
        id: '33333333-3333-4333-8333-333333333333',
        status: 'CREATED',
        statusLabel: 'Awaiting payment',
        statusTone: 'neutral',
        gatewayOrderId: 'order_open',
        gatewayPaymentId: null,
        paidAt: null,
        dateLabel: '10 Nov 2026',
      }),
    ],
    canAdjust: true,
    canRecheck: true,
    ...overrides,
  };
}

beforeEach(() => {
  actions.rechecked = [];
});

describe('a dealership’s payments in the admin console', () => {
  it('shows each order’s Razorpay ids, so a dealer’s reference can be matched', () => {
    render(<DealerCredits dealerId={DEALER} credits={credits()} />);
    expect(screen.getByText(/order_paid/)).toBeInTheDocument();
    expect(screen.getByText(/pay_paid/)).toBeInTheDocument();
    expect(screen.getByText(/order_open/)).toBeInTheDocument();
    expect(screen.getByText(/No payment yet/)).toBeInTheDocument();
  });

  it('offers Check with Razorpay on an unpaid order only, and shows what Razorpay said', async () => {
    render(<DealerCredits dealerId={DEALER} credits={credits()} />);
    const buttons = screen.getAllByRole('button', { name: /with Razorpay/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(
      'Check the ₹2,655 payment of 10 Nov 2026 with Razorpay',
    );

    await act(async () => {
      fireEvent.click(buttons[0]!);
      await Promise.resolve();
    });
    expect(actions.rechecked).toEqual([[DEALER, '33333333-3333-4333-8333-333333333333']]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Razorpay confirmed the payment. The credits have been added.',
    );
  });

  it('shows no check button to an admin who cannot add credits, or with no payment gateway', () => {
    render(<DealerCredits dealerId={DEALER} credits={credits({ canRecheck: false })} />);
    expect(screen.queryByRole('button', { name: /with Razorpay/ })).not.toBeInTheDocument();
  });
});
