import type { RequestHandler } from 'express';

import { getContext } from './request-context.js';
import { normalizedHttpRoute } from '../platform/telemetry/http-route.js';
import { logger } from '../platform/telemetry/logger.js';

const QUIET_PATHS = ['/health/live', '/health/ready'];

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const path = req.path;
  const context = getContext();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = QUIET_PATHS.includes(path) ? 'debug' : 'info';

    logger[level](
      {
        method: req.method,
        route: normalizedHttpRoute(req),
        status: res.statusCode,
        status_code: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        dbMs: Math.round((context?.dbDurationSeconds ?? 0) * 100_000) / 100,
        dbOps: context?.dbOperationCount ?? 0,
      },
      'request completed',
    );
  });

  next();
};
