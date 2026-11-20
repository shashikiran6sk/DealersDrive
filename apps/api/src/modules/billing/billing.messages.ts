import { creditsLabel } from '@dealers-drive/contracts';

export const INSUFFICIENT_CREDITS = (required: number, available: number): string =>
  `Submitting this car needs ${creditsLabel(required)}. You have ${creditsLabel(available)} available.`;

export const INSUFFICIENT_CREDITS_SALES = (required: number, available: number): string =>
  `This dealership doesn't have enough credits for this car — it needs ${creditsLabel(required)} and has ${creditsLabel(available)} available. Ask the dealership's owner to buy credits from Billing in their dealer console, or ask a Dealers-Drive super admin to add credits.`;

export const CREDITS_WOULD_GO_NEGATIVE = (available: number): string =>
  `That would take the dealership below zero — it has ${creditsLabel(available)} available.`;

export const DEALER_NOT_FOUND = 'That dealership does not exist.';

export const PACK_NOT_FOUND =
  'That credit pack is not on sale. Reload the page to see the current packs.';

export const PAYMENTS_DISABLED =
  'Online payment is not switched on yet. Contact Dealers-Drive to add credits.';

export const ORDER_NOT_FOUND = 'That order does not exist.';

export const RECHECK_MESSAGES = {
  paid: 'Razorpay confirmed the payment. The credits have been added.',
  'already-paid': 'This order was already paid and credited. Nothing changed.',
  unpaid: 'Razorpay has no completed payment for this order. Nothing changed.',
  mismatch:
    'Razorpay has a payment for a different amount than this order. Nothing was credited — check it in the Razorpay dashboard.',
} as const;

export const CHECKOUT_NOT_COMPLETED = 'Checkout was not completed.';

export const SIGNATURE_MISMATCH =
  'We could not confirm that payment with Razorpay. If money left your account, it will be credited or refunded automatically — contact support with the payment id.';

export const PAYMENT_NOT_CAPTURED =
  'Razorpay has not confirmed this payment yet. Your credits will appear as soon as it does.';

export const PAYMENT_AMOUNT_MISMATCH =
  'The amount Razorpay received does not match this order. Contact support with the payment id.';

export const ORDER_PAID = (credits: number): string =>
  `${creditsLabel(credits)} added — payment received. Thank you.`;

export const ORDER_DESCRIPTION = (credits: number): string =>
  `${creditsLabel(credits)} for Dealers-Drive listings`;

export const TAX_NOTE = (gstPercent: number): string =>
  gstPercent > 0
    ? `Prices are before ${String(gstPercent)}% GST, which is added at checkout.`
    : 'Prices are final — no GST is charged.';

export const SAVINGS_LABEL = (percent: number): string => `Save ${String(percent)}%`;

export const LEDGER_NOTES = {
  hold: 'Held while the listing is reviewed',
  holdAdjusted: 'Hold changed with the photo plan',
  release: 'Returned — the listing was not approved',
  consume: 'Used — the listing went live',
} as const;
