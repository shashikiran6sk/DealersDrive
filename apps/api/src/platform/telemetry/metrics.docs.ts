import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const metricsDocs: ModuleDocs = {
  tag: DOC_TAGS.metrics,
  description:
    'A Prometheus scrape endpoint for Grafana Cloud. Not part of the public API surface — ' +
    'infrastructure polls it, clients never do.',
  operations: [
    {
      method: 'get',
      path: '/internal/metrics',
      operationId: 'getMetrics',
      tag: DOC_TAGS.metrics,
      summary: 'Scrape Prometheus metrics',
      description:
        'Returns the process metrics in Prometheus exposition format. Guarded by a bearer ' +
        'token compared with `timingSafeEqual`, not a session — the scraper is Grafana ' +
        "Cloud's agent, not a signed-in dealer or admin.",
      audience: 'internal',
      responses: [
        {
          status: 200,
          description: 'The current metrics snapshot.',
          contentType: 'text/plain',
          inlineSchema: { type: 'string' },
          example:
            '# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.\n' +
            '# TYPE process_cpu_user_seconds_total counter\n' +
            'process_cpu_user_seconds_total 0.42\n',
        },
        {
          status: 401,
          description: 'The bearer token is missing or does not match `METRICS_SCRAPE_TOKEN`.',
          contentType: 'text/plain',
          inlineSchema: { type: 'string' },
          headers: {
            'WWW-Authenticate': {
              description: 'Always `Bearer` — the scheme the caller is expected to use.',
              schema: { type: 'string', example: 'Bearer' },
            },
          },
          example: 'Unauthorized\n',
        },
        {
          status: 503,
          description: 'The metrics registry failed to serialize.',
          contentType: 'text/plain',
          inlineSchema: { type: 'string' },
          example: 'Metrics unavailable\n',
        },
      ],
    },
  ],
};
