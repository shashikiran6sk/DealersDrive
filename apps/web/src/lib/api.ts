import type { ProblemDetails } from '@dealers-drive/contracts';
import { cookies } from 'next/headers';

import { serverConfig } from './config';

/** The session cookie the API issues. Named here so one file forwards it. */
export const SESSION_COOKIE = 'dd_session';

/** What a 5xx is allowed to say. Never the bug's own words. */
export const SERVER_ERROR_MESSAGE =
  'Something went wrong on our side. Please try again in a moment.';

/**
 * The one place the web app talks to the API.
 *
 * Every call is server-side by default (Rule 8): RSC fetches through
 * `apiGet`, and mutations go through Server Actions that call `apiSend`. The
 * browser only reaches the API directly for the two things that genuinely
 * cannot be expressed as a navigation — the direct-to-storage upload and the
 * enquiry-inbox tab switch — and those go through `/api/*` BFF handlers so no
 * `NEXT_PUBLIC_*` variable is ever needed (Rule 9, ARCHITECTURE §15.3).
 *
 * Because the fetch happens on the Next server rather than in the browser, the
 * dealer's `dd_session` cookie is not attached automatically — this file
 * forwards it. It does so only for uncached requests, which is not a
 * convenience: reading a cookie makes a route dynamic, and attaching a session
 * to a *cached* fetch is how one dealer's console ends up in another's browser
 * (ARCHITECTURE §18). Public pages therefore stay anonymous and cacheable, and
 * anything behind a session is `revalidate: false` and never shared.
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

  /**
   * The one line of this error a person may be shown.
   *
   * A 4xx `detail` is written *for* the person who made the request — "That
   * email and password do not match", "This car is no longer listed" — and
   * putting it on screen is the whole point of RFC 9457.
   *
   * A 5xx `detail` is the opposite: it is a bug describing itself. The API
   * fills it only outside production (`apps/api/src/middleware/error-handler.ts`
   * — `env.isProduction ? undefined : error.message`), so on a laptop it
   * carries text like "Invalid `tx.dealerDocument.create()` invocation …
   * Transaction API error". That is a stack trace wearing a sentence, it names
   * our internals, and there is nothing in it a buyer or a dealer can act on.
   * So every 5xx gets the same neutral line, in every environment — the detail
   * is still in the server log, addressed by `traceId`, where it belongs.
   */
  userMessage(fallback: string = SERVER_ERROR_MESSAGE): string {
    if (this.status >= 500) return SERVER_ERROR_MESSAGE;
    return this.problem.detail ?? fallback;
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

/**
 * The session token, or undefined outside a request scope.
 *
 * `cookies()` throws during static generation — the sitemap and the cached
 * public pages are rendered with no request at all — and that is a legitimate
 * state, not an error: those pages have no session to forward.
 */
async function sessionCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

/**
 * A sign-in call, which is the one place the API's *response* headers matter.
 *
 * Ordinary calls only need the body. This one also needs the `Set-Cookie` the
 * API issued, because the cookie has to be re-issued by *this* origin: the
 * fetch happened on the Next server, so nothing reached the browser on its own.
 * Returning it rather than setting it keeps this file free of `next/headers`
 * side effects — the Server Action decides what to do with it.
 */
export interface IssuedSession {
  value: string;
  expires?: Date;
}

export async function apiSignIn<T>(
  path: string,
  body: unknown,
): Promise<{ data: T; session: IssuedSession | null }> {
  const response = await fetch(`${serverConfig().apiBaseUrl}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

  return { data: payload as T, session: sessionFrom(response.headers.getSetCookie()) };
}

/** Pulls `dd_session` and its expiry out of the API's Set-Cookie headers. */
export function sessionFrom(setCookie: string[]): IssuedSession | null {
  const header = setCookie.find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  if (!header) return null;

  const [pair, ...attributes] = header.split(';');
  const value = pair?.slice(SESSION_COOKIE.length + 1) ?? '';
  if (!value) return null;

  const expiresAttribute = attributes
    .map((attribute) => attribute.trim())
    .find((attribute) => attribute.toLowerCase().startsWith('expires='));
  const expires = expiresAttribute
    ? new Date(expiresAttribute.slice('expires='.length))
    : undefined;

  return {
    value,
    ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
  };
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
