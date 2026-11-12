import { z } from 'zod';

import { CursorPage, Uuid, formatRupees } from './common.js';
import { CreditReason, StatusTone } from './enums.js';
import type { PhotoPlan } from './dealer-photos.js';

/**
 * Listing credits (**F050–F054**, revised).
 *
 * A credit is the unit a listing is paid in. Submitting a car for review
 * **holds** what it costs; an approval **consumes** the hold and a rejection
 * **releases** it, so a dealership pays only for cars that go live. A request
 * for changes keeps the hold, and a resubmission adjusts it to the current
 * cost of the photo plan.
 *
 * What a car costs is two admin-configurable numbers:
 *
 *   billing.listingCredits     — every submission (default 1)
 *   billing.photoshootCredits  — added when Dealers-Drive photographs it (default 1)
 *
 * and what a credit costs is `billing.creditPacks`. With the defaults, a car
 * the dealer photographs is one credit (₹500) and a Dealers-Drive photoshoot
 * is two (₹1,000), both before GST.
 */

export const CREDIT_REASON_LABELS: Record<CreditReason, string> = {
  PURCHASE: 'Credits purchased',
  ADMIN_GRANT: 'Credits added by Dealers-Drive',
  ADMIN_DEDUCT: 'Credits removed by Dealers-Drive',
  HOLD_SUBMIT: 'Held for a listing in review',
  HOLD_ADJUST: 'Hold changed with the photo plan',
  RELEASE_REJECT: 'Returned — listing not approved',
  CONSUME_APPROVE: 'Used — listing approved',
};

export const CreditOrderStatus = z.enum(['CREATED', 'PAID', 'FAILED']);
export type CreditOrderStatus = z.infer<typeof CreditOrderStatus>;

export const CREDIT_ORDER_STATUS_LABELS: Record<CreditOrderStatus, string> = {
  CREATED: 'Awaiting payment',
  PAID: 'Paid',
  FAILED: 'Failed',
};

export const CREDIT_ORDER_STATUS_TONES: Record<CreditOrderStatus, StatusTone> = {
  CREATED: 'neutral',
  PAID: 'ok',
  FAILED: 'err',
};

/** The two configurable credit costs a submission is priced from. */
export interface CreditCosts {
  listing: number;
  photoshoot: number;
}

/**
 * What one submission costs, in credits. A listing with no plan — every one
 * submitted before plans existed, and those a Sales Representative submits —
 * costs the base listing credits.
 */
export function submissionCost(plan: PhotoPlan | null, costs: CreditCosts): number {
  return costs.listing + (plan === 'DEALERS_DRIVE' ? costs.photoshoot : 0);
}

/** One configured pack, as parsed from `billing.creditPacks`. */
export interface PackDefinition {
  credits: number;
  pricePaise: number;
}

const PACK_ENTRY = /^\s*(\d{1,4})\s*=\s*(\d{1,10})\s*$/;

/**
 * `billing.creditPacks` is a list of `credits=pricePaise` entries, e.g.
 * `["1=50000", "5=225000", "10=400000"]`. Returns the packs in credit order,
 * or the reasons the list is unusable — the admin console refuses to save
 * one that has any.
 */
export function parseCreditPacks(
  entries: readonly string[],
): { ok: true; packs: PackDefinition[] } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const packs: PackDefinition[] = [];
  for (const entry of entries) {
    const match = PACK_ENTRY.exec(entry);
    const credits = Number(match?.[1]);
    const pricePaise = Number(match?.[2]);
    if (!match || credits < 1 || pricePaise < 100) {
      problems.push(`"${entry}" is not credits=pricePaise, e.g. 5=225000 for 5 credits at ₹2,250.`);
      continue;
    }
    if (packs.some((pack) => pack.credits === credits)) {
      problems.push(`There are two packs of ${String(credits)} credits.`);
      continue;
    }
    packs.push({ credits, pricePaise });
  }
  if (entries.length === 0) problems.push('At least one pack is needed.');
  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, packs: packs.sort((a, b) => a.credits - b.credits) };
}

export function packId(credits: number): string {
  return `pack-${String(credits)}`;
}

/** GST on an amount, rounded to the paisa, half up. */
export function gstPaise(amountPaise: number, gstPercent: number): number {
  return Math.round((amountPaise * gstPercent) / 100);
}

/**
 * The dealership's credits and what its next car will cost. `enabled` is
 * the `feature.listingCredits` flag: while it is off nothing is held and the
 * console shows no balance.
 */
export const BillingSummary = z.object({
  enabled: z.boolean(),
  balance: z.number().int(),
  held: z.number().int(),
  available: z.number().int(),
  costs: z.object({
    DEALER: z.number().int(),
    DEALERS_DRIVE: z.number().int(),
    UNPLANNED: z.number().int(),
  }),
  /** The cheapest single credit, for "1 credit = ₹500" lines. */
  creditPriceLabel: z.string().nullable(),
  canPurchase: z.boolean(),
});
export type BillingSummary = z.infer<typeof BillingSummary>;

