import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBillingService } from '../../../../src/modules/billing/billing.service.js';
import type { DealersRepository } from '../../../../src/modules/dealers/dealers.facade.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import { DomainError, NotFoundError } from '../../../../src/platform/errors.js';
import type {
  GatewayCapture,
  PaymentProvider,
} from '../../../../src/platform/payments/payment.port.js';

/**
 * Unit tests for `src/modules/billing/billing.service.ts`.
 *
 * Two invariants from §26.4 carry the money here, and both are asserted directly:
 *
 *   · **the client sends `packId` and nothing else** — the server prices the pack
 *     and computes GST, because a client-supplied amount is how marketplaces give
 *     inventory away;
 *   · **`verifyOrder` never credits.** It confirms the handshake and reports
 *     state. With a real gateway the webhook is the only writer, and that has to
 *     stay true of the code path the browser can reach.
 *
 * `settleCapturedPayment` is the only function that turns money into credits, so
 * its replay guard gets its own tests: running it twice for one order must be a
 * no-op, not a second credit.
 */
const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';

function capture(overrides: Partial<GatewayCapture> = {}): GatewayCapture {
  return {
    gatewayPaymentId: 'dev_pay_0123456789abcd',
    method: 'development',
    amountPaise: 531_000n,
    rawPayload: { provider: 'development' },
    ...overrides,
  };
}

interface Options {
  order?: Record<string, unknown> | null;
  orderWithRelations?: Record<string, unknown> | null;
  alreadySettled?: { balanceAfter: number } | null;
  dealer?: Record<string, unknown> | null;
  pack?: Record<string, unknown> | null;
  packs?: Record<string, unknown>[];
  ledger?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
  invoice?: Record<string, unknown> | null;
  owner?: Record<string, unknown> | null;
  usedThisMonth?: number;
  gstPercent?: number;
  settlement?: 'immediate' | 'webhook';
  handshakeOk?: boolean;
  invoiceSeq?: bigint;
}

