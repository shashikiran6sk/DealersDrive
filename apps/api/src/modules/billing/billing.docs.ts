import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

const ORDER_ID = '0b7a4f0e-6a39-4b8a-9d55-2f1c3b8e7a10';

const SUMMARY_EXAMPLE = {
  enabled: true,
  balance: 6,
  held: 1,
  available: 5,
  costs: { DEALER: 1, DEALERS_DRIVE: 2, UNPLANNED: 1 },
  creditPriceLabel: '₹500',
  canPurchase: true,
};

const LEDGER_ENTRY = {
  id: '42',
  reason: 'HOLD_SUBMIT',
  label: 'Held for a listing in review',
  delta: 0,
  heldDelta: 1,
  changeLabel: '1 held',
  tone: 'warn',
  balanceAfter: 6,
  availableAfter: 5,
  listingId: '6a1f3c2e-8b4d-4e5f-9a7b-1c2d3e4f5a6b',
  orderId: null,
  note: 'Held while the listing is reviewed',
  createdAt: '2026-11-11T09:30:00.000Z',
  dateLabel: '11 Nov 2026',
};

const ORDER_ROW = {
  id: ORDER_ID,
  credits: 5,
  totalPaise: 265_500,
  totalLabel: '₹2,655',
  status: 'PAID',
  statusLabel: 'Paid',
  statusTone: 'ok',
  failureReason: null,
  createdAt: '2026-11-11T09:00:00.000Z',
  dateLabel: '11 Nov 2026',
  paidAt: '2026-11-11T09:01:12.000Z',
};

