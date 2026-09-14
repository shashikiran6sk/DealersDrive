import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const configDocs: ModuleDocs = {
  tag: DOC_TAGS.config,
  description:
    'The subset of platform configuration a browser is allowed to see. Deliberately a ' +
    '*subset*: the admin-only keys are filtered server-side and never appear here, so ' +
    'widening the public surface is a code change rather than a config change.',
  operations: [
    {
      method: 'get',
      path: '/v1/config/public',
      operationId: 'getPublicConfig',
      tag: DOC_TAGS.config,
      summary: 'Client-safe platform configuration',
      description:
        'Listing duration, minimum photo count, support contacts, EMI assumptions, the ' +
        'public feature flags and the social links the buyer footer renders. The values the ' +
        'front end must not hard-code, because changing them is an operations action rather ' +
        'than a deploy.\n\n' +
        '`social` carries only the networks an operator has published a URL for, and only ' +
        'ones that parse as `https:` — a mistyped or non-HTTPS value is dropped here rather ' +
        'than rendered into an `href` on every public page.\n\n' +
        '`Cache-Control: public, max-age=60`.',
      audience: 'public',
      responses: [{ status: 200, description: 'Public configuration.', schema: 'PublicConfig' }],
    },
  ],
};