function setup(options: Options = {}) {
  const orderCreates: Record<string, unknown>[] = [];
  const orderUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const invoiceCreates: Record<string, unknown>[] = [];
  const paymentUpserts: Record<string, unknown>[] = [];
  const creditRows: Record<string, unknown>[] = [];
  const outbox: Record<string, unknown>[] = [];
  const gatewayOrders: Record<string, unknown>[] = [];

  const order = {
    id: 'order-1',
    dealerId: DEALER,
    credits: 10,
    amountPaise: 450_000n,
    taxPaise: 81_000n,
    totalPaise: 531_000n,
    status: 'PENDING',
    gatewayOrderId: 'dev_order_0123456789abcd',
    ...(options.order ?? {}),
  };

  const tx = {
    order: {
      findUnique: () =>
        Promise.resolve(
          options.orderWithRelations === null
            ? null
            : {
                ...order,
                pack: { slug: 'growth' },
                dealer: { gstin: '33AABCS1429B1ZX' },
                ...(options.orderWithRelations ?? {}),
              },
        ),
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        orderUpdates.push(args);
        return Promise.resolve({});
      },
    },
    creditTransaction: {
      findUnique: () => Promise.resolve(options.alreadySettled ?? null),
      findFirst: () => Promise.resolve({ balanceAfter: 29 }),
      create: (args: { data: Record<string, unknown> }) => {
        creditRows.push(args.data);
        return Promise.resolve({ id: 'txn-1', ...args.data });
      },
    },
    payment: {
      upsert: (args: { create: Record<string, unknown> }) => {
        paymentUpserts.push(args.create);
        return Promise.resolve({ id: 'payment-1' });
      },
    },
    invoice: {
      create: (args: { data: Record<string, unknown> }) => {
        invoiceCreates.push(args.data);
        return Promise.resolve({});
      },
    },
    dealer: { update: () => Promise.resolve({}) },
    outboxEvent: {
      create: (args: { data: Record<string, unknown> }) => {
        outbox.push(args.data);
        return Promise.resolve({});
      },
    },
    $queryRaw: (strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join('').includes('nextval')
          ? [{ n: options.invoiceSeq ?? 7n }]
          : [{ credit_balance: 29 }],
      ),
    $executeRawUnsafe: () => Promise.resolve(1),
  };

  const prisma = {
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
    order: {
      findUnique: () => Promise.resolve(options.order === null ? null : order),
      findFirst: () =>
        Promise.resolve(
          options.orderWithRelations === null
            ? null
            : {
                ...order,
                invoices: options.invoices ?? [],
                dealer: { creditBalance: 39 },
                ...(options.orderWithRelations ?? {}),
              },
        ),
      create: (args: { data: Record<string, unknown> }) => {
        orderCreates.push(args.data);
        return Promise.resolve({ id: 'order-1', ...args.data });
      },
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        orderUpdates.push(args);
        return Promise.resolve({});
      },
    },
    creditPack: {
      findFirst: () =>
        Promise.resolve(
          options.pack === null
            ? null
            : {
                id: 'pack-1',
                slug: 'growth',
                credits: 10,
                pricePaise: 450_000n,
                ...(options.pack ?? {}),
              },
        ),
      findMany: () => Promise.resolve(options.packs ?? []),
    },
    creditTransaction: {
      count: () => Promise.resolve(options.usedThisMonth ?? 0),
      findMany: () => Promise.resolve(options.ledger ?? []),
    },
    invoice: {
      findMany: () => Promise.resolve(options.invoices ?? []),
      findFirst: () => Promise.resolve(options.invoice ?? null),
    },
  } as unknown as PrismaClient;

  const dealers = {
    findById: () =>
      Promise.resolve(
        options.dealer === null
          ? null
          : {
              id: DEALER,
              slug: 'sri-lakshmi-motors',
              brandName: 'Sri Lakshmi Motors',
              contactEmail: 'contact@sri-lakshmi-motors.in',
              contactPhone: '9840012345',
              creditBalance: 39,
              creditsHeld: 2,
              ...(options.dealer ?? {}),
            },
      ),
    ownerOf: () => Promise.resolve(options.owner ?? null),
  } as unknown as DealersRepository;

  const payments = {
    name: 'development',
    createOrder: (request: Record<string, unknown>) => {
      gatewayOrders.push(request);
      return Promise.resolve({
        gatewayOrderId: 'dev_order_0123456789abcd',
        settlement: options.settlement ?? 'webhook',
        ...(options.settlement === 'immediate' ? { capture: capture() } : {}),
      });
    },
    verifyClientHandshake: () => options.handshakeOk ?? true,
  } as unknown as PaymentProvider;

  const config = {
    number: (key: string) =>
      Promise.resolve(key === 'billing.gstPercent' ? (options.gstPercent ?? 18) : 90),
    boolean: () => Promise.resolve(false),
    stringList: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
    set: () => Promise.reject(new Error('not used')),
    flag: () => Promise.resolve(false),
    flags: () => Promise.resolve({}),
    invalidate: () => Promise.resolve(),
  } as unknown as PlatformConfigService;

  return {
    service: createBillingService({ prisma, dealers, payments, config }),
    orderCreates,
    orderUpdates,
    invoiceCreates,
    paymentUpserts,
    creditRows,
    outbox,
    gatewayOrders,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('summary', () => {
  it('reports the balance, the held count and what a credit buys', async () => {
    const h = setup({ usedThisMonth: 4 });

    const summary = await h.service.summary(DEALER);

    expect(summary).toMatchObject({
      creditBalance: 39,
      creditsHeld: 2,
      creditsAvailable: 39,
      usedThisMonth: 4,
      listingDurationDays: 90,
    });
    expect(summary.note).toContain('90 days');
  });

  it('never reports a negative available balance', async () => {
    const h = setup({ dealer: { creditBalance: -1 } });

    expect((await h.service.summary(DEALER)).creditsAvailable).toBe(0);
  });

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.summary(DEALER)).rejects.toThrow(NotFoundError);
  });
});

