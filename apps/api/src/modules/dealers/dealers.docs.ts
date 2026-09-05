import type { ModuleDocs } from '../../docs/spec.js';

/**
 * C1–C5 and C18. The dealership's own record and its console.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline module documents nine operations. This file grows with the
 * router beside it — an operation lands in the same PR that mounts its route,
 * which is what `tests/unit/docs/openapi.test.ts` checks in both directions.
 * F040 brought the checklist, F041 five more, F043 the completeness read,
 * **F042 the submit**. `getDealerDashboard` (F048) is what remains.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const dealersDocs: ModuleDocs = {
  tag: 'Dealer account',
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
      tag: 'Dealer account',
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
      tag: 'Dealer account',
      summary: 'Update the dealership',
      description:
        '**Partial by design.** The onboarding wizard PATCHes only the fields on the current ' +
        'step, so `Back` never blanks what another step filled in.\n\n' +
        'Notable absences, all deliberate: `phone` (it is the login identity — changing it ' +
        'needs an OTP round-trip on the new number), `status`, `slug` and `dealerId`. GSTIN ' +
        'and PAN are validated against their real formats and upper-cased.\n\n' +
        '`brandName` is absent too, and for a different reason: a dealership has **one** ' +
        'name. `legalName` is it, and `brandName` is the server-written display mirror of ' +
        'it — a client able to set both is a client able to make them disagree.\n\n' +
        '`legalName` is unique **within a city** and `gstin` is unique across the platform. A ' +
        'collision is a 409 (`DEALER_NAME_TAKEN`, `GSTIN_ALREADY_REGISTERED`) naming the ' +
        'field. A rename is checked against the city this same request moves to, when it ' +
        'moves — so changing both in one call is checked against the pair, not a half-applied ' +
        'combination of them.\n\n' +
        '`address.city` and `address.state` are free text, normalised on write. There is no ' +
        'list of cities to choose from and no state the platform is confined to.\n\n' +
        'OWNER only (`dealer:update`) — a manager or salesperson gets a 403.',
      audience: 'dealer',
      permission: 'dealer:update',
      requestBody: {
        schema: 'UpdateDealerInput',
        description: 'Only the fields being changed.',
        example: {
          legalName: 'Sri Lakshmi Motors',
          tagline: 'Family-run since 2009',
          gstin: '33AABCS1429P1Z5',
          address: {
            line: '142 Katpadi Main Road',
            city: 'Vellore',
            state: 'Tamil Nadu',
            pincode: '632007',
          },
          contact: { fullName: 'Karthik Raman', roleTitle: 'Proprietor' },
        },
      },
      responses: [{ status: 200, description: 'The updated dealership.', schema: 'DealerProfile' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'get',
      path: '/v1/dealer/completeness',
      operationId: 'getDealerCompleteness',
      tag: 'Dealer account',
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
      operationId: 'submitDealerForVerification',
      tag: 'Dealer account',
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
      tag: 'Dealer account',
      summary: 'KYC document status',
      description:
        'All three required documents — GST certificate, PAN card, address proof — each with ' +
        'its status and rejection reason if it has one. Rows are returned for documents that ' +
        'have not been uploaded yet, so the checklist is complete rather than growing.',
      audience: 'dealer',
      responses: [
        { status: 200, description: 'The document checklist.', schema: 'DealerDocumentsResponse' },
      ],
      errors: [401, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/documents/presign',
      operationId: 'presignDealerDocument',
      tag: 'Dealer account',
      summary: 'Get an upload URL for a KYC document',
      description:
        'Step 1 of 2. Returns a short-lived signed `PUT` URL; the file goes **straight to ' +
        'storage**, never through this API, so a 5 MB PDF never occupies a request worker.\n\n' +
        'The declared `mimeType` and `bytes` are baked into the signature, so the upload is ' +
        'rejected at the storage edge if the actual file disagrees — the limits are not ' +
        'advisory.\n\n' +
        'Then `PUT` the bytes to `uploadUrl` with the returned `headers`, and finish with ' +
        '`POST /v1/dealer/documents/{type}/commit`.\n\n' +
        'Accepts PDF, JPEG and PNG up to 5 MB. OWNER only (`document:upload`).',
      audience: 'dealer',
      permission: 'document:upload',
      requestBody: {
        schema: 'DocumentPresignInput',
        description: 'What is about to be uploaded.',
        example: {
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
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/documents/:type/commit',
      operationId: 'commitDealerDocument',
      tag: 'Dealer account',
      summary: 'Confirm a KYC upload',
      description:
        'Step 2 of 2. Verifies the object actually landed in storage before marking the ' +
        'document uploaded — a presign that was never followed by a `PUT` must not leave a ' +
        'document looking complete. A missing object is a 422 `UPLOAD_MISSING`.\n\n' +
        '`type` in the path must match the type the document was presigned as.',
      audience: 'dealer',
      permission: 'document:upload',
      params: 'DocTypeParam',
      requestBody: {
        schema: 'DocumentCommitInput',
        description: 'The `documentId` returned by presign.',
        example: { documentId: '7f3c9a21-4444-4000-8000-000000000004' },
      },
      responses: [
        {
          status: 200,
          description: 'The document row, now awaiting review.',
          schema: 'DealerDocumentDto',
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'delete',
      path: '/v1/dealer/documents/:type',
      operationId: 'deleteDealerDocument',
      tag: 'Dealer account',
      summary: 'Remove a KYC document',
      description:
        'Deletes the row and the stored object, so a wrong file can be replaced. OWNER only ' +
        '(`document:upload`).',
      audience: 'dealer',
      permission: 'document:upload',
      params: 'DocTypeParam',
      responses: [{ status: 204, description: 'Deleted.' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'get',
      path: '/v1/dealer/yard-photo',
      operationId: 'getDealerYardPhoto',
      tag: 'Dealer account',
      summary: 'The yard photograph',
      description:
        'The image that fronts the dealership\u2019s public portfolio. `url` is a **short-lived ' +
        'signed read of the original**, not a permanent delivery URL: the derivative pipeline ' +
        'that content-addresses an image is F034, and until it lands the original is the only ' +
        'copy there is.\n\n' +
        'Every field is `null` when nothing has been uploaded yet.',
      audience: 'dealer',
      responses: [
        {
          status: 200,
          description: 'The yard photograph, or an empty one.',
          schema: 'YardPhotoDto',
        },
      ],
      errors: [401, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/yard-photo/presign',
      operationId: 'presignDealerYardPhoto',
      tag: 'Dealer account',
      summary: 'Get an upload URL for the yard photograph',
      description:
        'Step 1 of 2, and the same presign \u2192 `PUT` \u2192 commit pipeline the KYC documents ' +
        'use \u2014 different prefix, different destiny. Accepts JPEG, PNG and WebP up to 10 MB.\n\n' +
        'Presigning does **not** displace the photograph already on the record. Nothing is ' +
        'replaced until commit, so a dealer who changes their mind halfway through picking a ' +
        'file still has the one they had before. OWNER only (`document:upload`).',
      audience: 'dealer',
      permission: 'document:upload',
      requestBody: {
        schema: 'YardPhotoPresignInput',
        description: 'What is about to be uploaded.',
        example: { fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: 1_842_100 },
      },
      responses: [
        {
          status: 201,
          description: 'A signed upload URL. `mediaId` identifies the row to commit.',
          schema: 'PresignResponse',
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/yard-photo/commit',
      operationId: 'commitDealerYardPhoto',
      tag: 'Dealer account',
      summary: 'Confirm the yard photograph upload',
      description:
        'Step 2 of 2. HEADs the object before adopting it \u2014 a presign never followed by a ' +
        '`PUT` must not leave the dealership looking like it has a hero image. A missing ' +
        'object is a 422 `UPLOAD_MISSING`.\n\n' +
        'This is where a replacement takes effect: the photograph being displaced is marked ' +
        'ORPHAN and its bytes are deleted in the same call.',
      audience: 'dealer',
      permission: 'document:upload',
      requestBody: {
        schema: 'YardPhotoCommitInput',
        description: 'The `mediaId` returned by presign.',
        example: { mediaId: '7f3c9a21-4444-4000-8000-000000000009' },
      },
      responses: [
        {
          status: 200,
          description: 'The yard photograph now on the record.',
          schema: 'YardPhotoDto',
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'delete',
      path: '/v1/dealer/yard-photo',
      operationId: 'deleteDealerYardPhoto',
      tag: 'Dealer account',
      summary: 'Remove the yard photograph',
      description:
        'Clears `coverMediaId` and deletes the stored object. The dealership then reads as ' +
        'incomplete again \u2014 `GET /v1/dealer/completeness` lists `YARD_PHOTO` as missing, ' +
        'and `POST /v1/dealer/submit` refuses until one is uploaded. OWNER only ' +
        '(`document:upload`).',
      audience: 'dealer',
      permission: 'document:upload',
      responses: [{ status: 204, description: 'Removed.' }],
      errors: [401, 403, 404],
    },
  ],
};
