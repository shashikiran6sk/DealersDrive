import type { NextFunction, Request, Response } from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as errorsModule from '../../../src/platform/errors.js';
import type * as rateLimitModule from '../../../src/middleware/rate-limit.js';
import { consumeRateLimit, peekRateLimit } from '../../../src/middleware/rate-limit.js';
import type { CachePort } from '../../../src/platform/cache/cache.port.js';
import { createMemoryCache } from '../../../src/platform/cache/memory.adapter.js';

/**
 * Taken with `typeof` off a value import rather than written as
 * `typeof import(…)`: the two mean the same thing, and only this form is
 * allowed by the lint rule that keeps type imports explicit.
 */
type RateLimitModule = typeof rateLimitModule;
type ErrorsModule = typeof errorsModule;

/**
 * A phone reveal is the thing competitors want and the thing that costs real
 * money per SMS, so this is a spend control as much as a security one. Three
 * behaviours carry that weight: the Nth+1 request is refused, the window
 * genuinely expires rather than locking someone out forever, and a counter
 * backend that is down does not take the site with it.
 *
 * The counter functions take a `CachePort` and are tested against a memory
 * cache. The *middleware* reads `env.RATE_LIMIT_ENABLED`, which the test project
 * pins to `false` (40 integration tests from one IP would otherwise trip it), so
 * those describes load their own module graph with the switch in the position
 * they are about to assert on — and take `RateLimitError` from that same graph,
 * or `instanceof` would compare classes from two different registries.
 */

let cache: CachePort;

async function loadWith(enabled: 'true' | 'false'): Promise<{
  module: RateLimitModule;
  RateLimitError: ErrorsModule['RateLimitError'];
}> {
  vi.stubEnv('RATE_LIMIT_ENABLED', enabled);
  vi.resetModules();
  const module = await import('../../../src/middleware/rate-limit.js');
  const { RateLimitError } = await import('../../../src/platform/errors.js');
  vi.unstubAllEnvs();
  return { module, RateLimitError };
}

