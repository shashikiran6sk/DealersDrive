import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { requestContext } from '../../../src/middleware/request-context.js';
import { requestMetrics } from '../../../src/middleware/request-metrics.js';
import {
  metricsRegistry,
  resetApplicationMetrics,
} from '../../../src/platform/telemetry/metrics.js';

function app() {
  const instance = express();
  instance.use(requestContext);
  instance.use(requestMetrics);

  const v1 = express.Router();
  const admin = express.Router();
  admin.get('/dealers/:id', (_req, res) => res.status(409).json({ conflict: true }));
  v1.use('/admin', admin);
  instance.use('/v1', v1);

  return instance;
}

beforeEach(() => resetApplicationMetrics());

describe('requestMetrics', () => {
  it('records the full normalized route, method and exact status code', async () => {
    await request(app()).get('/v1/admin/dealers/private-dealer-id').expect(409);

    const output = await metricsRegistry.metrics();
    expect(output).toContain(
      'dealers_drive_http_requests_total{method="GET",route="/v1/admin/dealers/:id",status_code="409"',
    );
    expect(output).not.toContain('private-dealer-id');
  });

  it('collapses unknown paths instead of labeling attacker-controlled values', async () => {
    await request(app()).get('/definitely/private-and-unique').expect(404);

    const output = await metricsRegistry.metrics();
    expect(output).toContain('route="unmatched"');
    expect(output).not.toContain('definitely/private-and-unique');
  });
});
