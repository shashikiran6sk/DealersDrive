import { afterEach, describe, expect, it, vi } from 'vitest';

interface PaymentEnv {
  PAYMENTS_DRIVER: string;
  RAZORPAY_KEY_ID: string | undefined;
  RAZORPAY_KEY_SECRET: string | undefined;
  RAZORPAY_WEBHOOK_SECRET: string | undefined;
  RAZORPAY_API_BASE: string;
}

const env = vi.hoisted<PaymentEnv>(() => ({
  PAYMENTS_DRIVER: 'none',
  RAZORPAY_KEY_ID: undefined,
  RAZORPAY_KEY_SECRET: undefined,
  RAZORPAY_WEBHOOK_SECRET: undefined,
  RAZORPAY_API_BASE: 'https://api.razorpay.com',
}));

vi.mock('../../../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return { env: Object.assign(env, { ...actual.env, ...env }) };
});

import { createPaymentGateway } from '../../../../src/platform/payments/factory.js';

afterEach(() => {
  env.PAYMENTS_DRIVER = 'none';
  env.RAZORPAY_KEY_ID = undefined;
  env.RAZORPAY_KEY_SECRET = undefined;
  env.RAZORPAY_WEBHOOK_SECRET = undefined;
});

describe('choosing the payment gateway', () => {
  it('sells nothing without a driver', () => {
    expect(createPaymentGateway().driver).toBe('none');
  });

  it('uses the fake gateway in development', () => {
    env.PAYMENTS_DRIVER = 'fake';
    expect(createPaymentGateway().driver).toBe('fake');
  });

  it('uses Razorpay only with all three secrets, and otherwise sells nothing', () => {
    env.PAYMENTS_DRIVER = 'razorpay';
    env.RAZORPAY_KEY_ID = 'rzp_test_abc';
    env.RAZORPAY_KEY_SECRET = 'key-secret';
    expect(createPaymentGateway().driver).toBe('none');
    env.RAZORPAY_WEBHOOK_SECRET = 'hook-secret';
    const gateway = createPaymentGateway();
    expect(gateway.driver).toBe('razorpay');
    expect(gateway.keyId).toBe('rzp_test_abc');
  });
});
