import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingHttpHeaders } from 'node:http';

import type { RequestHandler } from 'express';
import { nanoid } from 'nanoid';

export interface RequestContext {
  traceId: string;
  traceInherited?: boolean;
  ip: string;
  userId?: string;
  dealerId?: string;
  dbDurationSeconds?: number;
  dbOperationCount?: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const TRACE_ID_HEADER = 'x-trace-id';

export const REQUEST_ID_HEADER = 'x-request-id';

export const CORRELATION_HEADERS = [
  'x-request-id',
  'x-correlation-id',
  'x-trace-id',
  'x-amzn-trace-id',
] as const;

const MAX_TRACE_ID_LENGTH = 64;

export function sanitizeTraceId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/[^A-Za-z0-9._=@:/+-]/g, '');
  if (cleaned.length === 0) return undefined;
  return cleaned.slice(0, MAX_TRACE_ID_LENGTH);
}

export function inboundTraceId(headers: IncomingHttpHeaders | undefined): string | undefined {
  if (!headers) return undefined;
  for (const name of CORRELATION_HEADERS) {
    const raw = headers[name];
    const candidate = sanitizeTraceId(Array.isArray(raw) ? raw[0] : raw);
    if (candidate) return candidate;
  }
  return undefined;
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function requireContext(): RequestContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error('requireContext() called outside of a request scope');
  }
  return context;
}

export function getTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

export function setContextValue<K extends keyof RequestContext>(
  key: K,
  value: RequestContext[K],
): void {
  const context = storage.getStore();
  if (context) {
    context[key] = value;
  }
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

function clientIp(ip: string | undefined, remoteAddress: string | undefined): string {
  return ip ?? remoteAddress ?? 'unknown';
}

export const requestContext: RequestHandler = (req, res, next) => {
  const inherited = inboundTraceId(req.headers);

  const context: RequestContext = {
    traceId: inherited ?? nanoid(10),
    traceInherited: inherited !== undefined,
    ip: clientIp(req.ip, req.socket.remoteAddress),
    dbDurationSeconds: 0,
    dbOperationCount: 0,
  };

  res.setHeader(TRACE_ID_HEADER, context.traceId);
  res.setHeader(REQUEST_ID_HEADER, context.traceId);
  storage.run(context, next);
};
