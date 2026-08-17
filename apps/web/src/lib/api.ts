import type { ProblemDetails } from '@dealers-drive/contracts';

import { serverConfig } from './config';

/**
 * The one place the web app talks to the API.
 *
 * Every call is server-side by default (Rule 8): RSC fetches through
 * `apiGet`, and mutations go through Server Actions that call `apiSend`. The
 * browser only reaches the API directly for the two things that genuinely
 * cannot be expressed as a navigation — the direct-to-storage upload and the
 * enquiry-inbox tab switch — and those go through `/api/*` BFF handlers so no
 * `NEXT_PUBLIC_*` variable is ever needed (Rule 9, ARCHITECTURE §15.3).
 */
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

  /** Per-field messages, keyed by the field name the form uses. */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const entry of this.problem.errors ?? []) {
      // `validate()` prefixes the source: "body.pricePaise" -> "pricePaise".
      const field = entry.field.replace(/^(body|query|params)\./, '');
      errors[field] ??= entry.message;
    }
    return errors;
  }
}

export interface RequestOptions {
  /** Public pages cache; anything behind a session must not (§18). */
  revalidate?: number | false;
  tags?: string[];
  signal?: AbortSignal;
  /**
   * Extra request headers. Used by Server Actions to forward the buyer's IP:
   * without it every reveal and every enquiry would arrive from the Next
   * server's single address and the per-IP limits protecting dealer phone
   * numbers would count one bucket for the whole internet (ARCHITECTURE §14.1).
   */
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

  if (options.revalidate === false || method !== 'GET') {
    init.cache = 'no-store';
  } else if (options.revalidate !== undefined) {
    init.next = {
      revalidate: options.revalidate,
      ...(options.tags ? { tags: options.tags } : {}),
    };
  }

  const response = await fetch(url, init);

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      (payload as ProblemDetails | null) ?? {
        type: 'about:blank',
        title: 'Request failed',
        status: response.status,
        code: 'INTERNAL',
      },
    );
  }

  return payload as T;
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

export function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  // An action with no input still sends `{}`. Several endpoints declare an
  // all-optional body (`POST /listings/:id/approve` takes an optional note),
  // and `.strict()` Zod rejects `undefined` — which is correct of it. Sending
  // nothing at all is what would be wrong.
  const payload = method === 'DELETE' ? body : (body ?? {});
  return request<T>(method, path, payload, options);
}

/** Builds a query string from a partial record, dropping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}
