import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar } from '../../setup.js';
import { ApiError, apiGet, apiSend, apiSignIn, qs, sessionFrom } from '../../../src/lib/api.js';

/**
 * The one place the web app talks to the API (Rule 8). Three behaviours here
 * are load-bearing and none of them are visible from a happy-path test.
 *
 * **Caching by intent, not by accident.** A public catalogue page is cached; a
 * page behind a session must never be (§18). A mutation is never cached at
 * all. Getting this wrong once serves one dealer's inventory to another from
 * the CDN — which is a tenant-isolation failure that no amount of server-side
 * scoping would catch.
 *
 * **A problem document survives the round trip.** The API answers RFC 9457,
 * and `ApiError.fieldErrors()` is what turns that into the per-field messages
 * a form renders. Losing the mapping means a validation failure shows as a
 * generic banner and the user cannot tell which field to fix.
 *
 * **An empty body is not an error.** A 204 is the normal answer to a delete,
 * and `JSON.parse('')` throws.
 */

const ORIGINAL_FETCH = globalThis.fetch;

interface Captured {
  url: string;
  init: RequestInit & { next?: { revalidate?: number; tags?: string[] } };
}

let calls: Captured[] = [];

function respondWith(
  body: unknown,
  init: { status?: number; text?: string } = {},
): ReturnType<typeof vi.fn> {
  const status = init.status ?? 200;
  const text = init.text ?? (body === undefined ? '' : JSON.stringify(body));

  return vi.fn((url: string, requestInit: Captured['init']) => {
    calls.push({ url, init: requestInit });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(text),
    } as Response);
  });
}

beforeEach(() => {
  calls = [];
  vi.stubEnv('API_BASE_URL', 'http://api.test');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe('apiGet', () => {
  it('returns the parsed body', async () => {
    globalThis.fetch = respondWith({ data: [{ id: 'v1' }] }) as unknown as typeof fetch;

    expect(await apiGet('/v1/vehicles')).toEqual({ data: [{ id: 'v1' }] });
  });

  it('addresses the configured API base', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/vehicles');

    expect(calls[0]?.url).toBe('http://api.test/v1/vehicles');
  });

  it('asks for JSON', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/vehicles');

    expect((calls[0]?.init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('sends no body and no content type on a GET', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/vehicles');

    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.init.headers).not.toHaveProperty('Content-Type');
  });

  it('passes an abort signal through', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;
    const controller = new AbortController();

    await apiGet('/v1/vehicles', { signal: controller.signal });

    expect(calls[0]?.init.signal).toBe(controller.signal);
  });
});

describe('caching', () => {
  /** The catalogue is the same for everyone, so it is worth caching. */
  it('caches a public read for the requested window', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/vehicles', { revalidate: 60 });

    expect(calls[0]?.init.next).toEqual({ revalidate: 60 });
    expect(calls[0]?.init.cache).toBeUndefined();
  });

  it('tags a cached read so a mutation can invalidate it', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/vehicles', { revalidate: 60, tags: ['vehicles'] });

    expect(calls[0]?.init.next).toEqual({ revalidate: 60, tags: ['vehicles'] });
  });

  /**
   * §18. A console page is scoped to one dealership; caching it would let the
   * CDN serve one dealer's inventory to another. `revalidate: false` is the
   * explicit opt-out and it has to reach `fetch` as `no-store`.
   */
  it('never caches a read the caller marked private', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/dealer/vehicles', { revalidate: false });

    expect(calls[0]?.init.cache).toBe('no-store');
    expect(calls[0]?.init.next).toBeUndefined();
  });

  it('adds no cache directive when the caller expressed no intent', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/vehicles');

    expect(calls[0]?.init.cache).toBeUndefined();
    expect(calls[0]?.init.next).toBeUndefined();
  });

  /** A mutation's response is never reusable, whatever the caller asked for. */
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'] as const)('never caches a %s', async (method) => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiSend(method, '/v1/dealer/vehicles', {}, { revalidate: 3600 });

    expect(calls[0]?.init.cache).toBe('no-store');
    expect(calls[0]?.init.next).toBeUndefined();
  });

  it('caches a zero-second revalidate rather than treating it as absent', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/vehicles', { revalidate: 0 });

    expect(calls[0]?.init.next).toEqual({ revalidate: 0 });
  });
});

