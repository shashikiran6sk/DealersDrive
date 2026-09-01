import type { ModuleDocs } from '../../docs/spec.js';

/**
 * C19–C20. Credits, orders, the ledger and invoices.
 *
 * One rule governs everything here: **a balance never changes without a ledger
 * row.** There is no `addCredits` and no `spendCredits` — there is one function
 * that takes a signed delta and a reason, writes an append-only
 * `CreditTransaction` with a materialised `balanceAfter`, and updates
 * `Dealer.creditBalance` in the same transaction. That column is a read cache;
 * the ledger is the balance.
 */
export const billingDocs: ModuleDocs = {
  tag: 'Billing & credits',
  description:
    'Listing credits, credit-pack purchases, the credit ledger and GST invoices.\n\n' +
    '**Payments are mocked in this build.** `PAYMENT_PROVIDER=development` settles an order ' +
    'inline through the same function a gateway webhook would call — so buying credits adds ' +
    'them immediately and there is no gateway page in the flow. The credit *accounting* is ' +
    'not mocked: the ledger, the row locking and the invoice are exactly what production ' +
    'runs.\n\n' +
    'All amounts are integer **paise**. `pricePaise: 450000` is ₹4,500.',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer/billing/summary',
      operationId: 'getBillingSummary',
      tag: 'Billing & credits',
      summary: 'Credit balance and usage',
      description:
        'The wallet panel: balance, how many credits are currently **held** by listings in ' +
        'review, how many are available to spend, and how many were used this month.\n\n' +
        '`creditsHeld` is the count of listings sitting in PENDING_REVIEW or ' +
        'CHANGES_REQUESTED — a credit that is held is neither spent nor available.',
      audience: 'dealer',
      permission: 'billing:read',
      responses: [
        {
          status: 200,
          description: 'The wallet.',
          schema: 'BillingSummary',
          example: {
            creditBalance: 38,
            creditsHeld: 1,
            creditsAvailable: 38,
            label: 'Listing credits available',
            note: 'One credit publishes one vehicle for 90 days.',
            listingDurationDays: 90,
            usedThisMonth: 3,
          },
        },
      ],
      errors: [401, 403, 404],
    },
    {
      method: 'get',
      path: '/v1/dealer/billing/packs',
      operationId: 'listCreditPacks',
      tag: 'Billing & credits',
      summary: 'Credit packs for sale',
      description:
        'The packs a dealer can buy, with per-listing pricing derived by division rather than ' +
        'stored — a stored per-unit rate that disagrees with the division is a support ticket.\n\n' +
        'Prices exclude GST; the tax is computed at order time.',
      audience: 'dealer',
      permission: 'billing:read',
      responses: [
        {
          status: 200,
          description: 'Active packs, cheapest first.',
          schema: 'CreditPacksResponse',
        },
      ],
      errors: [401, 403],
    },
    {
      method: 'post',
      path: '/v1/dealer/billing/orders',
      operationId: 'createCreditOrder',
      tag: 'Billing & credits',
      summary: 'Buy a credit pack',
      description:
        '**The client sends a `packId` and nothing else.** No amount, no credit count — the ' +
        'server prices the pack and computes GST, because a client-supplied amount is how ' +
        'marketplaces give inventory away.\n\n' +
        'With `PAYMENT_PROVIDER=development` the order settles inline: by the time this ' +
        'returns 201 the credits are in the ledger as a `PURCHASE` row and an invoice exists. ' +
        'The settlement goes through the same internal function a Razorpay webhook would ' +
        'call, so there is no second implementation of "add credits" to keep in step.\n\n' +
        'OWNER only (`billing:purchase`) — a manager can read the balance but not spend money.',
      audience: 'dealer',
      permission: 'billing:purchase',
      requestBody: {
        schema: 'CreateOrderInput',
        description: 'Which pack to buy.',
        example: { packId: 'a4c81f92-9999-4000-8000-000000000009' },
      },
      rateLimit:
        '10 orders per hour per dealer (not per IP — two dealers on one showroom connection must not throttle each other)',
      responses: [
        {
          status: 201,
          description:
            'The order. With the development provider it is already PAID and the credits are ' +
            'already in the ledger.',
          schema: 'CreateOrderResponse',
          example: {
            orderId: 'e91b7c34-aaaa-4000-8000-00000000000a',
            gatewayOrderId: 'dev_order_e91b7c34',
            gateway: 'development',
            credits: 25,
            amountPaise: 1_000_000,
            taxPaise: 180_000,
            totalPaise: 1_180_000,
            totalLabel: '₹11,800',
            currency: 'INR',
            prefill: {
              name: 'Sri Lakshmi Motors',
              email: 'karthik@srilakshmimotors.in',
              contact: '+919840012345',
            },
            expiresAt: '2026-08-17T09:35:00.000Z',
          },
        },
      ],
      errors: [400, 401, 403, 404, 429],
    },
    {
      method: 'post',
      path: '/v1/dealer/billing/orders/:id/verify',
      operationId: 'verifyCreditOrder',
      tag: 'Billing & credits',
      summary: 'Confirm an order after checkout',
      description:
        "The client's post-checkout handshake. In production it carries the gateway's " +
        '`paymentId` and `signature`; with the development provider the body may be empty ' +
        '(`{}`) because the order already settled.\n\n' +
        '**200** when the order is PAID — the response carries the credits added and the ' +
        'invoice. **202** when payment has been received but the webhook has not landed yet, ' +
        'with `pollAfterSeconds`: credits appear when the webhook is processed, never because ' +
        'a client said so. Verification alone therefore never grants credits.\n\n' +
        "A signature that does not verify is a 422 `SIGNATURE_MISMATCH`. Another dealer's " +
        'order id is a 404.',
      audience: 'dealer',
      permission: 'billing:purchase',
      params: 'IdParam',
      requestBody: {
        schema: 'VerifyOrderInput',
        description: 'The gateway handshake. Empty for the development provider.',
        required: false,
        example: {},
      },
      responses: [
        {
          status: 200,
          description: 'Paid. Credits are in the ledger and the invoice is issued.',
          schema: 'VerifyOrderResponse',
          example: {
            verified: true,
            orderStatus: 'PAID',
            creditsAdded: 25,
            creditBalance: 63,
            invoice: { id: 'd2f4a880-bbbb-4000-8000-00000000000b', number: 'DD-INV-00042' },
            message: '25 credits added — payment captured.',
          },
        },
        {
          status: 202,
          description: 'Verified, but not yet settled. Poll after `pollAfterSeconds`.',
          schema: 'VerifyOrderResponse',
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'get',
      path: '/v1/dealer/billing/ledger',
      operationId: 'getCreditLedger',
      tag: 'Billing & credits',
      summary: 'Credit history',
      description:
        "Every credit movement, newest first, cursor-paginated on the ledger's append " +
        'sequence rather than a timestamp — two movements committed in one transaction share ' +
        'a `now()`, so paginating on time could skip a row.\n\n' +
        '`balanceAfter` is **read from the row, never summed**, so the history a dealer sees ' +
        'is the arithmetic the system actually performed.\n\n' +
        'Reasons: `PURCHASE`, `ADMIN_GRANT`, `HOLD_SUBMIT`, `CONSUME_APPROVE`, ' +
        '`RELEASE_REJECT`, `RELEASE_EXPIRED_UNREVIEWED`, `ADMIN_ADJUSTMENT`, `REVERSAL`. ' +
        'A `CONSUME_APPROVE` row has `delta: 0` — the credit was already deducted when it was ' +
        'held — and it is written anyway, because the ledger has to be able to answer "what ' +
        'happened to that credit?" and silence is not an answer a dealer can read.',
      audience: 'dealer',
      permission: 'billing:read',
      query: 'CursorQuery',
      responses: [
        {
          status: 200,
          description: 'A page of ledger rows.',
          schema: 'LedgerResponse',
          example: {
            data: [
              {
                id: '5b7a2e91-8888-4000-8000-000000000008',
                delta: -1,
                deltaLabel: '−1',
                tone: 'err',
                label: 'Submitted for review — 2021 Maruti Suzuki Swift VXi',
                reason: 'HOLD_SUBMIT',
                createdAt: '2026-08-17T09:20:00.000Z',
                dateLabel: '17 Aug 2026',
                balanceAfter: 38,
                balanceLabel: 'bal 38',
                listingId: '8d1e4c77-7777-4000-8000-000000000007',
                orderId: null,
                invoiceNumber: null,
              },
            ],
            page: { nextCursor: 'MTIzNA', hasMore: true },
          },
        },
      ],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/dealer/billing/invoices',
      operationId: 'listInvoices',
      tag: 'Billing & credits',
      summary: 'GST invoices',
      description: 'Invoices for this dealership, newest first. Cursor-paginated on issue date.',
      audience: 'dealer',
      permission: 'billing:read',
      query: 'CursorQuery',
      responses: [{ status: 200, description: 'A page of invoices.', schema: 'InvoicesResponse' }],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/dealer/billing/invoices/:id/pdf',
      operationId: 'getInvoicePdf',
      tag: 'Billing & credits',
      summary: 'Download an invoice PDF',
      description:
        '**302 redirect** to a signed URL valid for five minutes — the PDF is not streamed ' +
        'through the API, and the signed link expires so a copied URL is not a permanent hole ' +
        "in another dealer's billing.\n\n" +
        "Scoped to the caller's own invoices; another dealer's invoice id is a 404 — as is an " +
        'invoice whose PDF has not been rendered yet, which answers 404 `PDF_NOT_READY` rather ' +
        'than a redirect to a URL that would 404 on arrival.\n\n' +
        '*Swagger UI follows the redirect automatically, so "Try it out" shows the PDF bytes ' +
        'rather than the 302.*',
      audience: 'dealer',
      permission: 'billing:read',
      params: 'IdParam',
      responses: [
        {
          status: 302,
          description: 'Redirect to the signed PDF URL.',
          headers: {
            Location: {
              description: 'A signed URL, valid for 300 seconds.',
              schema: { type: 'string', format: 'uri' },
            },
          },
        },
      ],
      errors: [400, 401, 403, 404],
    },
  ],
};
