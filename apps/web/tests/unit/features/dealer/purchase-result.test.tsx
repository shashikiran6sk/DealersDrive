import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

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
import { CreditPacks } from '@/features/dealer/billing';
import { openCheckout } from '@/features/dealer/billing/razorpay';

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

const CHECKOUT = {
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
  prefill: { name: 'Sks cars', email: null, contact: null },
  simulation: null,
};

const PAYMENT = {
  razorpayOrderId: 'order_TEST123',
  razorpayPaymentId: 'pay_TEST456',
  razorpaySignature: 'sig',
};

function verified(status: 'PAID' | 'CREATED') {
  return {
    ok: true,
    value: {
      orderId: CHECKOUT.orderId,
      status,
      credits: 1,
      balance: 9,
      available: 9,
      message: '',
    },
  };
}

beforeEach(() => {
  vi.mocked(createCreditOrderAction).mockReset();
  vi.mocked(verifyCreditOrderAction).mockReset();
  vi.mocked(openCheckout).mockReset();
  vi.mocked(createCreditOrderAction).mockResolvedValue({ ok: true, value: CHECKOUT } as never);
  navigationState.refreshed = 0;
});

describe('the purchase result window', () => {
  it('says the payment succeeded, what was added, the amount and the payment id', async () => {
    vi.mocked(openCheckout).mockResolvedValue({ kind: 'paid', payment: PAYMENT });
    vi.mocked(verifyCreditOrderAction).mockResolvedValue(verified('PAID') as never);
    const user = userEvent.setup();
    render(<CreditPacks packs={PACKS} canPurchase />);

    await user.click(screen.getByRole('button', { name: 'Buy' }));

    const dialog = await screen.findByRole('dialog', { name: 'Payment successful' });
    expect(dialog).toHaveTextContent(
      '1 credit added to your account. You now have 9 credits available.',
    );
    expect(dialog).toHaveTextContent('₹500');
    expect(dialog).toHaveTextContent('pay_TEST456');
    expect(screen.getByRole('link', { name: 'Add a vehicle' })).toHaveAttribute(
      'href',
      '/dealer/vehicles/new',
    );
    expect(navigationState.refreshed).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(navigationState.refreshed).toBe(1);
  });

  it('tells the dealer a declined payment cost nothing, and offers to try again', async () => {
    vi.mocked(openCheckout).mockResolvedValue({ kind: 'failed' });
    const user = userEvent.setup();
    render(<CreditPacks packs={PACKS} canPurchase />);

    await user.click(screen.getByRole('button', { name: 'Buy' }));
    const dialog = await screen.findByRole('dialog', { name: 'Payment not completed' });
    expect(dialog).toHaveTextContent('you have not been charged');

    vi.mocked(openCheckout).mockResolvedValue({ kind: 'paid', payment: PAYMENT });
    vi.mocked(verifyCreditOrderAction).mockResolvedValue(verified('PAID') as never);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('dialog', { name: 'Payment successful' })).toBeInTheDocument();
    expect(createCreditOrderAction).toHaveBeenCalledTimes(2);
  });

  it('says a payment Razorpay has not captured yet is received, with the id to quote', async () => {
    vi.mocked(openCheckout).mockResolvedValue({ kind: 'paid', payment: PAYMENT });
    vi.mocked(verifyCreditOrderAction).mockResolvedValue(verified('CREATED') as never);
    const user = userEvent.setup();
    render(<CreditPacks packs={PACKS} canPurchase />);

    await user.click(screen.getByRole('button', { name: 'Buy' }));
    const dialog = await screen.findByRole('dialog', { name: 'Payment received' });
    expect(dialog).toHaveTextContent('you do not need to pay again');
    expect(dialog).toHaveTextContent('pay_TEST456');
    expect(dialog).toHaveTextContent('Quote this payment ID');
    expect(screen.queryByRole('link', { name: 'Add a vehicle' })).not.toBeInTheDocument();
  });

  it('shows why a payment could not be confirmed, with the id to quote', async () => {
    vi.mocked(openCheckout).mockResolvedValue({ kind: 'paid', payment: PAYMENT });
    vi.mocked(verifyCreditOrderAction).mockResolvedValue({
      ok: false,
      message: 'We could not confirm that payment with Razorpay.',
    } as never);
    const user = userEvent.setup();
    render(<CreditPacks packs={PACKS} canPurchase />);

    await user.click(screen.getByRole('button', { name: 'Buy' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'We could not confirm your payment',
    });
    expect(dialog).toHaveTextContent('We could not confirm that payment with Razorpay.');
    expect(dialog).toHaveTextContent('pay_TEST456');
  });

  it('opens no window when the dealer simply closes Checkout', async () => {
    vi.mocked(openCheckout).mockResolvedValue({ kind: 'dismissed' });
    const user = userEvent.setup();
    render(<CreditPacks packs={PACKS} canPurchase />);

    await user.click(screen.getByRole('button', { name: 'Buy' }));
    expect(
      await screen.findByText('Payment cancelled. You have not been charged.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('inside the submit checklist, hands back only once the dealer has read the result', async () => {
    vi.mocked(openCheckout).mockResolvedValue({ kind: 'paid', payment: PAYMENT });
    vi.mocked(verifyCreditOrderAction).mockResolvedValue(verified('PAID') as never);
    const onPurchased = vi.fn();
    const user = userEvent.setup();
    render(<CreditPacks packs={PACKS} canPurchase onPurchased={onPurchased} />);

    await user.click(screen.getByRole('button', { name: 'Buy' }));
    await screen.findByRole('dialog', { name: 'Payment successful' });
    expect(screen.queryByRole('link', { name: 'Add a vehicle' })).not.toBeInTheDocument();
    expect(onPurchased).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onPurchased).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
  });
});
