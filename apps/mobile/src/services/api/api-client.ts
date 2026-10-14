import { ProblemDetails } from '@dealers-drive/contracts/common';
import type { ZodType } from 'zod';

import { ApiError } from './api-error';
import { API_MESSAGES, API_TIMEOUT_MS } from './api.constants';

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

function requestUrl(baseUrl: string, path: string): string {
  if (!path.startsWith('/v1/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('API paths must be relative v1 routes.');
  }
  const base = new URL(baseUrl);
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith('/v1/')) {
    throw new Error('The API request cannot leave the configured service.');
  }
  return url.href;
}

function decodeBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('INVALID_RESPONSE', API_MESSAGES.invalidResponse);
  }
}

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const until = Date.parse(value);
  return Number.isFinite(until) ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : undefined;
}

const CUSTOMER_PATHS = [
  /^\/v1\/auth\/customer\/me\/?$/,
  /^\/v1\/auth\/native\/customer\/(?:me|logout)\/?$/,
  /^\/v1\/legal\/customer\/(?:status|history|terms)\/?$/,
  /^\/v1\/enquiries(?:\/|$)/,
  /^\/v1\/saved-vehicles(?:\/|$)/,
  /^\/v1\/support(?:\/|$)/,
];
const PUBLIC_AUTH_PATH = /^\/v1\/auth\/native\/customer\/(?:otp|otp\/resend|otp\/verify|sign-up)$/;
export interface CustomerRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

export function createApiClient({
  baseUrl,
  fetcher = fetch,
  timeoutMs = API_TIMEOUT_MS,
}: ApiClientOptions) {
  async function request<T>(
    path: string,
    schema: ZodType<T>,
    signal?: AbortSignal,
    options: CustomerRequest = {},
    token?: string,
  ): Promise<T> {
    const url = requestUrl(baseUrl, path);
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetcher(url, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: 'error',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (
        response.redirected ||
        (response.url && new URL(response.url).origin !== new URL(url).origin)
      )
        throw new ApiError('INVALID_RESPONSE', API_MESSAGES.invalidResponse);
      const text = await response.text();
      if (!response.ok) {
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
        const parsed = ProblemDetails.safeParse(payload);
        const problem = parsed.success ? { ...parsed.data, status: response.status } : undefined;
        throw new ApiError(
          problem?.code ?? 'REQUEST_FAILED',
          response.status >= 500 ? API_MESSAGES.server : (problem?.detail ?? API_MESSAGES.request),
          response.status,
          problem,
          retryAfter(response.headers.get('Retry-After')),
        );
      }
      const parsed = schema.safeParse(response.status === 204 ? undefined : decodeBody(text));
      if (!parsed.success) throw new ApiError('INVALID_RESPONSE', API_MESSAGES.invalidResponse);
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (timedOut) throw new ApiError('REQUEST_TIMEOUT', API_MESSAGES.timeout);
      if (signal?.aborted) throw new ApiError('REQUEST_CANCELLED', API_MESSAGES.cancelled);
      throw new ApiError('NETWORK_UNAVAILABLE', API_MESSAGES.network);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  return {
    get: <T>(path: string, schema: ZodType<T>, signal?: AbortSignal) =>
      request(path, schema, signal),
    postAuth<T>(path: string, body: unknown, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
      if (!PUBLIC_AUTH_PATH.test(path)) throw new Error('Not a native customer auth route.');
      return request(path, schema, signal, { method: 'POST', body });
    },
    customer<T>(
      path: string,
      schema: ZodType<T>,
      token: string,
      options: CustomerRequest = {},
      signal?: AbortSignal,
    ): Promise<T> {
      const url = requestUrl(baseUrl, path);
      if (
        !CUSTOMER_PATHS.some((pattern) => pattern.test(new URL(url).pathname)) ||
        !/^[A-Za-z0-9_-]{43}$/.test(token)
      )
        throw new Error('Not a customer credential/route.');
      return request(path, schema, signal, options, token);
    },
  };
}