export const CreditPack = z.object({
  id: z.string(),
  credits: z.number().int(),
  pricePaise: z.number().int(),
  priceLabel: z.string(),
  totalPaise: z.number().int(),
  totalLabel: z.string(),
  perCreditLabel: z.string(),
  savingsLabel: z.string().nullable(),
});
export type CreditPack = z.infer<typeof CreditPack>;

export const CreditPacksResponse = z.object({
  data: z.array(CreditPack),
  gstPercent: z.number(),
  taxNote: z.string(),
  /** False while no payment gateway is configured; packs are still shown. */
  purchasable: z.boolean(),
});
export type CreditPacksResponse = z.infer<typeof CreditPacksResponse>;

/** **The client never sends an amount** — only which pack. */
export const CreateCreditOrderInput = z
  .object({ packId: z.string().regex(/^pack-\d{1,4}$/) })
  .strict();
export type CreateCreditOrderInput = z.infer<typeof CreateCreditOrderInput>;

export const PaymentGatewayName = z.enum(['razorpay', 'fake']);
export type PaymentGatewayName = z.infer<typeof PaymentGatewayName>;

/**
 * What the browser needs to open the payment gateway's checkout. With the
 * `fake` gateway (development and tests only — the API refuses it in
 * production) `simulation` carries a valid payment id and signature, so the
 * whole verify path runs without a real card.
 */
export const CreditCheckout = z.object({
  orderId: Uuid,
  gateway: PaymentGatewayName,
  gatewayOrderId: z.string(),
  keyId: z.string(),
  credits: z.number().int(),
  amountPaise: z.number().int(),
  taxPaise: z.number().int(),
  totalPaise: z.number().int(),
  totalLabel: z.string(),
  currency: z.literal('INR'),
  description: z.string(),
  prefill: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    contact: z.string().nullable(),
  }),
  simulation: z.object({ paymentId: z.string(), signature: z.string() }).nullable(),
});
export type CreditCheckout = z.infer<typeof CreditCheckout>;

/** Razorpay Checkout's success handler payload, forwarded verbatim. */
export const VerifyCreditOrderInput = z
  .object({
    razorpayOrderId: z.string().min(1).max(64),
    razorpayPaymentId: z.string().min(1).max(64),
    razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type VerifyCreditOrderInput = z.infer<typeof VerifyCreditOrderInput>;

export const CreditOrderResult = z.object({
  orderId: Uuid,
  status: CreditOrderStatus,
  credits: z.number().int(),
  balance: z.number().int(),
  available: z.number().int(),
  message: z.string(),
});
export type CreditOrderResult = z.infer<typeof CreditOrderResult>;

export const CreditLedgerEntry = z.object({
  id: z.string(),
  reason: CreditReason,
  label: z.string(),
  delta: z.number().int(),
  heldDelta: z.number().int(),
  /** What moved, as the dealer reads it: `+5`, `−1`, `1 held`. */
  changeLabel: z.string(),
  tone: StatusTone,
  balanceAfter: z.number().int(),
  availableAfter: z.number().int(),
  listingId: Uuid.nullable(),
  orderId: Uuid.nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  dateLabel: z.string(),
});
export type CreditLedgerEntry = z.infer<typeof CreditLedgerEntry>;

export const CreditLedgerResponse = z.object({
  data: z.array(CreditLedgerEntry),
  page: CursorPage,
});
export type CreditLedgerResponse = z.infer<typeof CreditLedgerResponse>;

export const CreditOrderRow = z.object({
  id: Uuid,
  credits: z.number().int(),
  totalPaise: z.number().int(),
  totalLabel: z.string(),
  status: CreditOrderStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  dateLabel: z.string(),
  paidAt: z.string().nullable(),
});
export type CreditOrderRow = z.infer<typeof CreditOrderRow>;

export const CreditOrdersResponse = z.object({ data: z.array(CreditOrderRow) });
export type CreditOrdersResponse = z.infer<typeof CreditOrdersResponse>;

/**
 * An admin's correction to a dealership's credits (**F054**): positive adds,
 * negative removes. Always with a note, which the dealer sees in the ledger.
 */
export const AdminCreditAdjustmentInput = z
  .object({
    credits: z
      .number()
      .int()
      .min(-1000)
      .max(1000)
      .refine((value) => value !== 0, { message: 'Enter a number of credits other than 0.' }),
    note: z.string().trim().min(3).max(300),
  })
  .strict();
export type AdminCreditAdjustmentInput = z.infer<typeof AdminCreditAdjustmentInput>;

export const AdminDealerCredits = z.object({
  enabled: z.boolean(),
  balance: z.number().int(),
  held: z.number().int(),
  available: z.number().int(),
  ledger: z.array(CreditLedgerEntry),
  orders: z.array(CreditOrderRow),
  canAdjust: z.boolean(),
});
export type AdminDealerCredits = z.infer<typeof AdminDealerCredits>;

/** `5 credits`, `1 credit`. */
export function creditsLabel(credits: number): string {
  return `${credits.toLocaleString('en-IN')} credit${Math.abs(credits) === 1 ? '' : 's'}`;
}

/** `₹450 per credit`. */
export function perCreditLabel(pack: PackDefinition): string {
  return `${formatRupees(Math.round(pack.pricePaise / pack.credits))} per credit`;
}
