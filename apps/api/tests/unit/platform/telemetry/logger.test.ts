import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { runWithContext } from '../../../../src/middleware/request-context.js';
import { LOGGER_OPTIONS, childLogger, logger } from '../../../../src/platform/telemetry/logger.js';

/**
 * Unit tests for `src/platform/telemetry/logger.ts`.
 *
 * Two properties matter and neither is visible from a call site:
 *
 *   1. **Every line carries the traceId** through pino's mixin, so no call site
 *      has to remember to pass it. A support ticket quoting a traceId is only
 *      worth having if the id is on the line that recorded the failure.
 *   2. **Secrets are redacted** wherever they appear in the object.
 *
 * pino fixes its destination at construction, so the live `logger` cannot be
 * asked what it would have written. These tests build a logger from the exported
 * `LOGGER_OPTIONS` — the real base, mixin and redaction list — and point it at a
 * capturing stream.
 */
/**
 * A logger built from the real `LOGGER_OPTIONS` but writing into an array, so
 * the redaction and mixin config under test is the config the server runs —
 * only the destination differs. The return type is inferred: `pino()` with a
 * custom stream is parameterised differently from `pino()` without one.
 */
function probe() {
  const lines: Record<string, unknown>[] = [];
  const log = pino(
    { ...LOGGER_OPTIONS, level: 'trace' },
    { write: (chunk: string) => void lines.push(JSON.parse(chunk) as Record<string, unknown>) },
  );

  return { lines, log };
}

describe('the shared logger', () => {
  it('is silent under test, so the suite output stays readable', () => {
    expect(logger.level).toBe('silent');
  });

  it('exposes every level as a function', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) {
      expect(typeof logger[level], `logger.${level}`).toBe('function');
      expect(() => logger[level]({ probe: true }, 'unit test')).not.toThrow();
    }
  });

  it('stamps the service and environment on every line', () => {
    const { lines, log } = probe();

    log.info('hello');

    expect(lines[0]).toMatchObject({ service: 'dealers-drive-api', env: 'test' });
  });

  it('writes the level as a label rather than as pino’s numeric code', () => {
    const { lines, log } = probe();

    log.warn('careful');

    // `level: 30` means nothing in a log search; `level: "warn"` does.
    expect(lines[0]?.level).toBe('warn');
  });

  it('timestamps in ISO 8601', () => {
    const { lines, log } = probe();

    log.info('when');

    expect(String(lines[0]?.time)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });
});

describe('the request-context mixin', () => {
  it('adds the traceId to a line logged inside a request', () => {
    const { lines, log } = probe();

    runWithContext({ traceId: 'trace-abc', ip: '127.0.0.1' }, () => log.info('inside'));

    expect(lines[0]).toMatchObject({ traceId: 'trace-abc' });
  });

  it('adds userId and dealerId once auth has run', () => {
    const { lines, log } = probe();

    runWithContext(
      { traceId: 'trace-1', ip: '1.1.1.1', userId: 'user-1', dealerId: 'dealer-1' },
      () => log.info('after auth'),
    );

    expect(lines[0]).toMatchObject({
      traceId: 'trace-1',
      userId: 'user-1',
      dealerId: 'dealer-1',
    });
  });

  it('omits userId and dealerId on a public read', () => {
    const { lines, log } = probe();

    runWithContext({ traceId: 'trace-2', ip: '1.1.1.1' }, () => log.info('public'));

    // Omitted rather than null: `userId: null` on a public search line reads as
    // a failed lookup instead of "nobody is signed in".
    expect(lines[0]).not.toHaveProperty('userId');
    expect(lines[0]).not.toHaveProperty('dealerId');
  });

  it('still writes a line outside any request', () => {
    const { lines, log } = probe();

    log.info('boot');

    // Boot logs and job handlers go through the same logger; a mixin that threw
    // without a context would silence exactly the lines nobody is watching.
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toHaveProperty('traceId');
  });

  it('re-reads the context per line rather than capturing it once', () => {
    const { lines, log } = probe();

    runWithContext({ traceId: 'first', ip: '1.1.1.1' }, () => log.info('a'));
    runWithContext({ traceId: 'second', ip: '1.1.1.1' }, () => log.info('b'));

    expect(lines.map((line) => line.traceId)).toEqual(['first', 'second']);
  });

  it('follows the context across an await', async () => {
    const { lines, log } = probe();

    await runWithContext({ traceId: 'async-trace', ip: '1.1.1.1' }, async () => {
      await Promise.resolve();
      log.info('after await');
    });

    // AsyncLocalStorage is the whole reason no call site threads a traceId
    // through; if it did not survive an await, every service would have to.
    expect(lines[0]).toMatchObject({ traceId: 'async-trace' });
  });
});

