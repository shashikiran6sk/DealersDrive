import type { Request, RequestHandler } from 'express';

import { env } from '../config/env.js';
import type { CachePort } from '../platform/cache/cache.port.js';
import { RateLimitError } from '../platform/errors.js';
import { logger } from '../platform/telemetry/logger.js';

/**
 * Fixed-window counters over a `CachePort` (§18).
 *
 * These are a spend control as much as a security control: a phone reveal is
 * the thing competitors want, and every SMS costs real money (§9.2). That is
 * why the counter had to stop living in process memory — behind N tasks a
 * `Map` permits N times the limit written next to it, and reports nothing.
 *
 * The port is passed in rather than imported. The limiter is built once in the
 * container, exactly like the auth guards, and handed to the routers that use
 * it — so a test can hand it a memory cache without touching a global (§5.3).
 */
export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
  /** What to count by. Defaults to the client IP. */
  keyBy?: (req: Request) => string;
  code?: string;
  message?: string;
}

/** What `container.rateLimit` is. Mirrors `container.guards`. */
export type RateLimiter = (name: string, options: RateLimitOptions) => RequestHandler;

export interface RateLimitDecision {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

/**
 * Consume one slot. Async because a shared counter is a network round trip —
 * shaping this synchronously is what tied the whole design to one process.
 */
export async function consumeRateLimit(
  cache: CachePort,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  const result = await cache.increment(key, windowSeconds);
  return {
    allowed: result.count <= limit,
    count: result.count,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

/** Reads the current count without consuming — used to decide "captcha after 3". */
export function peekRateLimit(cache: CachePort, key: string): Promise<number> {
  return cache.peek(key);
}

/**
 * Builds the middleware factory. One per process, constructed in the container.
 *
 * A cache failure does **not** deny the request. A limiter that cannot count is
 * a limiter with no opinion, and turning a database blip into a site-wide 429
 * converts a degraded dependency into an outage. The failure is logged by the
 * error path that surfaces it; the request proceeds.
 */
export function createRateLimiter(cache: CachePort): RateLimiter {
  return function rateLimit(name: string, options: RateLimitOptions): RequestHandler {
    return (req, _res, next) => {
      if (!env.RATE_LIMIT_ENABLED) {
        next();
        return;
      }

      void (async () => {
        const key = `${name}:${options.keyBy ? options.keyBy(req) : (req.ip ?? 'unknown')}`;

        let result: RateLimitDecision;
        try {
          result = await consumeRateLimit(cache, key, options.limit, options.windowSeconds);
        } catch (error) {
          logger.warn(
            { err: error, limiter: name },
            'rate limit backend unavailable — allowing the request',
          );
          next();
          return;
        }

        if (!result.allowed) {
          next(
            new RateLimitError(
              options.message ?? 'You have made too many requests. Try again shortly.',
              result.retryAfterSeconds,
              options.code === undefined ? undefined : { code: options.code },
            ),
          );
          return;
        }

        next();
      })();
    };
  };
}
