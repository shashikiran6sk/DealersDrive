import type { ProblemDetails } from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import type { ZodType } from 'zod';

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

/*
 * `apiSignIn` and `sessionFrom` used to live here — a POST whose *response
 * headers* mattered, because the admin sign-in returned a `Set-Cookie` that had
 * to be re-issued by this origin.
 *
 * There is no such call any more. Both consoles sign in by navigating the
 * browser to the API, which sets the cookie itself on the OAuth callback, so
 * nothing in this app ever relays one. Keeping the helper would have meant
 * keeping the only code path that copies a session cookie between two
 * processes, for no caller.
 */

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

/**
 * `apiGet`, but the payload is **checked** against the contract it claims to be.
 *
 * ## Why this exists (R22)
 *
 * `apiGet<T>` is a cast. `T` is a promise the compiler cannot keep, because the
 * bytes come off a socket from a process built at a different time — and the
 * failure that taught us this is worth writing down, because it did not look
 * like a failure.
 *
 * R22 added `state` to each district in `/v1/locations`. Between the API
 * restarting and Next's ten-minute fetch cache expiring, the header was handed
 * the *old* payload: districts with no `state` key. Nothing threw. `undefined`
 * flowed into the selector and every district in the country was filed under
 * **"State not recorded"** — which is not a rendering glitch a reader dismisses
 * but a **factual claim**, in the product's own voice, that the platform does
 * not know where Chennai is. Version skew wearing the costume of data.
 *
 * `schema.parse` turns that into a throw, and a throw the caller can degrade
 * from. Losing the dropdown for the few minutes a deploy is skewed is a cost
 * worth paying; telling a buyer something false for the same few minutes is
 * not.
 *
 * ## When to reach for it
 *
 * Not everywhere, and not as a rule pending on the other call sites. Use it
 * where a **missing or changed field renders as a plausible sentence rather
 * than as an obvious break** — that is the class this catches and type
 * assertions cannot. A payload whose absence yields an empty list or a blank
 * card is already loud enough to need no help.
 *
 * Zod objects ignore unknown keys by default, so an additive API change still
 * parses. Only a field this app *requires* going missing is an error, which is
 * exactly the skew direction that hurts.
 */
export async function apiGetParsed<T>(
  schema: ZodType<T>,
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const payload = await request<unknown>('GET', path, undefined, options);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    /*
     * Named, and loud. The caller degrades — that is its business — but a
     * silent degrade is how a skewed deploy looks identical to an empty
     * platform for as long as nobody thinks to check.
     */
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
