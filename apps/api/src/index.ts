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
      payments: env.PAYMENT_PROVIDER,
      storage: env.STORAGE_DRIVER,
      // `cache: container.cache.driver` returns with F028, which builds it.
      devDealer: env.DEV_DEALER_SLUG,
    },
    'dealers-drive api listening',
  );
});

/**
 * Keep-alive is what makes the drain below actually drain.
 *
 * `server.close()` stops accepting *new* connections but waits for existing
 * ones to end, and an idle keep-alive connection does not end on its own.
 * Node 19+ closes idle ones on `close()`, but a client that is between requests
 * on a busy connection can still hold the server open past the budget — so the
 * timeouts are set explicitly rather than left to the platform default.
 */
server.keepAliveTimeout = 61_000;
server.headersTimeout = 65_000;

let shuttingDown = false;

/**
 * Shutdown, in two phases (§20.10).
 *
 *   1. Fail readiness, keep serving. `/health/ready` answers 503 the instant
 *      the signal arrives, and we then do nothing for SHUTDOWN_DRAIN_MS. That
 *      pause is the load balancer's chance to notice and stop routing new
 *      requests here. Closing the listener first is what produces the
 *      connection resets that make a normal deploy look like an outage.
 *   2. Close, then release. Stop accepting connections, let the in-flight
 *      requests finish, then shut the queue, the outbox and the database pool.
 *
 * The whole thing is bounded by SHUTDOWN_TIMEOUT_MS. Exceeding it exits
 * non-zero rather than hanging a deployment for ECS's stopTimeout.
 */
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
    // Phase 1 — deliberately doing nothing, so the target group can react.
    // Zero outside production: nothing is load-balancing `pnpm dev`.
    if (env.SHUTDOWN_DRAIN_MS > 0) await delay(env.SHUTDOWN_DRAIN_MS);

    // Phase 2 — stop listening, then wait out the in-flight requests.
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
