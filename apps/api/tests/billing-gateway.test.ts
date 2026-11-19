import { createHash, createHmac } from 'node:crypto';

import type request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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
  OrderPayment,
  PaymentGatewayPort,
} from '../src/platform/payments/payment.port.js';
import type { Queue } from '../src/platform/jobs/queue.js';

/**
 * The payment paths the fake gateway cannot reach on its own: no gateway at
 * all, a payment Razorpay has not captured yet, a payment for the wrong amount,
 * and every webhook that should change nothing. The gateway here is the fake
 * one with a switchboard in front of it.
 */
const script: {
  driver: PaymentDriver;
  confirm: ((amount: number) => ConfirmedPayment) | null;
  payments: ((gatewayOrderId: string, amount: number) => OrderPayment[]) | null;
} = {
  driver: 'fake',
  confirm: null,
  payments: null,
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
    orderPayments: (orderId, amount) =>
      script.payments
        ? Promise.resolve(script.payments(orderId, amount))
        : fake.orderPayments(orderId, amount),
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
  script.payments = null;
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

describe('re-checking unpaid orders with Razorpay', () => {
  const MINUTE = 60 * 1000;

  async function aged(owner: Dealership, minutes: number) {
    const order = await checkout(owner);
    await h.prisma.creditOrder.update({
      where: { id: order.orderId },
      data: { createdAt: new Date(Date.now() - minutes * MINUTE) },
    });
    return order;
  }

  function paidOnly(gatewayOrderId: string, status = 'captured', difference = 0) {
    script.payments = (asked, amount) =>
      asked === gatewayOrderId
        ? [{ paymentId: `pay_${gatewayOrderId}`, status, amountPaise: amount + difference }]
        : [];
  }

  async function orderOf(id: string) {
    return h.prisma.creditOrder.findUniqueOrThrow({ where: { id } });
  }

  afterEach(() => {
    script.driver = 'fake';
    script.confirm = null;
    script.payments = null;
  });

  it('credits a paid order whose confirmation never arrived, once', async () => {
    const owner = await fixtures.dealership();
    const order = await aged(owner, 20);
    paidOnly(order.gatewayOrderId);

    await h.container.billing.recheckOpenOrders(new Date());
    await h.container.billing.recheckOpenOrders(new Date(Date.now() + 2 * 60 * MINUTE));

    expect(await orderOf(order.orderId)).toMatchObject({
      status: 'PAID',
      gatewayPaymentId: `pay_${order.gatewayOrderId}`,
    });
    const purchases = await h.prisma.creditTransaction.findMany({
      where: { dealerId: owner.dealerId, reason: 'PURCHASE' },
    });
    expect(purchases).toHaveLength(1);
  });

  it('asks about an unpaid order at most hourly, and only between 15 minutes and 72 hours', async () => {
    const owner = await fixtures.dealership();
    const young = await aged(owner, 5);
    const due = await aged(owner, 20);
    const stale = await aged(owner, 73 * 60);
    const asked: string[] = [];
    script.payments = (gatewayOrderId) => {
      asked.push(gatewayOrderId);
      return [];
    };

    await h.container.billing.recheckOpenOrders(new Date());
    await h.container.billing.recheckOpenOrders(new Date());
    expect(asked.filter((id) => id === due.gatewayOrderId)).toHaveLength(1);
    expect(asked).not.toContain(young.gatewayOrderId);
    expect(asked).not.toContain(stale.gatewayOrderId);

    await h.container.billing.recheckOpenOrders(new Date(Date.now() + 61 * MINUTE));
    expect(asked.filter((id) => id === due.gatewayOrderId)).toHaveLength(2);
    expect(await orderOf(due.orderId)).toMatchObject({ status: 'CREATED' });
  });

  it('captures an authorized payment, and refuses one for a different amount', async () => {
    const owner = await fixtures.dealership();
    const authorized = await aged(owner, 20);
    paidOnly(authorized.gatewayOrderId, 'authorized');
    script.confirm = (amount) => ({
      captured: true,
      gatewayOrderId: authorized.gatewayOrderId,
      amountPaise: amount,
      status: 'captured',
    });
    await h.container.billing.recheckOpenOrders(new Date());
    expect(await orderOf(authorized.orderId)).toMatchObject({ status: 'PAID' });

    const short = await aged(owner, 20);
    paidOnly(short.gatewayOrderId, 'captured', -100);
    await h.container.billing.recheckOpenOrders(new Date());
    expect(await orderOf(short.orderId)).toMatchObject({ status: 'CREATED' });
  });

  it('keeps going past an order Razorpay could not answer for, and does nothing with no gateway', async () => {
    const owner = await fixtures.dealership();
    const broken = await aged(owner, 25);
    const fine = await aged(owner, 20);
    script.payments = (gatewayOrderId, amount) => {
      if (gatewayOrderId === broken.gatewayOrderId) throw new Error('Razorpay is down');
      return gatewayOrderId === fine.gatewayOrderId
        ? [{ paymentId: 'pay_fine', status: 'captured', amountPaise: amount }]
        : [];
    };
    await h.container.billing.recheckOpenOrders(new Date());
    expect(await orderOf(fine.orderId)).toMatchObject({ status: 'PAID' });
    expect(await orderOf(broken.orderId)).toMatchObject({ status: 'CREATED' });

    script.driver = 'none';
    expect(await h.container.billing.recheckOpenOrders(new Date())).toEqual({
      checked: 0,
      paid: 0,
    });
  });

  it('runs every ten minutes on the job queue', async () => {
    const registered: string[] = [];
    const queue = {
      work: (name: string) => {
        registered.push(`work:${name}`);
        return Promise.resolve();
      },
      schedule: (name: string, cron: string) => {
        registered.push(`schedule:${name}:${cron}`);
        return Promise.resolve();
      },
    } as unknown as Queue;
    await h.container.billing.work(queue);
    expect(registered).toEqual([
      'work:billing.recheck-orders',
      'schedule:billing.recheck-orders:*/10 * * * *',
    ]);
  });

  it('lets a super admin ask Razorpay about one order, with the ids to match it by', async () => {
    const owner = await fixtures.dealership();
    const order = await checkout(owner);
    const path = `/v1/admin/dealers/${owner.dealerId}/credits/orders/${order.orderId}/recheck`;

    const view = await admin.get(`/v1/admin/dealers/${owner.dealerId}/credits`).expect(200);
    expect(view.body.canRecheck).toBe(true);
    expect(view.body.orders[0]).toMatchObject({
      gatewayOrderId: order.gatewayOrderId,
      gatewayPaymentId: null,
    });

    const unpaid = await admin.post(path).expect(200);
    expect(unpaid.body).toMatchObject({ outcome: 'unpaid', credits: { balance: 0 } });

    paidOnly(order.gatewayOrderId);
    const paid = await admin.post(path).expect(200);
    expect(paid.body.outcome).toBe('paid');
    expect(paid.body.credits.orders[0]).toMatchObject({
      status: 'PAID',
      gatewayPaymentId: `pay_${order.gatewayOrderId}`,
    });
    expect((await admin.post(path).expect(200)).body.outcome).toBe('already-paid');

    paidOnly('another-order', 'captured');
    const mismatch = await checkout(owner);
    paidOnly(mismatch.gatewayOrderId, 'captured', 500);
    const different = await admin
      .post(`/v1/admin/dealers/${owner.dealerId}/credits/orders/${mismatch.orderId}/recheck`)
      .expect(200);
    expect(different.body.outcome).toBe('mismatch');

    const audits = await h.prisma.auditLog.findMany({
      where: { dealerId: owner.dealerId, action: 'billing.order_rechecked' },
    });
    expect(audits).toHaveLength(4);

    const moderator = await fixtures.staff('MODERATOR');
    await moderator.post(path).expect(403);
    await admin
      .post(
        `/v1/admin/dealers/${owner.dealerId}/credits/orders/00000000-0000-4000-8000-000000000000/recheck`,
      )
      .expect(404);

    script.driver = 'none';
    await admin.post(path).expect(503);
    const off = await admin.get(`/v1/admin/dealers/${owner.dealerId}/credits`).expect(200);
    expect(off.body.canRecheck).toBe(false);
  });
});