beforeEach(() => {
  cache = createMemoryCache();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('consumeRateLimit', () => {
  it('allows the first request and opens a window', async () => {
    await expect(consumeRateLimit(cache, 'k', 3, 60)).resolves.toEqual({
      allowed: true,
      count: 1,
      retryAfterSeconds: 60,
    });
  });

  it('counts up to the limit inclusively', async () => {
    await consumeRateLimit(cache, 'k', 3, 60);
    await consumeRateLimit(cache, 'k', 3, 60);

    await expect(consumeRateLimit(cache, 'k', 3, 60)).resolves.toMatchObject({
      allowed: true,
      count: 3,
    });
  });

  it('refuses the request after the limit', async () => {
    for (let i = 0; i < 3; i += 1) await consumeRateLimit(cache, 'k', 3, 60);

    await expect(consumeRateLimit(cache, 'k', 3, 60)).resolves.toMatchObject({
      allowed: false,
      count: 4,
    });
  });

  it('keeps counting past the limit, so a hammering client stays refused', async () => {
    for (let i = 0; i < 10; i += 1) await consumeRateLimit(cache, 'k', 3, 60);

    await expect(consumeRateLimit(cache, 'k', 3, 60)).resolves.toMatchObject({
      allowed: false,
      count: 11,
    });
  });

  it('keeps separate keys separate', async () => {
    for (let i = 0; i < 5; i += 1) await consumeRateLimit(cache, 'a', 3, 60);

    await expect(consumeRateLimit(cache, 'b', 3, 60)).resolves.toMatchObject({
      allowed: true,
      count: 1,
    });
  });

  it('reports how long until the window opens again', async () => {
    await consumeRateLimit(cache, 'k', 1, 60);
    vi.advanceTimersByTime(20_000);

    const result = await consumeRateLimit(cache, 'k', 1, 60);
    expect(result.retryAfterSeconds).toBe(40);
  });

  it('never reports a retryAfter below one second', async () => {
    await consumeRateLimit(cache, 'k', 1, 60);
    vi.advanceTimersByTime(59_900);

    const result = await consumeRateLimit(cache, 'k', 1, 60);
    expect(result.retryAfterSeconds).toBe(1);
  });

  it('opens a fresh window once the old one expires', async () => {
    for (let i = 0; i < 5; i += 1) await consumeRateLimit(cache, 'k', 3, 60);
    vi.advanceTimersByTime(60_001);

    await expect(consumeRateLimit(cache, 'k', 3, 60)).resolves.toEqual({
      allowed: true,
      count: 1,
      retryAfterSeconds: 60,
    });
  });

  it('treats a window whose reset moment has exactly arrived as expired', async () => {
    await consumeRateLimit(cache, 'k', 1, 60);
    vi.advanceTimersByTime(60_000);

    await expect(consumeRateLimit(cache, 'k', 1, 60)).resolves.toMatchObject({
      allowed: true,
      count: 1,
    });
  });

  it('is fixed-window, not sliding — the count resets wholesale', async () => {
    for (let i = 0; i < 3; i += 1) await consumeRateLimit(cache, 'k', 3, 10);
    vi.advanceTimersByTime(10_001);
    for (let i = 0; i < 3; i += 1) await consumeRateLimit(cache, 'k', 3, 10);

    const result = await consumeRateLimit(cache, 'k', 3, 10);
    expect(result.allowed).toBe(false);
  });
});

describe('peekRateLimit', () => {
  /** "Captcha after 3" needs the count without spending one of the three. */
  it('reads the count without consuming', async () => {
    await consumeRateLimit(cache, 'k', 5, 60);
    await consumeRateLimit(cache, 'k', 5, 60);

    await expect(peekRateLimit(cache, 'k')).resolves.toBe(2);
    await expect(peekRateLimit(cache, 'k')).resolves.toBe(2);
    const result = await consumeRateLimit(cache, 'k', 5, 60);
    expect(result.count).toBe(3);
  });

  it('is zero for a key never seen', async () => {
    await expect(peekRateLimit(cache, 'never')).resolves.toBe(0);
  });

  it('is zero once the window has expired', async () => {
    await consumeRateLimit(cache, 'k', 5, 30);
    vi.advanceTimersByTime(30_001);

    await expect(peekRateLimit(cache, 'k')).resolves.toBe(0);
  });

  it('is zero at the exact reset moment', async () => {
    await consumeRateLimit(cache, 'k', 5, 30);
    vi.advanceTimersByTime(30_000);

    await expect(peekRateLimit(cache, 'k')).resolves.toBe(0);
  });
});

describe('cache.reset', () => {
  it('clears every bucket', async () => {
    await consumeRateLimit(cache, 'a', 1, 60);
    await consumeRateLimit(cache, 'b', 1, 60);
    await cache.reset();

    await expect(peekRateLimit(cache, 'a')).resolves.toBe(0);
    await expect(peekRateLimit(cache, 'b')).resolves.toBe(0);
  });
});

describe('the middleware', () => {
  let limiter: RateLimitModule;
  let RateLimitError: ErrorsModule['RateLimitError'];

  beforeAll(async () => {
    const loaded = await loadWith('true');
    limiter = loaded.module;
    RateLimitError = loaded.RateLimitError;
  });

  afterAll(() => {
    vi.resetModules();
  });

  /**
   * The handler consults a shared counter, so `next` is reached on a microtask
   * rather than synchronously. Awaiting the returned promise is what makes the
   * assertion see the verdict instead of the initial 'not-called'.
   */
  async function call(
    handler: ReturnType<ReturnType<RateLimitModule['createRateLimiter']>>,
    req: Partial<Request> = {},
  ): Promise<unknown> {
    return new Promise((resolve) => {
      handler(
        { ip: '203.0.113.1', ...req } as Request,
        {} as Response,
        ((error?: unknown) => {
          resolve(error);
        }) as NextFunction,
      );
    });
  }

  function build(name: string, options: rateLimitModule.RateLimitOptions) {
    return limiter.createRateLimiter(cache)(name, options);
  }

  it('calls next() with nothing while under the limit', async () => {
    const handler = build('reveal', { limit: 2, windowSeconds: 60 });

    await expect(call(handler)).resolves.toBeUndefined();
    await expect(call(handler)).resolves.toBeUndefined();
  });

  it('passes a RateLimitError to next() once over', async () => {
    const handler = build('reveal', { limit: 1, windowSeconds: 60 });
    await call(handler);

    const error = await call(handler);

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as InstanceType<ErrorsModule['RateLimitError']>).status).toBe(429);
  });

  it('carries the retryAfter so the handler can set Retry-After', async () => {
    const handler = build('reveal', { limit: 1, windowSeconds: 90 });
    await call(handler);
    vi.advanceTimersByTime(30_000);

    const error = (await call(handler)) as InstanceType<ErrorsModule['RateLimitError']>;
    expect(error.retryAfterSeconds).toBe(60);
  });

  it('uses a default message a dealer can read', async () => {
    const handler = build('reveal', { limit: 1, windowSeconds: 60 });
    await call(handler);

    const error = (await call(handler)) as InstanceType<ErrorsModule['RateLimitError']>;
    expect(error.detail).toBe('You have made too many requests. Try again shortly.');
  });

  it('lets a route supply its own message', async () => {
    const handler = build('reveal', {
      limit: 1,
      windowSeconds: 60,
      message: 'Too many phone reveals. Try again in a minute.',
    });
    await call(handler);

    const error = (await call(handler)) as InstanceType<ErrorsModule['RateLimitError']>;
    expect(error.detail).toBe('Too many phone reveals. Try again in a minute.');
  });

  it('lets a route supply its own code', async () => {
    const handler = build('reveal', {
      limit: 1,
      windowSeconds: 60,
      code: 'REVEAL_RATE_LIMITED',
    });
    await call(handler);

    const error = (await call(handler)) as InstanceType<ErrorsModule['RateLimitError']>;
    expect(error.code).toBe('REVEAL_RATE_LIMITED');
  });

  it('falls back to the generic code when none is given', async () => {
    const handler = build('reveal', { limit: 1, windowSeconds: 60 });
    await call(handler);

    const error = (await call(handler)) as InstanceType<ErrorsModule['RateLimitError']>;
    expect(error.code).toBe('RATE_LIMITED');
  });

  /** Namespacing by limiter name is what stops one route eating another's budget. */
  it('keys by limiter name, so two limiters do not share a budget', async () => {
    const reveal = build('reveal', { limit: 1, windowSeconds: 60 });
    const enquiry = build('enquiry', { limit: 1, windowSeconds: 60 });
    await call(reveal);

    await expect(call(enquiry)).resolves.toBeUndefined();
  });

  it('keys by IP by default, so one client cannot exhaust another', async () => {
    const handler = build('reveal', { limit: 1, windowSeconds: 60 });
    await call(handler, { ip: '203.0.113.1' });

    await expect(call(handler, { ip: '198.51.100.2' })).resolves.toBeUndefined();
    await expect(call(handler, { ip: '203.0.113.1' })).resolves.toBeInstanceOf(RateLimitError);
  });

  it("keys everything without an IP under 'unknown' together", async () => {
    const handler = build('reveal', { limit: 1, windowSeconds: 60 });
    await call(handler, { ip: undefined });

    await expect(call(handler, { ip: undefined })).resolves.toBeInstanceOf(RateLimitError);
  });

  it('honours a custom keyBy — e.g. per listing rather than per IP', async () => {
    const handler = build('reveal', {
      limit: 1,
      windowSeconds: 60,
      keyBy: (req) => (req.params as Record<string, string>).listingId ?? 'none',
    });
    await call(handler, { params: { listingId: 'l1' } } as Partial<Request>);

    await expect(
      call(handler, { params: { listingId: 'l2' } } as Partial<Request>),
    ).resolves.toBeUndefined();
    await expect(
      call(handler, { params: { listingId: 'l1' } } as Partial<Request>),
    ).resolves.toBeInstanceOf(RateLimitError);
  });

  it('lets everything through once the window rolls over', async () => {
    const handler = build('reveal', { limit: 1, windowSeconds: 60 });
    await call(handler);
    await expect(call(handler)).resolves.toBeInstanceOf(RateLimitError);

    vi.advanceTimersByTime(60_001);

    await expect(call(handler)).resolves.toBeUndefined();
  });

  /**
   * The counter now lives in another process. A limiter that cannot count is a
   * limiter with no opinion — turning a database blip into a site-wide 429 would
   * convert a degraded dependency into an outage, so it fails open.
   */
  it('allows the request when the counter backend is down', async () => {
    const broken: CachePort = {
      ...createMemoryCache(),
      increment: () => Promise.reject(new Error('connection refused')),
    };
    const handler = limiter.createRateLimiter(broken)('reveal', {
      limit: 1,
      windowSeconds: 60,
    });

    await expect(call(handler)).resolves.toBeUndefined();
    await expect(call(handler)).resolves.toBeUndefined();
  });
});

describe('RATE_LIMIT_ENABLED=false', () => {
  /**
   * The integration suite turns the limiter off — 40 tests hitting the same
   * endpoint from one IP would otherwise trip it. The switch must skip the
   * counter entirely, not merely ignore the verdict, or a later enabled test
   * would inherit a full bucket.
   */
  it('passes everything through and consumes nothing', async () => {
    const { module } = await loadWith('false');
    const handler = module.createRateLimiter(cache)('reveal', { limit: 1, windowSeconds: 60 });

    for (let i = 0; i < 10; i += 1) {
      const passed = await new Promise<unknown>((resolve) => {
        handler(
          { ip: '203.0.113.1' } as Request,
          {} as Response,
          ((error?: unknown) => {
            resolve(error);
          }) as NextFunction,
        );
      });
      expect(passed).toBeUndefined();
    }

    await expect(module.peekRateLimit(cache, 'reveal:203.0.113.1')).resolves.toBe(0);
    vi.resetModules();
  });
});
