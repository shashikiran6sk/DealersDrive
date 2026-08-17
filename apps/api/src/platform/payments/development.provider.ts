import { randomUUID } from 'node:crypto';

import type { CreateOrderRequest, GatewayOrder, PaymentProvider } from './payment.port.js';

/**
 * The provider that is active for the current build (CLAUDE.md §6, §18).
 *
 * It reports a successful capture immediately, so `Buy credits` adds credits
 * with no gateway page in the way. What it deliberately does **not** do is
 * write anything: settlement still goes through the billing service's
 * `settleCapturedPayment`, under `SELECT … FOR UPDATE`, writing a
 * `CreditTransaction` and an `Invoice` in one transaction, keyed on an
 * idempotency key. That is the same function a Razorpay webhook will call.
 *
 * The result is that replacing this file with a real gateway changes when
 * credits are written, never how.
 */
export function createDevelopmentPaymentProvider(): PaymentProvider {
  return {
    name: 'development',

    async createOrder(request: CreateOrderRequest): Promise<GatewayOrder> {
      const suffix = randomUUID().replaceAll('-', '').slice(0, 14);
      await Promise.resolve();

      return {
        gatewayOrderId: `dev_order_${suffix}`,
        settlement: 'immediate',
        capture: {
          gatewayPaymentId: `dev_pay_${suffix}`,
          method: 'development',
          amountPaise: request.totalPaise,
          rawPayload: {
            provider: 'development',
            note: 'Settled locally — no payment gateway was contacted.',
            orderId: request.orderId,
            dealerId: request.dealerId,
            credits: request.credits,
            amountPaise: Number(request.totalPaise),
            currency: request.currency,
            capturedAt: new Date().toISOString(),
          },
        },
      };
    },

    /**
     * There is no signature to check without a gateway. The handshake still
     * exists as a route so the client flow — and the response the billing
     * screen renders its toast from — is the one the API spec describes.
     */
    verifyClientHandshake() {
      return true;
    },
  };
}