describe('apiSend', () => {
  it('sends the body as JSON with a content type', async () => {
    globalThis.fetch = respondWith({ id: 'v1' }, { status: 201 }) as unknown as typeof fetch;

    await apiSend('POST', '/v1/dealer/vehicles', { year: 2019 });

    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe('{"year":2019}');
    expect((calls[0]?.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  /**
   * Several endpoints declare an all-optional body — `POST /listings/:id/approve`
   * takes an optional note — and a `.strict()` Zod schema rejects `undefined`,
   * correctly. Sending `{}` is what an action with no input means.
   */
  it('sends {} rather than nothing when an action has no input', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiSend('POST', '/v1/admin/listings/l1/approve');

    expect(calls[0]?.init.body).toBe('{}');
  });

  /** A DELETE with a body is unusual enough that inventing one would be wrong. */
  it('sends no body on a DELETE unless one was given', async () => {
    globalThis.fetch = respondWith(undefined, { status: 204 }) as unknown as typeof fetch;

    await apiSend('DELETE', '/v1/dealer/media/m1');

    expect(calls[0]?.init.body).toBeUndefined();
  });

  it('sends a DELETE body when the caller supplies one', async () => {
    globalThis.fetch = respondWith(undefined, { status: 204 }) as unknown as typeof fetch;

    await apiSend('DELETE', '/v1/dealer/media/m1', { reason: 'blurry' });

    expect(calls[0]?.init.body).toBe('{"reason":"blurry"}');
  });

  /**
   * §14.1: the buyer's address, forwarded so the API's per-IP limits count the
   * buyer rather than counting the Next server once for the whole internet.
   */
  it('forwards the headers a server action supplies', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiSend('POST', '/v1/enquiries', {}, { headers: { 'x-forwarded-for': '203.0.113.7' } });

    expect((calls[0]?.init.headers as Record<string, string>)['x-forwarded-for']).toBe(
      '203.0.113.7',
    );
  });

  it('keeps Accept alongside the forwarded headers', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiSend('POST', '/v1/enquiries', {}, { headers: { 'x-real-ip': '203.0.113.7' } });

    expect(calls[0]?.init.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-real-ip': '203.0.113.7',
    });
  });
});

describe('empty responses', () => {
  /** `JSON.parse('')` throws, and a 204 is the normal answer to a delete. */
  it('returns undefined for a 204 rather than throwing', async () => {
    globalThis.fetch = respondWith(undefined, { status: 204 }) as unknown as typeof fetch;

    expect(await apiSend('DELETE', '/v1/dealer/media/m1')).toBeUndefined();
  });

  it('returns null for a 200 with an empty body', async () => {
    globalThis.fetch = respondWith(undefined, { status: 200, text: '' }) as unknown as typeof fetch;

    expect(await apiGet('/v1/anything')).toBeNull();
  });
});

