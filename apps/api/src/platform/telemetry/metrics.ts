import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
  Summary,
} from '@prometheus-io/client';

import { env } from '../../config/env.js';
import { getContext, getTraceId } from '../../middleware/request-context.js';
import { logger } from './logger.js';
import { errorCode } from '../errors.js';

const HTTP_LABELS = ['method', 'route', 'status_code'] as const;
const DB_LABELS = ['model', 'operation', 'outcome'] as const;
const DB_OPERATION_LABELS = ['model', 'operation'] as const;

export const metricsRegistry = new Registry();
metricsRegistry.setContentType(Registry.OPENMETRICS_CONTENT_TYPE);
metricsRegistry.setDefaultLabels({
  environment: env.APP_ENV,
  service: 'dealers-drive-api',
});

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'dealers_drive_',
  labels: { environment: env.APP_ENV, service: 'dealers-drive-api' },
});

export const serviceUp = new Gauge({
  name: 'dealers_drive_service_up',
  help: 'Whether this application process is running and able to expose metrics.',
  registers: [metricsRegistry],
});
serviceUp.set(1);

const httpRequests = new Counter({
  name: 'dealers_drive_http_requests_total',
  help: 'Total completed HTTP requests by normalized route, method and status code.',
  labelNames: HTTP_LABELS,
  registers: [metricsRegistry],
});

const httpRequestDuration = new Histogram({
  name: 'dealers_drive_http_request_duration_seconds',
  help: 'End-to-end HTTP request duration in seconds.',
  labelNames: HTTP_LABELS,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20],
  enableExemplars: true,
  registers: [metricsRegistry],
});

const httpRequestExtrema = new Summary({
  name: 'dealers_drive_http_request_extrema_seconds',
  help: 'Rolling five-minute minimum and maximum HTTP request duration.',
  labelNames: ['method', 'route'] as const,
  percentiles: [0, 1],
  maxAgeSeconds: 300,
  ageBuckets: 5,
  pruneAgedBuckets: true,
  registers: [metricsRegistry],
});

const requestDbDuration = new Histogram({
  name: 'dealers_drive_http_request_db_duration_seconds',
  help: 'Cumulative database operation time attributed to a completed HTTP request.',
  labelNames: HTTP_LABELS,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20],
  enableExemplars: true,
  registers: [metricsRegistry],
});

const requestDbOperations = new Histogram({
  name: 'dealers_drive_http_request_db_operations',
  help: 'Number of database operations attributed to a completed HTTP request.',
  labelNames: ['method', 'route'] as const,
  buckets: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55],
  registers: [metricsRegistry],
});

const dbOperations = new Counter({
  name: 'dealers_drive_db_operations_total',
  help: 'Total Prisma database operations by model, operation and outcome.',
  labelNames: DB_LABELS,
  registers: [metricsRegistry],
});

const dbOperationDuration = new Histogram({
  name: 'dealers_drive_db_operation_duration_seconds',
  help: 'Prisma database operation duration in seconds.',
  labelNames: DB_LABELS,
  buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20],
  enableExemplars: true,
  registers: [metricsRegistry],
});

const dbErrors = new Counter({
  name: 'dealers_drive_db_errors_total',
  help: 'Total failed Prisma database operations.',
  labelNames: DB_OPERATION_LABELS,
  registers: [metricsRegistry],
});

const dbSlowOperations = new Counter({
  name: 'dealers_drive_db_slow_operations_total',
  help: 'Total Prisma operations at or above DB_SLOW_OPERATION_MS.',
  labelNames: DB_OPERATION_LABELS,
  registers: [metricsRegistry],
});

const oauthAttempts = new Counter({
  name: 'dealers_drive_oauth_attempts_total',
  help: 'Completed Google OAuth attempts by audience, outcome and bounded reason.',
  labelNames: ['audience', 'outcome', 'reason'] as const,
  registers: [metricsRegistry],
});

export interface HttpObservation {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
  dbDurationSeconds: number;
  dbOperationCount: number;
  traceId?: string | undefined;
}