describe('redaction', () => {
  it('censors credentials at the top level', () => {
    const { lines, log } = probe();

    log.info({ password: 'hunter2', token: 'eyJhb', otp: '123456' }, 'login attempt');

    expect(lines[0]).toMatchObject({
      password: '[redacted]',
      token: '[redacted]',
      otp: '[redacted]',
    });
  });

  it('censors credentials nested one level down', () => {
    const { lines, log } = probe();

    log.info({ session: { token: 'eyJhb' }, user: { passwordHash: '$2b$12$…' } }, 'session');

    expect(lines[0]).toMatchObject({
      session: { token: '[redacted]' },
      user: { passwordHash: '[redacted]' },
    });
  });

  it('censors the request headers that carry a session', () => {
    const { lines, log } = probe();

    log.info(
      { req: { headers: { authorization: 'Bearer abc', cookie: 'sid=abc', accept: '*/*' } } },
      'request',
    );

    const headers = (lines[0]?.req as { headers: Record<string, unknown> }).headers;
    expect(headers.authorization).toBe('[redacted]');
    expect(headers.cookie).toBe('[redacted]');
    // Everything else survives, or the logs stop being useful.
    expect(headers.accept).toBe('*/*');
  });

  it('censors set-cookie on the way out', () => {
    const { lines, log } = probe();

    log.info({ res: { headers: { 'set-cookie': 'sid=abc; HttpOnly' } } }, 'response');

    const headers = (lines[0]?.res as { headers: Record<string, unknown> }).headers;
    expect(headers['set-cookie']).toBe('[redacted]');
  });

  it('leaves ordinary fields alone', () => {
    const { lines, log } = probe();

    log.info({ dealerId: 'dealer-1', pricePaise: 64_500_00 }, 'listing published');

    expect(lines[0]).toMatchObject({ dealerId: 'dealer-1', pricePaise: 6_450_000 });
  });
});

describe('childLogger', () => {
  it('tags every line with the component name', () => {
    expect(childLogger('jobs').bindings()).toMatchObject({ component: 'jobs' });
  });

  it('inherits the parent’s level and base fields', () => {
    const jobs = childLogger('jobs');

    expect(jobs.level).toBe(logger.level);
    expect(jobs.bindings()).toMatchObject({ service: 'dealers-drive-api' });
  });

  it('produces independent children', () => {
    expect(childLogger('jobs').bindings()).not.toEqual(childLogger('media').bindings());
  });

  it('keeps the mixin, so a job line still carries its traceId', () => {
    const lines: Record<string, unknown>[] = [];
    const parent = pino(
      { ...LOGGER_OPTIONS, level: 'trace' },
      { write: (chunk: string) => void lines.push(JSON.parse(chunk) as Record<string, unknown>) },
    );

    runWithContext({ traceId: 'job-trace', ip: '::1' }, () =>
      parent.child({ component: 'jobs' }).info('indexing'),
    );

    expect(lines[0]).toMatchObject({ component: 'jobs', traceId: 'job-trace' });
  });
});
