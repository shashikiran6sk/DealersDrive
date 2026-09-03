import type { RequestHandler } from 'express';

import { logger } from '../platform/telemetry/logger.js';

/** Health probes fire every few seconds; they log at debug so dev output stays readable. */
const QUIET_PATHS = ['/health/live', '/health/ready'];

/**
 * One line per completed request. traceId is attached by the logger mixin, so
 * this line and every line the handler emitted share the same id.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  // Captured now: Express rewrites req.url while routing into a mounted
  // router, and 'finish' can fire before it is restored.
  const path = req.path;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = QUIET_PATHS.includes(path) ? 'debug' : 'info';

    logger[level](
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      },
      'request completed',
    );
  });

  next();
};
