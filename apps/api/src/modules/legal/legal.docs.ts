import type { ModuleDocs, OperationSpec } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';
const accountOperations = (['account', 'customer', 'dealer'] as const).flatMap(
  (audience): OperationSpec[] => {
    const scope = audience === 'customer' ? 'customer' : 'dealer';
    return [
      {
        method: 'get',
        path: `/v1/legal/${audience}/status`,
        operationId: `legalStatus${audience}`,
        tag: DOC_TAGS.legal,
        summary: 'Current agreement requirements',
        description:
          'Authenticated account requirements. Login never creates acceptance. The account route also permits a pending dealer identity. Dealer requirements refer only to the active workspace. No-store.',
        audience: scope,
        responses: [{ status: 200, description: 'Current requirements.', schema: 'LegalStatus' }],
        errors: [401],
      },
      {
        method: 'get',
        path: `/v1/legal/${audience}/history`,
        operationId: `legalHistory${audience}`,
        tag: DOC_TAGS.legal,
        summary: 'Your agreement and choice receipts',
        description:
          'Up to 100 recent receipts for the authenticated actor and linked absorbed account identities. No identity, IP, document contents or other users’ events are returned. Evidence is immutable. No-store.',
        audience: scope,
        responses: [{ status: 200, description: 'Your recent receipts.', schema: 'LegalHistory' }],
        errors: [401],
      },
      {
        method: 'post',
        path: `/v1/legal/${audience}/terms`,
        operationId: `legalAcceptTerms${audience}`,
        tag: DOC_TAGS.legal,
        summary: 'Accept current account Terms',
        description:
          'Requires explicit Terms acceptance and separate Privacy Policy acknowledgment at the exact current version. Records ACCEPT and ACKNOWLEDGE atomically and idempotently. Disabled releases reject collection. No-store.',
        audience: scope,
        requestBody: { schema: 'TermsAcceptanceInput', required: true },
        responses: [{ status: 200, description: 'Updated requirements.', schema: 'LegalStatus' }],
        errors: [400, 401, 422],
      },
    ];
  },
);
export const legalDocs: ModuleDocs = {
  tag: DOC_TAGS.legal,
  description:
    'Versioned draft snapshots, contract acceptance, privacy notice acknowledgment, enquiry sharing choices and listing certifications. Production activation is blocked until factual completion and approval. There is no document mutation or administrative acceptance endpoint.',
  operations: [
    ...accountOperations,
    {
      method: 'get',
      path: '/v1/enquiries/:id',
      operationId: 'getOwnEnquiry',
      tag: DOC_TAGS.legal,
      summary: 'Read your selected enquiry',
      description:
        'Customer ownership checked; permits sharing controls for older enquiries outside the recent list. Other customers’ IDs return 404. No-store.',
      audience: 'customer',
      params: 'LegalEnquiryParam',
      responses: [{ status: 200, description: 'Your enquiry.', schema: 'CustomerEnquiry' }],
      errors: [400, 401, 404],
    },
    {
      method: 'post',
      path: '/v1/legal/dealer/dealer-agreement',
      operationId: 'legalAcceptDealerAgreement',
      tag: DOC_TAGS.legal,
      summary: 'Owner accepts the dealership agreement',
      description:
        'Only an active OWNER membership in the current session workspace may bind the dealership. Checks active membership again in the transaction and records the Terms, Privacy acknowledgment and dealership agreement. Staff and sales cooperation cannot supply acceptance.',
      audience: 'dealer',
      requestBody: { schema: 'DealerAcceptanceInput', required: true },
      responses: [{ status: 200, description: 'Updated requirements.', schema: 'LegalStatus' }],
      errors: [400, 401, 403, 422],
    },
    {
      method: 'get',
      path: '/v1/admin/legal/events',
      operationId: 'adminLegalEvents',
      tag: DOC_TAGS.legal,
      summary: 'Read evidence for a known subject',
      description:
        'Authorized audit readers only. Requires an exact subject UUID and kind; bounded to 100 recent receipts. No bulk public export or update capability. No-store.',
      audience: 'admin',
      permission: 'admin:audit:read',
      query: 'LegalEvidenceQuery',
      responses: [{ status: 200, description: 'Subject receipts.', schema: 'LegalHistory' }],
      errors: [400, 401, 403],
    },
    {
      method: 'post',
      path: '/v1/enquiries/:id/withdraw-sharing',
      operationId: 'withdrawEnquirySharing',
      tag: DOC_TAGS.legal,
      summary: 'Withdraw future dealer disclosure',
      description:
        'Customer owns the enquiry; another customer’s UUID is a 404. Idempotently records withdrawal and suppresses future dealer views, dashboard details and pending notification rendering. Does not recall delivered messages. Available even when new Terms are declined; never changes enquiry status. No-store.',
      audience: 'customer',
      params: 'LegalEnquiryParam',
      responses: [
        {
          status: 200,
          description: 'Future disclosure withdrawn.',
          inlineSchema: {
            type: 'object',
            properties: { withdrawn: { type: 'boolean', enum: [true] } },
            required: ['withdrawn'],
          },
        },
      ],
      errors: [400, 401, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/certify',
      operationId: 'certifyAssistedDraft',
      tag: DOC_TAGS.legal,
      summary: 'Owner certifies an assisted draft',
      description:
        'The active dealership OWNER personally reviews and certifies an editable, complete assisted vehicle. Requires current account Terms and Dealer Agreement. Certification is tied to vehicle revision and submission count; edits invalidate it. The salesperson may then submit through the existing state machine. No-store.',
      audience: 'dealer',
      permission: 'listing:submit',
      requiresActiveDealer: true,
      params: 'IdParam',
      requestBody: { schema: 'SubmitVehicleInput', required: true },
      responses: [
        {
          status: 200,
          description: 'Exact draft certified.',
          inlineSchema: {
            type: 'object',
            properties: { certified: { type: 'boolean', enum: [true] } },
            required: ['certified'],
          },
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
  ],
};
