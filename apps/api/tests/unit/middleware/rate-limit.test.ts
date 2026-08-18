import type { NextFunction, Request, Response } from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as errorsModule from '../../../src/platform/errors.js';
import type * as rateLimitModule from '../../../src/middleware/rate-limit.js';
import {
  consumeRateLimit,
  peekRateLimit,
  resetRateLimits,
} from '../../../src/middleware/rate-limit.js';

/**
 * Taken with `typeof` off a value import rather than written as
 * `typeof import(…)`: the two mean the same thing, and only this form is
 * allowed by the lint rule that keeps type imports explicit.
 */
type RateLimitModule = typeof rateLimitModule;
type ErrorsModule = typeof errorsModule;

/**
 * A phone reveal is the thing competitors want and the thing that costs real
 * money per SMS, so this is a spend control as much as a security one. Two
 * behaviours carry that weight: the Nth+1 request is refused, and the window
 * genuinely expires rather than locking someone out forever.
 *
 * The counter functions are pure and are tested against the static import. The
 * *middleware* reads `env.RATE_LIMIT_ENABLED`, which the test project pins to
 * `false` (40 integration tests from one IP would otherwise trip it), so those
 * describes load their own module graph with the switch in the position they
 * are about to assert on — and take `RateLimitError` from that same graph, or
 * `instanceof` would compare classes from two different registries.
 */

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
  resetRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetRateLimits();
});

describe('consumeRateLimit', () => {
  it('allows the first request and opens a window', () => {
    expect(consumeRateLimit('k', 3, 60)).toEqual({
      allowed: true,
      count: 1,
      retryAfterSeconds: 60,
    });
  });

  it('counts up to the limit inclusively', () => {
    consumeRateLimit('k', 3, 60);
    consumeRateLimit('k', 3, 60);

    expect(consumeRateLimit('k', 3, 60)).toMatchObject({ allowed: true, count: 3 });
  });

  it('refuses the request after the limit', () => {
    for (let i = 0; i < 3; i += 1) consumeRateLimit('k', 3, 60);

    expect(consumeRateLimit('k', 3, 60)).toMatchObject({ allowed: false, count: 4 });
  });

  it('keeps counting past the limit, so a hammering client stays refused', () => {
    for (let i = 0; i < 10; i += 1) consumeRateLimit('k', 3, 60);

    expect(consumeRateLimit('k', 3, 60)).toMatchObject({ allowed: false, count: 11 });
  });

  it('keeps separate keys separate', () => {
    for (let i = 0; i < 5; i += 1) consumeRateLimit('a', 3, 60);

    expect(consumeRateLimit('b', 3, 60)).toMatchObject({ allowed: true, count: 1 });
  });

  it('reports how long until the window opens again', () => {
    consumeRateLimit('k', 1, 60);
    vi.advanceTimersByTime(20_000);

    expect(consumeRateLimit('k', 1, 60).retryAfterSeconds).toBe(40);
  });

  it('never reports a retryAfter below one second', () => {
    consumeRateLimit('k', 1, 60);
    vi.advanceTimersByTime(59_900);

    expect(consumeRateLimit('k', 1, 60).retryAfterSeconds).toBe(1);
  });

  it('opens a fresh window once the old one expires', () => {
    for (let i = 0; i < 5; i += 1) consumeRateLimit('k', 3, 60);
    vi.advanceTimersByTime(60_001);

    expect(consumeRateLimit('k', 3, 60)).toEqual({
      allowed: true,
      count: 1,
      retryAfterSeconds: 60,
    });
  });

  it('treats a window whose reset moment has exactly arrived as expired', () => {
    consumeRateLimit('k', 1, 60);
    vi.advanceTimersByTime(60_000);

    expect(consumeRateLimit('k', 1, 60)).toMatchObject({ allowed: true, count: 1 });
  });

  it('is fixed-window, not sliding — the count resets wholesale', () => {
    for (let i = 0; i < 3; i += 1) consumeRateLimit('k', 3, 10);
    vi.advanceTimersByTime(10_001);
    for (let i = 0; i < 3; i += 1) consumeRateLimit('k', 3, 10);

    expect(consumeRateLimit('k', 3, 10).allowed).toBe(false);
  });
});

describe('peekRateLimit', () => {
  /** "Captcha after 3" needs the count without spending one of the three. */
  it('reads the count without consuming', () => {
    consumeRateLimit('k', 5, 60);
    consumeRateLimit('k', 5, 60);

    expect(peekRateLimit('k')).toBe(2);
    expect(peekRateLimit('k')).toBe(2);
    expect(consumeRateLimit('k', 5, 60).count).toBe(3);
  });

  it('is zero for a key never seen', () => {
    expect(peekRateLimit('never')).toBe(0);
  });

  it('is zero once the window has expired', () => {
    consumeRateLimit('k', 5, 30);
    vi.advanceTimersByTime(30_001);

    expect(peekRateLimit('k')).toBe(0);
  });

  it('is zero at the exact reset moment', () => {
    consumeRateLimit('k', 5, 30);
    vi.advanceTimersByTime(30_000);

    expect(peekRateLimit('k')).toBe(0);
  });
});

