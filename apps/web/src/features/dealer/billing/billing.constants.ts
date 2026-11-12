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
  paid: (message: string) => message,
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
  disabledTitle: 'Listing credits are not switched on',
  disabledBody:
    'Submitting a car for review is free for now. We will tell you before that changes.',
} as const;
