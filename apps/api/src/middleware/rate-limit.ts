import type { Request, RequestHandler } from 'express';

import { env } from '../config/env.js';
import type { CachePort } from '../platform/cache/cache.port.js';
import { RateLimitError } from '../platform/errors.js';
import { logger } from '../platform/telemetry/logger.js';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyBy?: (req: Request) => string;
  code?: string;
  message?: string;
}

export type RateLimiter = (name: string, options: RateLimitOptions) => RequestHandler;

export interface RateLimitDecision {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

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

export function peekRateLimit(cache: CachePort, key: string): Promise<number> {
  return cache.peek(key);
}

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
