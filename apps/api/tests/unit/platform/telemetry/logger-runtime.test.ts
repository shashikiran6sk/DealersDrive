import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pino, transport } from 'pino-production-repro';
import pinoLoki from 'pino-loki';
import { afterEach, describe, expect, it } from 'vitest';

const processes: ChildProcess[] = [];
const servers: Server[] = [];
const directories: string[] = [];
const fixture = fileURLToPath(new URL('./fixtures/logger-runtime.mjs', import.meta.url));

afterEach(async () => {
  for (const child of processes.splice(0)) if (child.exitCode === null) child.kill('SIGKILL');
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function runtime(endpoint: string, enabled = true, level = 'info', productionPino = false) {
  // Empty cwd prevents dotenv from reading any developer/production .env.
  const cwd = await mkdtemp(join(tmpdir(), 'pino-runtime-'));
  directories.push(cwd);
  const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), fixture], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      APP_ENV: 'production',
      LOG_LEVEL: level,
      PINO_PRODUCTION_REPRO: String(productionPino),
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      WEB_ORIGIN: 'https://web.example.test',
      WEB_BASE_URL: 'https://web.example.test',
      API_BASE_URL: 'https://api.example.test',
      AUTH_MODE: 'cookie',
      MEDIA_BASE_URL: 'https://storage.example.test/media',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      SESSION_SECRET: 'test-only-session-secret-0123456789',
      STORAGE_DRIVER: 'r2',
      S3_ENDPOINT: 'https://storage.example.test',
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
      MAIL_DRIVER: 'resend',
      RESEND_API_KEY: 'test-resend',
      MAIL_FROM: 'support@example.test',
      PHONE_OTP_DRIVER: 'msg91',
      MSG91_AUTH_KEY: 'test-msg91',
      MSG91_WIDGET_ID: 'test-widget',
      MSG91_WIDGET_TOKEN: 'test-widget-token',
      CACHE_DRIVER: 'postgres',
      JOBS_ENABLED: 'false',
      WORKER_INLINE: 'false',
      METRICS_ENABLED: 'true',
      METRICS_SCRAPE_TOKEN: 'test-metrics-token-0123456789abcdef',
      GRAFANA_CLOUD_LOGS_ENABLED: String(enabled),
      GRAFANA_CLOUD_LOKI_URL: endpoint,
      GRAFANA_CLOUD_LOKI_USER: 'test-instance',
      GRAFANA_CLOUD_LOKI_TOKEN: 'test-only-loki-token',
    },
  });
  processes.push(child);
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const exit = once(child, 'exit');
  const [ready] = await Promise.race([
    once(child, 'message'),
    exit.then(() => {
      throw new Error(`fixture exited before ready: ${stderr}`);
    }),
  ]);
  const port = (ready as { port: number }).port;
  return {
    child,
    port,
    output: () => ({ stdout, stderr }),
    stop: async () => {
      child.send('stop');
      const [code] = await exit;
      expect(code, stderr).toBe(0);
      return {
        lines: stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
        stderr,
      };
    },
  };
}

async function receiver(status = 204, hang = false) {
  const requests: {
    path: string;
    auth: string | undefined;
    contentType: string | undefined;
    body: { streams: { stream: Record<string, unknown>; values: string[][] }[] };
  }[] = [];
  let notify: () => void = () => undefined;
  let disconnect: () => void = () => undefined;
  const pending: ServerResponse[] = [];
  const disconnected = new Promise<void>((resolve) => {
    disconnect = resolve;
  });
  const received = new Promise<void>((resolve) => {
    notify = resolve;
  });
  const server = createServer((req, res) => {
    res.on('close', disconnect);
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      requests.push({
        path: req.url!,
        auth: req.headers.authorization,
        contentType: req.headers['content-type'],
        body: JSON.parse(body),
      });
      notify();
      if (hang) pending.push(res);
      else
        res
          .writeHead(status)
          .end(status === 204 ? undefined : 'test-only-loki-token secret-response');
    });
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing HTTP address');
  return {
    requests,
    received,
    disconnected,
    release: () => {
      hang = false;
      for (const response of pending) if (!response.destroyed) response.writeHead(204).end();
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    endpoint: `http://127.0.0.1:${address.port}/loki/api/v1/push?test=1`,
  };
}

async function exerciseHttp(port: number) {
  for (const [path, status] of [
    ['/dealers/private-id?token=secret-query', 200],
    ['/missing/private-id', 404],
    ['/boom', 500],
  ] as const) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: {
        'x-trace-id': 'runtime-trace',
        authorization: 'secret-header',
        cookie: 'secret-cookie',
      },
    });
    expect(response.status).toBe(status);
    expect(response.headers.get('x-trace-id')).toBe('runtime-trace');
    await response.text();
  }
  const metrics = await fetch(`http://127.0.0.1:${port}/internal/metrics`, {
    headers: { authorization: 'Bearer test-metrics-token-0123456789abcdef' },
  });
  expect(metrics.status).toBe(200);
  expect(await metrics.text()).toContain('dealers_drive_http_requests_total');
}

