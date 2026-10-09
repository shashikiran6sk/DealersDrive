import { once } from 'node:events';
import { registerHooks } from 'node:module';

import express from 'express';

if (process.env.PINO_PRODUCTION_REPRO === 'true') {
  const productionPino = import.meta.resolve('pino-production-repro');
  registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(specifier === 'pino' ? productionPino : specifier, context);
    },
  });
}

const { pino } = await import('pino');

const source = new URL('../../../../../src/', import.meta.url);
const root = process.env.LOGGER_SOURCE_ROOT ?? source.href;
const { logger, childLogger, LOGGER_OPTIONS } = await import(
  `${root}platform/telemetry/logger.${process.env.LOGGER_SOURCE_ROOT ? 'js' : 'ts'}`
);
const { requestContext, setContextValue } = await import(
  `${root}middleware/request-context.${process.env.LOGGER_SOURCE_ROOT ? 'js' : 'ts'}`
);
const { requestLogger } = await import(
  `${root}middleware/request-logger.${process.env.LOGGER_SOURCE_ROOT ? 'js' : 'ts'}`
);
const { requestMetrics } = await import(
  `${root}middleware/request-metrics.${process.env.LOGGER_SOURCE_ROOT ? 'js' : 'ts'}`
);
const { createMetricsRouter } = await import(
  `${root}platform/telemetry/metrics.routes.${process.env.LOGGER_SOURCE_ROOT ? 'js' : 'ts'}`
);

// This fixture imports application configuration; no Pino or HTTP mocks.
const stream = logger[pino.symbols.streamSym];
if (process.env.GRAFANA_CLOUD_LOGS_ENABLED === 'true' && !stream.ready) {
  await once(stream, 'ready');
}

const app = express();
app.use(requestContext, requestLogger, requestMetrics);
app.get('/dealers/:id', (_req, res) => {
  setContextValue('dbDurationSeconds', 0.012);
  setContextValue('dbOperationCount', 2);
  res.sendStatus(200);
});
app.get('/boom', (_req, res) => res.sendStatus(500));
app.use(createMetricsRouter(process.env.METRICS_SCRAPE_TOKEN));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');

function emit() {
  logger.trace('runtime trace');
  logger.debug('runtime debug');
  logger.info('runtime info');
  logger.warn('runtime warn');
  logger.error('runtime error');
  logger.fatal('runtime fatal');
  childLogger('jobs').info({ job: 'test' }, 'runtime worker');
  logger.info(
    {
      password: 'secret-password',
      passwordHash: 'secret-hash',
      otp: 'secret-otp',
      token: 'secret-session',
      email: 'secret-customer',
      meta: { token: 'secret-meta', password: 'secret-nested' },
      req: { headers: { authorization: 'secret-auth', cookie: 'secret-cookie' } },
      res: { headers: { 'set-cookie': 'secret-response-cookie' } },
      url: 'secret-kyc-signed-url',
      error: 'secret-db-credentials',
      err: Object.assign(new Error('secret-error-message'), { code: 'TEST_FAILURE' }),
    },
    'runtime redaction',
  );
}

async function stop() {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve, reject) =>
    logger.flush((error) => (error ? reject(error) : resolve())),
  );
  if (process.env.GRAFANA_CLOUD_LOGS_ENABLED === 'true') {
    const closed = once(stream, 'close');
    stream.end();
    await closed;
  }
  process.exit(0);
}

process.on('message', (message) => {
  if (message === 'emit') emit();
  if (message === 'fail') {
    stream.once('close', () => process.send?.('failed'));
    void stream.worker.terminate();
  }
  if (message === 'stop') void stop();
});
// Also usable in an isolated Docker container without IPC.
if (!process.send) {
  emit();
  process.stdout.write(`${JSON.stringify({ fixturePort: server.address().port })}\n`);
  process.on('SIGTERM', () => void stop());
} else {
  process.send({ port: server.address().port, level: LOGGER_OPTIONS.level });
}
