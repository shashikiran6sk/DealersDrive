import process from 'node:process';

import { env } from './config/env.js';
import { buildContainer, closeContainer, startWorker } from './container.js';
import { logger } from './platform/telemetry/logger.js';

if (!env.JOBS_ENABLED) {
  logger.error('JOBS_ENABLED=false — the worker has nothing to do. Exiting.');
  process.exit(1);
}

const container = await buildContainer();
await container.queue.start();
await startWorker(container);

logger.info(
  {
    nodeEnv: env.NODE_ENV,
    appEnv: env.APP_ENV,
    mail: container.mailer.driver,
  },
  'dealers-drive worker started',
);

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal, timeoutMs: env.SHUTDOWN_TIMEOUT_MS }, 'worker draining');

  const forceExit = setTimeout(() => {
    logger.error('worker shutdown timed out, forcing exit');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  void (async () => {
    try {
      await closeContainer(container);
    } catch (error) {
      logger.error({ err: error }, 'error closing the worker container');
      process.exit(1);
    }

    logger.info('worker shutdown complete');
    process.exit(0);
  })();
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection in the worker');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception in the worker');
  shutdown('uncaughtException');
});
