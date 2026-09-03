import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingHttpHeaders } from 'node:http';

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
  /**
   * The id this request is known by, everywhere. Appears in every log line and
   * every error body.
   *
   * Adopted from the edge when the edge sent one (see `CORRELATION_HEADERS`),
   * generated as `nanoid(10)` when it did not. Adopting matters as soon as
   * anything sits in front of the API: the ALB, the CDN and the web app's BFF
   * all log an id for the same request, and a trace that cannot be joined
   * across those three is a trace that only answers questions about one hop.
   */
  traceId: string;
  /**
   * True when `traceId` came from the caller rather than from this process.
   * Optional because jobs and tests build a context directly and have no
   * caller to inherit from.
   */
  traceInherited?: boolean;
  ip: string;
  userId?: string;
  dealerId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Response header that lets a dealer's support ticket quote a traceId. */
export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Echoed alongside `x-trace-id` because it is the name everything else already
 * uses — nginx, the ALB, and most log shippers look for this one.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Inbound headers that may carry an id, in precedence order.
 *
 * `x-amzn-trace-id` is last on purpose: the ALB sets it on every request, so
 * taking it first would mean an id supplied deliberately by the web app's BFF
 * were always ignored.
 */
export const CORRELATION_HEADERS = [
  'x-request-id',
  'x-correlation-id',
  'x-trace-id',
  'x-amzn-trace-id',
] as const;

/** Longest inbound id accepted. `x-amzn-trace-id` is ~55 characters. */
const MAX_TRACE_ID_LENGTH = 64;

/**
 * A caller-supplied id is untrusted input that ends up in every log line for
 * the request, so it is filtered rather than trusted.
 *
 * Only unreserved URL characters survive. That rules out the newline that
 * would let a caller forge a second log entry, the quote that would break the
 * JSON a log shipper parses, and the control characters that make a terminal
 * do something other than print. Anything left over that is empty or too long
 * is discarded and we generate our own.
 */
export function sanitizeTraceId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/[^A-Za-z0-9._=@:/+-]/g, '');
  if (cleaned.length === 0) return undefined;
  return cleaned.slice(0, MAX_TRACE_ID_LENGTH);
}

/**
 * The first usable id among the correlation headers, if any.
 *
 * Reads the raw header bag rather than `req.get()`: this has to work for a
 * plain Node request too, and a repeated header arrives as an array, whose
 * first value is the one the edge set.
 */
export function inboundTraceId(headers: IncomingHttpHeaders | undefined): string | undefined {
  if (!headers) return undefined;
  for (const name of CORRELATION_HEADERS) {
    const raw = headers[name];
    const candidate = sanitizeTraceId(Array.isArray(raw) ? raw[0] : raw);
    if (candidate) return candidate;
  }
  return undefined;
}

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
  const inherited = inboundTraceId(req.headers);

  const context: RequestContext = {
    traceId: inherited ?? nanoid(10),
    traceInherited: inherited !== undefined,
    ip: clientIp(req.ip, req.socket.remoteAddress),
  };

  res.setHeader(TRACE_ID_HEADER, context.traceId);
  res.setHeader(REQUEST_ID_HEADER, context.traceId);
  storage.run(context, next);
};
