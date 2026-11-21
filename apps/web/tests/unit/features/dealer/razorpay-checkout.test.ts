import type { CreditCheckout } from '@dealers-drive/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { openCheckout } from '@/features/dealer/billing/razorpay';
import type { RazorpayOptions } from '@/features/dealer/billing/razorpay.types';

const CHECKOUT = {
  orderId: '2d9c6a2a-8c5b-4dab-9f77-4b3e5d0a9c32',
  gatewayOrderId: 'order_TEST123',
  keyId: 'rzp_test_abc',
  totalPaise: 50_000,
  currency: 'INR',
  description: '1 credit',
  prefill: { name: 'Sks cars', email: null, contact: null },
  simulation: null,
} as unknown as CreditCheckout;

interface FakeCheckout {
  options: RazorpayOptions;
  failed: (() => void) | null;
}

function installFakeRazorpay(): FakeCheckout {
  const fake: FakeCheckout = { options: null as unknown as RazorpayOptions, failed: null };
  window.Razorpay = class {
    constructor(options: RazorpayOptions) {
      fake.options = options;
    }
    open() {}
    on(_event: 'payment.failed', handler: () => void) {
      fake.failed = handler;
    }
  };
  return fake;
}

const SUCCESS = {
  razorpay_order_id: 'order_TEST123',
  razorpay_payment_id: 'pay_RETRY',
  razorpay_signature: 'sig',
};

afterEach(() => {
  delete window.Razorpay;
});

describe('Razorpay Checkout', () => {
  it('keeps waiting after a failed attempt, so a retry in the same window is still verified', async () => {
    const fake = installFakeRazorpay();
    const outcome = openCheckout(CHECKOUT);
    await Promise.resolve();
    fake.failed?.();
    fake.options.handler(SUCCESS);
    await expect(outcome).resolves.toEqual({
      kind: 'paid',
      payment: {
        razorpayOrderId: 'order_TEST123',
        razorpayPaymentId: 'pay_RETRY',
        razorpaySignature: 'sig',
      },
    });
  });

  it('reports a failure only when the dealer closes the window after a failed attempt', async () => {
    const fake = installFakeRazorpay();
    const outcome = openCheckout(CHECKOUT);
    await Promise.resolve();
    fake.failed?.();
    fake.options.modal.ondismiss();
    await expect(outcome).resolves.toEqual({ kind: 'failed' });
  });

  it('reports a cancel when the window is closed without trying to pay', async () => {
    const fake = installFakeRazorpay();
    const outcome = openCheckout(CHECKOUT);
    await Promise.resolve();
    fake.options.modal.ondismiss();
    await expect(outcome).resolves.toEqual({ kind: 'dismissed' });
  });
});
