import type { ModuleDocs } from '../../docs/spec.js';

/**
 * D1–D15. The platform's own console.
 *
 * This is the one group that reads across tenants, and it does so deliberately:
 * every write is audit-logged with the admin's identity, and the admin
 * permission table (§8.3) is narrower than "is an admin" — granting credits and
 * changing configuration are SUPER_ADMIN only, support staff can read payments
 * but moderate nothing.
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
      responses: [
        { status: 200, description: 'The dealership.', schema: 'AdminDealerDetail' },
      ],
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
        '`grantCredits` optionally seeds an onboarding bonus in the same transaction — and ' +
        'like every other credit movement it writes an `ADMIN_GRANT` ledger row rather than ' +
        'incrementing a column.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'ApproveDealerInput',
        description: 'Optional onboarding credits and an internal note.',
        required: false,
        example: { grantCredits: 5, note: 'GST and address proof both verified.' },
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
            creditsGranted: 5,
            creditBalance: 5,
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
      responses: [
        { status: 200, description: 'Rejected.', schema: 'DealerModerationResponse' },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/suspend',
      operationId: 'suspendDealer',
      tag: 'Admin',
      summary: 'Suspend a dealership',
      description:
        '**Pulls every one of the dealership\'s cars out of the catalogue at once**, because ' +
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
        { status: 200, description: 'Suspended, and de-listed.', schema: 'DealerModerationResponse' },
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
        { status: 200, description: 'Reinstated, and re-listed.', schema: 'DealerModerationResponse' },
      ],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/credits/grant',
      operationId: 'grantDealerCredits',
      tag: 'Admin',
      summary: 'Grant or deduct credits',
      description:
        'A manual credit adjustment. `credits` is signed: positive grants (`ADMIN_GRANT`), ' +
        'negative deducts (`ADMIN_ADJUSTMENT`). Zero is rejected, and a negative adjustment ' +
        'requires a reason of at least six characters — taking credits away without a written ' +
        'reason is not something the API will do.\n\n' +
        'Cannot drive a balance below zero: the ledger floors at zero and returns 422 ' +
        '`INSUFFICIENT_CREDITS`.\n\n' +
        '`label` is shown verbatim in the dealer\'s own credit history, so write it for them.\n\n' +
        'SUPER_ADMIN only (`admin:credit:grant`).',
      audience: 'admin',
      permission: 'admin:credit:grant',
      params: 'IdParam',
      requestBody: {
        schema: 'GrantCreditsInput',
        description: 'A signed credit delta with a dealer-visible label.',
        example: { credits: 10, label: 'Goodwill credit — listing outage on 12 Aug' },
      },
      responses: [
        {
          status: 201,
          description: 'The ledger row that was written.',
          schema: 'GrantCreditsResponse',
          example: {
            transactionId: 'f0a3b621-cccc-4000-8000-00000000000c',
            delta: 10,
            balanceAfter: 48,
            dealerNotified: true,
          },
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'post',
      path: '/v1/admin/documents/:id/verify',
      operationId: 'verifyDealerDocument',
      tag: 'Admin',
      summary: 'Verify a KYC document',
      description:
        'Marks one document verified. `allVerified` in the response says whether that was the ' +
        'last one outstanding, which is the moderator\'s cue that the dealership can now be ' +
        'approved.\n\n' +
        'Takes no body.',
      audience: 'admin',
      permission: 'admin:document:review',
      params: 'IdParam',
      responses: [
        { status: 200, description: 'Verified.', schema: 'VerifyDocumentResponse' },
      ],
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
      responses: [
        { status: 200, description: 'Rejected.', schema: 'VerifyDocumentResponse' },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'get',
      path: '/v1/admin/listings',
      operationId: 'getModerationQueue',
      tag: 'Admin',
      summary: 'The moderation queue',
      description:
        'Listings awaiting a decision, oldest first — a review queue sorted newest-first is a ' +
        'queue that starves. `status` defaults to `PENDING_REVIEW`; pass another to review ' +
        'past decisions.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      query: 'AdminListingQuery',
      responses: [
        { status: 200, description: 'A page of the queue.', schema: 'ModerationQueueResponse' },
      ],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/admin/listings/:id',
      operationId: 'getAdminListingDetail',
      tag: 'Admin',
      summary: 'One listing, with review context',
      description:
        'The review screen: full-size photos, the specification table, the dealer\'s standing, ' +
        'and `flags[]` — automated checks such as too few photos, a price outside the band for ' +
        'the model, or a phone number in the description.\n\n' +
        '**Flags are advisory.** Nothing here auto-rejects anything; a human decides.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      responses: [
        { status: 200, description: 'The listing.', schema: 'AdminListingDetail' },
      ],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/approve',
      operationId: 'approveListing',
      tag: 'Admin',
      summary: 'Approve a listing (spends the held credit)',
      description:
        'Publishes the listing and **consumes** the credit that was held at submission. The ' +
        'ledger gets a `CONSUME_APPROVE` row with `delta: 0` — the deduction already happened ' +
        'when the credit was held — because a movement with no row would leave the dealer ' +
        'unable to see where their credit went.\n\n' +
        'Sets `expiresAt` to `listing.durationDays` from now. Indexing into the public ' +
        'catalogue, the dealer email and cache revalidation all happen **asynchronously**: ' +
        'none of them can roll back an approval.\n\n' +
        'Only a PENDING_REVIEW listing can be approved. A second moderator clicking approve ' +
        'on the same card gets 409 `INVALID_TRANSITION` rather than a double approval.\n\n' +
        'The body is optional, but note that `.strict()` rejects `undefined` — send `{}` ' +
        'rather than no body at all.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'NoteInput',
        description: 'Optional internal note. Send `{}` for none.',
        required: false,
        example: {},
      },
      responses: [
        {
          status: 200,
          description: 'Published.',
          schema: 'ApproveListingResponse',
          example: {
            listingId: '8d1e4c77-7777-4000-8000-000000000007',
            status: 'APPROVED',
            displayStatus: 'ACTIVE',
            approvedAt: '2026-08-17T09:45:00.000Z',
            expiresAt: '2026-11-15T09:45:00.000Z',
            expiryLabel: '15 Nov 2026',
            credit: { consumed: 1, transactionId: '4c9d1a55-dddd-4000-8000-00000000000d' },
          },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/reject',
      operationId: 'rejectListing',
      tag: 'Admin',
      summary: 'Reject a listing (returns the credit)',
      description:
        'Rejects the listing and **returns** the held credit with a `RELEASE_REJECT` +1 ledger ' +
        'row. The dealer is not charged for a listing that was never published.\n\n' +
        'The reason is required and shown to the dealer. After rejection the dealer may fix ' +
        'and resubmit, which takes a **fresh** credit — contrast request-changes below.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        description: 'Shown to the dealer. Minimum six characters.',
        example: { reason: 'The photos show a different vehicle to the one described.' },
      },
      responses: [
        { status: 200, description: 'Rejected, credit returned.', schema: 'RejectListingResponse' },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/request-changes',
      operationId: 'requestListingChanges',
      tag: 'Admin',
      summary: 'Request changes (credit stays held)',
      description:
        'Sends the listing back to the dealer **without releasing the credit** — and writes no ' +
        'ledger row at all, because nothing moved.\n\n' +
        '**That surviving hold is the entire difference between this and rejection.** The ' +
        'dealer fixes the listing, resubmits, and is not charged a second time; the resubmit ' +
        'reuses the same hold. Charging again would make them pay twice for one listing.\n\n' +
        'The note is required and shown to the dealer — it is the instruction they act on.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'RequestChangesInput',
        description: 'What the dealer must change. Minimum six characters.',
        example: { note: 'Add an interior photo and confirm the odometer reading.' },
      },
      responses: [
        {
          status: 200,
          description: 'Returned to the dealer, credit still held.',
          schema: 'RequestChangesResponse',
          example: {
            listingId: '8d1e4c77-7777-4000-8000-000000000007',
            status: 'CHANGES_REQUESTED',
            displayStatus: 'CHANGES_REQUESTED',
            note: 'Add an interior photo and confirm the odometer reading.',
            credit: { stillHeld: 1, dealerBalanceAfter: 38 },
            dealerNotifiedAt: '2026-08-17T09:46:00.000Z',
            toast: 'Changes requested. The dealer keeps their credit.',
          },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/takedown',
      operationId: 'takedownListing',
      tag: 'Admin',
      summary: 'Take a published listing down',
      description:
        'Removes an already-published listing from the catalogue — the lever for a listing ' +
        'that turns out to be fraudulent after approval.\n\n' +
        '`refundCredit` is an explicit decision, defaulting to **false**: a takedown for the ' +
        'dealer\'s own misconduct should not also refund them. When true, a `REVERSAL` +1 row ' +
        'is written.\n\n' +
        'Works from APPROVED, PENDING_REVIEW or CHANGES_REQUESTED.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'TakedownInput',
        description: 'Why, and whether to refund the credit.',
        example: { reason: 'Duplicate of another live listing from the same dealer.', refundCredit: true },
      },
      responses: [
        { status: 200, description: 'Removed from the catalogue.', schema: 'TakedownResponse' },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'get',
      path: '/v1/admin/payments',
      operationId: 'listAdminPayments',
      tag: 'Admin',
      summary: 'Payments across all dealers',
      description:
        'Every payment, filterable by status, dealer and date range (`from`/`to` as ' +
        '`YYYY-MM-DD`), with the totals for the filtered set. Readable by SUPPORT admins — ' +
        'this is the screen a support call is answered from.',
      audience: 'admin',
      permission: 'admin:payment:read',
      query: 'AdminPaymentQuery',
      responses: [
        { status: 200, description: 'A page of payments.', schema: 'AdminPaymentsResponse' },
      ],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/admin/config',
      operationId: 'getAdminConfig',
      tag: 'Admin',
      summary: 'Platform configuration',
      description:
        'Every `platform_config` entry with its type, current value and default — including ' +
        'the keys `GET /v1/config/public` withholds. This is where the listing duration, ' +
        'minimum photo count, GST percentage and reveal caps come from, so behaviour can be ' +
        'tuned without a deploy.',
      audience: 'admin',
      permission: 'admin:config:write',
      responses: [{ status: 200, description: 'All configuration.', schema: 'ConfigResponse' }],
      errors: [401, 403],
    },
    {
      method: 'put',
      path: '/v1/admin/config/:key',
      operationId: 'updateAdminConfig',
      tag: 'Admin',
      summary: 'Change one configuration value',
      description:
        'Sets one key. `value` is a number, boolean, string or string array, and is validated ' +
        'against the key\'s declared type — a string where a number belongs is a 422, not a ' +
        'silently broken platform.\n\n' +
        'Audit-logged with the before and after values. SUPER_ADMIN only ' +
        '(`admin:config:write`).',
      audience: 'admin',
      permission: 'admin:config:write',
      params: 'ConfigKeyParam',
      requestBody: {
        schema: 'UpdateConfigInput',
        description: 'The new value, typed to match the key.',
        example: { value: 8 },
      },
      responses: [
        { status: 200, description: 'Updated. Returns the full configuration.', schema: 'ConfigResponse' },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'get',
      path: '/v1/admin/audit-logs',
      operationId: 'listAuditLogs',
      tag: 'Admin',
      summary: 'The audit log',
      description:
        'Who did what, to which entity, with the before and after state. Filterable by ' +
        'entity, dealer, actor, action and date range.\n\n' +
        'This is the fourth layer of the tenancy model: session scoping, repository scoping ' +
        'and tests prevent cross-tenant access, and this makes every deliberate cross-tenant ' +
        'action — every admin write — reviewable after the fact.',
      audience: 'admin',
      permission: 'admin:audit:read',
      query: 'AuditQuery',
      responses: [{ status: 200, description: 'A page of audit rows.', schema: 'AuditResponse' }],
      errors: [400, 401, 403],
    },
  ],
};
