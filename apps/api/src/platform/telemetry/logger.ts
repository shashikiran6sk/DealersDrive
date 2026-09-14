import { pino, transport, type Logger, type LoggerOptions } from 'pino';
import type { LokiOptions } from 'pino-loki';

import { env } from '../../config/env.js';
import { getContext } from '../../middleware/request-context.js';
import { isRecord } from '../errors.js';

export const LOGGER_OPTIONS: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: 'dealers-drive-api',
    env: env.NODE_ENV,
    environment: env.APP_ENV,
  },
  timestamp: pino.stdTimeFunctions.epochTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err(value: unknown) {
      const error = isRecord(value) ? value : null;
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

  const endpoint = new URL(env.GRAFANA_CLOUD_LOKI_URL!);
  return transport({
    targets: [
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
          propsToLabels: ['method', 'route', 'status_code'],
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pino-loki types levelMap more narrowly than it accepts
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

export function childLogger(component: string): Logger {
  return logger.child({ component });
}
