import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/dealer/billing/billing-actions', () => ({
  createCreditOrderAction: vi.fn(),
  verifyCreditOrderAction: vi.fn(),
}));

vi.mock('@/features/dealer/billing/razorpay', () => ({
  openCheckout: vi.fn(),
}));

import {
  createCreditOrderAction,
  verifyCreditOrderAction,
} from '@/features/dealer/billing/billing-actions';
import { openCheckout } from '@/features/dealer/billing/razorpay';
import { SubmissionChecklist } from '@/features/vehicle/vehicle-wizard/submission-checklist';

const SHORT = {
  photosShown: false,
  photosReady: true,
  creditsShown: true,
  creditsNeeded: 2,
  creditsAvailable: 0,
  creditsReady: false,
};

const PACKS = {
  data: [
    {
      id: '1',
      credits: 1,
      pricePaise: 50_000,
      priceLabel: '₹500',
      totalPaise: 50_000,
      totalLabel: '₹500',
      perCreditLabel: '₹500 per credit',
      savingsLabel: null,
    },
  ],
  gstPercent: 0,
  taxNote: 'Prices are final — no GST is charged.',
  purchasable: true,
};

const BILLING = {
  enabled: true,
  balance: 0,
  held: 0,
  available: 0,
  canPurchase: true,
  costs: { listing: 1, photoshoot: 1 },
  gstPercent: 0,
} as never;

beforeEach(() => {
  vi.mocked(createCreditOrderAction).mockResolvedValue({
    ok: true,
    value: {
      orderId: '2d9c6a2a-8c5b-4dab-9f77-4b3e5d0a9c32',
      gateway: 'razorpay',
      gatewayOrderId: 'order_TEST123',
      keyId: 'rzp_test_abc',
      credits: 1,
      amountPaise: 50_000,
      taxPaise: 0,
      totalPaise: 50_000,
      totalLabel: '₹500',
      currency: 'INR',
      description: '1 credit',
      prefill: { name: null, email: null, contact: null },
      simulation: null,
    },
  } as never);
  vi.mocked(openCheckout).mockResolvedValue({
    kind: 'paid',
    payment: {
      razorpayOrderId: 'order_TEST123',
      razorpayPaymentId: 'pay_TEST456',
      razorpaySignature: 'sig',
    },
  });
  vi.mocked(verifyCreditOrderAction).mockResolvedValue({
    ok: true,
    value: {
      orderId: '2d9c6a2a-8c5b-4dab-9f77-4b3e5d0a9c32',
      status: 'PAID',
      credits: 1,
      balance: 2,
      available: 2,
      message: '',
    },
  } as never);
});

function checklist(needs = SHORT) {
  return (
    <SubmissionChecklist
      needs={needs}
      photos={null}
      billing={BILLING}
      packs={PACKS}
      photosHref="#photos"
    />
  );
}

describe('buying credits from the submit checklist', () => {
  it('opens the packs in the checklist itself, not in a dialog Razorpay would close', async () => {
    const user = userEvent.setup();
    render(checklist());

    await user.click(screen.getByRole('button', { name: 'Buy credits' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Buy listing credits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Buy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy credits' })).toBeInTheDocument();
  });

  it('keeps the result in view when the page refreshes to enough credits, until Done', async () => {
    const user = userEvent.setup();
    const { rerender } = render(checklist());

    await user.click(screen.getByRole('button', { name: 'Buy credits' }));
    await user.click(screen.getByRole('button', { name: 'Buy' }));
    await screen.findByRole('dialog', { name: 'Payment successful' });

    rerender(checklist({ ...SHORT, creditsAvailable: 2, creditsReady: true }));
    expect(screen.getByRole('dialog', { name: 'Payment successful' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Buy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy credits' })).not.toBeInTheDocument();
    expect(screen.getByText(/you have 2 credits available/)).toBeInTheDocument();
  });
});
