import { pino, transport, type Logger, type LoggerOptions } from 'pino';
import type { LokiOptions } from 'pino-loki';

import { env } from '../../config/env.js';
import { getContext } from '../../middleware/request-context.js';

/**
 * Structured JSON logs, one line per event.
 *
 * The mixin is the important part: every log line emitted anywhere inside a
 * request — controller, service, repository, error handler — automatically
 * carries that request's traceId. Principal IDs deliberately stay out of the
 * centralized stream; audit records, not application logs, hold actor identity.
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
    environment: env.APP_ENV,
  },
  // Epoch milliseconds are understood by CloudWatch and are the native input
  // pino-loki converts to Loki nanoseconds. Keeping an ISO string here would
  // make the Loki transport unable to build a valid timestamp.
  timestamp: pino.stdTimeFunctions.epochTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    /*
     * Provider/HTTP client errors sometimes embed request URLs or response
     * bodies in `message`. Those can contain OAuth codes or credentials, so a
     * centralized log gets the useful type, bounded code and call frames but
     * never the uncontrolled message text.
     */
    err(value: unknown) {
      const error = value as { name?: unknown; code?: unknown; stack?: unknown } | null;
      const code = typeof error?.code === 'string' ? error.code : undefined;
      const stack =
        typeof error?.stack === 'string' ? error.stack.split('\n').slice(1).join('\n') : undefined;
      return {
        type: typeof error?.name === 'string' ? error.name : 'Error',
        ...(code ? { code } : {}),
        ...(stack ? { stack } : {}),
      };
    },
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
      '*.email',
      '*.recipient',
      '*.subject',
      '*.userId',
      '*.dealerId',
      '*.dedupeKey',
      '*.url',
      '*.error',
      'password',
      'passwordHash',
      'token',
      'otp',
      'email',
      'recipient',
      'subject',
      'userId',
      'dealerId',
      'dedupeKey',
      'url',
      'error',
    ],
    censor: '[redacted]',
  },
  mixin() {
    const context = getContext();
    if (!context) return {};

    return {
      traceId: context.traceId,
    };
  },
};

function destination() {
  if (!env.GRAFANA_CLOUD_LOGS_ENABLED) return undefined;

  // Cross-field validation guarantees all three values when the transport is enabled.
  const endpoint = new URL(env.GRAFANA_CLOUD_LOKI_URL!);
  return transport({
    targets: [
      // Keep the platform-native stdout copy as a fallback and for ECS diagnostics.
      { target: 'pino/file', options: { destination: 1 } },
      {
        target: 'pino-loki',
        options: {
          host: endpoint.origin,
          endpoint: `${endpoint.pathname}${endpoint.search}`,
          basicAuth: {
            username: env.GRAFANA_CLOUD_LOKI_USER!,
            password: env.GRAFANA_CLOUD_LOKI_TOKEN!,
          },
          labels: {
            service: 'dealers-drive-api',
            environment: env.APP_ENV,
          },
          // These values are bounded. traceId stays in the JSON body and never
          // becomes a high-cardinality Loki stream label; principal IDs are
          // censored before either destination receives the record.
          propsToLabels: ['method', 'route', 'status_code'],
          // LOGGER_OPTIONS intentionally renders levels as readable strings;
          // pino-loki's defaults expect Pino's numeric levels.
          levelMap: {
            trace: 'debug',
            debug: 'debug',
            info: 'info',
            warn: 'warning',
            error: 'error',
            fatal: 'critical',
          } as unknown as LokiOptions['levelMap'],
          batching: { interval: 5, maxBufferSize: 10_000 },
          timeout: 10_000,
          silenceErrors: false,
          structuredMetaKey: false,
        } satisfies LokiOptions,
      },
    ],
  });
}

const logDestination = destination();
export const logger: Logger = logDestination
  ? pino(LOGGER_OPTIONS, logDestination)
  : pino(LOGGER_OPTIONS);

/** Child logger for a subsystem: `const log = childLogger('jobs')`. */
export function childLogger(component: string): Logger {
  return logger.child({ component });
}