describe('actual production logger and transport worker', () => {
  it('delivers both destinations with actual configuration under production Pino 10.3.1', async () => {
    const loki = await receiver();
    const process = await runtime(loki.endpoint, true, 'info', true);
    process.child.send('emit');
    const { lines } = await process.stop();
    expect(lines).toHaveLength(6);
    expect(lines.every((line) => typeof line.level === 'number')).toBe(true);
    expect(
      loki.requests.flatMap((request) =>
        request.body.streams.map((stream) => JSON.parse(stream.values[0]![1]!)),
      ),
    ).toEqual(lines);
  }, 20_000);

  it('reports terminal worker failure without exposing its error and keeps HTTP available', async () => {
    const loki = await receiver();
    const process = await runtime(loki.endpoint);
    const failed = once(process.child, 'message');
    process.child.send('fail');
    expect((await failed)[0]).toBe('failed');
    const response = await fetch(`http://127.0.0.1:${process.port}/dealers/test`);
    expect(response.status).toBe(200);
    await response.text();
    expect(process.output().stderr).toContain('Pino transport failed; check logging configuration');
    expect(process.output().stderr).not.toContain('secret-');
    expect(process.output().stderr).not.toContain('test-only-loki-token');
  }, 20_000);

  it('reproduces string-level loss in Pino multi-target routing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pino-reproduction-'));
    directories.push(directory);
    for (const broken of [true, false]) {
      const files = [
        join(directory, `${broken}-stdout.jsonl`),
        join(directory, `${broken}-second.jsonl`),
      ];
      const stream = transport({
        targets: files.map((destination) => ({ target: 'pino/file', options: { destination } })),
      });
      await once(stream, 'ready');
      const log = pino(
        { ...(broken ? { formatters: { level: (label: string) => ({ level: label }) } } : {}) },
        stream,
      );
      log.info('routing probe');
      const closed = once(stream, 'close');
      stream.end();
      await closed;
      for (const file of files) {
        const output = await readFile(file, 'utf8');
        if (broken) expect(output).toBe('');
        else expect(JSON.parse(output)).toMatchObject({ level: 30, msg: 'routing probe' });
      }
    }
  });

  it.each([false, true])(
    'delivers actual configuration with Loki enabled=%s',
    async (enabled) => {
      const loki = await receiver();
      const process = await runtime(loki.endpoint, enabled);
      process.child.send('emit');
      await exerciseHttp(process.port);
      const { lines, stderr } = await process.stop();
      expect(stderr).toBe('');
      expect(
        lines
          .filter((line) => /^runtime (info|warn|error|fatal)$/.test(line.msg))
          .map((line) => [line.msg, line.level]),
      ).toEqual(
        expect.arrayContaining([
          ['runtime info', 30],
          ['runtime warn', 40],
          ['runtime error', 50],
          ['runtime fatal', 60],
        ]),
      );
      expect(lines.find((line) => line.msg === 'runtime worker')).toMatchObject({
        component: 'jobs',
        level: 30,
      });
      for (const line of lines)
        expect(line).toMatchObject({
          time: expect.any(Number),
          service: 'dealers-drive-api',
          env: 'production',
          environment: 'production',
        });
      const requests = lines.filter(
        (line) => line.msg === 'request completed' && line.route !== '/internal/metrics',
      );
      expect(requests).toHaveLength(3);
      expect(requests.map((line) => line.route)).toEqual(['/dealers/:id', 'unmatched', '/boom']);
      expect(requests.map((line) => line.status_code)).toEqual([200, 404, 500]);
      for (const line of requests)
        expect(line).toMatchObject({
          method: 'GET',
          durationMs: expect.any(Number),
          dbMs: expect.any(Number),
          dbOps: expect.any(Number),
          traceId: 'runtime-trace',
        });
      expect(requests[0]).toMatchObject({ dbMs: 12, dbOps: 2 });
      expect(JSON.stringify(lines)).not.toContain('secret-');
      expect(JSON.stringify(lines)).not.toContain('private-id');
      if (!enabled) {
        expect(loki.requests).toHaveLength(0);
        return;
      }
      expect(loki.requests).toHaveLength(1); // transport close drains the pending batch
      const request = loki.requests[0]!;
      expect(request).toMatchObject({
        path: '/loki/api/v1/push?test=1',
        auth: `Basic ${Buffer.from('test-instance:test-only-loki-token').toString('base64')}`,
        contentType: 'application/json',
      });
      const records = request.body.streams.map((stream) => JSON.parse(stream.values[0]![1]!));
      expect(records).toEqual(lines);
      expect(request.body.streams.map((stream) => stream.stream.level)).toContain('warning');
      expect(request.body.streams.map((stream) => stream.stream.level)).toContain('error');
      for (const stream of request.body.streams) {
        expect(stream.stream).toMatchObject({
          service: 'dealers-drive-api',
          environment: 'production',
        });
        expect(stream.stream).not.toHaveProperty('traceId');
        expect(stream.stream).not.toHaveProperty('userId');
        expect(stream.values[0]).toHaveLength(2);
        expect(stream.values[0]![0]).toMatch(/^\d{19}$/);
      }
    },
    20_000,
  );

  it.each(['trace', 'warn'])(
    'honors LOG_LEVEL=%s in both destinations',
    async (level) => {
      const loki = await receiver();
      const process = await runtime(loki.endpoint, true, level);
      process.child.send('emit');
      const { lines } = await process.stop();
      expect(lines.map((line) => line.level)).toEqual(
        level === 'trace' ? [10, 20, 30, 40, 50, 60, 30, 30] : [40, 50, 60],
      );
      expect(
        loki.requests.flatMap((request) =>
          request.body.streams.map((stream) => JSON.parse(stream.values[0]![1]!)),
        ),
      ).toEqual(lines);
    },
    20_000,
  );

  it.each([401, 403, 429, 500])(
    'keeps stdout and HTTP available after Loki HTTP %s',
    async (status) => {
      const loki = await receiver(status);
      const process = await runtime(loki.endpoint);
      process.child.send('emit');
      await loki.received; // automatic five-second batch, not just close()
      await exerciseHttp(process.port);
      const { lines, stderr } = await process.stop();
      expect(lines.filter((line) => line.msg === 'request completed')).toHaveLength(4);
      expect(stderr).toBe(''); // untrusted response bodies never bypass redaction
      expect(loki.requests.length).toBeGreaterThanOrEqual(2);
    },
    25_000,
  );

  it.each(['connection refusal', 'DNS failure'])(
    'keeps stdout and HTTP available after network failure: %s',
    async (failure) => {
      const unused = await receiver();
      await unused.close();
      const endpoint =
        failure === 'connection refusal'
          ? unused.endpoint
          : 'http://nonexistent.invalid/loki/api/v1/push';
      const process = await runtime(endpoint);
      process.child.send('emit');
      await exerciseHttp(process.port);
      const { lines, stderr } = await process.stop();
      expect(lines.some((line) => line.msg === 'runtime info')).toBe(true);
      expect(lines.filter((line) => line.msg === 'request completed')).toHaveLength(4);
      expect(stderr).toBe('');
    },
    25_000,
  );

  it('does not block HTTP or stdout while a Loki batch times out', async () => {
    const loki = await receiver(204, true);
    const process = await runtime(loki.endpoint);
    process.child.send('emit');
    await loki.received;
    await exerciseHttp(process.port);
    await loki.disconnected; // actual production timeout aborts the first push
    loki.release(); // allow transport close to drain later records normally
    const { lines, stderr } = await process.stop();
    expect(lines.filter((line) => line.msg === 'request completed')).toHaveLength(4);
    expect(stderr).toBe('');
  }, 30_000);

  it('drops the oldest unsent logs when the real Loki buffer fills', async () => {
    const loki = await receiver();
    const endpoint = new URL(loki.endpoint);
    const stream = pinoLoki({
      host: endpoint.origin,
      endpoint: endpoint.pathname,
      batching: { interval: 3600, maxBufferSize: 3 },
      silenceErrors: true,
    });
    for (let index = 0; index < 6; index++)
      stream.write(`${JSON.stringify({ level: 30, time: Date.now(), index })}\n`);
    const closed = once(stream, 'close');
    stream.end();
    await closed;
    expect(
      loki.requests.flatMap((request) =>
        request.body.streams.map((entry) => JSON.parse(entry.values[0]![1]!).index),
      ),
    ).toEqual([3, 4, 5]);
  });
});
