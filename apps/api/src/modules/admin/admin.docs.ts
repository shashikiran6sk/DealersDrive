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
    'audit logs and nothing else. Locally the admin is the first `ADMIN_ALLOWLIST` ' +
    'entry, seeded as ' +
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
        'Every dealership, filterable by status, free text and location, cursor-paginated. ' +
        '`counts` gives the total per status so the tabs do not need a second request, and ' +
        '`facets` gives the cities, districts and states that actually occur — so the ' +
        "console's location filters can only ever offer a value that matches something.\n\n" +
        '`city`, `district` and `state` are `AND`ed and matched case-insensitively against ' +
        'the text on the dealership. `facets` is deliberately unaffected by the current ' +
        'filter: narrowing to a state must not empty the district list and strand the ' +
        'console with no way back.',
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
      method: 'patch',
      path: '/v1/admin/dealers/:id',
      operationId: 'updateAdminDealer',
      tag: 'Admin',
      summary: "Amend a dealership's details",
      description:
        'Edits the answers the dealer gave, from the review screen. A moderator reading a ' +
        'GSTIN off the certificate in front of them can see that one digit is wrong, and the ' +
        'alternative to fixing it here is a round trip that costs a working day to correct a ' +
        'character.\n\n' +
        'The body is **the same `UpdateDealerInput` `PATCH /v1/dealer` takes**, and the same ' +
        'service performs the write: locality normalisation, the E.164 rewrite of the phone ' +
        'number, the name-unique-within-a-city check, the platform-wide GSTIN and PAN ' +
        'uniqueness checks (**R38**) and the `brandName` mirror all apply identically. It ' +
        'is partial, so sending one field never blanks another. The one difference from ' +
        'the dealer path is the audit row — an edit the dealer did not make has to be ' +
        'attributable to the person who made it.\n\n' +
        'That the checks are shared is the point rather than a detail: a moderator ' +
        'correcting a digit can still only correct it to a value no other dealership ' +
        'holds, and a 409 here names the field (`GSTIN_ALREADY_REGISTERED`, ' +
        '`PAN_ALREADY_REGISTERED`) exactly as it does on the dealer route.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'UpdateDealerInput',
        description: 'Any subset of the dealership\u2019s own fields.',
        example: { gstin: '33AABCS1429B1ZX', address: { city: 'Vellore', pincode: '632001' } },
      },
      responses: [{ status: 200, description: 'The amended dealership.', schema: 'DealerProfile' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/reject',
      operationId: 'rejectDealer',
      tag: 'Admin',
      summary: 'Reject a dealership — and destroy the application',
      description:
        '**This is destructive and it is not reversible.** Rejecting deletes the three KYC ' +
        'scans and the yard photograph from object storage, then deletes the `dealers` row ' +
        'with its documents and its OWNER membership. The applicant keeps their verified ' +
        'Google account and nothing else: signing in again finds no dealership and starts ' +
        'onboarding from step one, as a first-time applicant.\n\n' +
        '**Use `request-changes` instead** for anything short of "this is not a dealership we ' +
        'will trade with". An unreadable GST certificate or a misspelt legal name is a ' +
        'correction, and answering it with this endpoint costs a real business every field ' +
        'they typed.\n\n' +
        'Only a DRAFT or PENDING_APPROVAL dealership can be rejected — an approved one is ' +
        'suspended, which is reversible, and a 409 says so. The reason is required, at least ' +
        'six characters, and is what the dealer is told.\n\n' +
        'The audit row survives the dealership: `audit_logs.dealerId` is a column rather than ' +
        'a foreign key, so what was removed, by whom and why is still answerable afterwards.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        description: 'Shown to the dealer. Minimum six characters.',
        example: { reason: 'The GST certificate does not match the legal name on the PAN card.' },
      },
      responses: [
        {
          status: 200,
          description: 'Purged. The counts are what was actually removed.',
          schema: 'DealerPurgeResponse',
          example: {
            id: '3c8f2b10-2222-4000-8000-000000000002',
            brandName: 'Sri Lakshmi Motors',
            documentsDeleted: 3,
            objectsDeleted: 4,
            reason: 'The GST certificate does not match the legal name on the PAN card.',
            purgedAt: '2026-08-17T09:40:00.000Z',
          },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/dealers/:id/request-changes',
      operationId: 'requestDealerChanges',
      tag: 'Admin',
      summary: 'Send an application back for correction',
      description:
        'PENDING_APPROVAL → DRAFT with the reason attached. **Nothing is deleted**: every ' +
        'field the dealer typed, every document they uploaded and the yard photograph all ' +
        'stay where they are.\n\n' +
        'What changes is that the application becomes theirs again. A PENDING_APPROVAL ' +
        'dealership is shown a "we are reviewing this" panel and no form — that is what stops ' +
        'a moderator reviewing a moving target — so handing it back means giving up that ' +
        'guarantee deliberately, and taking the application out of the queue at the same ' +
        'time. Onboarding reopens filled in, with the reason at the top of it, and ' +
        '`POST /v1/dealer/submit` clears the reason when they resubmit.\n\n' +
        'This is the refusal a moderator wants nine times in ten. `reject` is the other one, ' +
        'and it destroys the application.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        description: 'What the dealer must fix. Shown verbatim. Minimum six characters.',
        example: {
          reason: 'The address proof is an electricity bill from 2024. Send one from this quarter.',
        },
      },
      responses: [
        {
          status: 200,
          description: 'Returned to the dealer as DRAFT.',
          schema: 'DealerModerationResponse',
        },
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
        "**Pulls every one of the dealership's cars out of the catalogue at once**, because " +
        'public visibility requires `dealer.status = ACTIVE` as well as an approved listing. ' +
        'Every member account is blocked from sign-in and its existing sessions are revoked. ' +
        'The suspension email carries the reason and support path.\n\n' +
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
        'un-approve them. Member accounts are restored, but revoked sessions stay revoked and ' +
        'each person must sign in again.',
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
      method: 'get',
      path: '/v1/admin/profile-changes',
      operationId: 'listProfileChanges',
      tag: 'Admin',
      summary: 'Profile edits waiting for a decision',
      description:
        'The queue a dealer’s own words wait in (**R34**), **oldest first** — this ' +
        'is work, and the dealership that has been waiting longest is the one owed an ' +
        'answer.\n\n' +
        'Every row carries what is **live** beside what is **proposed**, because the ' +
        'question is not "is this tagline acceptable" but "is this *change* acceptable", and ' +
        'the two differ whenever the edit is a small correction to a line already approved. ' +
        'A reviewer holding the old value in their head is one who approves a number ' +
        'appended to a sentence they half-remember.\n\n' +
        '`tagline: null` and `specialities: []` on the proposed side mean *this request does ' +
        'not touch that field* — unambiguous because neither can be emptied by a ' +
        'dealer: the floors are ten characters and one entry.\n\n' +
        'Capped at 100. A backlog longer than that is an operational problem rather than a ' +
        'pagination one.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      responses: [
        {
          status: 200,
          description: 'Pending edits, oldest first.',
          schema: 'AdminProfileChangesResponse',
        },
      ],
      errors: [401, 403],
    },
    {
      method: 'post',
      path: '/v1/admin/profile-changes/:id/approve',
      operationId: 'approveProfileChange',
      tag: 'Admin',
      summary: 'Publish a dealer’s proposed tagline or services',
      description:
        'Writes the proposed values onto the dealership and marks the request APPROVED ' +
        '(**R34**).\n\n' +
        'This is the **only** path by which `tagline` and `specialities` move on an ACTIVE ' +
        'dealership, which is what makes the queue a gate rather than a notification: there ' +
        'is no second route, so an edit that was not approved was not published.\n\n' +
        'It writes through the same `dealers.update` the dealer’s own PATCH uses, so ' +
        'service de-duplication (R18) and every other rule about the data holds. A field ' +
        'the request does not carry is not sent — approving a services-only edit must ' +
        'not fail on a tagline that was never part of it.\n\n' +
        '`dealerSlug` comes back because the console has to clear the public pages this ' +
        'decision changed, and the slug of the row that was actually written is the only ' +
        'trustworthy source for which pages those are.\n\n' +
        'A request that has already been decided is a **409**, not a silent success. Two ' +
        'moderators working the same queue is the ordinary case, and the second must be ' +
        'told their button did nothing rather than shown a tick.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      responses: [
        {
          status: 200,
          description: 'Published. The dealership’s public pages now show the new words.',
          schema: 'ProfileChangeDecisionResponse',
        },
      ],
      errors: [401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/profile-changes/:id/reject',
      operationId: 'rejectProfileChange',
      tag: 'Admin',
      summary: 'Refuse a dealer’s proposed tagline or services',
      description:
        'Marks the request REJECTED with a reason the dealer reads verbatim (**R34**).\n\n' +
        '**Nothing is restored, because nothing was taken away.** The live columns were ' +
        'never written, so a refusal is a status change on the request and no write at all ' +
        'on the dealership. A design that published first and rolled back on refusal would ' +
        'have a window, however short, in which the phone number was on the page; this one ' +
        'has none.\n\n' +
        'The reason is **required**, minimum six characters, and it is the only thing the ' +
        'dealer will ever be told about why their line did not appear. "Rejected" with no ' +
        'sentence attached is how a dealer concludes the product is broken and submits the ' +
        'same text again.\n\n' +
        'The dealer sees it on their profile screen as `profileChange.decisionReason` until ' +
        'they edit again, at which point a new request replaces it.',
      audience: 'admin',
      permission: 'admin:dealer:approve',
      params: 'IdParam',
      requestBody: {
        schema: 'ReasonInput',
        description: 'What was wrong with it. Shown to the dealer verbatim.',
        example: {
          reason:
            'The tagline ends with a mobile number. Buyers reach you through the contact ' +
            'button, which logs the lead for you — please remove it.',
        },
      },
      responses: [
        {
          status: 200,
          description: 'Refused. What buyers see is unchanged.',
          schema: 'ProfileChangeDecisionResponse',
        },
      ],
      errors: [400, 401, 403, 404, 409],
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
      summary: 'Reject a KYC document — ask for that one again',
      description:
        'Rejects **one file**, not the dealership. The scan is unreadable, or it is last ' +
        "year's electricity bill, or it is a photograph of the wrong page — the other two " +
        'documents are untouched and no verdict has been reached on the applicant.\n\n' +
        'Two things follow. The **file is deleted from object storage** and the row is ' +
        'emptied of its file name: a rejected scan of a PAN card will never be read again, ' +
        'and KYC media is exactly the category where "we still had a copy" is the wrong ' +
        'answer. The dealer sees the empty slot they saw before they uploaded, with the ' +
        'reason underneath saying what to send instead.\n\n' +
        'And the **application is reopened** — a PENDING_APPROVAL dealership returns to ' +
        'DRAFT, because otherwise the dealer is told to re-upload and shown no upload box. ' +
        '`dealerReturnedToDraft` in the response says whether that happened.\n\n' +
        'The reason is required and at least six characters; the dealer reads it verbatim.',
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
