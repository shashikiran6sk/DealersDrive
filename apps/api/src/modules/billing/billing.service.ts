import { createHash, randomUUID } from 'node:crypto';

import {
  canDealer,
  formatRupees,
  gstPaise,
  packId,
  parseCreditPacks,
  perCreditLabel,
  submissionCost,
  type AdminCreditAdjustmentInput,
  type AdminDealerCredits,
  type BillingSummary,
  type CreateCreditOrderInput,
  type CreditCheckout,
  type CreditLedgerResponse,
  type CreditOrderResult,
  type CreditOrdersResponse,
  type CreditPacksResponse,
  type CursorQuery,
  type PackDefinition,
  type VerifyCreditOrderInput,
} from '@dealers-drive/contracts';
import type { CreditOrder, PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import {
  AppError,
  ConfigurationError,
  DomainError,
  NotFoundError,
  errorCode,
  isRecord,
} from '../../platform/errors.js';
import type { PaymentGatewayPort } from '../../platform/payments/payment.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';
import { toLedgerEntry, toOrderRow } from './billing.mapper.js';
import {
  ORDER_DESCRIPTION,
  ORDER_NOT_FOUND,
  ORDER_PAID,
  PACK_NOT_FOUND,
  PAYMENTS_DISABLED,
  PAYMENT_AMOUNT_MISMATCH,
  PAYMENT_NOT_CAPTURED,
  SAVINGS_LABEL,
  SIGNATURE_MISMATCH,
  TAX_NOTE,
} from './billing.messages.js';
import { ledgerBalance, moveCredits, type CreditActor } from './credits.js';
import { creditCosts, listingCreditsEnabled } from './listing-credits.js';

export interface BillingDeps {
  prisma: PrismaClient;
  config: PlatformConfigService;
  gateway: PaymentGatewayPort;
  audit: AuditService;
}

export interface BillingActor {
  dealerId: string;
  userId: string;
  permissions?: readonly string[];
}

export interface WebhookDelivery {
  rawBody: Buffer | null;
  signature: string | undefined;
  eventId: string | undefined;
  body: unknown;
}

export const ADMIN_LEDGER_LIMIT = 50;

const ORDER_HISTORY_LIMIT = 50;

class SignatureMismatchError extends AppError {
  readonly status = 400;
  readonly code = 'SIGNATURE_MISMATCH';
  readonly title = 'Payment not verified';
}

function path(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function stringAt(value: unknown, ...keys: string[]): string | null {
  const found = path(value, ...keys);
  return typeof found === 'string' ? found : null;
}

function numberAt(value: unknown, ...keys: string[]): number | null {
  const found = path(value, ...keys);
  return typeof found === 'number' ? found : null;
}

function savingsPercent(pack: PackDefinition, base: PackDefinition | undefined): number {
  if (!base || pack.credits === base.credits) return 0;
  const perCredit = pack.pricePaise / pack.credits;
  const basePerCredit = base.pricePaise / base.credits;
  return Math.max(0, Math.round((1 - perCredit / basePerCredit) * 100));
}

export function createBillingService({ prisma, config, gateway, audit }: BillingDeps) {
  async function packDefinitions(): Promise<PackDefinition[]> {
    const parsed = parseCreditPacks(await config.stringList('billing.creditPacks'));
    if (!parsed.ok) {
      logger.error({ problems: parsed.problems }, 'billing.packs_unusable');
      return [];
    }
    return parsed.packs;
  }

  async function balanceOf(dealerId: string) {
    return withTransaction(prisma, (tx) => ledgerBalance(tx, dealerId));
  }

  async function fulfil(order: CreditOrder, paymentId: string, actor: CreditActor) {
    try {
      return await withTransaction(prisma, async (tx) => {
        const [locked] = await tx.$queryRaw<{ status: string }[]>`
          SELECT "status" FROM "credit_orders" WHERE "id" = ${order.id}::uuid FOR UPDATE`;
        if (!locked) throw new NotFoundError(ORDER_NOT_FOUND, { code: 'ORDER_NOT_FOUND' });
        if (locked.status === 'PAID') return false;

        await tx.creditOrder.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            gatewayPaymentId: paymentId,
            failureReason: null,
          },
        });
        await moveCredits(tx, {
          dealerId: order.dealerId,
          reason: 'PURCHASE',
          delta: order.credits,
          orderId: order.id,
          actor,
          note: formatRupees(order.totalPaise),
        });
        await audit.record(tx, {
          actorType: actor.type,
          actorId: actor.id,
          dealerId: order.dealerId,
          action: 'billing.order_paid',
          entityType: 'CreditOrder',
          entityId: order.id,
          before: { status: locked.status },
          after: {
            status: 'PAID',
            credits: order.credits,
            totalPaise: order.totalPaise.toString(),
            gateway: order.gateway,
            gatewayPaymentId: paymentId,
          },
        });
        return true;
      });
    } catch (error) {
      if (errorCode(error) === 'P2002') return false;
      throw error;
    }
  }

  async function result(order: CreditOrder): Promise<CreditOrderResult> {
    const current = await prisma.creditOrder.findUniqueOrThrow({ where: { id: order.id } });
    const balance = await balanceOf(order.dealerId);
    return {
      orderId: current.id,
      status: current.status,
      credits: current.credits,
      balance: balance.balance,
      available: balance.available,
      message: current.status === 'PAID' ? ORDER_PAID(current.credits) : PAYMENT_NOT_CAPTURED,
    };
  }

  async function handleEvent(event: string, body: unknown): Promise<string> {
    const payment = path(body, 'payload', 'payment', 'entity');
    const gatewayOrderId =
      stringAt(payment, 'order_id') ?? stringAt(body, 'payload', 'order', 'entity', 'id');
    const paymentId = stringAt(payment, 'id');
    if (!gatewayOrderId) return 'ignored:no-order';

    const order = await prisma.creditOrder.findUnique({ where: { gatewayOrderId } });
    if (!order) return 'ignored:unknown-order';

    if (event === 'payment.captured' || event === 'order.paid') {
      if (!paymentId) return 'ignored:no-payment';
      const amount = numberAt(payment, 'amount');
      if (amount !== Number(order.totalPaise)) {
        logger.error(
          { orderId: order.id, amount, expected: order.totalPaise.toString() },
          'billing.webhook_amount_mismatch',
        );
        return 'refused:amount-mismatch';
      }
      return (await fulfil(order, paymentId, { type: 'SYSTEM', id: null }))
        ? 'fulfilled'
        : 'already-paid';
    }

    if (event === 'payment.failed') {
      const reason = stringAt(payment, 'error_description') ?? 'The payment did not go through.';
      const moved = await prisma.creditOrder.updateMany({
        where: { id: order.id, status: 'CREATED' },
        data: { status: 'FAILED', failureReason: reason.slice(0, 300) },
      });
      return moved.count > 0 ? 'failed' : 'ignored:not-open';
    }

    return 'ignored:event';
  }

  return {
    async summary(dealerId: string, permissions?: readonly string[]): Promise<BillingSummary> {
      const [enabled, costs, balance, packs] = await Promise.all([
        listingCreditsEnabled(config),
        creditCosts(config),
        balanceOf(dealerId),
        packDefinitions(),
      ]);
      const single = packs[0];
      return {
        enabled,
        ...balance,
        costs: {
          DEALER: submissionCost('DEALER', costs),
          DEALERS_DRIVE: submissionCost('DEALERS_DRIVE', costs),
          UNPLANNED: submissionCost(null, costs),
        },
        creditPriceLabel: single
          ? formatRupees(Math.round(single.pricePaise / single.credits))
          : null,
        canPurchase: gateway.driver !== 'none' && canDealer(permissions, 'billing:purchase'),
      };
    },

    async packs(): Promise<CreditPacksResponse> {
      const [packs, gstPercent] = await Promise.all([
        packDefinitions(),
        config.number('billing.gstPercent'),
      ]);
      const base = packs[0];
      return {
        data: packs.map((pack) => {
          const total = pack.pricePaise + gstPaise(pack.pricePaise, gstPercent);
          const saving = savingsPercent(pack, base);
          return {
            id: packId(pack.credits),
            credits: pack.credits,
            pricePaise: pack.pricePaise,
            priceLabel: formatRupees(pack.pricePaise),
            totalPaise: total,
            totalLabel: formatRupees(total),
            perCreditLabel: perCreditLabel(pack),
            savingsLabel: saving > 0 ? SAVINGS_LABEL(saving) : null,
          };
        }),
        gstPercent,
        taxNote: TAX_NOTE(gstPercent),
        purchasable: gateway.driver !== 'none',
      };
    },

    async ledger(dealerId: string, query: CursorQuery): Promise<CreditLedgerResponse> {
      const before = query.cursor && /^\d{1,19}$/.test(query.cursor) ? BigInt(query.cursor) : null;
      const rows = await prisma.creditTransaction.findMany({
        where: { dealerId, ...(before ? { id: { lt: before } } : {}) },
        orderBy: { id: 'desc' },
        take: query.limit + 1,
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      return {
        data: page.map(toLedgerEntry),
        page: { nextCursor: hasMore ? (page.at(-1)?.id.toString() ?? null) : null, hasMore },
      };
    },

    async orders(dealerId: string): Promise<CreditOrdersResponse> {
      const rows = await prisma.creditOrder.findMany({
        where: { dealerId },
        orderBy: { createdAt: 'desc' },
        take: ORDER_HISTORY_LIMIT,
      });
      return { data: rows.map(toOrderRow) };
    },

    async createOrder(actor: BillingActor, input: CreateCreditOrderInput): Promise<CreditCheckout> {
      if (gateway.driver === 'none' || !gateway.keyId) {
        throw new ConfigurationError(PAYMENTS_DISABLED, { code: 'PAYMENTS_DISABLED' });
      }
      const pack = (await packDefinitions()).find((one) => packId(one.credits) === input.packId);
      if (!pack) throw new DomainError('PACK_NOT_FOUND', PACK_NOT_FOUND);

      const gstPercent = await config.number('billing.gstPercent');
      const taxPaise = gstPaise(pack.pricePaise, gstPercent);
      const totalPaise = pack.pricePaise + taxPaise;
      const orderId = randomUUID();
      const dealer = await prisma.dealer.findUniqueOrThrow({
        where: { id: actor.dealerId },
        select: { brandName: true, contactEmail: true, contactPhone: true },
      });

      const { gatewayOrderId } = await gateway.createOrder({
        amountPaise: totalPaise,
        receipt: orderId,
        notes: { orderId, dealerId: actor.dealerId, credits: String(pack.credits) },
      });

      await withTransaction(prisma, async (tx) => {
        await tx.creditOrder.create({
          data: {
            id: orderId,
            dealerId: actor.dealerId,
            credits: pack.credits,
            amountPaise: BigInt(pack.pricePaise),
            taxPaise: BigInt(taxPaise),
            totalPaise: BigInt(totalPaise),
            gateway: gateway.driver,
            gatewayOrderId,
            createdBy: actor.userId,
          },
        });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: 'billing.order_created',
          entityType: 'CreditOrder',
          entityId: orderId,
          after: { credits: pack.credits, totalPaise: String(totalPaise), gateway: gateway.driver },
        });
      });

      return {
        orderId,
        gateway: gateway.driver === 'razorpay' ? 'razorpay' : 'fake',
        gatewayOrderId,
        keyId: gateway.keyId,
        credits: pack.credits,
        amountPaise: pack.pricePaise,
        taxPaise,
        totalPaise,
        totalLabel: formatRupees(totalPaise),
        currency: 'INR',
        description: ORDER_DESCRIPTION(pack.credits),
        prefill: {
          name: dealer.brandName,
          email: dealer.contactEmail,
          contact: dealer.contactPhone,
        },
        simulation: gateway.simulate(gatewayOrderId),
      };
    },

    async verify(
      actor: BillingActor,
      orderId: string,
      input: VerifyCreditOrderInput,
    ): Promise<CreditOrderResult> {
      const order = await prisma.creditOrder.findFirst({
        where: { id: orderId, dealerId: actor.dealerId },
      });
      if (!order) throw new NotFoundError(ORDER_NOT_FOUND, { code: 'ORDER_NOT_FOUND' });

      const signed =
        input.razorpayOrderId === order.gatewayOrderId &&
        gateway.verifyCheckout({
          gatewayOrderId: order.gatewayOrderId,
          paymentId: input.razorpayPaymentId,
          signature: input.razorpaySignature,
        });
      if (!signed) {
        logger.warn(
          { orderId, dealerId: actor.dealerId, paymentId: input.razorpayPaymentId },
          'billing.signature_mismatch',
        );
        throw new SignatureMismatchError(SIGNATURE_MISMATCH);
      }
      if (order.status === 'PAID') return result(order);

      const payment = await gateway.confirmPayment(
        input.razorpayPaymentId,
        Number(order.totalPaise),
      );
      if (
        (payment.gatewayOrderId !== null && payment.gatewayOrderId !== order.gatewayOrderId) ||
        payment.amountPaise !== Number(order.totalPaise)
      ) {
        logger.error({ orderId, payment }, 'billing.payment_mismatch');
        throw new DomainError('PAYMENT_MISMATCH', PAYMENT_AMOUNT_MISMATCH);
      }
      if (payment.captured) {
        await fulfil(order, input.razorpayPaymentId, { type: 'DEALER', id: actor.userId });
      }
      return result(order);
    },

    async webhook(delivery: WebhookDelivery): Promise<{ outcome: string }> {
      if (
        !delivery.rawBody ||
        !delivery.signature ||
        !gateway.verifyWebhook(delivery.rawBody, delivery.signature)
      ) {
        logger.warn({ eventId: delivery.eventId }, 'billing.webhook_signature_invalid');
        throw new SignatureMismatchError('The webhook signature did not verify.');
      }
      const event = stringAt(delivery.body, 'event') ?? 'unknown';
      const id =
        delivery.eventId ??
        createHash('sha256').update(delivery.rawBody).digest('hex').slice(0, 40);

      const seen = await prisma.paymentWebhookEvent.findUnique({ where: { id } });
      if (seen?.processedAt) return { outcome: 'duplicate' };
      if (!seen) {
        try {
          await prisma.paymentWebhookEvent.create({
            data: {
              id,
              gateway: gateway.driver,
              event,
              payload: delivery.body ?? {},
            },
          });
        } catch (error) {
          if (errorCode(error) === 'P2002') return { outcome: 'duplicate' };
          throw error;
        }
      }

      const outcome = await handleEvent(event, delivery.body);
      await prisma.paymentWebhookEvent.update({
        where: { id },
        data: { outcome, processedAt: new Date() },
      });
      logger.info({ eventId: id, event, outcome }, 'billing.webhook');
      return { outcome };
    },

    async adminCredits(admin: AdminPrincipal, dealerId: string): Promise<AdminDealerCredits> {
      const dealer = await prisma.dealer.findUnique({
        where: { id: dealerId },
        select: { id: true },
      });
      if (!dealer)
        throw new NotFoundError('That dealership does not exist.', { code: 'DEALER_NOT_FOUND' });
      const [enabled, balance, ledger, orders] = await Promise.all([
        listingCreditsEnabled(config),
        balanceOf(dealerId),
        prisma.creditTransaction.findMany({
          where: { dealerId },
          orderBy: { id: 'desc' },
          take: ADMIN_LEDGER_LIMIT,
        }),
        prisma.creditOrder.findMany({
          where: { dealerId },
          orderBy: { createdAt: 'desc' },
          take: ORDER_HISTORY_LIMIT,
        }),
      ]);
      return {
        enabled,
        ...balance,
        ledger: ledger.map(toLedgerEntry),
        orders: orders.map(toOrderRow),
        canAdjust: admin.permissions.includes('admin:credit:grant'),
      };
    },

    async adjust(
      admin: AdminPrincipal,
      dealerId: string,
      input: AdminCreditAdjustmentInput,
    ): Promise<AdminDealerCredits> {
      await withTransaction(prisma, async (tx) => {
        const row = await moveCredits(tx, {
          dealerId,
          reason: input.credits > 0 ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT',
          delta: input.credits,
          actor: { type: 'ADMIN', id: admin.userId },
          note: input.note,
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: input.credits > 0 ? 'billing.credits_granted' : 'billing.credits_deducted',
          entityType: 'Dealer',
          entityId: dealerId,
          after: { credits: input.credits, note: input.note, balanceAfter: row.balanceAfter },
        });
      });
      return this.adminCredits(admin, dealerId);
    },
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
