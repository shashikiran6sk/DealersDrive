import { CREDITS_POLICY_ROUTE } from './credits-policy.constants';

export const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export const BILLING_HREF = '/dealer/billing';

export const CHECKOUT_THEME_COLOR = '#0c0c0b';

export const BILLING_TEXT = {
  pageTitle: 'Billing & credits',
  intro:
    'Credits pay for listings. Submitting a car holds its credits while our team reviews it; they are used only if the car goes live, and returned if it does not.',
  available: 'Credits available',
  held: 'Held for cars in review',
  balance: 'Total credits',
  heldDelta: (held: number) => (held > 0 ? `${String(held)} in review` : 'None in review'),
  costsTitle: 'What a car costs',
  costDealer: 'You upload the photos',
  costStudio: 'Dealers-Drive photoshoot',
  packsTitle: 'Buy credits',
  buy: 'Buy',
  creditsUnit: (count: number) => (count === 1 ? 'credit' : 'credits'),
  buying: 'Opening payment…',
  perCredit: 'per credit',
  inclGst: (total: string) => `${total} incl. GST`,
  ownerOnly: 'Only the dealership owner can buy credits.',
  gatewayOff:
    'Online payment is not switched on yet. Contact Dealers-Drive support to add credits to your account.',
  pending: 'Payment received. Your credits will appear in a moment — refresh this page shortly.',
  failed: 'The payment could not be completed. You have not been charged.',
  dismissed: 'Payment cancelled. You have not been charged.',
  scriptFailed: 'The payment window could not be opened. Check your connection and try again.',
  simulatedTitle: 'Test payment',
  simulatedBody:
    'This environment has no real payment gateway. Confirm to simulate a successful payment.',
  simulatedConfirm: 'Simulate payment',
  cancel: 'Cancel',
  ledgerTitle: 'Credit history',
  ledgerEmpty: 'No credit movements yet.',
  ordersTitle: 'Payments',
  ordersEmpty: 'No payments yet.',
  merchant: 'Dealers-Drive',
  columns: {
    date: 'Date',
    what: 'What',
    change: 'Change',
    available: 'Available after',
    credits: 'Credits',
    amount: 'Amount',
    status: 'Status',
  },
  purchaseTerms:
    'One-time purchase, not a subscription. Credits never expire, and bought credits are not refundable.',
  policyLink: 'Credits and refunds policy',
  policyHref: CREDITS_POLICY_ROUTE,
  missingCredits:
    'Money taken but no credits? Contact Dealers-Drive support with the payment ID from your Razorpay receipt — we check it with Razorpay and add your credits.',
  paymentId: (id: string) => `Payment ID: ${id}`,
  result: {
    paidTitle: 'Payment successful',
    paidBody: (added: string, available: string) =>
      `${added} added to your account. You now have ${available} available.`,
    pendingTitle: 'Payment received',
    pendingBody:
      'Razorpay is still confirming it. Your credits will appear on the Billing page within a few minutes — you do not need to pay again.',
    unconfirmedTitle: 'We could not confirm your payment',
    failedTitle: 'Payment not completed',
    failedBody:
      'The payment did not go through, and you have not been charged. You can try again with another bank, card or UPI app.',
    amount: 'Amount paid',
    paymentId: 'Payment ID',
    quoteId: 'Quote this payment ID if you contact Dealers-Drive support.',
    addVehicle: 'Add a vehicle',
    done: 'Done',
    tryAgain: 'Try again',
    close: 'Close',
  },
  disabledTitle: 'Listing credits are not switched on',
  disabledBody:
    'Submitting a car for review is free for now. We will tell you before that changes.',
} as const;
