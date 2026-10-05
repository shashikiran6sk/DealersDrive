import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { cookieJar } from '../../setup.js';
import { PublicLocations } from '@dealers-drive/contracts';

import {
  API_TIMEOUT_MS,
  ApiError,
  apiGet,
  apiGetParsed,
  apiSend,
  qs,
  SERVER_ERROR_MESSAGE,
  UpstreamUnavailableError,
} from '../../../src/lib/api.js';
import { logger } from '../../../src/lib/logger.js';

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
 *
 * **A cast is not a check** (R22). `apiGet<T>` promises a shape the compiler
 * cannot verify, because the bytes come from a process built at a different
 * time. `apiGetParsed` is for the reads where being wrong about that renders as
 * a sentence rather than as a break.
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
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

/**
 * The error model's input side: whatever came back, the caller receives one of
 * two things — an `ApiError` whose status is the one on the response, or an
 * `UpstreamUnavailableError` saying the API could not be reached, answered in
 * time, or answered with something unreadable. Nothing an upstream wrote into a
 * body it was not meant to reaches the problem the UI and the BFF read from.
 */
describe('upstream failures', () => {
  let stderr: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function logged(): Record<string, unknown>[] {
    return stderr.mock.calls.map(
      (call: unknown[]) => JSON.parse(String(call[0])) as Record<string, unknown>,
    );
  }

  it('reads an HTML error page as a synthesised problem rather than a parse failure', async () => {
    globalThis.fetch = respondWith(undefined, {
      status: 502,
      text: '<html><body>Bad Gateway nginx/1.25</body></html>',
    }) as unknown as typeof fetch;

    const error = (await apiGet('/v1/vehicles').catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(JSON.stringify(error.problem)).not.toContain('nginx');
  });

  it('keeps nothing from a body that is not a problem document', async () => {
    globalThis.fetch = respondWith(
      { error: "PrismaClientInitializationError: Can't reach database server at db.internal:5432" },
      { status: 500 },
    ) as unknown as typeof fetch;

    const error = (await apiGet('/v1/vehicles').catch((caught: unknown) => caught)) as ApiError;

    expect(error.problem).toEqual({
      type: 'about:blank',
      title: 'Request failed',
      status: 500,
      code: 'INTERNAL',
    });
    expect(error.userMessage()).toBe(SERVER_ERROR_MESSAGE);
  });

  it('takes the status from the response, never from the body', async () => {
    globalThis.fetch = respondWith(
      { type: 'x', title: 'Not found', status: 200, code: 'NOT_FOUND' },
      { status: 404 },
    ) as unknown as typeof fetch;

    const error = (await apiGet('/v1/vehicles/x').catch((caught: unknown) => caught)) as ApiError;
    expect(error.status).toBe(404);
  });

  it('calls an unreachable API unavailable, and logs why', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') })),
    );

    const error = await apiGet('/v1/vehicles').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UpstreamUnavailableError);
    expect((error as UpstreamUnavailableError).kind).toBe('network');
    expect(logged()[0]).toMatchObject({
      level: 'error',
      event: 'api.request_failed',
      method: 'GET',
      path: '/v1/vehicles',
    });
    expect(logged()[0]).toMatchObject({
      error: { kind: 'network', cause: { name: 'TypeError', cause: { name: 'Error' } } },
    });
    expect(JSON.stringify(logged()[0])).not.toContain('ECONNREFUSED');
  });

  it('gives up on an API that does not answer in time', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined));

    const pending = apiGet('/v1/vehicles').catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    const error = await pending;

    expect(error).toBeInstanceOf(UpstreamUnavailableError);
    expect((error as UpstreamUnavailableError).kind).toBe('timeout');
  });

  it('calls a 200 it cannot read malformed rather than returning half of it', async () => {
    globalThis.fetch = respondWith(undefined, {
      status: 200,
      text: '{"data": [',
    }) as unknown as typeof fetch;

    const error = await apiGet('/v1/vehicles').catch((caught: unknown) => caught);
    expect((error as UpstreamUnavailableError).kind).toBe('malformed');
  });

  it('logs a server failure with its trace id, and never a 4xx', async () => {
    globalThis.fetch = respondWith(
      { type: 'x', title: 'Internal server error', status: 500, code: 'INTERNAL', traceId: 'T1' },
      { status: 500 },
    ) as unknown as typeof fetch;
    await apiGet('/v1/vehicles').catch(() => undefined);
    expect(logged()[0]).toMatchObject({
      error: { status: 500, code: 'INTERNAL', traceId: 'T1' },
    });

    stderr.mockClear();
    globalThis.fetch = respondWith(
      { type: 'x', title: 'Not found', status: 404, code: 'VEHICLE_NOT_FOUND' },
      { status: 404 },
    ) as unknown as typeof fetch;
    await apiGet('/v1/vehicles/x').catch(() => undefined);
    expect(stderr).not.toHaveBeenCalled();
  });

  it('lets a caller’s own abort through untouched and unlogged', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException('Aborted', 'AbortError');
    globalThis.fetch = vi.fn(() => Promise.reject(abort));

    await expect(apiGet('/v1/vehicles', { signal: controller.signal })).rejects.toBe(abort);
    expect(stderr).not.toHaveBeenCalled();
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

/**
 * R22 — the read that is checked rather than asserted, and the incident it
 * came from.
 *
 * `/v1/locations` gained a `state` on each district. For the ten minutes
 * between the API restarting and Next's fetch cache expiring, the header was
 * served the previous payload; `state` was `undefined`; and the location dialog
 * filed every district in the country under **"State not recorded"** — the
 * product asserting, in its own voice, that it did not know which state Chennai
 * is in. Nothing threw, nothing logged, and it looked exactly like data.
 *
 * These pin the two halves of the fix: the skew throws, and an additive change
 * does not.
 */
describe('apiGetParsed', () => {
  const CURRENT = {
    districts: [{ slug: 'chennai', name: 'Chennai', count: 1, state: 'Tamil Nadu' }],
    total: 1,
    cars: { total: 3, districts: { chennai: 3 } },
  };

  it('returns the payload when it matches the contract', async () => {
    globalThis.fetch = respondWith(CURRENT) as unknown as typeof fetch;

    expect(await apiGetParsed(PublicLocations, '/v1/locations')).toEqual(CURRENT);
  });

  /** The incident, as a test: an older API, one field short. */
  it('throws on a payload from before a field was added, naming the field', async () => {
    globalThis.fetch = respondWith({
      districts: [{ slug: 'chennai', name: 'Chennai', count: 1 }],
      total: 1,
    }) as unknown as typeof fetch;

    await expect(apiGetParsed(PublicLocations, '/v1/locations')).rejects.toThrow(
      /districts\.0\.state/,
    );
  });

  /**
   * `null` is a real answer — the column is nullable, and a district whose
   * dealerships never filled the state in is still a district. Only *absence*
   * is the error, which is the direction that hurts.
   */
  it('accepts a state that is genuinely null', async () => {
    globalThis.fetch = respondWith({
      districts: [{ slug: 'chennai', name: 'Chennai', count: 1, state: null }],
      total: 1,
      cars: { total: 0, districts: {} },
    }) as unknown as typeof fetch;

    await expect(apiGetParsed(PublicLocations, '/v1/locations')).resolves.toBeTruthy();
  });

  /**
   * The other direction, and why this is not brittle: a **newer** API that has
   * added a field this app does not know about still parses. Zod objects ignore
   * unknown keys, so deploying the API first stays safe.
   */
  it('accepts a payload from a newer API carrying fields it does not know', async () => {
    globalThis.fetch = respondWith({
      districts: [
        { slug: 'chennai', name: 'Chennai', count: 1, state: 'Tamil Nadu', carCount: 48 },
      ],
      total: 1,
      cars: { total: 48, districts: { chennai: 48 } },
      nextThing: true,
    }) as unknown as typeof fetch;

    await expect(apiGetParsed(PublicLocations, '/v1/locations')).resolves.toMatchObject({
      total: 1,
    });
  });

  /**
   * A cached read that no longer matches is the cache's fault, not the API's.
   * Next hands back an expired entry, however old, while it revalidates in the
   * background, so the first request for a URL after a contract change gets
   * the old body. It asks the API once more, uncached, and answers from that.
   */
  describe('when a cached read no longer matches its contract', () => {
    const STALE = { districts: [{ slug: 'chennai', name: 'Chennai', count: 1 }], total: 1 };

    function answers(...bodies: unknown[]): ReturnType<typeof vi.fn> {
      return vi.fn((url: string, requestInit: Captured['init']) => {
        calls.push({ url, init: requestInit });
        const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(body)),
          headers: new Headers(),
        } as Response);
      });
    }

    it('asks the API again, uncached, and answers from that', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      globalThis.fetch = answers(STALE, CURRENT) as unknown as typeof fetch;

      await expect(
        apiGetParsed(PublicLocations, '/v1/locations', { revalidate: 600, tags: ['locations'] }),
      ).resolves.toEqual(CURRENT);

      expect(calls).toHaveLength(2);
      expect(calls[0]?.init.next).toEqual({ revalidate: 600, tags: ['locations'] });
      expect(calls[1]?.init.cache).toBe('no-store');
      expect(calls[1]?.init.next).toBeUndefined();
    });

    it('sends no session cookie on the second ask — the read is still public', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      cookieJar.set('dd_session', 'the-token');
      globalThis.fetch = answers(STALE, CURRENT) as unknown as typeof fetch;

      await apiGetParsed(PublicLocations, '/v1/locations', { revalidate: 600 });

      expect(new Headers(calls[1]?.init.headers).has('cookie')).toBe(false);
    });

    it('still throws when the API itself answers the old shape', async () => {
      globalThis.fetch = answers(STALE, STALE) as unknown as typeof fetch;

      await expect(
        apiGetParsed(PublicLocations, '/v1/locations', { revalidate: 600 }),
      ).rejects.toThrow(/districts\.0\.state/);
      expect(calls).toHaveLength(2);
    });

    it('does not ask twice for a read that was never cached', async () => {
      globalThis.fetch = answers(STALE, CURRENT) as unknown as typeof fetch;

      await expect(
        apiGetParsed(PublicLocations, '/v1/locations', { revalidate: false }),
      ).rejects.toThrow(/districts\.0\.state/);
      expect(calls).toHaveLength(1);
    });
  });
});

