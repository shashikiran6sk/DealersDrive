import type { LegalDocument } from '@dealers-drive/contracts';

export const CREDITS_POLICY_ROUTE = '/credits-and-refunds';

export const CREDITS_POLICY: LegalDocument & { effectiveDate: string } = {
  title: 'Credits, cancellations and refunds',
  version: 'credits-refunds-v1',
  route: CREDITS_POLICY_ROUTE,
  description:
    'How listing credits are bought, used and returned on Dealers-Drive, and when a payment is refunded.',
  effectiveDate: '',
  sections: [
    {
      id: 'what-credits-are',
      heading: '1. What credits are',
      paragraphs: [
        'Dealerships pay for listings on Dealers-Drive with credits. A car the dealership photographs itself costs one credit to list; a car photographed by Dealers-Drive costs two. The current costs are always shown in the dealer console before a car is submitted.',
        'Credits are bought in packs from the dealer console. Each pack is a one-time purchase, not a subscription: nothing renews and nothing is charged again without the dealership buying another pack.',
      ],
    },
    {
      id: 'prices-and-payment',
      heading: '2. Prices and payment',
      paragraphs: [
        'The price of each pack, and any GST on it, is shown before payment. Payments are made through Razorpay, by UPI, card or net banking. Dealers-Drive does not see or store card or bank details.',
        'Only the owner of a dealership account can buy credits.',
      ],
    },
    {
      id: 'how-credits-are-used',
      heading: '3. How credits are used',
      paragraphs: [
        'When a car is submitted for review, its credits are held, not spent. They are used only when the listing is approved and goes live. If the listing is not approved, the held credits return to the dealership’s balance.',
        'Each car is paid for once, when it first goes live. Reserving, selling or withdrawing a listing does not return its credits, and relisting a withdrawn listing does not cost more.',
      ],
    },
    {
      id: 'expiry',
      heading: '4. Credits do not expire',
      paragraphs: [
        'Credits stay on a dealership’s account until they are used. They do not expire.',
        'Free credits — such as the welcome credits a dealership receives when it is approved, or credits added by Dealers-Drive — work like bought credits but have no cash value.',
      ],
    },
    {
      id: 'refunds',
      heading: '5. Refunds',
      paragraphs: [
        'Bought credits are not refundable, and cannot be exchanged for cash or moved to another dealership.',
        'If a payment was taken but the credits were not added, Dealers-Drive checks the payment with Razorpay and adds the credits. If the same purchase was charged twice, the extra payment is refunded to the original payment method. Refunds made through Razorpay usually reach the account in 5–7 working days, depending on the bank.',
      ],
    },
    {
      id: 'cancellations-and-failed-payments',
      heading: '6. Cancellations and failed payments',
      paragraphs: [
        'A purchase can be cancelled at any time before the payment is completed, at no charge. Once a payment is completed, the purchase cannot be cancelled.',
        'If a payment fails, no credits are added. Any amount the bank debited for a failed payment is reversed by the bank or by Razorpay.',
      ],
    },
    {
      id: 'help',
      heading: '7. Getting help with a payment',
      paragraphs: [
        'Contact Dealers-Drive support with the payment ID from your Razorpay receipt or bank statement. Every payment and every change to a dealership’s credits is recorded, so it can be traced and corrected.',
      ],
    },
  ],
};
