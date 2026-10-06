import type { ProblemDetails } from '@dealers-drive/contracts';
import { cookies, headers } from 'next/headers';
import { z, type ZodError, type ZodType } from 'zod';

import { serverConfig } from './config';
import { logger } from './logger';

export const SESSION_COOKIE = 'dd_session';

export const SERVER_ERROR_MESSAGE =
  'Something went wrong on our side. Please try again in a moment.';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: ProblemDetails;
  readonly traceId: string | undefined;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.problem = problem;
    this.traceId = problem.traceId;
  }

  userMessage(fallback: string = SERVER_ERROR_MESSAGE): string {
    if (this.status >= 500) return SERVER_ERROR_MESSAGE;
    return this.problem.detail ?? fallback;
  }

  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const entry of this.problem.errors ?? []) {
      const field = entry.field.replace(/^(body|query|params)\./, '');
      errors[field] ??= entry.message;
    }
    return errors;
  }
}

export type UpstreamFailureKind = 'network' | 'timeout' | 'malformed';

export class UpstreamUnavailableError extends Error {
  readonly kind: UpstreamFailureKind;
  readonly status = 503;

  constructor(kind: UpstreamFailureKind, method: string, path: string, cause?: unknown) {
    super(`${method} ${path} failed: ${kind}`, cause === undefined ? undefined : { cause });
    this.name = 'UpstreamUnavailableError';
    this.kind = kind;
  }
}

export const API_TIMEOUT_MS = 8_000;

export const API_SLOW_MS = 1_000;

const REQUEST_ID_HEADER = 'x-request-id';

export const CLIENT_IP_HEADER = 'x-dd-client-ip';

export const CLIENT_IP_SECRET_HEADER = 'x-dd-forward-secret';

const LOOSE_PROBLEM = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    code: z.string(),
    traceId: z.string().optional(),
    requestId: z.string().optional(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    errors: z
      .array(z.object({ field: z.string(), code: z.string().optional(), message: z.string() }))
      .optional(),
  })
  .loose();

const UNNAMED_FIELD_CODE = 'INVALID';

const SYNTHESISED_TITLES: Readonly<Record<number, string>> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  429: 'Too many requests',
  502: 'Bad gateway',
  503: 'Service unavailable',
  504: 'Gateway timeout',
};

function synthesisedTitle(status: number): string {
  return SYNTHESISED_TITLES[status] ?? 'Request failed';
}

function synthesisedCode(status: number): string {
  if (status === 502 || status === 503 || status === 504) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL';
  if (status === 404) return 'NOT_FOUND';
  return 'REQUEST_FAILED';
}

export function problemFrom(payload: unknown, status: number): ProblemDetails {
  const parsed = LOOSE_PROBLEM.safeParse(payload);
  if (parsed.success) {
    const { errors, ...problem } = parsed.data;
    return {
      ...problem,
      type: problem.type ?? 'about:blank',
      title: problem.title ?? synthesisedTitle(status),
      status,
      ...(errors
        ? {
            errors: errors.map((entry) => ({
              field: entry.field,
              code: entry.code ?? UNNAMED_FIELD_CODE,
              message: entry.message,
            })),
          }
        : {}),
    };
  }
  return {
    type: 'about:blank',
    title: synthesisedTitle(status),
    status,
    code: synthesisedCode(status),
  };
}

class Deadline {
  private timer: ReturnType<typeof setTimeout> | undefined;

  race<T>(work: Promise<T>): Promise<T | typeof TIMED_OUT> {
    const expiry = new Promise<typeof TIMED_OUT>((resolve) => {
      this.timer = setTimeout(() => {
        resolve(TIMED_OUT);
      }, API_TIMEOUT_MS);
    });
    return Promise.race([work, expiry]).finally(() => {
      clearTimeout(this.timer);
    });
  }
}

const TIMED_OUT = Symbol('timed-out');

