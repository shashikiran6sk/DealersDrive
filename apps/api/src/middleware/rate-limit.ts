import type { Request, RequestHandler } from 'express';

import { env } from '../config/env.js';
import { RateLimitError } from '../platform/errors.js';

/**
 * Fixed-window counters in process memory (ARCHITECTURE §18 — no Redis in this
 * phase; a `CachePort` swap is half a day when cross-instance limits are
 * needed).
 *
 * These are a spend control as much as a security control: a phone reveal is
 * the thing competitors want, and every SMS costs real money (§9.2).
 */
interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
  /** What to count by. Defaults to the client IP. */
  keyBy?: (req: Request) => string;
  code?: string;
  message?: string;
}

const buckets = new Map<string, Window>();

export function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): { allowed: boolean; count: number; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, count: 1, retryAfterSeconds: windowSeconds };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return { allowed: existing.count <= limit, count: existing.count, retryAfterSeconds };
}

/** Reads the current count without consuming — used to decide "captcha after 3". */
export function peekRateLimit(key: string): number {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= Date.now()) return 0;
  return existing.count;
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function rateLimit(name: string, options: RateLimitOptions): RequestHandler {
  return (req, _res, next) => {
    if (!env.RATE_LIMIT_ENABLED) {
      next();
      return;
    }

    const key = `${name}:${options.keyBy ? options.keyBy(req) : (req.ip ?? 'unknown')}`;
    const result = consumeRateLimit(key, options.limit, options.windowSeconds);

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
  };
}