describe('ApiError', () => {
  const problem = {
    type: 'https://dealersdrive.com/errors/validation-failed',
    title: 'Validation failed',
    status: 400,
    code: 'VALIDATION_FAILED',
    traceId: 'a1b2c3d4e5',
    detail: 'The request did not match the expected shape.',
    errors: [
      { field: 'body.pricePaise', code: 'TOO_SMALL', message: 'Price is too low.' },
      { field: 'body.year', code: 'INVALID_TYPE', message: 'Year must be a number.' },
    ],
  };

  it('throws on a non-2xx', async () => {
    globalThis.fetch = respondWith(problem, { status: 400 }) as unknown as typeof fetch;

    await expect(apiGet('/v1/vehicles')).rejects.toBeInstanceOf(ApiError);
  });

  it('carries the status and the code', async () => {
    globalThis.fetch = respondWith(problem, { status: 400 }) as unknown as typeof fetch;

    const error = (await apiGet('/v1/vehicles').catch((caught: unknown) => caught)) as ApiError;

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('uses the detail as its message, because that is what a user would read', async () => {
    globalThis.fetch = respondWith(problem, { status: 400 }) as unknown as typeof fetch;

    const error = (await apiGet('/v1/vehicles').catch((caught: unknown) => caught)) as ApiError;

    expect(error.message).toBe('The request did not match the expected shape.');
  });

  it('falls back to the title when there is no detail', () => {
    const error = new ApiError({ ...problem, detail: undefined });

    expect(error.message).toBe('Validation failed');
  });

  it('keeps the whole problem document, including the traceId to quote', () => {
    const error = new ApiError(problem);

    expect(error.problem.traceId).toBe('a1b2c3d4e5');
  });

  it('is a real Error, so it survives a rethrow and shows a stack', () => {
    const error = new ApiError(problem);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
  });

  /**
   * A response that is not a problem document at all — a 502 from a proxy, an
   * HTML error page — must still become an ApiError rather than a parse
   * failure the caller cannot distinguish from a bug.
   */
  it('synthesises a problem for a non-problem failure', async () => {
    globalThis.fetch = respondWith(undefined, {
      status: 502,
      text: '',
    }) as unknown as typeof fetch;

    const error = (await apiGet('/v1/vehicles').catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe('INTERNAL');
  });
});

describe('fieldErrors', () => {
  /**
   * `validate()` prefixes each field with its source, so `body.pricePaise`
   * arrives where the form knows the field as `pricePaise`. Without stripping
   * the prefix every message would land on no field at all and the form would
   * show a generic banner instead.
   */
  it('strips the source prefix so a message lands on its input', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Validation failed',
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 't',
      errors: [{ field: 'body.pricePaise', code: 'TOO_SMALL', message: 'Price is too low.' }],
    });

    expect(error.fieldErrors()).toEqual({ pricePaise: 'Price is too low.' });
  });

  it.each(['body', 'query', 'params'])('strips the %s prefix', (source) => {
    const error = new ApiError({
      type: 'x',
      title: 'x',
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 't',
      errors: [{ field: `${source}.limit`, code: 'TOO_BIG', message: 'Too many.' }],
    });

    expect(error.fieldErrors()).toEqual({ limit: 'Too many.' });
  });

  it('keeps a nested path below the source, so a sub-field still resolves', () => {
    const error = new ApiError({
      type: 'x',
      title: 'x',
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 't',
      errors: [{ field: 'body.pricing.amount', code: 'INVALID', message: 'Bad amount.' }],
    });

    expect(error.fieldErrors()).toEqual({ 'pricing.amount': 'Bad amount.' });
  });

  /** The first message is the actionable one; the rest repeat the same field. */
  it('keeps the first message when a field fails twice', () => {
    const error = new ApiError({
      type: 'x',
      title: 'x',
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 't',
      errors: [
        { field: 'body.year', code: 'TOO_SMALL', message: 'Too old.' },
        { field: 'body.year', code: 'INVALID_TYPE', message: 'Not a number.' },
      ],
    });

    expect(error.fieldErrors()).toEqual({ year: 'Too old.' });
  });

  it('is empty when the failure was not per-field', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Not found',
      status: 404,
      code: 'NOT_FOUND',
      traceId: 't',
    });

    expect(error.fieldErrors()).toEqual({});
  });

  it('leaves an unprefixed field name alone', () => {
    const error = new ApiError({
      type: 'x',
      title: 'x',
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 't',
      errors: [{ field: 'pricePaise', code: 'TOO_SMALL', message: 'Too low.' }],
    });

    expect(error.fieldErrors()).toEqual({ pricePaise: 'Too low.' });
  });
});

describe('qs', () => {
  it('returns an empty string for no parameters', () => {
    expect(qs({})).toBe('');
  });

  it('builds a leading-question-mark query string', () => {
    expect(qs({ city: 'vellore' })).toBe('?city=vellore');
  });

  it('stringifies numbers', () => {
    expect(qs({ page: 2, limit: 24 })).toBe('?page=2&limit=24');
  });

  /** A dangling `?city=` filters on the empty string, which matches nothing. */
  it('drops undefined, null and empty values', () => {
    expect(qs({ city: undefined, q: null, sort: '', page: 1 })).toBe('?page=1');
  });

  it('keeps a zero, which is a real value', () => {
    expect(qs({ priceMin: 0 })).toBe('?priceMin=0');
  });

  it('encodes a value that needs it', () => {
    expect(qs({ q: 'swift vxi & more' })).toContain('swift+vxi+%26+more');
  });

  it('returns an empty string when every value was dropped', () => {
    expect(qs({ city: undefined, q: '' })).toBe('');
  });
});

/**
 * The session has to be carried by hand.
 *
 * These fetches happen on the Next server, not in the browser, so the dealer's
 * `dd_session` cookie is not attached for us. Forwarding it is what makes the
 * console work at all — and forwarding it on a *cached* request is how one
 * dealer's inventory would end up in another's browser (§18). The rule is
 * therefore not "always forward" but "forward exactly when the response is not
 * shared", which is what these tests pin.
 */
