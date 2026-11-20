export type PurchaseOutcome =
  | {
      kind: 'paid';
      credits: number;
      available: number;
      amountLabel: string;
      paymentId: string;
    }
  | { kind: 'pending'; amountLabel: string; paymentId: string }
  | { kind: 'unconfirmed'; message: string; paymentId: string }
  | { kind: 'failed'; packId: string };
