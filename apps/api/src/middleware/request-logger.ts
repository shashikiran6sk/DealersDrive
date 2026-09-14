import type { RequestHandler } from 'express';

import { normalizedHttpRoute } from '../platform/telemetry/http-route.js';
import { logger } from '../platform/telemetry/logger.js';

const QUIET_PATHS = ['/health/live', '/health/ready'];

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const path = req.path;

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
      },
      'request completed',
    );
  });

  next();
};
