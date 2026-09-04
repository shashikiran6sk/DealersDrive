import type { ModuleDocs } from '../../docs/spec.js';

/**
 * C1–C5 and C18. The dealership's own record and its console.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline module documents nine operations. This file grows with the
 * router beside it — an operation lands in the same PR that mounts its route,
 * which is what `tests/unit/docs/openapi.test.ts` checks in both directions.
 * **F040 brings the first: the KYC document checklist.**
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
  ],
};
