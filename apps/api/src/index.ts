import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { env } from './config/env.js';
import { buildContainer, closeContainer, startBackground } from './container.js';
import { beginDraining } from './platform/telemetry/lifecycle.js';
import { logger } from './platform/telemetry/logger.js';
import { createApp } from './server.js';

const container = await buildContainer();
await startBackground(container);

const app = createApp(container);

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      port: env.PORT,
      host: env.HOST,
      nodeEnv: env.NODE_ENV,
      appEnv: env.APP_ENV,
      storage: env.STORAGE_DRIVER,
      devDealer: env.DEV_DEALER_SLUG,
    },
    'dealers-drive api listening',
  );
});

server.keepAliveTimeout = 61_000;
server.headersTimeout = 65_000;

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  beginDraining();
  logger.info(
    { signal, drainMs: env.SHUTDOWN_DRAIN_MS, timeoutMs: env.SHUTDOWN_TIMEOUT_MS },
    'draining — readiness is now failing, still serving in-flight requests',
  );

  const forceExit = setTimeout(() => {
    logger.error('shutdown timed out, forcing exit');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  void (async () => {
    if (env.SHUTDOWN_DRAIN_MS > 0) await delay(env.SHUTDOWN_DRAIN_MS);

    const closeError = await new Promise<Error | undefined>((resolve) => {
      server.close((error) => {
        resolve(error ?? undefined);
      });
    });

    if (closeError) {
      logger.error({ err: closeError }, 'error closing http server');
    }

    try {
      await closeContainer(container);
    } catch (error) {
      logger.error({ err: error }, 'error closing container');
    }

    logger.info('shutdown complete');
    process.exit(closeError ? 1 : 0);
  })();
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  shutdown('uncaughtException');
});
