import { describe, expect, it, vi } from 'vitest';

import { runWithContext, type RequestContext } from '../../../../src/middleware/request-context.js';
import { logger } from '../../../../src/platform/telemetry/logger.js';
import {
  instrumentDbOperation,
  metricsRegistry,
  recordHttpRequest,
  recordOAuthAttempt,
  resetApplicationMetrics,
} from '../../../../src/platform/telemetry/metrics.js';

describe('application metrics', () => {
  it('exports request totals, latency, DB attribution and a trace exemplar', async () => {
    resetApplicationMetrics();
    recordHttpRequest({
      method: 'GET',
      route: '/v1/dealers/:slug',
      statusCode: 200,
      durationSeconds: 0.42,
      dbDurationSeconds: 0.18,
      dbOperationCount: 2,
      traceId: 'trace-123',
    });

    const output = await metricsRegistry.metrics();
    expect(output).toContain(
      'dealers_drive_http_requests_total{method="GET",route="/v1/dealers/:slug",status_code="200"',
    );
    expect(output).toContain('dealers_drive_http_request_duration_seconds_bucket');
    expect(output).toContain('dealers_drive_http_request_db_duration_seconds_bucket');
    expect(output).toContain('dealers_drive_http_request_db_operations_bucket');
    expect(output).toContain('trace_id="trace-123"');
  });

  it('records OAuth semantics separately from HTTP redirects', async () => {
    resetApplicationMetrics();
    recordOAuthAttempt('ADMIN', 'failure', 'not_authorised');

    expect(await metricsRegistry.metrics()).toContain(
      'dealers_drive_oauth_attempts_total{audience="admin",outcome="failure",reason="not_authorised"',
    );
  });

  it('attributes database duration and operation count to the live request context', async () => {
    resetApplicationMetrics();
    const context: RequestContext = { traceId: 'db-trace', ip: '127.0.0.1' };

    const result = await runWithContext(context, () =>
      instrumentDbOperation('Dealer', 'findMany', async () => 'ok'),
    );

    expect(result).toBe('ok');
    expect(context.dbOperationCount).toBe(1);
    expect(context.dbDurationSeconds).toBeGreaterThanOrEqual(0);
    expect(await metricsRegistry.metrics()).toContain(
      'dealers_drive_db_operations_total{model="Dealer",operation="findMany",outcome="success"',
    );
  });

  it('counts a database failure without logging arguments or SQL', async () => {
    resetApplicationMetrics();
    const error = Object.assign(new Error('not logged by the instrumentation'), { code: 'P2002' });
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    await expect(
      instrumentDbOperation('Dealer', 'create', async () => Promise.reject(error)),
    ).rejects.toBe(error);

    expect(await metricsRegistry.metrics()).toContain(
      'dealers_drive_db_errors_total{model="Dealer",operation="create"',
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'Dealer', operation: 'create', errorCode: 'P2002' }),
      'database operation failed',
    );
    expect(log.mock.calls[0]?.[0]).not.toHaveProperty('args');
    expect(log.mock.calls[0]?.[0]).not.toHaveProperty('query');
    log.mockRestore();
  });
});
