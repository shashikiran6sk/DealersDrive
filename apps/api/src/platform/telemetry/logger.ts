import { pino, type Logger, type LoggerOptions } from 'pino';

import { env } from '../../config/env.js';
import { getContext } from '../../middleware/request-context.js';

/**
 * Structured JSON logs, one line per event.
 *
 * The mixin is the important part: every log line emitted anywhere inside a
 * request — controller, service, repository, error handler — automatically
 * carries that request's traceId, plus userId/dealerId once auth has run. No
 * call site ever has to remember to pass it.
 *
 * The options are exported because pino fixes its destination at construction:
 * there is no way to ask the live `logger` what it would have written. A test
 * builds a second logger from *these* options and a capturing stream, so what it
 * asserts on is the real redaction list and the real mixin rather than a copy of
 * them that can drift.
 */
export const LOGGER_OPTIONS: LoggerOptions = {
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
};

export const logger: Logger = pino(LOGGER_OPTIONS);

/** Child logger for a subsystem: `const log = childLogger('jobs')`. */
export function childLogger(component: string): Logger {
  return logger.child({ component });
}
