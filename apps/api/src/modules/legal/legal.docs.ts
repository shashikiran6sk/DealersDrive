import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const legalDocs: ModuleDocs = {
  tag: DOC_TAGS.legal,
  description:
    'One-time account and owner-authorized dealership acceptance. Authentication, recovery and support remain available without agreement. Customer enquiries, saved cars and invitations, and normal dealer operations require current acceptance. Dealer drafts/uploads remain available. All identities and versions are server-derived.',
  operations: [
    {
      method: 'get',
      path: '/v1/legal/status',
      operationId: 'legalStatus',
      tag: DOC_TAGS.legal,
      summary: 'Read current policy acceptance',
      description:
        'Available to authenticated customers and dealer/pending accounts through the existing person session. Does not infer agreement from sign-in. Not cached.',
      audience: 'customer',
      query: 'LegalStatusQuery',
      responses: [
        {
          status: 200,
          description: 'Current acceptance and owner authority.',
          schema: 'LegalStatus',
        },
      ],
      errors: [400, 401],
    },
    {
      method: 'post',
      path: '/v1/legal/accept',
      operationId: 'acceptLegalPolicies',
      tag: DOC_TAGS.legal,
      summary: 'Affirm the current Terms and Privacy Policy',
      description:
        'Requires accepted=true. Body cannot supply an identity or document version. Idempotent insertion under a unique subject/version key; original timestamps are preserved. Only the current authenticated owner can accept for a dealership. Cross-origin browser submissions and non-JSON bodies are refused. No IP or fingerprint is recorded. In production this release stays inactive until mandatory publication details are complete.',
      audience: 'customer',
      requestBody: { schema: 'LegalAcceptInput', required: true },
      responses: [{ status: 200, description: 'Acceptance persisted.', schema: 'LegalStatus' }],
      errors: [400, 401, 403],
    },
  ],
};
