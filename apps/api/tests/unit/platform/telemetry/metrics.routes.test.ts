import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createMetricsRouter } from '../../../../src/platform/telemetry/metrics.routes.js';

function app() {
  const instance = express();
  instance.use(createMetricsRouter('a'.repeat(32)));
  return instance;
}

describe('metrics exposition', () => {
  it('refuses an unauthenticated scrape', async () => {
    const response = await request(app()).get('/internal/metrics');

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('uses a bearer token and returns OpenMetrics', async () => {
    const response = await request(app())
      .get('/internal/metrics')
      .set('Authorization', `Bearer ${'a'.repeat(32)}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/openmetrics-text');
    expect(response.text).toContain('dealers_drive_service_up');
  });

  it('does not accept a same-length wrong token', async () => {
    await request(app())
      .get('/internal/metrics')
      .set('Authorization', `Bearer ${'b'.repeat(32)}`)
      .expect(401);
  });
});
