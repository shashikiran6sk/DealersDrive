import { createHash, createHmac } from 'node:crypto';

import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createAuthHarness,
  createFakeGoogle,
  createRecordingMailer,
  type AuthHarness,
} from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';
import {
  FAKE_WEBHOOK_SECRET,
  createFakePaymentGateway,
} from '../src/platform/payments/fake.adapter.js';
import type {
  ConfirmedPayment,
  PaymentDriver,
  PaymentGatewayPort,
} from '../src/platform/payments/payment.port.js';

/**
 * The payment paths the fake gateway cannot reach on its own: no gateway at
 * all, a payment Razorpay has not captured yet, a payment for the wrong amount,
 * and every webhook that should change nothing. The gateway here is the fake
 * one with a switchboard in front of it.
 */
const script: { driver: PaymentDriver; confirm: ((amount: number) => ConfirmedPayment) | null } = {
  driver: 'fake',
  confirm: null,
};

function scriptedGateway(): PaymentGatewayPort {
  const fake = createFakePaymentGateway();
  return {
    get driver() {
      return script.driver;
    },
    get keyId() {
      return script.driver === 'none' ? null : fake.keyId;
    },
    createOrder: (input) => fake.createOrder(input),
    verifyCheckout: (input) => fake.verifyCheckout(input),
    confirmPayment: (paymentId, amount) =>
      script.confirm
        ? Promise.resolve(script.confirm(amount))
        : fake.confirmPayment(paymentId, amount),
    verifyWebhook: (body, signature) => fake.verifyWebhook(body, signature),
    simulate: (orderId) => fake.simulate(orderId),
  };
}

let h: AuthHarness;
let admin: request.Agent;
let fixtures: ReturnType<typeof marketplaceFixtures>;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle(), createRecordingMailer(), {
    payments: scriptedGateway(),
  });
  fixtures = marketplaceFixtures(h, 'gateway');
  admin = await fixtures.moderator();
});

afterAll(async () => {
  script.driver = 'fake';
  script.confirm = null;
  await h.close();
});

async function checkout(owner: Dealership, packId = 'pack-1') {
  const created = await owner.agent.post('/v1/dealer/billing/orders').send({ packId }).expect(201);
  return created.body as {
    orderId: string;
    gatewayOrderId: string;
    totalPaise: number;
    simulation: { paymentId: string; signature: string };
  };
}

function signed(body: string) {
  return createHmac('sha256', FAKE_WEBHOOK_SECRET).update(body).digest('hex');
}

function webhook(payload: unknown, eventId?: string) {
  const body = JSON.stringify(payload);
  const call = h
    .agent()
    .post('/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', signed(body));
  return (eventId ? call.set('X-Razorpay-Event-Id', eventId) : call).send(body);
}

describe('no payment gateway configured', () => {
  it('still lists the packs, says they cannot be bought, and refuses an order', async () => {
    const owner = await fixtures.dealership();
    script.driver = 'none';
    try {
      const packs = await owner.agent.get('/v1/dealer/billing/packs').expect(200);
      expect(packs.body.purchasable).toBe(false);
      const summary = await owner.agent.get('/v1/dealer/billing/summary').expect(200);
      expect(summary.body.canPurchase).toBe(false);
      const refused = await owner.agent
        .post('/v1/dealer/billing/orders')
        .send({ packId: 'pack-1' })
        .expect(503);
      expect(refused.body.code).toBe('PAYMENTS_DISABLED');
    } finally {
      script.driver = 'fake';
    }
  });
});