describe('forwarding the session', () => {
  it('sends the cookie on an uncached read', async () => {
    cookieJar.set('dd_session', 'the-token');
    globalThis.fetch = respondWith({ ok: true }) as unknown as typeof fetch;

    await apiGet('/v1/dealer', { revalidate: false });

    expect((calls[0]?.init.headers as Record<string, string>).Cookie).toBe('dd_session=the-token');
  });

  it('sends it on every mutation', async () => {
    cookieJar.set('dd_session', 'the-token');
    globalThis.fetch = respondWith({ ok: true }) as unknown as typeof fetch;

    await apiSend('POST', '/v1/dealer/vehicles', { year: 2020 });

    expect((calls[0]?.init.headers as Record<string, string>).Cookie).toBe('dd_session=the-token');
  });

  /** The catalogue is the same for everyone, and is cached for everyone. */
  it('never sends it on a cached read', async () => {
    cookieJar.set('dd_session', 'the-token');
    globalThis.fetch = respondWith({ data: [] }) as unknown as typeof fetch;

    await apiGet('/v1/vehicles', { revalidate: 60 });

    expect((calls[0]?.init.headers as Record<string, string>).Cookie).toBeUndefined();
    expect(calls[0]?.init.next?.revalidate).toBe(60);
  });

  it('sends no cookie header at all when there is no session', async () => {
    globalThis.fetch = respondWith({ ok: true }) as unknown as typeof fetch;

    await apiGet('/v1/dealer', { revalidate: false });

    expect((calls[0]?.init.headers as Record<string, string>).Cookie).toBeUndefined();
  });
});

describe('sessionFrom', () => {
  it('reads the token and its expiry out of Set-Cookie', () => {
    const session = sessionFrom([
      'dd_session=abc123; Path=/; Expires=Wed, 19 Aug 2026 03:52:38 GMT; HttpOnly; SameSite=Lax',
    ]);

    expect(session?.value).toBe('abc123');
    expect(session?.expires?.toUTCString()).toBe('Wed, 19 Aug 2026 03:52:38 GMT');
  });

  it('ignores every other cookie the API sets', () => {
    expect(sessionFrom(['dd_oauth=xyz; Path=/', 'other=1'])).toBeNull();
    expect(sessionFrom([])).toBeNull();
  });

  it('accepts a session with no expiry', () => {
    const session = sessionFrom(['dd_session=abc123; Path=/; HttpOnly']);

    expect(session).toEqual({ value: 'abc123' });
  });

  it('rejects an empty value rather than issuing a blank session', () => {
    expect(sessionFrom(['dd_session=; Path=/'])).toBeNull();
  });

  it('ignores an unparseable expiry rather than issuing an invalid date', () => {
    expect(sessionFrom(['dd_session=abc; Expires=not-a-date'])).toEqual({ value: 'abc' });
  });
});

describe('apiSignIn', () => {
  function signInResponse(body: unknown, setCookie: string[], status = 200) {
    return vi.fn((url: string, init: Captured['init']) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(JSON.stringify(body)),
        headers: { getSetCookie: () => setCookie },
      } as unknown as Response);
    });
  }

  it('returns the body and the issued session together', async () => {
    globalThis.fetch = signInResponse({ admin: { id: '1' } }, [
      'dd_session=issued; Path=/; HttpOnly',
    ]) as unknown as typeof fetch;

    const result = await apiSignIn<{ admin: { id: string } }>('/v1/auth/admin/login', {
      email: 'a@b.c',
      password: 'x',
    });

    expect(result.data.admin.id).toBe('1');
    expect(result.session?.value).toBe('issued');
  });

  it('never caches a sign-in', async () => {
    globalThis.fetch = signInResponse({}, []) as unknown as typeof fetch;

    await apiSignIn('/v1/auth/admin/login', {});

    expect(calls[0]?.init.cache).toBe('no-store');
  });

  it('throws the problem document on a refusal', async () => {
    globalThis.fetch = signInResponse(
      { type: 'about:blank', title: 'no', status: 401, code: 'INVALID_CREDENTIALS' },
      [],
      401,
    ) as unknown as typeof fetch;

    const error = (await apiSignIn('/v1/auth/admin/login', {}).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INVALID_CREDENTIALS');
  });
});