describe('packs', () => {
  it('derives the per-listing rate by division rather than storing it', async () => {
    const h = setup({
      packs: [
        {
          id: 'pack-1',
          slug: 'growth',
          credits: 10,
          pricePaise: 1_000_000n,
          badge: 'Popular',
          highlighted: true,
        },
      ],
    });

    const response = await h.service.packs();

    // §26.1: a stored rate that disagrees with the division is a support ticket.
    expect(response.data[0]?.perListingLabel).toBe('₹1,000 per listing');
    expect(response.data[0]?.priceLabel).toBe('₹10,000');
  });

  it('returns paise as numbers and states that tax is extra', async () => {
    const h = setup({
      packs: [
        { id: 'p', slug: 's', credits: 5, pricePaise: 450_000n, badge: null, highlighted: false },
      ],
    });

    const response = await h.service.packs();

    expect(response.data[0]?.pricePaise).toBe(450_000);
    expect(response.currency).toBe('INR');
    expect(response.taxNote).toContain('18% GST');
  });

  it('returns an empty list when nothing is on sale', async () => {
    const h = setup({ packs: [] });

    expect((await h.service.packs()).data).toEqual([]);
  });
});

describe('createOrder', () => {
  it('prices the pack server-side and computes GST', async () => {
    const h = setup({ gstPercent: 18 });

    const response = await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    // §26.4: the client sends `packId` and nothing else.
    expect(response.amountPaise).toBe(450_000);
    expect(response.taxPaise).toBe(81_000);
    expect(response.totalPaise).toBe(531_000);
    expect(response.totalLabel).toBe('₹5,310');
  });

  it('computes tax in integer paise, never a float', async () => {
    const h = setup({ pack: { pricePaise: 333_333n }, gstPercent: 18 });

    await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    // BigInt division truncates, which is the correct behaviour for money: it
    // can never produce a fraction of a paisa.
    expect(h.orderCreates[0]?.taxPaise).toBe(59_999n);
    expect(typeof h.orderCreates[0]?.taxPaise).toBe('bigint');
  });

  it('reads the GST rate from platform config', async () => {
    const h = setup({ gstPercent: 12 });

    const response = await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    expect(response.taxPaise).toBe(54_000);
  });

  it('records the gateway order id against the order', async () => {
    const h = setup();

    await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    expect(h.orderUpdates[0]?.data).toEqual({ gatewayOrderId: 'dev_order_0123456789abcd' });
  });

  it('passes only ids and the server-computed amount to the provider', async () => {
    const h = setup();

    await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    expect(h.gatewayOrders[0]).toMatchObject({
      orderId: 'order-1',
      dealerId: DEALER,
      credits: 10,
      totalPaise: 531_000n,
      currency: 'INR',
      notes: { dealerSlug: 'sri-lakshmi-motors', packSlug: 'growth' },
    });
  });

  it('settles inline when the provider reports an immediate capture', async () => {
    const h = setup({ settlement: 'immediate' });

    const response = await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    // There is no gateway page in the way, and no second implementation of
    // "add credits" — this goes through the same function a webhook calls.
    expect(response.autoCaptured).toBe(true);
    expect(h.creditRows).toHaveLength(1);
    expect(h.invoiceCreates).toHaveLength(1);
  });

  it('waits for the webhook when the provider says so', async () => {
    const h = setup({ settlement: 'webhook' });

    const response = await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    expect(response.autoCaptured).toBe(false);
    expect(h.creditRows).toEqual([]);
  });

  it('prefills checkout from the dealership record', async () => {
    const h = setup({ owner: { user: { email: 'owner@sri-lakshmi-motors.in' } } });

    const response = await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    expect(response.prefill).toEqual({
      name: 'Sri Lakshmi Motors',
      email: 'owner@sri-lakshmi-motors.in',
      contact: '9840012345',
    });
  });

  it('falls back to the dealership email when there is no owner', async () => {
    const h = setup({ owner: null });

    expect(
      (await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' })).prefill.email,
    ).toBe('contact@sri-lakshmi-motors.in');
  });

  it('prefills an empty contact rather than null when no number is on file', async () => {
    const h = setup({ dealer: { contactPhone: null } });

    expect(
      (await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' })).prefill.contact,
    ).toBe('');
  });

  it('expires the checkout window in fifteen minutes', async () => {
    const h = setup();

    const response = await h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' });

    const expires = new Date(response.expiresAt).getTime();
    expect(expires).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
  });

  it('404s a pack that is not on sale', async () => {
    const h = setup({ pack: null });

    await expect(h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' })).rejects.toThrow(
      /not available/,
    );
    expect(h.orderCreates).toEqual([]);
  });

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.createOrder(DEALER, 'user-1', { packId: 'pack-1' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('settleCapturedPayment', () => {
  it('credits the pack, writes an invoice and marks the order paid', async () => {
    const h = setup();

    const result = await h.service.settleCapturedPayment('order-1', capture());

    expect(result).toMatchObject({ creditsAdded: 10, replay: false });
    expect(h.creditRows[0]).toMatchObject({ delta: 10, reason: 'PURCHASE' });
    expect(h.orderUpdates[0]?.data).toMatchObject({ status: 'PAID' });
    expect(h.invoiceCreates).toHaveLength(1);
  });

  it('is idempotent per order, so a replayed webhook credits nothing', async () => {
    const h = setup({ alreadySettled: { balanceAfter: 49 } });

    const result = await h.service.settleCapturedPayment('order-1', capture());

    // §26.4: the idempotency key means running it twice is a no-op rather than a
    // dealer being credited twice.
    expect(result).toMatchObject({ creditsAdded: 0, balanceAfter: 49, replay: true });
    expect([h.creditRows, h.invoiceCreates]).toEqual([[], []]);
  });

  it('keys idempotency on the order, not on the gateway payment', async () => {
    const h = setup();

    await h.service.settleCapturedPayment('order-1', capture());

    // A gateway that retries with a new payment id must still not double-credit.
    expect(h.creditRows[0]?.idempotencyKey).toBe('order:order-1:capture');
  });

  it('records the payment with the gateway’s own reference', async () => {
    const h = setup();

    await h.service.settleCapturedPayment('order-1', capture());

    expect(h.paymentUpserts[0]).toMatchObject({
      gatewayPaymentId: 'dev_pay_0123456789abcd',
      method: 'development',
      status: 'CAPTURED',
      amountPaise: 531_000n,
    });
  });

  it('numbers the invoice by financial year from a database sequence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const h = setup({ invoiceSeq: 7n });

    await h.service.settleCapturedPayment('order-1', capture());

    // §26.5: the Indian financial year runs April–March, so August 2026 is FY
    // 2026 — and the number comes from a sequence, never from a count.
    expect(h.invoiceCreates[0]?.number).toBe('DD-INV-2026-0007');
  });

  it('uses the previous financial year for a January invoice', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T00:00:00.000Z'));
    const h = setup({ invoiceSeq: 12n });

    await h.service.settleCapturedPayment('order-1', capture());

    expect(h.invoiceCreates[0]?.number).toBe('DD-INV-2026-0012');
  });

  it('copies the tax breakdown and the GSTIN onto the invoice', async () => {
    const h = setup();

    await h.service.settleCapturedPayment('order-1', capture());

    expect(h.invoiceCreates[0]).toMatchObject({
      credits: 10,
      amountPaise: 450_000n,
      taxPaise: 81_000n,
      totalPaise: 531_000n,
      status: 'CAPTURED',
      gstin: '33AABCS1429B1ZX',
      placeOfSupply: '33',
    });
  });

  it('publishes CreditsPurchased in the same transaction', async () => {
    const h = setup();

    await h.service.settleCapturedPayment('order-1', capture());

    expect(h.outbox[0]).toMatchObject({ eventType: 'CreditsPurchased' });
  });

  it('404s an order that does not exist', async () => {
    const h = setup({ order: null });

    await expect(h.service.settleCapturedPayment('order-1', capture())).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('verifyOrder', () => {
  it('never credits — it reads and reports', async () => {
    const h = setup({ orderWithRelations: { status: 'PAID' } });

    const response = await h.service.verifyOrder(DEALER, 'order-1', {});

    // §26.4. The browser can be closed, throttled, or lying; the webhook (or the
    // inline settle) is the only writer.
    expect(h.creditRows).toEqual([]);
    expect(response.verified).toBe(true);
  });

  it('reports the credits and the invoice once the order is paid', async () => {
    const h = setup({
      orderWithRelations: { status: 'PAID' },
      invoices: [{ id: 'invoice-1', number: 'DD-INV-2026-0007' }],
    });

    const response = await h.service.verifyOrder(DEALER, 'order-1', {});

    expect(response).toMatchObject({
      orderStatus: 'PAID',
      creditsAdded: 10,
      creditBalance: 39,
      invoice: { id: 'invoice-1', number: 'DD-INV-2026-0007' },
    });
    expect(response.message).toContain('10 credits added');
  });

  it('asks the client to poll while the webhook is still in flight', async () => {
    const h = setup({ orderWithRelations: { status: 'PENDING' } });

    const response = await h.service.verifyOrder(DEALER, 'order-1', {});

    // The deferred branch: credits appear when the webhook lands, never because
    // a client said so.
    expect(response).toMatchObject({
      verified: true,
      orderStatus: 'PENDING',
      creditsAdded: 0,
      invoice: null,
      pollAfterSeconds: 2,
    });
  });

  it('reports a paid order with no invoice row as null rather than failing', async () => {
    const h = setup({ orderWithRelations: { status: 'PAID' }, invoices: [] });

    expect((await h.service.verifyOrder(DEALER, 'order-1', {})).invoice).toBeNull();
  });

  it('refuses a handshake the provider rejects', async () => {
    const h = setup({ handshakeOk: false });

    try {
      await h.service.verifyOrder(DEALER, 'order-1', { paymentId: 'p', signature: 'bad' });
      expect.unreachable('a bad signature must not verify');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('SIGNATURE_MISMATCH');
    }
  });

  it('404s an order belonging to another dealership', async () => {
    const h = setup({ orderWithRelations: null });

    await expect(h.service.verifyOrder(DEALER, 'order-1', {})).rejects.toThrow(NotFoundError);
  });
});

describe('ledger', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'txn-1',
    seq: 12n,
    delta: -1,
    label: 'Submitted for review — 2021 Alto 800',
    reason: 'HOLD_SUBMIT',
    createdAt: new Date('2026-08-17T10:00:00.000Z'),
    balanceAfter: 38,
    listingId: 'listing-1',
    orderId: null,
    ...overrides,
  });

  it('signs and tones each movement', async () => {
    const h = setup({
      ledger: [
        row({ delta: 10, reason: 'PURCHASE' }),
        row({ delta: -1 }),
        row({ delta: 0, reason: 'CONSUME_APPROVE' }),
      ],
    });

    const response = await h.service.ledger(DEALER, { limit: 24 });

    expect(response.data.map((entry) => entry.deltaLabel)).toEqual(['+10', '−1', '0']);
    expect(response.data.map((entry) => entry.tone)).toEqual(['ok', 'err', 'neutral']);
  });

  it('uses a minus sign rather than a hyphen', async () => {
    const h = setup({ ledger: [row({ delta: -1 })] });

    const label = (await h.service.ledger(DEALER, { limit: 24 })).data[0]?.deltaLabel;

    expect(label).toBe('−1');
    expect(label).not.toBe('-1');
  });

  it('shows the running balance from the row, never a sum', async () => {
    const h = setup({ ledger: [row({ balanceAfter: 38 })] });

    const entry = (await h.service.ledger(DEALER, { limit: 24 })).data[0];

    expect(entry?.balanceAfter).toBe(38);
    expect(entry?.balanceLabel).toBe('bal 38');
  });

  it('joins a purchase to its invoice number', async () => {
    const h = setup({
      ledger: [row({ delta: 10, reason: 'PURCHASE', orderId: 'order-1' })],
      invoices: [{ orderId: 'order-1', number: 'DD-INV-2026-0007' }],
    });

    expect((await h.service.ledger(DEALER, { limit: 24 })).data[0]?.invoiceNumber).toBe(
      'DD-INV-2026-0007',
    );
  });

  it('reports a null invoice number for a movement with no order', async () => {
    const h = setup({ ledger: [row()] });

    expect((await h.service.ledger(DEALER, { limit: 24 })).data[0]?.invoiceNumber).toBeNull();
  });

  it('reports a null invoice number when the order has no invoice yet', async () => {
    const h = setup({ ledger: [row({ orderId: 'order-1' })], invoices: [] });

    expect((await h.service.ledger(DEALER, { limit: 24 })).data[0]?.invoiceNumber).toBeNull();
  });

  it('paginates on the append sequence', async () => {
    const h = setup({ ledger: [row({ seq: 3n }), row({ seq: 2n }), row({ seq: 1n })] });

    const response = await h.service.ledger(DEALER, { limit: 2 });

    expect(response.data).toHaveLength(2);
    expect(response.page.hasMore).toBe(true);
    expect(response.page.nextCursor).not.toBeNull();
  });

  it('stops paginating on the last page', async () => {
    const h = setup({ ledger: [row()] });

    expect((await h.service.ledger(DEALER, { limit: 24 })).page).toEqual({
      hasMore: false,
      nextCursor: null,
    });
  });

  it('formats the date for display alongside the ISO timestamp', async () => {
    const h = setup({ ledger: [row()] });

    const entry = (await h.service.ledger(DEALER, { limit: 24 })).data[0];

    expect(entry?.createdAt).toBe('2026-08-17T10:00:00.000Z');
    expect(entry?.dateLabel).toBe('17 Aug 2026');
  });
});

describe('invoices', () => {
  const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'invoice-1',
    number: 'DD-INV-2026-0007',
    issuedAt: new Date('2026-08-17T10:00:00.000Z'),
    amountPaise: 450_000n,
    totalPaise: 531_000n,
    status: 'CAPTURED',
    credits: 10,
    pdfMediaKey: 'invoices/DD-INV-2026-0007.pdf',
    failureReason: null,
    ...overrides,
  });

  it('lists invoices newest first with a download link', async () => {
    const h = setup({ invoices: [invoice()] });

    const response = await h.service.invoices(DEALER, { limit: 24 });

    expect(response.data[0]).toMatchObject({
      number: 'DD-INV-2026-0007',
      totalPaise: 531_000,
      amountLabel: '₹4,500',
      credits: 10,
      pdfReady: true,
      pdfUrl: '/v1/dealer/billing/invoices/invoice-1/pdf',
      statusTone: 'ok',
    });
  });

  it('keeps a failed payment’s invoice, with no PDF and a reason', async () => {
    const h = setup({
      invoices: [invoice({ status: 'FAILED', pdfMediaKey: null, failureReason: 'Card declined.' })],
    });

    const entry = (await h.service.invoices(DEALER, { limit: 24 })).data[0];

    // §26.5: the dealer sees the attempt rather than wondering where it went.
    expect(entry?.pdfUrl).toBeNull();
    expect(entry?.pdfReady).toBe(false);
    expect(entry?.failureReason).toBe('Card declined.');
    expect(entry?.statusTone).toBe('err');
  });

  it('paginates on the issue date', async () => {
    const h = setup({ invoices: [invoice(), invoice({ id: 'b' }), invoice({ id: 'c' })] });

    const response = await h.service.invoices(DEALER, { limit: 2 });

    expect(response.data).toHaveLength(2);
    expect(response.page.nextCursor).not.toBeNull();
  });
});

describe('invoicePdfKey', () => {
  it('returns the storage key for a rendered invoice', async () => {
    const h = setup({ invoice: { id: 'invoice-1', pdfMediaKey: 'invoices/x.pdf' } });

    expect(await h.service.invoicePdfKey(DEALER, 'invoice-1')).toBe('invoices/x.pdf');
  });

  it('reports PDF_NOT_READY while rendering is still queued', async () => {
    const h = setup({ invoice: { id: 'invoice-1', pdfMediaKey: null } });

    try {
      await h.service.invoicePdfKey(DEALER, 'invoice-1');
      expect.unreachable();
    } catch (error) {
      // A distinct code, so the client knows to poll rather than to retry the
      // purchase.
      expect((error as NotFoundError).code).toBe('PDF_NOT_READY');
    }
  });

  it('404s an invoice belonging to another dealership', async () => {
    const h = setup({ invoice: null });

    await expect(h.service.invoicePdfKey(DEALER, 'invoice-1')).rejects.toThrow(NotFoundError);
  });
});