export function recordHttpRequest(observation: HttpObservation): void {
  const labels = {
    method: observation.method.toUpperCase(),
    route: observation.route,
    status_code: String(observation.statusCode),
  };
  const exemplarLabels = observation.traceId ? { trace_id: observation.traceId } : undefined;

  httpRequests.inc(labels);
  httpRequestDuration.observe({
    labels,
    value: observation.durationSeconds,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- prom-client types exemplarLabels as never
    exemplarLabels: exemplarLabels as never,
  });
  httpRequestExtrema.observe(
    { method: labels.method, route: labels.route },
    observation.durationSeconds,
  );
  requestDbDuration.observe({
    labels,
    value: observation.dbDurationSeconds,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- prom-client types exemplarLabels as never
    exemplarLabels: exemplarLabels as never,
  });
  requestDbOperations.observe(
    { method: labels.method, route: labels.route },
    observation.dbOperationCount,
  );
}

export type DbOutcome = 'success' | 'error';

export async function instrumentDbOperation<T>(
  model: string | undefined,
  operation: string,
  query: () => Promise<T>,
): Promise<T> {
  const startedAt = process.hrtime.bigint();
  const safeModel = model ?? 'raw';

  try {
    const result = await query();
    observeDbOperation(safeModel, operation, 'success', startedAt);
    return result;
  } catch (error) {
    observeDbOperation(safeModel, operation, 'error', startedAt);
    dbErrors.inc({ model: safeModel, operation });
    logger.error(
      {
        component: 'database',
        model: safeModel,
        operation,
        errorCode: prismaErrorCode(error),
      },
      'database operation failed',
    );
    throw error;
  }
}

function observeDbOperation(
  model: string,
  operation: string,
  outcome: DbOutcome,
  startedAt: bigint,
): void {
  const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  const labels = { model, operation, outcome };
  const traceId = getTraceId();

  dbOperations.inc(labels);
  dbOperationDuration.observe({
    labels,
    value: durationSeconds,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- prom-client types exemplarLabels as never
    exemplarLabels: (traceId ? { trace_id: traceId } : undefined) as never,
  });

  const context = getContext();
  if (context) {
    context.dbDurationSeconds = (context.dbDurationSeconds ?? 0) + durationSeconds;
    context.dbOperationCount = (context.dbOperationCount ?? 0) + 1;
  }

  const durationMs = durationSeconds * 1000;
  if (durationMs >= env.DB_SLOW_OPERATION_MS) {
    dbSlowOperations.inc({ model, operation });
    logger.warn(
      {
        component: 'database',
        model,
        operation,
        durationMs: Math.round(durationMs * 100) / 100,
        thresholdMs: env.DB_SLOW_OPERATION_MS,
      },
      'slow database operation',
    );
  }
}

function prismaErrorCode(error: unknown): string {
  const code = errorCode(error);
  return code !== undefined && /^P\d{4}$/.test(code) ? code : 'unknown';
}

export type OAuthOutcome = 'success' | 'failure' | 'error';
export type OAuthReason =
  | 'completed'
  | 'google_declined'
  | 'invalid_callback'
  | 'sign_in_failed'
  | 'identity_unverified'
  | 'account_link_required'
  | 'account_suspended'
  | 'not_authorised'
  | 'internal';

export function recordOAuthAttempt(
  audience: 'DEALER' | 'ADMIN',
  outcome: OAuthOutcome,
  reason: OAuthReason,
): void {
  oauthAttempts.inc({ audience: audience.toLowerCase(), outcome, reason });
}

export function resetApplicationMetrics(): void {
  for (const metric of [
    httpRequests,
    httpRequestDuration,
    httpRequestExtrema,
    requestDbDuration,
    requestDbOperations,
    dbOperations,
    dbOperationDuration,
    dbErrors,
    dbSlowOperations,
    oauthAttempts,
  ]) {
    metric.reset();
  }
  serviceUp.set(1);
}