function parseBody(text: string): { ok: true; value: unknown } | { ok: false } {
  if (text.length === 0) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function reportFailure(method: string, path: string, error: Error): void {
  logger.error('api.request_failed', { method, path, error });
}

export interface RequestOptions {
  revalidate?: number | false;
  tags?: string[];
  signal?: AbortSignal;
  headers?: Record<string, string>;
  onSetCookie?: (cookies: string[]) => void;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  bypassCache = false,
): Promise<T> {
  const url = `${serverConfig().apiBaseUrl}${path}`;
  const requestId = method === 'GET' ? undefined : crypto.randomUUID();
  const startedAt = performance.now();

  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    method,
    headers: {
      Accept: 'application/json',
      ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  const uncached = options.revalidate === false || method !== 'GET';

  if (uncached) {
    init.cache = 'no-store';
    const session = await sessionCookie();
    if (session) {
      init.headers = { ...init.headers, Cookie: `${SESSION_COOKIE}=${session}` };
    }
    init.headers = { ...init.headers, ...(await clientIpHeaders()) };
  } else if (bypassCache) {
    init.cache = 'no-store';
  } else if (typeof options.revalidate === 'number') {
    init.next = {
      revalidate: options.revalidate,
      ...(options.tags ? { tags: options.tags } : {}),
    };
  }

  let settled: { response: Response; text: string } | typeof TIMED_OUT;
  try {
    settled = await new Deadline().race(
      fetch(url, init).then(async (response) => ({
        response,
        text: response.status === 204 ? '' : await response.text(),
      })),
    );
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    const failure = new UpstreamUnavailableError('network', method, path, cause);
    reportFailure(method, path, failure);
    throw failure;
  }

  if (settled === TIMED_OUT) {
    const failure = new UpstreamUnavailableError('timeout', method, path);
    reportFailure(method, path, failure);
    throw failure;
  }

  const { response, text } = settled;
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs >= API_SLOW_MS) {
    logger.warn('api.slow_request', {
      method,
      path,
      status: response.status,
      durationMs,
      traceId: response.headers.get(REQUEST_ID_HEADER) ?? requestId,
    });
  }
  options.onSetCookie?.(response.headers.getSetCookie());

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a 204 has no body to parse
  if (response.status === 204) return undefined as T;

  const parsed = parseBody(text);

  if (!response.ok) {
    const error = new ApiError(problemFrom(parsed.ok ? parsed.value : null, response.status));
    if (error.status >= 500) reportFailure(method, path, error);
    throw error;
  }

  if (!parsed.ok) {
    const failure = new UpstreamUnavailableError('malformed', method, path);
    reportFailure(method, path, failure);
    throw failure;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- see the docblock: `T` is a promise the compiler cannot keep, and `apiGetParsed` is the checked alternative
  return parsed.value as T;
}

async function sessionCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

function firstValue(value: string | null | undefined): string | undefined {
  const trimmed = value?.split(',')[0]?.trim();
  return trimmed ? trimmed : undefined;
}

async function clientIpHeaders(): Promise<Record<string, string>> {
  const secret = process.env.CLIENT_IP_FORWARD_SECRET;
  if (!secret) return {};
  try {
    const incoming = await headers();
    const ip = firstValue(incoming.get('x-real-ip')) ?? firstValue(incoming.get('x-forwarded-for'));
    return ip ? { [CLIENT_IP_HEADER]: ip, [CLIENT_IP_SECRET_HEADER]: secret } : {};
  } catch {
    return {};
  }
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

function contractError(path: string, error: ZodError): Error {
  return new Error(
    `GET ${path} did not match its contract: ${error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
      .join('; ')}`,
  );
}

export async function apiGetParsed<T>(
  schema: ZodType<T>,
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const parsed = schema.safeParse(await request<unknown>('GET', path, undefined, options));
  if (parsed.success) return parsed.data;

  if (typeof options?.revalidate !== 'number') throw contractError(path, parsed.error);

  const fresh = schema.safeParse(await request<unknown>('GET', path, undefined, options, true));
  if (fresh.success) {
    logger.warn('api.stale_contract_refetched', { path });
    return fresh.data;
  }
  const failure = contractError(path, fresh.error);
  reportFailure('GET', path, failure);
  throw failure;
}

export function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const payload = method === 'DELETE' ? body : (body ?? {});
  return request<T>(method, path, payload, options);
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}
