import { timingSafeEqual } from 'node:crypto';

import { Router } from 'express';

import { metricsRegistry } from './metrics.js';

export function createMetricsRouter(scrapeToken: string): Router {
  const router = Router();

  router.get('/internal/metrics', (req, res) => {
    if (!validBearerToken(req.get('authorization'), scrapeToken)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).type('text/plain').send('Unauthorized\n');
      return;
    }

    void metricsRegistry
      .metrics()
      .then((body) => res.type(metricsRegistry.contentType).send(body))
      .catch(() => res.status(503).type('text/plain').send('Metrics unavailable\n'));
  });

  return router;
}

function validBearerToken(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice('Bearer '.length));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
