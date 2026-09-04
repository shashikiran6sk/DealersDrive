import { CONTRACTS_VERSION } from '@dealers-drive/contracts';

import type { JsonSchema } from '../../docs/schemas.js';
import type { ModuleDocs } from '../../docs/spec.js';

/** Shared by the 200 and the 503 — the same body, a different verdict. */
const READINESS: JsonSchema = {
  type: 'object',
  required: ['status', 'contracts', 'appEnv', 'version', 'checks', 'uptimeSeconds'],
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    contracts: { type: 'string', description: 'The @dealers-drive/contracts version.' },
    appEnv: { type: 'string', enum: ['local', 'preview', 'dev', 'production'] },
    version: {
      type: 'string',
      description:
        'The commit this image was built from (`GIT_SHA`), or `unknown` outside a built image. ' +
        'Deployments gate on it: promotion refuses to run unless dev is already reporting the ' +
        'SHA being promoted.',
    },
    checks: {
      type: 'object',
      additionalProperties: { type: 'string', enum: ['ok', 'down'] },
      description: 'One entry per dependency: database, cache, queue, storage, gateway.',
    },
    uptimeSeconds: { type: 'integer' },
  },
};

/**
 * E2 · E3. Deliberately outside `/v1`: infrastructure probes these, not clients,
 * so they must not move when the API version does.
 */
export const healthDocs: ModuleDocs = {
  tag: 'Health',
  description:
    'Liveness and readiness probes. Two endpoints rather than one because they answer ' +
    'different questions: whether the process is alive, and whether it can serve traffic. ' +
    'Conflating them means a database blip gets the container killed and restarted, which ' +
    'helps nobody.',
  operations: [
    {
      method: 'get',
      path: '/health/live',
      operationId: 'getLiveness',
      tag: 'Health',
      summary: 'Liveness probe',
      description:
        'Returns 200 whenever the process is running. **Touches no dependency** — that is the ' +
        'point. If this checked the database, a database blip would restart a perfectly ' +
        'healthy container.',
      audience: 'internal',
      responses: [
        {
          status: 200,
          description: 'The process is up.',
          inlineSchema: {
            type: 'object',
            required: ['status'],
            properties: { status: { type: 'string', enum: ['ok'] } },
          },
          example: { status: 'ok' },
        },
      ],
    },
    {
      method: 'get',
      path: '/health/ready',
      operationId: 'getReadiness',
      tag: 'Health',
      summary: 'Readiness probe',
      description:
        'Checks the dependencies and names the ones that are down. **503 with a body**, not a ' +
        'bare 503 — deploys gate on this, and a failed deploy should say which dependency ' +
        'failed.\n\n' +
        '`contracts` is the shared contract version, so a mismatched web and API deploy is ' +
        'visible from outside the process.',
      audience: 'internal',
      responses: [
        {
          status: 200,
          description: 'Every dependency responded.',
          inlineSchema: READINESS,
          example: {
            status: 'ok',
            contracts: CONTRACTS_VERSION,
            appEnv: 'local',
            version: 'unknown',
            checks: { queue: 'ok', storage: 'ok', gateway: 'ok', database: 'ok', cache: 'ok' },
            uptimeSeconds: 412,
          },
        },
        {
          status: 503,
          description: 'A dependency is down. `checks` names it; the process stays alive.',
          inlineSchema: READINESS,
          example: {
            status: 'degraded',
            contracts: CONTRACTS_VERSION,
            appEnv: 'local',
            version: 'unknown',
            checks: { queue: 'ok', storage: 'ok', gateway: 'ok', database: 'down', cache: 'ok' },
            uptimeSeconds: 412,
          },
        },
      ],
    },
  ],
};
