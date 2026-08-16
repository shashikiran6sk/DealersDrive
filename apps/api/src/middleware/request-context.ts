import { AsyncLocalStorage } from 'node:async_hooks';

import type { RequestHandler } from 'express';
import { nanoid } from 'nanoid';

/**
 * Everything that is true of "the request currently being handled", available
 * anywhere in the call stack without threading a parameter through every
 * function signature.
 *
 *   import { getContext } from '../middleware/request-context.js';
 *   const ctx = getContext();
 */
export interface RequestContext {
  /** nanoid(10), generated per request. Appears in every log line and every error body. */
  traceId: string;
  ip: string;
  userId?: string;
  dealerId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Response header that lets a dealer's support ticket quote a traceId. */
export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * The current request's context, or undefined when called outside a request
 * (boot, shutdown, background jobs, workers).
 */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Same, for code that cannot meaningfully continue without a request. */
export function requireContext(): RequestContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error('requireContext() called outside of a request scope');
  }
  return context;
}

/** Convenience for log lines and error bodies. */
export function getTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

/**
 * Mutates the *current* context. This is how auth (Day 8) and tenant
 * resolution (Day 10) attach identity without re-running the middleware
 * chain — and why every later log line carries userId/dealerId for free.
 */
export function setContextValue<K extends keyof RequestContext>(
  key: K,
  value: RequestContext[K],
): void {
  const context = storage.getStore();
  if (context) {
    context[key] = value;
  }
}

/** Runs a function inside a context. Used by jobs and tests, not by Express. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

function clientIp(ip: string | undefined, remoteAddress: string | undefined): string {
  return ip ?? remoteAddress ?? 'unknown';
}

/**
 * Must be mounted before anything that logs or throws — everything downstream
 * runs inside storage.run(), including async continuations.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const context: RequestContext = {
    traceId: nanoid(10),
    ip: clientIp(req.ip, req.socket.remoteAddress),
  };

  res.setHeader(TRACE_ID_HEADER, context.traceId);
  storage.run(context, next);
};
