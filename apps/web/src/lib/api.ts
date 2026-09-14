import type { ProblemDetails } from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import type { ZodType } from 'zod';

import { serverConfig } from './config';

export const SESSION_COOKIE = 'dd_session';

export const SERVER_ERROR_MESSAGE =
  'Something went wrong on our side. Please try again in a moment.';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.problem = problem;
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

export interface RequestOptions {
  revalidate?: number | false;
  tags?: string[];
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${serverConfig().apiBaseUrl}${path}`;

  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    method,
    headers: {
      Accept: 'application/json',
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
  } else if (typeof options.revalidate === 'number') {
    init.next = {
      revalidate: options.revalidate,
      ...(options.tags ? { tags: options.tags } : {}),
    };
  }

  const response = await fetch(url, init);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a 204 has no body to parse
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the error body is untyped off the wire
      (payload as ProblemDetails | null) ?? {
        type: 'about:blank',
        title: 'Request failed',
        status: response.status,
        code: 'INTERNAL',
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- see the docblock: `T` is a promise the compiler cannot keep, and `apiGetParsed` is the checked alternative
  return payload as T;
}

async function sessionCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

export async function apiGetParsed<T>(
  schema: ZodType<T>,
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const payload = await request<unknown>('GET', path, undefined, options);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(
      `GET ${path} did not match its contract: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
        .join('; ')}`,
    );
  }

  return parsed.data;
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