describe('resetRateLimits', () => {
  it('clears every bucket', () => {
    consumeRateLimit('a', 1, 60);
    consumeRateLimit('b', 1, 60);
    resetRateLimits();

    expect(peekRateLimit('a')).toBe(0);
    expect(peekRateLimit('b')).toBe(0);
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

  beforeEach(() => {
    limiter.resetRateLimits();
  });

  function call(
    handler: ReturnType<RateLimitModule['rateLimit']>,
    req: Partial<Request> = {},
  ): unknown {
    let passed: unknown = 'not-called';
    handler(
      { ip: '203.0.113.1', ...req } as Request,
      {} as Response,
      ((error?: unknown) => {
        passed = error;
      }) as NextFunction,
    );
    return passed;
  }

  it('calls next() with nothing while under the limit', () => {
    const handler = limiter.rateLimit('reveal', { limit: 2, windowSeconds: 60 });

    expect(call(handler)).toBeUndefined();
    expect(call(handler)).toBeUndefined();
  });

  it('passes a RateLimitError to next() once over', () => {
    const handler = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 60 });
    call(handler);

    const error = call(handler);

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as InstanceType<ErrorsModule['RateLimitError']>).status).toBe(429);
  });

  it('carries the retryAfter so the handler can set Retry-After', () => {
    const handler = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 90 });
    call(handler);
    vi.advanceTimersByTime(30_000);

    expect((call(handler) as InstanceType<ErrorsModule['RateLimitError']>).retryAfterSeconds).toBe(
      60,
    );
  });

  it('uses a default message a dealer can read', () => {
    const handler = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 60 });
    call(handler);

    expect((call(handler) as InstanceType<ErrorsModule['RateLimitError']>).detail).toBe(
      'You have made too many requests. Try again shortly.',
    );
  });

  it('lets a route supply its own message', () => {
    const handler = limiter.rateLimit('reveal', {
      limit: 1,
      windowSeconds: 60,
      message: 'Too many phone reveals. Try again in a minute.',
    });
    call(handler);

    expect((call(handler) as InstanceType<ErrorsModule['RateLimitError']>).detail).toBe(
      'Too many phone reveals. Try again in a minute.',
    );
  });

  it('lets a route supply its own code', () => {
    const handler = limiter.rateLimit('reveal', {
      limit: 1,
      windowSeconds: 60,
      code: 'REVEAL_RATE_LIMITED',
    });
    call(handler);

    expect((call(handler) as InstanceType<ErrorsModule['RateLimitError']>).code).toBe(
      'REVEAL_RATE_LIMITED',
    );
  });

  it('falls back to the generic code when none is given', () => {
    const handler = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 60 });
    call(handler);

    expect((call(handler) as InstanceType<ErrorsModule['RateLimitError']>).code).toBe(
      'RATE_LIMITED',
    );
  });

  /** Namespacing by limiter name is what stops one route eating another's budget. */
  it('keys by limiter name, so two limiters do not share a budget', () => {
    const reveal = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 60 });
    const enquiry = limiter.rateLimit('enquiry', { limit: 1, windowSeconds: 60 });
    call(reveal);

    expect(call(enquiry)).toBeUndefined();
  });

  it('keys by IP by default, so one client cannot exhaust another', () => {
    const handler = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 60 });
    call(handler, { ip: '203.0.113.1' });

    expect(call(handler, { ip: '198.51.100.2' })).toBeUndefined();
    expect(call(handler, { ip: '203.0.113.1' })).toBeInstanceOf(RateLimitError);
  });

  it("keys everything without an IP under 'unknown' together", () => {
    const handler = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 60 });
    call(handler, { ip: undefined });

    expect(call(handler, { ip: undefined })).toBeInstanceOf(RateLimitError);
  });

  it('honours a custom keyBy — e.g. per listing rather than per IP', () => {
    const handler = limiter.rateLimit('reveal', {
      limit: 1,
      windowSeconds: 60,
      keyBy: (req) => (req.params as Record<string, string>).listingId ?? 'none',
    });
    call(handler, { params: { listingId: 'l1' } } as Partial<Request>);

    expect(call(handler, { params: { listingId: 'l2' } } as Partial<Request>)).toBeUndefined();
    expect(call(handler, { params: { listingId: 'l1' } } as Partial<Request>)).toBeInstanceOf(
      RateLimitError,
    );
  });

  it('lets everything through once the window rolls over', () => {
    const handler = limiter.rateLimit('reveal', { limit: 1, windowSeconds: 60 });
    call(handler);
    expect(call(handler)).toBeInstanceOf(RateLimitError);

    vi.advanceTimersByTime(60_001);

    expect(call(handler)).toBeUndefined();
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
    const handler = module.rateLimit('reveal', { limit: 1, windowSeconds: 60 });

    for (let i = 0; i < 10; i += 1) {
      let passed: unknown = 'not-called';
      handler(
        { ip: '203.0.113.1' } as Request,
        {} as Response,
        ((error?: unknown) => {
          passed = error;
        }) as NextFunction,
      );
      expect(passed).toBeUndefined();
    }

    expect(module.peekRateLimit('reveal:203.0.113.1')).toBe(0);
    vi.resetModules();
  });
});
