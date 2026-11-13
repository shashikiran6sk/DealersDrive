import { randomBytes } from 'node:crypto';

import type { PaymentGatewayPort } from './payment.port.js';
import { checkoutPayload, hmacHex, sameHex } from './signature.js';

export const FAKE_KEY_ID = 'rzp_test_fake';

export const FAKE_SECRET = 'fake-razorpay-secret';

export const FAKE_WEBHOOK_SECRET = 'fake-razorpay-webhook-secret';

function token(prefix: string): string {
  return `${prefix}_fake${randomBytes(7).toString('hex')}`;
}

export function createFakePaymentGateway(): PaymentGatewayPort {
  return {
    driver: 'fake',
    keyId: FAKE_KEY_ID,

    createOrder() {
      return Promise.resolve({ gatewayOrderId: token('order') });
    },

    verifyCheckout({ gatewayOrderId, paymentId, signature }) {
      return sameHex(hmacHex(FAKE_SECRET, checkoutPayload(gatewayOrderId, paymentId)), signature);
    },

    confirmPayment(_paymentId, amountPaise) {
      return Promise.resolve({
        captured: true,
        gatewayOrderId: null,
        amountPaise,
        status: 'captured',
      });
    },

    verifyWebhook(rawBody, signature) {
      return sameHex(hmacHex(FAKE_WEBHOOK_SECRET, rawBody), signature);
    },

    simulate(gatewayOrderId) {
      const paymentId = token('pay');
      return {
        paymentId,
        signature: hmacHex(FAKE_SECRET, checkoutPayload(gatewayOrderId, paymentId)),
      };
    },
  };
}

export function createDisabledPaymentGateway(): PaymentGatewayPort {
  const refuse = () => Promise.reject(new Error('No payment gateway is configured.'));
  return {
    driver: 'none',
    keyId: null,
    createOrder: refuse,
    verifyCheckout: () => false,
    confirmPayment: refuse,
    verifyWebhook: () => false,
    simulate: () => null,
  };
}
