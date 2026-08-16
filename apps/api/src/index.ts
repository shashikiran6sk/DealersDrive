import process from 'node:process';

import { env } from './config/env.js';
import { buildContainer, closeContainer } from './container.js';
import { logger } from './platform/telemetry/logger.js';
import { createApp } from './server.js';

/** How long a shutdown may take before the process is killed anyway. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const container = buildContainer();
const app = createApp(container);

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    { port: env.PORT, host: env.HOST, nodeEnv: env.NODE_ENV },
    'dealers-drive api listening',
  );
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutting down');

  const forceExit = setTimeout(() => {
    logger.error('shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close((closeError) => {
    void (async () => {
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
  });
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
