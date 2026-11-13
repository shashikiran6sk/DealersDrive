import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createRazorpayGateway } from '../../../../src/platform/payments/razorpay.adapter.js';

const SECRET = 'key-secret-123';
const WEBHOOK_SECRET = 'webhook-secret-456';

function gateway(fetch: typeof globalThis.fetch) {
  return createRazorpayGateway({
    keyId: 'rzp_test_abc',
    keySecret: SECRET,
    webhookSecret: WEBHOOK_SECRET,
    apiBase: 'https://api.example.test',
    fetch,
  });
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const hmac = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('the Razorpay adapter', () => {
  it('creates an order for the exact amount, with HTTP basic auth', async () => {
    const fetch = vi.fn(async () => reply(200, { id: 'order_123', status: 'created' }));
    const order = await gateway(fetch).createOrder({
      amountPaise: 59_000,
      receipt: 'r-1',
      notes: { orderId: 'r-1' },
    });

    expect(order).toEqual({ gatewayOrderId: 'order_123' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/v1/orders');
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 59_000,
      currency: 'INR',
      receipt: 'r-1',
      notes: { orderId: 'r-1' },
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`rzp_test_abc:${SECRET}`).toString('base64')}`,
    );
  });

  it('verifies Checkout’s signature over order_id|payment_id, and nothing else', () => {
    const adapter = gateway(vi.fn());
    const signature = hmac(SECRET, 'order_1|pay_1');

    expect(
      adapter.verifyCheckout({ gatewayOrderId: 'order_1', paymentId: 'pay_1', signature }),
    ).toBe(true);
    expect(
      adapter.verifyCheckout({ gatewayOrderId: 'order_2', paymentId: 'pay_1', signature }),
    ).toBe(false);
    expect(
      adapter.verifyCheckout({ gatewayOrderId: 'order_1', paymentId: 'pay_1', signature: 'zz' }),
    ).toBe(false);
  });

  it('verifies a webhook against the raw body under the webhook secret', () => {
    const adapter = gateway(vi.fn());
    const body = Buffer.from('{"event":"payment.captured"}');
    expect(adapter.verifyWebhook(body, hmac(WEBHOOK_SECRET, body.toString()))).toBe(true);
    expect(adapter.verifyWebhook(body, hmac(SECRET, body.toString()))).toBe(false);
  });

  it('captures a payment that is only authorized, for the order amount', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        reply(200, { id: 'pay_1', status: 'authorized', order_id: 'order_1', amount: 59_000 }),
      )
      .mockResolvedValueOnce(
        reply(200, { id: 'pay_1', status: 'captured', order_id: 'order_1', amount: 59_000 }),
      );

    const payment = await gateway(fetch).confirmPayment('pay_1', 59_000);

    expect(payment).toEqual({
      captured: true,
      gatewayOrderId: 'order_1',
      amountPaise: 59_000,
      status: 'captured',
    });
    expect(fetch.mock.calls[1]?.[0]).toBe('https://api.example.test/v1/payments/pay_1/capture');
  });

  it('turns an outage or a refusal into a 503 that charges nothing', async () => {
    const down = gateway(vi.fn(async () => Promise.reject(new Error('ECONNRESET'))));
    await expect(
      down.createOrder({ amountPaise: 1, receipt: 'r', notes: {} }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'PAYMENTS_UNAVAILABLE',
    });
    const refused = gateway(
      vi.fn(async () => reply(400, { error: { code: 'BAD_REQUEST_ERROR' } })),
    );
    await expect(
      refused.createOrder({ amountPaise: 1, receipt: 'r', notes: {} }),
    ).rejects.toMatchObject({
      status: 503,
    });
  });
});

describe('the Razorpay adapter, less common answers', () => {
  it('does not capture a payment that is already captured, and reports one that failed', async () => {
    const captured = vi.fn(async () =>
      reply(200, { id: 'pay_1', status: 'captured', order_id: 'order_1', amount: 59_000 }),
    );
    expect(await gateway(captured).confirmPayment('pay_1', 59_000)).toMatchObject({
      captured: true,
    });
    expect(captured).toHaveBeenCalledTimes(1);

    const failed = vi.fn(async () => reply(200, { id: 'pay_2', status: 'failed' }));
    expect(await gateway(failed).confirmPayment('pay_2', 59_000)).toEqual({
      captured: false,
      gatewayOrderId: null,
      amountPaise: 0,
      status: 'failed',
    });
  });

  it('treats an order answer with no id, or an unreadable body, as unavailable', async () => {
    const noId = gateway(vi.fn(async () => reply(200, { status: 'created' })));
    await expect(
      noId.createOrder({ amountPaise: 1, receipt: 'r', notes: {} }),
    ).rejects.toMatchObject({ status: 503 });
    const garbled = gateway(vi.fn(async () => new Response('not json', { status: 502 })));
    await expect(
      garbled.createOrder({ amountPaise: 1, receipt: 'r', notes: {} }),
    ).rejects.toMatchObject({ status: 503 });
    const odd = gateway(vi.fn(async () => reply(200, 'a string')));
    expect(await odd.confirmPayment('pay_3', 1)).toMatchObject({
      status: 'unknown',
      amountPaise: 0,
    });
  });

  it('never simulates a payment', () => {
    expect(gateway(vi.fn()).simulate('order_1')).toBeNull();
  });
});
