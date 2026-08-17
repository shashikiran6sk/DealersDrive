import {
  formatDate,
  formatRupees,
  INVOICE_STATUS_LABELS,
  type BillingSummary,
  type CreateOrderInput,
  type CreateOrderResponse,
  type CreditPacksResponse,
  type CursorQuery,
  type InvoicesResponse,
  type LedgerResponse,
  type StatusTone,
  type VerifyOrderInput,
  type VerifyOrderResponse,
} from '@dealers-drive/contracts';
import { Prisma, type PrismaClient } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { withTenant } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { DomainError, NotFoundError } from '../../platform/errors.js';
import type { GatewayCapture, PaymentProvider } from '../../platform/payments/payment.port.js';
import type { DealersRepository } from '../dealers/dealers.repository.js';
import {
  decodeCursor,
  decodeSeqCursor,
  encodeCursor,
  encodeSeqCursor,
} from '../enquiries/enquiries.service.js';
import { moveCredits } from './credits.service.js';

export interface BillingDeps {
  prisma: PrismaClient;
  dealers: DealersRepository;
  payments: PaymentProvider;
  config: PlatformConfigService;
}

export function createBillingService({ prisma, dealers, payments, config }: BillingDeps) {
  /**
   * The **only** function that turns money into credits.
   *
   * The development provider reaches it inline; a Razorpay `payment.captured`
   * webhook would reach it from the webhook handler. Because both go through
   * here, swapping providers cannot change how a credit is written — and the
   * idempotency key means running it twice for the same order is a no-op
   * rather than a dealer being credited twice (§26.4, §26.8).
   */
  async function settleCapturedPayment(orderId: string, capture: GatewayCapture) {
    return withTenant(prisma, (await requireOrder(orderId)).dealerId, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { pack: true, dealer: true },
      });
      if (!order) throw new NotFoundError('That order does not exist.');

      const idempotencyKey = `order:${order.id}:capture`;
      const already = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
      if (already) {
        return { creditsAdded: 0, balanceAfter: already.balanceAfter, replay: true, order };
      }

      const payment = await tx.payment.upsert({
        where: { gatewayPaymentId: capture.gatewayPaymentId },
        create: {
          orderId: order.id,
          dealerId: order.dealerId,
          gatewayPaymentId: capture.gatewayPaymentId,
          method: capture.method,
          amountPaise: capture.amountPaise,
          status: 'CAPTURED',
          rawPayload: capture.rawPayload as Prisma.InputJsonValue,
          capturedAt: new Date(),
        },
        update: { status: 'CAPTURED', capturedAt: new Date() },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      const movement = await moveCredits(tx, {
        dealerId: order.dealerId,
        delta: order.credits,
        reason: 'PURCHASE',
        label: `Purchased — ${order.credits} credit pack`,
        orderId: order.id,
        actorType: 'DEALER',
        idempotencyKey,
      });

      const number = await nextInvoiceNumber(tx);
      await tx.invoice.create({
        data: {
          number,
          dealerId: order.dealerId,
          orderId: order.id,
          paymentId: payment.id,
          credits: order.credits,
          amountPaise: order.amountPaise,
          taxPaise: order.taxPaise,
          totalPaise: order.totalPaise,
          status: 'CAPTURED',
          gstin: order.dealer.gstin,
          placeOfSupply: '33',
          pdfMediaKey: `invoices/${number}.pdf`,
        },
      });

      await enqueueOutbox(tx, {
        type: 'CreditsPurchased',
        aggregateType: 'Order',
        aggregateId: order.id,
        dealerId: order.dealerId,
        actor: { type: 'DEALER' },
        traceId: getContext()?.traceId ?? 'purchase',
        payload: { orderId: order.id, credits: order.credits, invoiceNumber: number },
      });

      return {
        creditsAdded: order.credits,
        balanceAfter: movement.balanceAfter,
        replay: false,
        order,
      };
    });
  }

  async function requireOrder(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('That order does not exist.');
    return order;
  }

  return {
    settleCapturedPayment,

    async summary(dealerId: string): Promise<BillingSummary> {
      const [dealer, durationDays, usedThisMonth] = await Promise.all([
        dealers.findById(dealerId),
        config.number('listing.durationDays'),
        prisma.creditTransaction.count({
          where: {
            dealerId,
            reason: 'HOLD_SUBMIT',
            createdAt: { gte: startOfMonth() },
          },
        }),
      ]);
      if (!dealer) throw new NotFoundError('That dealership no longer exists.');

      return {
        creditBalance: dealer.creditBalance,
        creditsHeld: dealer.creditsHeld,
        creditsAvailable: Math.max(0, dealer.creditBalance),
        label: 'Listing credits available',
        note: `One credit publishes one vehicle for ${durationDays} days.`,
        listingDurationDays: durationDays,
        usedThisMonth,
      };
    },

    async packs(): Promise<CreditPacksResponse> {
      const rows = await prisma.creditPack.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      return {
        data: rows.map((pack) => ({
          id: pack.id,
          slug: pack.slug,
          credits: pack.credits,
          pricePaise: Number(pack.pricePaise),
          priceLabel: formatRupees(pack.pricePaise),
          // Derived by division, never stored — a stored rate that disagrees
          // with the division is a support ticket (§26.1).
          perListingLabel: `${formatRupees(Number(pack.pricePaise) / pack.credits)} per listing`,
          badge: pack.badge,
          highlighted: pack.highlighted,
        })),
        currency: 'INR',
        taxNote: 'Prices exclude 18% GST.',
      };
    },

    /**
     * C19 create order. The client sends `packId` and nothing else — the
     * server prices the pack and computes GST, because a client-supplied
     * amount is how marketplaces give inventory away (§26.4).
     */
    async createOrder(
      dealerId: string,
      userId: string,
      input: CreateOrderInput,
    ): Promise<CreateOrderResponse> {
      const [pack, dealer, gstPercent] = await Promise.all([
        prisma.creditPack.findFirst({ where: { id: input.packId, isActive: true } }),
        dealers.findById(dealerId),
        config.number('billing.gstPercent'),
      ]);

      if (!pack) throw new NotFoundError('That credit pack is not available.');
      if (!dealer) throw new NotFoundError('That dealership no longer exists.');

      const amountPaise = pack.pricePaise;
      const taxPaise = (amountPaise * BigInt(gstPercent)) / 100n;
      const totalPaise = amountPaise + taxPaise;

      const order = await prisma.order.create({
        data: {
          dealerId,
          packId: pack.id,
          credits: pack.credits,
          amountPaise,
          taxPaise,
          totalPaise,
          status: 'PENDING',
          gateway: payments.name,
        },
      });

      const gateway = await payments.createOrder({
        orderId: order.id,
        dealerId,
        credits: pack.credits,
        totalPaise,
        currency: 'INR',
        notes: { dealerSlug: dealer.slug, packSlug: pack.slug },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { gatewayOrderId: gateway.gatewayOrderId },
      });

      // The development provider settles here and now, through exactly the
      // function a webhook would call. There is no gateway page in the way,
      // and no second implementation of "add credits" (CLAUDE.md §6, §18).
      if (gateway.settlement === 'immediate' && gateway.capture) {
        await settleCapturedPayment(order.id, gateway.capture);
      }

      const owner = await dealers.ownerOf(dealerId);
      void userId;

      return {
        orderId: order.id,
        gatewayOrderId: gateway.gatewayOrderId,
        gateway: payments.name,
        credits: pack.credits,
        amountPaise: Number(amountPaise),
        taxPaise: Number(taxPaise),
        totalPaise: Number(totalPaise),
        totalLabel: formatRupees(totalPaise),
        currency: 'INR',
        prefill: {
          name: dealer.brandName,
          email: owner?.user.email ?? dealer.contactEmail,
          contact: dealer.contactPhone ?? '',
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        autoCaptured: gateway.settlement === 'immediate',
      };
    },

    /**
     * C19 verify. This endpoint **never credits** — it confirms the handshake
     * and reports the current state. With a real gateway the webhook is the
     * only writer; with the development provider the write already happened
     * during `createOrder`, and this still only reads (§26.4).
     */
    async verifyOrder(
      dealerId: string,
      orderId: string,
      input: VerifyOrderInput,
    ): Promise<VerifyOrderResponse> {
      const order = await prisma.order.findFirst({
        where: { id: orderId, dealerId },
        include: { invoices: { orderBy: { issuedAt: 'desc' }, take: 1 }, dealer: true },
      });
      if (!order) throw new NotFoundError('That order does not exist.');

      const verified = payments.verifyClientHandshake({
        gatewayOrderId: order.gatewayOrderId ?? '',
        ...(input.paymentId === undefined ? {} : { paymentId: input.paymentId }),
        ...(input.signature === undefined ? {} : { signature: input.signature }),
      });
      if (!verified) {
        throw new DomainError('SIGNATURE_MISMATCH', 'That payment could not be verified.');
      }

      const invoice = order.invoices[0] ?? null;

      if (order.status !== 'PAID') {
        return {
          verified: true,
          orderStatus: order.status,
          creditsAdded: 0,
          creditBalance: order.dealer.creditBalance,
          invoice: null,
          pollAfterSeconds: 2,
          message: 'Payment received. Your credits will appear in a few seconds.',
        };
      }

      return {
        verified: true,
        orderStatus: 'PAID',
        creditsAdded: order.credits,
        creditBalance: order.dealer.creditBalance,
        invoice: invoice ? { id: invoice.id, number: invoice.number } : null,
        message: `${order.credits} credits added — payment captured.`,
      };
    },

    /** Newest first. `balanceAfter` is read, never summed (§26.2). */
    async ledger(dealerId: string, query: CursorQuery): Promise<LedgerResponse> {
      const rows = await prisma.creditTransaction.findMany({
        where: {
          dealerId,
          ...(query.cursor ? { seq: { lt: BigInt(decodeSeqCursor(query.cursor)) } } : {}),
        },
        orderBy: { seq: 'desc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      const orderIds = page.map((row) => row.orderId).filter((id): id is string => id !== null);
      const invoices = orderIds.length
        ? await prisma.invoice.findMany({ where: { orderId: { in: orderIds } } })
        : [];
      const invoiceByOrder = new Map(invoices.map((invoice) => [invoice.orderId, invoice.number]));

      return {
        data: page.map((row) => ({
          id: row.id,
          delta: row.delta,
          deltaLabel: row.delta > 0 ? `+${row.delta}` : row.delta === 0 ? '0' : `−${-row.delta}`,
          tone: (row.delta > 0 ? 'ok' : row.delta === 0 ? 'neutral' : 'err') as StatusTone,
          label: row.label,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
          dateLabel: formatDate(row.createdAt),
          balanceAfter: row.balanceAfter,
          balanceLabel: `bal ${row.balanceAfter}`,
          listingId: row.listingId,
          orderId: row.orderId,
          invoiceNumber: row.orderId ? (invoiceByOrder.get(row.orderId) ?? null) : null,
        })),
        page: { nextCursor: hasMore && last ? encodeSeqCursor(last.seq) : null, hasMore },
      };
    },

    async invoices(dealerId: string, query: CursorQuery): Promise<InvoicesResponse> {
      const rows = await prisma.invoice.findMany({
        where: {
          dealerId,
          ...(query.cursor ? { issuedAt: { lt: decodeCursor(query.cursor) } } : {}),
        },
        orderBy: { issuedAt: 'desc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      return {
        data: page.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          issuedAt: invoice.issuedAt.toISOString(),
          dateLabel: formatDate(invoice.issuedAt),
          totalPaise: Number(invoice.totalPaise),
          amountLabel: formatRupees(invoice.amountPaise),
          status: invoice.status,
          statusLabel: INVOICE_STATUS_LABELS[invoice.status],
          statusTone: (invoice.status === 'CAPTURED' ? 'ok' : 'err') as StatusTone,
          credits: invoice.credits,
          // A failed payment keeps its invoice row and has no PDF, so the
          // dealer can see the attempt rather than wondering (§26.5).
          pdfUrl: invoice.pdfMediaKey ? `/v1/dealer/billing/invoices/${invoice.id}/pdf` : null,
          pdfReady: invoice.pdfMediaKey !== null,
          failureReason: invoice.failureReason,
        })),
        page: { nextCursor: hasMore && last ? encodeCursor(last.issuedAt) : null, hasMore },
      };
    },

    async invoicePdfKey(dealerId: string, invoiceId: string): Promise<string> {
      const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, dealerId } });
      if (!invoice) throw new NotFoundError('That invoice does not exist.');
      if (!invoice.pdfMediaKey) {
        throw new NotFoundError('The invoice PDF is still being generated.', {
          code: 'PDF_NOT_READY',
        });
      }
      return invoice.pdfMediaKey;
    },
  };
}

export type BillingService = ReturnType<typeof createBillingService>;

/** `DD-INV-{FY}-{NNNN}` from a Postgres sequence (§26.5). */
async function nextInvoiceNumber(tx: {
  $queryRaw: <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}): Promise<string> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('invoice_number_seq') AS n`;
  const sequence = Number(rows[0]?.n ?? 1n);
  const now = new Date();
  // Indian financial year runs April–March.
  const fy = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `DD-INV-${fy}-${String(sequence).padStart(4, '0')}`;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
