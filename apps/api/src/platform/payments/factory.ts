import { env } from '../../config/env.js';
import { createDisabledPaymentGateway, createFakePaymentGateway } from './fake.adapter.js';
import type { PaymentGatewayPort } from './payment.port.js';
import { createRazorpayGateway } from './razorpay.adapter.js';

export function createPaymentGateway(): PaymentGatewayPort {
  if (env.PAYMENTS_DRIVER === 'fake') return createFakePaymentGateway();
  if (
    env.PAYMENTS_DRIVER === 'razorpay' &&
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    env.RAZORPAY_WEBHOOK_SECRET
  ) {
    return createRazorpayGateway({
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
      apiBase: env.RAZORPAY_API_BASE,
    });
  }
  return createDisabledPaymentGateway();
}
