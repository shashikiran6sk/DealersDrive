import type { ModuleDocs } from '../../docs/spec.js';

/**
 * D1–D15. The platform's own console.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline documents 20 operations. This file grows with the router beside
 * it — an operation lands in the same PR that mounts its route, which is what
 * `tests/unit/docs/openapi.test.ts` checks in both directions. **F049 brings
 * the first: the metrics the console shell reads.**
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
  ],
};