export const billingDocs: ModuleDocs = {
  tag: DOC_TAGS.billing,
  description:
    'Listing credits and Razorpay (**F050–F054**, revised). A credit is the unit a listing ' +
    'is paid in. Submitting a car **holds** its cost; an approval **consumes** the hold and a ' +
    'rejection **releases** it, so a dealership pays only for cars that go live. A car the ' +
    'dealer photographs costs `billing.listingCredits`; a Dealers-Drive photoshoot adds ' +
    '`billing.photoshootCredits`. Both, the packs and GST are admin configuration.\n\n' +
    '**Every movement is one append-only `credit_transactions` row**, written by ' +
    '`moveCredits()` with the dealer row locked `FOR UPDATE` (rule 4).\n\n' +
    '**Buying is three steps.** `POST /billing/orders` creates a Razorpay order for a pack — ' +
    'the client names the pack, never an amount. The browser opens Razorpay Checkout with ' +
    'it, then forwards the success payload to `POST /billing/orders/{id}/verify`, which checks ' +
    'the signature, confirms (and if needed captures) the payment with Razorpay and adds the ' +
    'credits. The `payment.captured` / `order.paid` webhook does the same for a buyer who ' +
    'closed the tab; fulfilment is idempotent, so whichever arrives second changes nothing.',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer/billing/summary',
      operationId: 'getBillingSummary',
      tag: DOC_TAGS.billing,
      summary: 'The dealership’s credits and what a car costs',
      description:
        'Balance, held and available credits, and the cost of a submission under each photo ' +
        'plan. `enabled` is `feature.listingCredits`; while it is off nothing is held at ' +
        'submission. Any member may read it — the wizard shows the cost before Submit.',
      audience: 'dealer',
      permission: 'vehicle:read',
      responses: [
        {
          status: 200,
          description: 'The summary.',
          schema: 'BillingSummary',
          example: SUMMARY_EXAMPLE,
        },
      ],
      errors: [401, 403],
    },
    {
      method: 'get',
      path: '/v1/dealer/billing/packs',
      operationId: 'getCreditPacks',
      tag: DOC_TAGS.billing,
      summary: 'The credit packs on sale',
      description:
        'From `billing.creditPacks`, cheapest first, with GST from `billing.gstPercent`. ' +
        '`purchasable` is false while no payment gateway is configured.',
      audience: 'dealer',
      permission: 'billing:read',
      responses: [{ status: 200, description: 'The packs.', schema: 'CreditPacksResponse' }],
      errors: [401, 403],
    },
    {
      method: 'get',
      path: '/v1/dealer/billing/ledger',
      operationId: 'getCreditLedger',
      tag: DOC_TAGS.billing,
      summary: 'Every credit movement, newest first',
      description: 'Keyset-paginated. `balanceAfter` is read from the row, never summed.',
      audience: 'dealer',
      permission: 'billing:read',
      query: 'CursorQuery',
      responses: [
        {
          status: 200,
          description: 'One page of the ledger.',
          schema: 'CreditLedgerResponse',
          example: { data: [LEDGER_ENTRY], page: { nextCursor: null, hasMore: false } },
        },
      ],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/dealer/billing/orders',
      operationId: 'getCreditOrders',
      tag: DOC_TAGS.billing,
      summary: 'The dealership’s credit purchases',
      description: 'The 50 most recent orders, paid, failed or awaiting payment.',
      audience: 'dealer',
      permission: 'billing:read',
      responses: [
        {
          status: 200,
          description: 'The orders.',
          schema: 'CreditOrdersResponse',
          example: { data: [ORDER_ROW] },
        },
      ],
      errors: [401, 403],
    },
    {
      method: 'post',
      path: '/v1/dealer/billing/orders',
      operationId: 'createCreditOrder',
      tag: DOC_TAGS.billing,
      summary: 'Start buying a credit pack',
      description:
        'Creates the Razorpay order and returns what Checkout needs. **The amount is the ' +
        'server’s**: pack price plus GST, snapshotted on the order so a price change never ' +
        'alters an order in flight. With `PAYMENTS_DRIVER=none` this is ' +
        '`503 PAYMENTS_DISABLED`. With the development `fake` gateway, `simulation` carries a ' +
        'valid payment id and signature.',
      audience: 'dealer',
      permission: 'billing:purchase',
      requiresActiveDealer: true,
      requestBody: {
        schema: 'CreateCreditOrderInput',
        description: 'Which pack.',
        example: { packId: 'pack-5' },
      },
      responses: [{ status: 201, description: 'The checkout.', schema: 'CreditCheckout' }],
      errors: [400, 401, 403, 422, 503],
    },
    {
      method: 'post',
      path: '/v1/dealer/billing/orders/:id/verify',
      operationId: 'verifyCreditOrder',
      tag: DOC_TAGS.billing,
      summary: 'Confirm a payment from Razorpay Checkout',
      description:
        'Forward Checkout’s success payload verbatim. The signature is checked (a mismatch ' +
        'is `400 SIGNATURE_MISMATCH` and logged), the payment is confirmed with Razorpay — ' +
        'captured if it is only authorized — and the credits are added. `status` is `CREATED` ' +
        'when Razorpay has not captured it yet; the webhook finishes the job.',
      audience: 'dealer',
      permission: 'billing:purchase',
      params: 'IdParam',
      requestBody: {
        schema: 'VerifyCreditOrderInput',
        example: {
          razorpayOrderId: 'order_PxK92mNq4Lp7Rd',
          razorpayPaymentId: 'pay_PxK9AbCdEfGhIj',
          razorpaySignature: '9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d',
        },
      },
      responses: [
        {
          status: 200,
          description: 'Where the order stands.',
          schema: 'CreditOrderResult',
          example: {
            orderId: ORDER_ID,
            status: 'PAID',
            credits: 5,
            balance: 11,
            available: 10,
            message: '5 credits added — payment received. Thank you.',
          },
        },
      ],
      errors: [400, 401, 403, 404, 422, 503],
    },
    {
      method: 'post',
      path: '/v1/webhooks/razorpay',
      operationId: 'razorpayWebhook',
      tag: DOC_TAGS.billing,
      summary: 'Razorpay webhook',
      description:
        'Called by Razorpay, not by a browser. `X-Razorpay-Signature` is the HMAC-SHA256 of ' +
        'the raw body under `RAZORPAY_WEBHOOK_SECRET`; anything else is `400`. Each event is ' +
        'stored once by `X-Razorpay-Event-Id`. `payment.captured` and `order.paid` add the ' +
        'credits (if the amount matches the order); `payment.failed` marks an open order ' +
        'failed. Always `200` once the signature verifies, so Razorpay stops retrying.',
      audience: 'public',
      responses: [
        {
          status: 200,
          description: 'What was done with the event.',
          inlineSchema: { type: 'object', properties: { outcome: { type: 'string' } } },
          example: { outcome: 'fulfilled' },
        },
      ],
      errors: [400],
    },
    {
      method: 'get',
      path: '/v1/admin/dealers/:id/credits',
      operationId: 'getAdminDealerCredits',
      tag: DOC_TAGS.billing,
      summary: 'A dealership’s credits, ledger and orders',
      description: 'The 50 newest ledger rows and orders. `canAdjust` is `admin:credit:grant`.',
      audience: 'admin',
      permission: 'admin:payment:read',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The credits.', schema: 'AdminDealerCredits' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/credits',
      operationId: 'adjustDealerCredits',
      tag: DOC_TAGS.billing,
      summary: 'Add or remove credits by hand',
      description:
        'Positive adds (`ADMIN_GRANT`), negative removes (`ADMIN_DEDUCT`). The note is shown ' +
        'to the dealer. Removing more than is available — credits held for listings in review ' +
        'included — is `422 CREDITS_NEGATIVE`.',
      audience: 'admin',
      permission: 'admin:credit:grant',
      params: 'IdParam',
      requestBody: {
        schema: 'AdminCreditAdjustmentInput',
        example: { credits: 3, note: 'Launch offer — three free listings' },
      },
      responses: [{ status: 200, description: 'The credits after.', schema: 'AdminDealerCredits' }],
      errors: [400, 401, 403, 404, 422],
    },
  ],
};
