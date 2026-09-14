import type { RequestHandler } from 'express';

import { getContext } from './request-context.js';
import { normalizedHttpRoute } from '../platform/telemetry/http-route.js';
import { recordHttpRequest } from '../platform/telemetry/metrics.js';

const EXCLUDED_PATHS = new Set(['/internal/metrics']);

export const requestMetrics: RequestHandler = (req, res, next) => {
  if (EXCLUDED_PATHS.has(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  const context = getContext();

  res.once('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    recordHttpRequest({
      method: req.method,
      route: normalizedHttpRoute(req),
      statusCode: res.statusCode,
      durationSeconds,
      dbDurationSeconds: context?.dbDurationSeconds ?? 0,
      dbOperationCount: context?.dbOperationCount ?? 0,
      traceId: context?.traceId,
    });
  });

  next();
};
