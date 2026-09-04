import type { ModuleDocs } from '../../docs/spec.js';

/**
 * D1–D15. The platform's own console.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline documents 20 operations. This file grows with the router beside
 * it — an operation lands in the same PR that mounts its route, which is what
 * `tests/unit/docs/openapi.test.ts` checks in both directions. F049 brought the
 * first — the metrics the console shell reads — F044 the two KYC review paths,
 * and **F045 the six dealer paths**. `grantDealerCredits` is not among them: it
 * moves credits, so it lands with the ledger.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const adminDocs: ModuleDocs = {
  tag: 'Admin',
  description:
    'Platform moderation: dealer verification, KYC review, the listing queue, payments, ' +
    'configuration and the audit log.\n\n' +
    '**Cross-tenant by design**, which is why every write records who did it. Permissions are ' +
    'per-operation rather than per-role-blanket: `admin:credit:grant` and ' +
    '`admin:config:write` are SUPER_ADMIN only, while a SUPPORT admin can read payments and ' +
    'audit logs and nothing else. Locally the admin is `DEV_ADMIN_EMAIL`, seeded as ' +
    'SUPER_ADMIN.\n\n' +
    'Every response here is `Cache-Control: no-store`.',
  operations: [
    {
      method: 'get',
      path: '/v1/admin/metrics/overview',
      operationId: 'getAdminOverview',
      tag: 'Admin',
      summary: 'Platform metrics',
      description:
        'The admin landing page: dealer and listing counts, payments and revenue over the ' +
        'last 30 days, and the moderation queue depth with how long the oldest item has ' +
        'waited.\n\n' +
        '`payments30d` is gross captured; `revenue30d` is net of GST. They differ on purpose — ' +
        'reporting one as the other is the kind of mistake that reaches a board deck.',
      audience: 'admin',
      permission: 'admin:metrics:read',
      responses: [{ status: 200, description: 'Metrics.', schema: 'AdminOverview' }],
      errors: [401, 403],
    },
    {
      method: 'get',
      path: '/v1/admin/dealers',
      operationId: 'listAdminDealers',
      tag: 'Admin',
      summary: 'All dealerships',
      description:
        'Every dealership, filterable by status, city or free text, cursor-paginated. ' +
        '`counts` gives the total per status so the tabs do not need a second request.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      query: 'AdminDealerQuery',
      responses: [
        { status: 200, description: 'A page of dealerships.', schema: 'AdminDealersResponse' },
      ],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/admin/dealers/:id',
      operationId: 'getAdminDealerDetail',
      tag: 'Admin',
      summary: 'One dealership, with review context',
      description:
        'Everything a moderator needs on one screen: the profile, the KYC documents with ' +
        'view links, listing and credit history, and an `actions` block saying which ' +
        'decisions are available from the current state — so the UI does not have to ' +
        're-derive the state machine.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The dealership.', schema: 'AdminDealerDetail' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/approve',
      operationId: 'approveDealer',
      tag: 'Admin',
      summary: 'Approve a dealership',
      description:
        'Sets the dealership ACTIVE, which is what makes its listings eligible to appear ' +
        'publicly at all (rule 6).\n\n' +
        'The body is optional and carries only an internal `note`. The onboarding credit ' +
        'bonus the baseline accepts here returns with the credit ledger — a movement has to ' +
        'write a `CreditTransaction`, and until it can, the field is refused by name rather ' +
        'than accepted and ignored. `creditsGranted` therefore reads `0`.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'ApproveDealerInput',
        description: 'An optional internal note.',
        required: false,
        example: { note: 'GST and address proof both verified.' },
      },
      responses: [
        {
          status: 200,
          description: 'Approved.',
          schema: 'DealerModerationResponse',
          example: {
            id: '3c8f2b10-2222-4000-8000-000000000002',
            status: 'ACTIVE',
            statusLabel: 'Verified dealer',
            creditsGranted: 0,
            creditBalance: 0,
            listingsAffected: 0,
            notifiedAt: '2026-08-17T09:40:00.000Z',
          },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/reject',
      operationId: 'rejectDealer',
      tag: 'Admin',
      summary: 'Reject a dealership',
      description:
        'Rejects the application. The reason is required and at least six characters, because ' +
        'it is shown to the dealer — "no" without a reason generates a support call.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        description: 'Shown to the dealer. Minimum six characters.',
        example: { reason: 'The GST certificate does not match the legal name on the PAN card.' },
      },
      responses: [{ status: 200, description: 'Rejected.', schema: 'DealerModerationResponse' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/suspend',
      operationId: 'suspendDealer',
      tag: 'Admin',
      summary: 'Suspend a dealership',
      description:
        "**Pulls every one of the dealership's cars out of the catalogue at once**, because " +
        'public visibility requires `dealer.status = ACTIVE` as well as an approved listing. ' +
        'The dealer keeps read access to their own console — they need to see why — but can ' +
        'publish nothing.\n\n' +
        '`listingsAffected` in the response is how many listings left the catalogue. ' +
        'Reversible with reinstate.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        description: 'Why. Minimum six characters.',
        example: { reason: 'Three buyer reports of misrepresented kilometres. Under review.' },
      },
      responses: [
        {
          status: 200,
          description: 'Suspended, and de-listed.',
          schema: 'DealerModerationResponse',
        },
      ],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/reinstate',
      operationId: 'reinstateDealer',
      tag: 'Admin',
      summary: 'Reinstate a suspended dealership',
      description:
        'Sets the dealership ACTIVE again and re-indexes its listings, so the cars that were ' +
        'approved before the suspension come back — the suspension hid them, it did not ' +
        'un-approve them.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'NoteInput',
        description: 'Optional internal note.',
        required: false,
        example: { note: 'Reports resolved; dealer corrected the two listings.' },
      },
      responses: [
        {
          status: 200,
          description: 'Reinstated, and re-listed.',
          schema: 'DealerModerationResponse',
        },
      ],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/admin/documents/:id/verify',
      operationId: 'verifyDealerDocument',
      tag: 'Admin',
      summary: 'Verify a KYC document',
      description:
        'Marks one document verified. `allVerified` in the response says whether that was the ' +
        "last one outstanding, which is the moderator's cue that the dealership can now be " +
        'approved.\n\n' +
        'Takes no body.',
      audience: 'admin',
      permission: 'admin:document:review',
      params: 'IdParam',
      responses: [{ status: 200, description: 'Verified.', schema: 'VerifyDocumentResponse' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/documents/:id/reject',
      operationId: 'rejectDealerDocument',
      tag: 'Admin',
      summary: 'Reject a KYC document',
      description:
        'Rejects one document with a reason the dealer sees, so they know what to re-upload ' +
        'rather than guessing. Minimum six characters.',
      audience: 'admin',
      permission: 'admin:document:review',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        description: 'Shown to the dealer.',
        example: { reason: 'The address proof is older than three months. Send a recent bill.' },
      },
      responses: [{ status: 200, description: 'Rejected.', schema: 'VerifyDocumentResponse' }],
      errors: [400, 401, 403, 404, 409],
    },
  ],
};
