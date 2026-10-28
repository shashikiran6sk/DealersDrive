import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const dealersDocs: ModuleDocs = {
  tag: DOC_TAGS.dealerAccount,
  description:
    'The acting dealership: profile, KYC documents, verification submission and dashboard. ' +
    'Every one of these reads and writes exactly one dealership — the one the ' +
    'session resolves to. **No endpoint here takes a `dealerId`**, and because the schemas ' +
    'are `.strict()`, sending one is a 400 rather than a quiet no-op (rule 1).',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer',
      operationId: 'getDealerProfile',
      tag: DOC_TAGS.dealerAccount,
      summary: 'The dealership record',
      description:
        'The full private profile — including the fields the public profile withholds, such ' +
        'as GSTIN, PAN and the credit balance. Any dealer seat may read it.',
      audience: 'dealer',
      responses: [{ status: 200, description: 'The dealership.', schema: 'DealerProfile' }],
      errors: [401, 404],
    },
    {
      method: 'patch',
      path: '/v1/dealer',
      operationId: 'updateDealerProfile',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Update the dealership',
      description:
        'OWNER only (`dealer:update`). Accepts `establishedYear`, `tagline`, `specialities`, and `contact.landline`; unknown fields are a named 400. Account mobile/email, business identity and address remain locked. ' +
        'On ACTIVE dealerships, tagline, services and customer contact changes enter the existing admin review queue. Established year updates immediately. The response shows approved details and the pending proposal; 200 means accepted, not published. ' +
        'An Indian mobile or landline with STD code is accepted for customer contact; blank/null requests removal. An omitted field is unchanged. Saving confirms consent to share the number with signed-in customers after approval. The previous approved number remains active while pending, rejected or withdrawn. ' +
        'Existing numbers need explicit confirmation and approval before calling is enabled. Account mobile is never a fallback. There is one pending request per dealership; cancel it before proposing another change. Draft contact edits are saved for initial application review. Other non-active states refuse contact edits. ' +
        'Customer contact review does not invalidate business verification. The wider draft onboarding and admin amendment routes remain available for their respective purposes.',
      audience: 'dealer',
      permission: 'dealer:update',
      requestBody: {
        schema: 'DealerSelfUpdateInput',
        description:
          'Only changed fields. On ACTIVE dealerships, tagline, services and customer contact changes require approval.',
        example: {
          establishedYear: 2009,
          tagline: 'Family-run since 2009 \u2014 every car with a service book.',
          specialities: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
        },
      },
      responses: [
        {
          status: 200,
          description:
            'The dealership as it stands now. `profileChange` says what is waiting for ' +
            'review, or why the last edit was refused.',
          schema: 'DealerProfile',
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'delete',
      path: '/v1/dealer/profile-change',
      operationId: 'withdrawDealerProfileChange',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Take back a change that is waiting for review',
      description:
        'Deletes the dealership\u2019s waiting profile edit (**R34**). What buyers see never ' +
        'moved, so nothing is restored \u2014 the proposal simply stops existing, the two boxes ' +
        'on the profile screen unlock, and the row leaves the moderator\u2019s queue.\n\n' +
        'No id in the path and no body: there is at most one request waiting per dealership, so ' +
        'naming it would be asking the client for an id it could only have got from the same ' +
        'response that told it the button should exist.\n\n' +
        'The row is **deleted**, not marked withdrawn. A record that a dealership briefly ' +
        'considered a different tagline is not history anybody reads, and a withdrawn row would ' +
        'have to be filtered out of every read of this table for the sake of nothing.\n\n' +
        '**404 when nothing is waiting.** The button only renders when there is one, so arriving ' +
        'here empty-handed is a double-click or a stale page \u2014 both of which want the ' +
        'screen re-read.\n\n' +
        'OWNER only (`dealer:update`): withdrawing is the other half of submitting.',
      audience: 'dealer',
      permission: 'dealer:update',
      responses: [
        {
          status: 200,
          description: 'The dealership, with `profileChange` now `null`.',
          schema: 'DealerProfile',
        },
      ],
      errors: [401, 403, 404],
    },
    {
      method: 'patch',
      path: '/v1/dealer/onboarding',
      operationId: 'amendDealerDuringOnboarding',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Amend a DRAFT dealership',
      description:
        'The onboarding wizard\u2019s write path, and the only route on which a dealer may ' +
        'still change their own name, address and contact details (**R27**).\n\n' +
        '**DRAFT only.** Anything else is a `409 PROFILE_LOCKED`. That covers both cases ' +
        'that matter: a dealership still working through the wizard, and one a moderator has ' +
        'sent back with *Request changes* \u2014 which writes `status: DRAFT` with a reason, ' +
        'so it is the same door. Nothing has been verified about a DRAFT, so there is ' +
        'nothing an edit here can invalidate.\n\n' +
        '**Partial by design.** The wizard PATCHes only the fields on the current step, so ' +
        '`Back` never blanks what another step filled in.\n\n' +
        'Notable absences, all deliberate: `status`, `slug` and `dealerId`. GSTIN and PAN ' +
        'are validated against their real formats and upper-cased.\n\n' +
        '`contact.phone` **is** patchable. It stopped being a credential when dealers moved ' +
        'to Google sign-in, so what this edits is the number a buyer is given \u2014 the ' +
        'thing a dealership changes when it swaps SIMs. It is normalised to E.164 and stays ' +
        'unique across users: a number another dealership holds is a `409 ' +
        'PHONE_ALREADY_REGISTERED` naming `body.contact.phone`. Both `users.phone` and the ' +
        "dealership's public `contactPhone` are written from the one answer.\n\n" +
        '`brandName` is absent too, and for a different reason: a dealership has **one** ' +
        'name. `legalName` is it, and `brandName` is the server-written display mirror of ' +
        'it \u2014 a client able to set both is a client able to make them disagree.\n\n' +
        '`legalName` is unique **within a city**; `gstin` and `pan` are each unique across ' +
        'the platform. A collision is a 409 (`DEALER_NAME_TAKEN`, `GSTIN_ALREADY_REGISTERED`, ' +
        '`PAN_ALREADY_REGISTERED`) naming the field. A rename is checked against the city ' +
        'this same request moves to, when it moves \u2014 so changing both in one call is ' +
        'checked against the pair, not a half-applied combination of them.\n\n' +
        'A submit carrying a duplicate **GSTIN and** a duplicate PAN is answered about the ' +
        'GSTIN. One field error at a time is the shape of every check on this path, and a ' +
        'GSTIN embeds the PAN of the entity that holds it \u2014 so a dealer who corrects ' +
        'the GSTIN usually corrects the PAN with it, and naming the derived field first ' +
        'would send them to the wrong document.\n\n' +
        '`address.city`, `address.district` and `address.state` are free text, normalised on ' +
        'write. There is no list of cities to choose from and no state the platform is ' +
        'confined to.\n\n' +
        '`address.mapsUrl` is the dealership\u2019s own Google Maps share link, stored ' +
        'verbatim and **host-checked**: `https` on a Google Maps domain, nothing else. A ' +
        "buyer's browser follows it from the public portfolio, so an arbitrary URL here " +
        'would be a self-service open redirect wearing a dealership\u2019s name.\n\n' +
        'OWNER only (`dealer:update`) \u2014 a manager or salesperson gets a 403.',
      audience: 'dealer',
      permission: 'dealer:update',
      requestBody: {
        schema: 'DealerOnboardingInput',
        description:
          'Only the fields being changed. The GSTIN is not here: it is entered with the GST certificate when that document is committed, and the PAN is an identity document.',
        example: {
          legalName: 'Sri Lakshmi Motors',
          address: {
            line: '142 Katpadi Main Road',
            city: 'Vellore',
            district: 'Vellore',
            state: 'Tamil Nadu',
            pincode: '632007',
            mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
          },
          contact: { fullName: 'Karthik Raman', phone: '9840012345' },
        },
      },
      responses: [{ status: 200, description: 'The updated dealership.', schema: 'DealerProfile' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'get',
      path: '/v1/dealer/completeness',
      operationId: 'getDealerCompleteness',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Onboarding progress',
      description:
        'Which onboarding steps are done, what is missing from each, and whether the ' +
        'dealership can be submitted for verification yet. Drives the progress meter, and ' +
        '`canSubmit` is the same condition `POST /v1/dealer/submit` enforces server-side.',
      audience: 'dealer',
      responses: [
        { status: 200, description: 'Step-by-step completeness.', schema: 'CompletenessResponse' },
      ],
      errors: [401, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/submit',
      requestBody: {
        schema: 'DealerLegalSubmitInput',
        description:
          'An unchecked/missing acceptance is refused when V1 agreement is missing. Only the authenticated owner may affirm it. Previously accepted owners may submit an empty object.',
        required: false,
      },
      operationId: 'submitDealerForVerification',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Submit for verification',
      description:
        'Hands the dealership to the moderation queue. Takes no body — everything it needs ' +
        'is already on the record.\n\n' +
        'Rejected with 422 if the profile or the KYC documents are incomplete; ' +
        '`GET /v1/dealer/completeness` says what is missing before you try.\n\n' +
        'OWNER only (`dealer:update`).',
      audience: 'dealer',
      permission: 'dealer:update',
      responses: [
        {
          status: 200,
          description: 'Submitted. The response carries the expected decision date.',
          schema: 'DealerSubmitResponse',
        },
      ],
      errors: [401, 403, 404, 422],
    },
    {
      method: 'get',
      path: '/v1/dealer/documents',
      operationId: 'listDealerDocuments',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Identity and business document slots',
      description:
        'One slot per category — Personal Identity Proof and Business Identity Proof — each ' +
        'with the types it accepts and the document the dealership chose for it, its review ' +
        'status and any rejection reason. Submission needs one of each; with a GSTIN on file the ' +
        'business proof is its GST Registration Certificate. `requirementMet` and `gaps` say ' +
        'which is still missing. A legacy supporting document an older application holds is in ' +
        '`data`. Verification is the owner’s business, so this needs `document:upload` (R92).',
      audience: 'dealer',
      permission: 'document:upload',
      responses: [
        { status: 200, description: 'The document checklist.', schema: 'DealerDocumentsResponse' },
      ],
      errors: [401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/documents/presign',
      operationId: 'presignDealerDocument',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Get an upload URL for a KYC document',
      description:
        'Step 1 of 2. Returns a short-lived signed `PUT` URL; the file goes **straight to ' +
        'storage**, never through this API, so a 5 MB PDF never occupies a request worker.\n\n' +
        'The declared `mimeType` and `bytes` are baked into the signature, so the upload is ' +
        'rejected at the storage edge if the actual file disagrees — the limits are not ' +
        'advisory.\n\n' +
        'Then `PUT` the bytes to `uploadUrl` with the returned `headers`, and finish with ' +
        '`POST /v1/dealer/documents/{category}/commit`.\n\n' +
        '`type` must belong to `category`; `OTHER_BUSINESS_CERTIFICATE` needs a `description` ' +
        'and no other type takes one; the file name extension must match `mimeType`. Choosing a ' +
        'new file for a slot replaces the one it held.\n\n' +
        'Outside `DRAFT` a document that is `UPLOADED` (under review) or `VERIFIED` is ' +
        'locked: the call is a 409 `DOCUMENT_LOCKED` and nothing changes. An empty, ' +
        '`REJECTED` or `UPLOADING` slot can still be filled.\n\n' +
        'Accepts PDF, JPEG and PNG up to 5 MB. OWNER only (`document:upload`).',
      audience: 'dealer',
      permission: 'document:upload',
      requestBody: {
        schema: 'DocumentPresignInput',
        description: 'What is about to be uploaded.',
        example: {
          category: 'BUSINESS_IDENTITY',
          type: 'GST_CERTIFICATE',
          fileName: 'gst-certificate.pdf',
          mimeType: 'application/pdf',
          bytes: 284_512,
        },
      },
      responses: [
        {
          status: 201,
          description: 'A signed upload URL. `documentId` identifies the row to commit.',
          schema: 'PresignResponse',
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/documents/:category/commit',
      operationId: 'commitDealerDocument',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Confirm a KYC upload',
      description:
        'Step 2 of 2. Verifies the object actually landed in storage before marking the ' +
        'document uploaded — a presign that was never followed by a `PUT` must not leave a ' +
        'document looking complete. A missing object is a 422 `UPLOAD_MISSING`.\n\n' +
        'The stored bytes are then read back: a size that differs from the presign is a 422 ' +
        '`DOCUMENT_SIZE_MISMATCH`, and content that is not a PDF, JPEG or PNG of the declared ' +
        'type is a 422 `DOCUMENT_CONTENT_MISMATCH`. Either way the object is deleted and the ' +
        'slot is emptied. Committing an already committed document returns it unchanged.\n\n' +
        'Outside `DRAFT` a document that is `UPLOADED` (under review) or `VERIFIED` is ' +
        'locked: the call is a 409 `DOCUMENT_LOCKED` and nothing changes. An empty, ' +
        '`REJECTED` or `UPLOADING` slot can still be filled.\n\n' +
        '`category` in the path must match the slot the document was presigned into.\n\n' +
        '**GSTIN.** The GSTIN on file is the one on the GST certificate. Committing a ' +
        '`GST_CERTIFICATE` sets it from `gstin` (blank or absent: none), committing any other ' +
        'business proof clears it, and sending `gstin` with any other document is a 422 ' +
        '`GSTIN_NEEDS_GST_CERTIFICATE`. A GSTIN another dealership holds is a 409 ' +
        '`GSTIN_ALREADY_REGISTERED`. A change revokes Dealer Verified, as any change to ' +
        'business identity does.',
      audience: 'dealer',
      permission: 'document:upload',
      params: 'DocCategoryParam',
      requestBody: {
        schema: 'DocumentCommitInput',
        description: 'The `documentId` returned by presign, and the GSTIN with a GST certificate.',
        example: { documentId: '7f3c9a21-4444-4000-8000-000000000004', gstin: '33AABCS1429P1Z5' },
      },
      responses: [
        {
          status: 200,
          description: 'The document row, now awaiting review.',
          schema: 'DealerDocumentDto',
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'delete',
      path: '/v1/dealer/documents/:category',
      operationId: 'deleteDealerDocument',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Remove a KYC document',
      description:
        'Deletes the row and the stored object, so a wrong file can be replaced.\n\n' +
        'Outside `DRAFT` a document that is `UPLOADED` (under review) or `VERIFIED` is ' +
        'locked: the call is a 409 `DOCUMENT_LOCKED` and nothing changes. An empty, ' +
        '`REJECTED` or `UPLOADING` slot can still be filled.\n\n' +
        'OWNER only (`document:upload`).',
      audience: 'dealer',
      permission: 'document:upload',
      params: 'DocCategoryParam',
      responses: [{ status: 204, description: 'Deleted.' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'get',
      path: '/v1/dealer/portfolio',
      operationId: 'getDealerPortfolio',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Portfolio photographs',
      description:
        'The dealership\u2019s own portfolio photographs (#299): approved, awaiting review and ' +
        'rejected. `previewUrl` is a **short-lived signed read** for the owner only; a pending ' +
        'or rejected photograph is never public.\n\n' +
        'Portfolio photographs are optional and are not identity evidence. They never affect ' +
        'completeness, approval or Dealer Verified.\n\n' +
        'OWNER only (`dealer:update`).',
      audience: 'dealer',
      permission: 'dealer:update',
      responses: [
        {
          status: 200,
          description: 'The photographs, the limit and whether another can be added.',
          schema: 'DealerPortfolioResponse',
        },
      ],
      errors: [401, 403],
    },
    {
      method: 'post',
      path: '/v1/dealer/portfolio/presign',
      operationId: 'presignDealerPortfolioPhoto',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Get an upload URL for a portfolio photograph',
      description:
        'Step 1 of 2 of the presign \u2192 `PUT` \u2192 commit upload. JPEG, PNG or WebP up to ' +
        '10 MB, into a private key.\n\n' +
        'With `replacesId` the photograph is a replacement for an approved one, and does not ' +
        'count against the limit. Without it, a portfolio already at the limit is a 409 ' +
        '`PORTFOLIO_FULL`.\n\n' +
        'OWNER only (`dealer:update`).',
      audience: 'dealer',
      permission: 'dealer:update',
      requestBody: {
        schema: 'PortfolioPhotoPresignInput',
        description: 'What is about to be uploaded.',
        example: { fileName: 'forecourt.jpg', mimeType: 'image/jpeg', bytes: 1_842_100 },
      },
      responses: [
        {
          status: 201,
          description: 'A signed upload URL. `mediaId` identifies the upload to commit.',
          schema: 'PortfolioPhotoPresignResponse',
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/portfolio/commit',
      operationId: 'commitDealerPortfolioPhoto',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Submit a portfolio photograph for review',
      description:
        'Step 2 of 2. Reads the stored object back: a missing object is a 422 ' +
        '`UPLOAD_MISSING`, and bytes that are not the declared image type or size are a 422 ' +
        '`PORTFOLIO_CONTENT_MISMATCH` (the object is deleted).\n\n' +
        'The photograph is created `PENDING` and is not public. A replacement leaves the ' +
        'approved photograph it names on the page until a reviewer approves the replacement; ' +
        'only one replacement per photograph may wait at a time (409 ' +
        '`PORTFOLIO_REPLACEMENT_PENDING`). Committing the same `mediaId` twice returns the ' +
        'same photograph.\n\n' +
        'OWNER only (`dealer:update`).',
      audience: 'dealer',
      permission: 'dealer:update',
      requestBody: {
        schema: 'PortfolioPhotoCommitInput',
        description: 'The `mediaId` returned by presign, and an optional caption.',
        example: { mediaId: '7f3c9a21-4444-4000-8000-000000000009', caption: 'Forecourt' },
      },
      responses: [
        {
          status: 201,
          description: 'The photograph, awaiting review.',
          schema: 'DealerPortfolioPhoto',
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'delete',
      path: '/v1/dealer/portfolio/:id',
      operationId: 'deleteDealerPortfolioPhoto',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Remove a portfolio photograph',
      description:
        'Takes an approved photograph off the page, or withdraws a pending or rejected one, ' +
        'and deletes its stored object. A pending replacement for a removed photograph ' +
        'stays in review as a new photograph.\n\n' +
        'OWNER only (`dealer:update`).',
      audience: 'dealer',
      permission: 'dealer:update',
      params: 'PortfolioPhotoParam',
      responses: [{ status: 204, description: 'Removed.' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'get',
      path: '/v1/dealer/dashboard',
      operationId: 'getDealerDashboard',
      tag: DOC_TAGS.dealerAccount,
      summary: 'Console dashboard',
      description:
        'The console landing page in one response: headline stats, the credit balance, ' +
        'recent leads, a seven-day view chart and any account-level banner. Every number ' +
        'arrives formatted and `viewsChart.series[].heightPct` is computed server-side ' +
        'against the week\u2019s own maximum, so the chart cannot disagree with the figures ' +
        'printed beside it (rule 6).\n\n' +
        'Any dealer seat may read it \u2014 a salesperson who cannot see their own dashboard ' +
        'has a broken console.\n\n' +
        '`Cache-Control: no-store` \u2014 a stale credit balance is worse than a slow one.\n\n' +
        '\u26a0\ufe0f **Partially reconstructed.** The view rollups, enquiry counts, recent ' +
        'leads, expiry alert and the two activity deltas read models that do not exist yet ' +
        '(`ListingViewDaily` and `Listing` at F064, `Enquiry` at F088, `CreditTransaction` ' +
        'at F050), so each reports the answer that is true with no rows. The shape is the ' +
        'final one; `activeListings`, `creditBalance` and `creditsHeld` are real today.',
      audience: 'dealer',
      responses: [{ status: 200, description: 'Dashboard payload.', schema: 'DashboardResponse' }],
      errors: [401, 404],
    },
  ],
};