describe('verifying a checkout', () => {
  it('refuses a pack that is not on sale', async () => {
    const owner = await fixtures.dealership();
    const refused = await owner.agent
      .post('/v1/dealer/billing/orders')
      .send({ packId: 'pack-7' })
      .expect(422);
    expect(refused.body.code).toBe('PACK_NOT_FOUND');
  });

  it('answers another dealership’s order, or one that does not exist, as not found', async () => {
    const owner = await fixtures.dealership();
    const other = await fixtures.dealership();
    const order = await checkout(owner);
    const payload = {
      razorpayOrderId: order.gatewayOrderId,
      razorpayPaymentId: order.simulation.paymentId,
      razorpaySignature: order.simulation.signature,
    };
    await other.agent
      .post(`/v1/dealer/billing/orders/${order.orderId}/verify`)
      .send(payload)
      .expect(404);
  });

  it('refuses a valid payload for a different order', async () => {
    const owner = await fixtures.dealership();
    const first = await checkout(owner);
    const second = await checkout(owner);
    const refused = await owner.agent
      .post(`/v1/dealer/billing/orders/${second.orderId}/verify`)
      .send({
        razorpayOrderId: first.gatewayOrderId,
        razorpayPaymentId: first.simulation.paymentId,
        razorpaySignature: first.simulation.signature,
      })
      .expect(400);
    expect(refused.body.code).toBe('SIGNATURE_MISMATCH');
  });

  it('leaves an order open while Razorpay has not captured the payment', async () => {
    const owner = await fixtures.dealership();
    const order = await checkout(owner);
    script.confirm = (amount) => ({
      captured: false,
      gatewayOrderId: order.gatewayOrderId,
      amountPaise: amount,
      status: 'authorized',
    });
    try {
      const pending = await owner.agent
        .post(`/v1/dealer/billing/orders/${order.orderId}/verify`)
        .send({
          razorpayOrderId: order.gatewayOrderId,
          razorpayPaymentId: order.simulation.paymentId,
          razorpaySignature: order.simulation.signature,
        })
        .expect(200);
      expect(pending.body).toMatchObject({ status: 'CREATED', balance: 0 });
      expect(pending.body.message).toMatch(/not confirmed/);
    } finally {
      script.confirm = null;
    }
  });

  it('refuses a payment for a different amount, or against a different order', async () => {
    const owner = await fixtures.dealership();
    for (const confirm of [
      (amount: number) => ({
        captured: true,
        gatewayOrderId: null,
        amountPaise: amount - 100,
        status: 'captured',
      }),
      (amount: number) => ({
        captured: true,
        gatewayOrderId: 'order_elsewhere',
        amountPaise: amount,
        status: 'captured',
      }),
    ]) {
      const order = await checkout(owner);
      script.confirm = confirm;
      try {
        const refused = await owner.agent
          .post(`/v1/dealer/billing/orders/${order.orderId}/verify`)
          .send({
            razorpayOrderId: order.gatewayOrderId,
            razorpayPaymentId: order.simulation.paymentId,
            razorpaySignature: order.simulation.signature,
          })
          .expect(422);
        expect(refused.body.code).toBe('PAYMENT_MISMATCH');
      } finally {
        script.confirm = null;
      }
    }
    expect((await owner.agent.get('/v1/dealer/billing/summary').expect(200)).body.balance).toBe(0);
  });
});

