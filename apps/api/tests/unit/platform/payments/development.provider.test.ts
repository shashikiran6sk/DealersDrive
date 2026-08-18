import { describe, expect, it } from 'vitest';

import { createDevelopmentPaymentProvider } from '../../../../src/platform/payments/development.provider.js';
import type { CreateOrderRequest } from '../../../../src/platform/payments/payment.port.js';

/**
 * Unit tests for `src/platform/payments/development.provider.ts`.
 *
 * The property worth protecting is the one in the file's own docblock: replacing
 * this provider with Razorpay must change **when** credits are written, never
 * **how**. So these tests check that the provider only *reports* — it never
 * writes, never computes an amount of its own, and hands back a capture the
 * billing service can settle through the same function a webhook will call.
 */
function request(overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    orderId: '11111111-0000-4000-8000-000000000000',
    dealerId: '22222222-0000-4000-8000-000000000000',
    credits: 10,
    totalPaise: 1_000_000n,
    currency: 'INR',
    notes: { packName: 'Growth' },
    ...overrides,
  };
}

describe('createDevelopmentPaymentProvider', () => {
  it('names itself, so an invoice records which provider settled it', () => {
    expect(createDevelopmentPaymentProvider().name).toBe('development');
  });

  it('satisfies the port and nothing more', () => {
    const provider = createDevelopmentPaymentProvider();

    expect(Object.keys(provider).sort()).toEqual(['createOrder', 'name', 'verifyClientHandshake']);
  });

  describe('createOrder', () => {
    it('reports an immediate settlement with a capture attached', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(request());

      expect(order.settlement).toBe('immediate');
      expect(order.capture).toBeDefined();
    });

    it('echoes the server-computed amount rather than deriving one', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(
        request({ totalPaise: 4_500_00n }),
      );

      // §26.4: the amount is computed from a CreditPack server-side and passed
      // in. A provider that recalculated it would be a second source of truth
      // for money.
      expect(order.capture?.amountPaise).toBe(4_500_00n);
      expect(order.capture?.rawPayload.amountPaise).toBe(450_000);
    });

    it('keeps the amount as BigInt paise, never a float', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(request());

      expect(typeof order.capture?.amountPaise).toBe('bigint');
    });

    it('mints a distinct order and payment id per call', async () => {
      const provider = createDevelopmentPaymentProvider();
      const [first, second] = await Promise.all([
        provider.createOrder(request()),
        provider.createOrder(request()),
      ]);

      expect(first.gatewayOrderId).not.toBe(second.gatewayOrderId);
      expect(first.capture?.gatewayPaymentId).not.toBe(second.capture?.gatewayPaymentId);
    });

    it('prefixes its ids so a development order is never mistaken for a real one', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(request());

      expect(order.gatewayOrderId).toMatch(/^dev_order_[0-9a-f]{14}$/);
      expect(order.capture?.gatewayPaymentId).toMatch(/^dev_pay_[0-9a-f]{14}$/);
    });

    it('pairs the payment id with its order id', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(request());

      const suffix = order.gatewayOrderId.replace('dev_order_', '');
      expect(order.capture?.gatewayPaymentId).toBe(`dev_pay_${suffix}`);
    });

    it('records a payload that says plainly that no gateway was contacted', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(request());

      // This lands in `Payment.rawPayload` and is what someone reads a year
      // later while reconciling. It must not look like a real capture.
      expect(order.capture?.rawPayload).toMatchObject({
        provider: 'development',
        note: 'Settled locally — no payment gateway was contacted.',
      });
      expect(order.capture?.method).toBe('development');
    });

    it('carries the order, dealer, credits and currency into the payload', async () => {
      const input = request({ credits: 25, currency: 'INR' });

      const order = await createDevelopmentPaymentProvider().createOrder(input);

      expect(order.capture?.rawPayload).toMatchObject({
        orderId: input.orderId,
        dealerId: input.dealerId,
        credits: 25,
        currency: 'INR',
      });
    });

    it('timestamps the capture in ISO 8601', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(request());

      expect(String(order.capture?.rawPayload.capturedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    });

    it('produces a payload that survives the jsonb column it is stored in', async () => {
      const order = await createDevelopmentPaymentProvider().createOrder(request());

      expect(() => JSON.stringify(order.capture?.rawPayload)).not.toThrow();
    });
  });

  describe('verifyClientHandshake', () => {
    it('accepts, because without a gateway there is no signature to check', () => {
      const provider = createDevelopmentPaymentProvider();

      expect(
        provider.verifyClientHandshake({
          gatewayOrderId: 'dev_order_0123456789abcd',
          paymentId: 'dev_pay_0123456789abcd',
          signature: 'anything',
        }),
      ).toBe(true);
    });

    it('accepts with no paymentId or signature at all', () => {
      // The route exists so the client flow matches the spec; the handshake is
      // never what credits an account. `verifyOrder` settles from the *server's*
      // record of the capture, not from what the browser reported.
      expect(
        createDevelopmentPaymentProvider().verifyClientHandshake({
          gatewayOrderId: 'dev_order_0123456789abcd',
        }),
      ).toBe(true);
    });

    it('is synchronous, so a caller cannot forget to await a security check', () => {
      const result = createDevelopmentPaymentProvider().verifyClientHandshake({
        gatewayOrderId: 'dev_order_0123456789abcd',
      });

      expect(result).not.toBeInstanceOf(Promise);
      expect(typeof result).toBe('boolean');
    });
  });
});
