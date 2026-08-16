import { pino, type Logger } from 'pino';

import { env } from '../../config/env.js';
import { getContext } from '../../middleware/request-context.js';

/**
 * Structured JSON logs, one line per event.
 *
 * The mixin is the important part: every log line emitted anywhere inside a
 * request — controller, service, repository, error handler — automatically
 * carries that request's traceId, plus userId/dealerId once auth has run. No
 * call site ever has to remember to pass it.
 */
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'dealers-drive-api',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.otp',
      'password',
      'passwordHash',
      'token',
      'otp',
    ],
    censor: '[redacted]',
  },
  mixin() {
    const context = getContext();
    if (!context) return {};

    return {
      traceId: context.traceId,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.dealerId ? { dealerId: context.dealerId } : {}),
    };
  },
});

/** Child logger for a subsystem: `const log = childLogger('jobs')`. */
export function childLogger(component: string): Logger {
  return logger.child({ component });
}
