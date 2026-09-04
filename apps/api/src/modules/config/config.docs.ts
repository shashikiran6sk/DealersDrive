import type { ModuleDocs } from '../../docs/spec.js';

/**
 * A14. The client-safe slice of `platform_config`.
 *
 * ── D1 ────────────────────────────────────────────────────────────────────
 * Also lifted out of the removed `catalog.docs.ts`. It was never catalogue
 * data in the first place — it shared that tag only because both responses
 * were public reference data fetched by the same shell.
 */
export const configDocs: ModuleDocs = {
  tag: 'Platform configuration',
  description:
    'The subset of platform configuration a browser is allowed to see. Deliberately a ' +
    '*subset*: the admin-only keys are filtered server-side and never appear here, so ' +
    'widening the public surface is a code change rather than a config change.',
  operations: [
    {
      method: 'get',
      path: '/v1/config/public',
      operationId: 'getPublicConfig',
      tag: 'Platform configuration',
      summary: 'Client-safe platform configuration',
      description:
        'Listing duration, minimum photo count, support contacts, EMI assumptions and the ' +
        'public feature flags. The values the front end must not hard-code, because changing ' +
        'them is an operations action rather than a deploy.\n\n' +
        '`Cache-Control: public, max-age=60`.',
      audience: 'public',
      responses: [{ status: 200, description: 'Public configuration.', schema: 'PublicConfig' }],
    },
  ],
};