/**
 * R99 — what a slow page can be traced by.
 *
 * A call that takes a second or more logs `api.slow_request` with the trace id
 * the API logged it under, so a slow render in the web log can be found next to
 * its `durationMs` / `dbMs` in the API's. Mutations send their own
 * `x-request-id`; reads never do, because Next keys its data cache and its
 * per-render fetch dedupe on the request headers, and a random header on a GET
 * would make every cached read a miss.
 */
describe('request ids and slow calls (R99)', () => {
  function headersOf(call: Captured | undefined): Record<string, string> {
    return (call?.init.headers ?? {}) as Record<string, string>;
  }

  it('sends no request id on a read, so cached and deduped reads keep their keys', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;
    await apiGet('/v1/cities', { revalidate: 60 });

    expect(headersOf(calls[0])['x-request-id']).toBeUndefined();
  });

  it('sends a fresh request id on every mutation', async () => {
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;
    await apiSend('POST', '/v1/dealer/vehicles', { registrationNumber: 'TN23AJ1245' });
    await apiSend('POST', '/v1/dealer/vehicles', { registrationNumber: 'TN23AJ1245' });

    const [first, second] = calls.map((call) => headersOf(call)['x-request-id']);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it('logs a call of a second or more with its route, status, duration and trace id — nothing else', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(1_450);
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-request-id': 'trace-abc' }),
        text: () => Promise.resolve('{}'),
      } as Response),
    );

    await apiGet('/v1/dealer/enquiries?status=NEW', { revalidate: false });

    expect(warn).toHaveBeenCalledWith('api.slow_request', {
      method: 'GET',
      path: '/v1/dealer/enquiries?status=NEW',
      status: 200,
      durationMs: 1_450,
      traceId: 'trace-abc',
    });
    warn.mockRestore();
    clock.mockRestore();
  });

  it('says nothing about a fast call', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = respondWith({}) as unknown as typeof fetch;

    await apiGet('/v1/cities', { revalidate: 60 });

    expect(warn).not.toHaveBeenCalledWith('api.slow_request', expect.anything());
    warn.mockRestore();
  });
});