describe('webhooks that change nothing', () => {
  it('ignores an event without an order, for an unknown order, or of another type', async () => {
    expect(
      (await webhook({ event: 'payment.captured', payload: {} }, 'evt_none').expect(200)).body,
    ).toEqual({ outcome: 'ignored:no-order' });
    expect(
      (
        await webhook(
          {
            event: 'payment.captured',
            payload: { payment: { entity: { id: 'pay_x', order_id: 'order_unknown', amount: 1 } } },
          },
          'evt_unknown',
        ).expect(200)
      ).body,
    ).toEqual({ outcome: 'ignored:unknown-order' });

    const owner = await fixtures.dealership();
    const order = await checkout(owner);
    expect(
      (
        await webhook(
          {
            event: 'refund.created',
            payload: { payment: { entity: { id: 'pay_r', order_id: order.gatewayOrderId } } },
          },
          'evt_other',
        ).expect(200)
      ).body,
    ).toEqual({ outcome: 'ignored:event' });
    expect(
      (
        await webhook(
          { event: 'order.paid', payload: { order: { entity: { id: order.gatewayOrderId } } } },
          'evt_nopay',
        ).expect(200)
      ).body,
    ).toEqual({ outcome: 'ignored:no-payment' });
  });

  it('refuses a captured payment for the wrong amount', async () => {
    const owner = await fixtures.dealership();
    const order = await checkout(owner);
    const result = await webhook(
      {
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_short', order_id: order.gatewayOrderId, amount: 100 } },
        },
      },
      'evt_short',
    ).expect(200);
    expect(result.body).toEqual({ outcome: 'refused:amount-mismatch' });
    expect((await owner.agent.get('/v1/dealer/billing/summary').expect(200)).body.balance).toBe(0);
  });

  it('marks a failed payment once, and still credits a later successful attempt', async () => {
    const owner = await fixtures.dealership();
    const order = await checkout(owner);
    const failed = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_f',
            order_id: order.gatewayOrderId,
            error_description: 'Card declined.',
          },
        },
      },
    };
    expect((await webhook(failed, 'evt_fail1').expect(200)).body).toEqual({ outcome: 'failed' });
    expect((await webhook(failed, 'evt_fail2').expect(200)).body).toEqual({
      outcome: 'ignored:not-open',
    });
    const orders = await owner.agent.get('/v1/dealer/billing/orders').expect(200);
    expect(orders.body.data[0]).toMatchObject({
      status: 'FAILED',
      failureReason: 'Card declined.',
    });

    const paid = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_ok', order_id: order.gatewayOrderId, amount: order.totalPaise },
        },
      },
    };
    expect((await webhook(paid).expect(200)).body).toEqual({ outcome: 'fulfilled' });
    expect((await owner.agent.get('/v1/dealer/billing/summary').expect(200)).body.balance).toBe(1);
  });

  it('identifies an event with no id header by its body, so a redelivery is still a duplicate', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {},
      unique: createHash('sha256').update(String(Date.now())).digest('hex'),
    };
    expect((await webhook(payload).expect(200)).body).toEqual({ outcome: 'ignored:no-order' });
    expect((await webhook(payload).expect(200)).body).toEqual({ outcome: 'duplicate' });
  });

  it('refuses a webhook with no signature', async () => {
    await h.agent().post('/v1/webhooks/razorpay').send({ event: 'payment.captured' }).expect(400);
  });
});

describe('reading credits', () => {
  it('pages the ledger newest first', async () => {
    const owner = await fixtures.dealership();
    for (const credits of [1, 2, 3]) {
      await admin
        .post(`/v1/admin/dealers/${owner.dealerId}/credits`)
        .send({ credits, note: `Grant ${String(credits)}` })
        .expect(200);
    }
    const first = await owner.agent.get('/v1/dealer/billing/ledger?limit=2').expect(200);
    expect(first.body.data.map((row: { delta: number }) => row.delta)).toEqual([3, 2]);
    expect(first.body.page.hasMore).toBe(true);
    const second = await owner.agent
      .get(`/v1/dealer/billing/ledger?limit=2&cursor=${first.body.page.nextCursor}`)
      .expect(200);
    expect(second.body.data.map((row: { delta: number }) => row.delta)).toEqual([1]);
    expect(second.body.page).toEqual({ nextCursor: null, hasMore: false });
  });

  it('shows an admin the credits, and lets only a super admin change them', async () => {
    const owner = await fixtures.dealership();
    const view = await admin.get(`/v1/admin/dealers/${owner.dealerId}/credits`).expect(200);
    expect(view.body).toMatchObject({ balance: 0, canAdjust: true, ledger: [], orders: [] });

    const moderator = await fixtures.staff('MODERATOR');
    const read = await moderator.get(`/v1/admin/dealers/${owner.dealerId}/credits`).expect(200);
    expect(read.body.canAdjust).toBe(false);
    await moderator
      .post(`/v1/admin/dealers/${owner.dealerId}/credits`)
      .send({ credits: 1, note: 'Nope' })
      .expect(403);

    await admin.get('/v1/admin/dealers/00000000-0000-4000-8000-000000000000/credits').expect(404);
    await admin
      .post('/v1/admin/dealers/00000000-0000-4000-8000-000000000000/credits')
      .send({ credits: 1, note: 'Nobody' })
      .expect(404);
  });
});
