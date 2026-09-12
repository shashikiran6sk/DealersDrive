import process from 'node:process';

import { env } from './config/env.js';
import { buildContainer, closeContainer, startWorker } from './container.js';
import { logger } from './platform/telemetry/logger.js';

/**
 * The background process (**R40**). No port, no routes, no HTTP.
 *
 * ── Why it is a second process and not a second promise ─────────────────────
 * The API could send its own emails. `void mailer.send(…)` after the response
 * would even look asynchronous. It is not: the work still runs on the API's
 * event loop, still holds its memory, still competes with the next request, and
 * still dies with a SIGTERM halfway through — with nowhere to record that it
 * did. When Resend has a slow minute, every one of those becomes the API's slow
 * minute.
 *
 * Splitting them gives all four away at once. The API writes one outbox row
 * inside the transaction that caused it and answers; this process turns the row
 * into a job, the job into a message, and a failure into a retry. A deploy that
 * restarts either one loses nothing, because the durable state is a table.
 *
 * ── Same image, same container, different entrypoint ────────────────────────
 * `node dist/worker.js` rather than `node dist/index.js`. It builds the *same*
 * container — one composition root, one set of adapters, one place a driver is
 * chosen — and calls `startWorker`, which is the identical function the API
 * calls under `WORKER_INLINE=true`. Two processes that registered different
 * handlers would be a bug nobody notices until a dealer is not told something.
 *
 * ── How many of these to run ────────────────────────────────────────────────
 * One. pg-boss hands each job to one worker, so more would be safe — but the
 * scheduled jobs are the reason to be careful, and one is enough for the volume
 * of email a moderation queue produces. Scale the API instead: that is the
 * whole point of `WORKER_INLINE=false`.
 */
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

/**
 * Graceful shutdown, and what "graceful" costs here.
 *
 * A worker has no connections to drain and no load balancer to notify, so there
 * is no equivalent of the API's fail-readiness-then-wait dance. What it has is
 * **jobs in flight**, and the only thing that matters is finishing them:
 * `boss.stop({ graceful: true })` stops fetching new work and waits for the
 * handlers already running.
 *
 * Killing it mid-job would not lose an email — pg-boss returns an unfinished
 * job to the queue and a `PENDING` delivery row is retried — but it *would*
 * mean a message that was already handed to Resend gets a second attempt. The
 * `dedupeKey` claim and Resend's idempotency key both cover that. Waiting is
 * still better than relying on them.
 *
 * `SHUTDOWN_TIMEOUT_MS` bounds the whole thing, because a handler wedged on a
 * socket that will never answer must not hold a deployment open until ECS's
 * `stopTimeout` kills it with a less useful exit code.
 */
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
      // `closeContainer` stops the outbox timer, then pg-boss gracefully, then
      // the cache and the database pool — in that order, so nothing is asked to
      // finish a job after its connection has gone.
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

/**
 * A worker has no request to fail, so an unhandled rejection here is a bug that
 * would otherwise be invisible: the job that caused it has already been marked
 * complete or failed by pg-boss, and the process carries on in an unknown
 * state. Logged loudly, and — unlike the API — not fatal, because one bad job
 * must not stop every other email on the queue.
 */
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection in the worker');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception in the worker');
  shutdown('uncaughtException');
});
