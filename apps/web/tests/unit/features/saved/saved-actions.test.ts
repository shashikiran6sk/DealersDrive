import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar, revalidations } from '../../../setup.js';
import { savedSlugsAction, setSavedAction } from '../../../../src/features/saved/actions.js';

/**
 * The Server Actions behind every heart (**R75**). The customer is the session
 * cookie this server forwards; without one, nothing is asked of the API.
 */
const ORIGINAL_FETCH = globalThis.fetch;

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { getSetCookie: () => [] },
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
  cookieJar.set('dd_session', 'session-token');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  cookieJar.clear();
});

describe('savedSlugsAction', () => {
  it('reads the saved slugs for a signed-in customer', async () => {
    globalThis.fetch = respond(200, { slugs: ['a', 'b'] });
    await expect(savedSlugsAction()).resolves.toEqual({ status: 'customer', slugs: ['a', 'b'] });
    expect(calls[0]?.url).toMatch(/\/v1\/saved-vehicles\/slugs$/);
  });

  it('asks nothing without a session cookie', async () => {
    cookieJar.clear();
    globalThis.fetch = respond(200, { slugs: [] });
    await expect(savedSlugsAction()).resolves.toEqual({ status: 'anonymous' });
    expect(calls).toHaveLength(0);
  });

  it('treats an expired session as signed out, and an outage as unknown', async () => {
    globalThis.fetch = respond(401, {
      status: 401,
      code: 'UNAUTHENTICATED',
      title: 'x',
      type: 'x',
    });
    await expect(savedSlugsAction()).resolves.toEqual({ status: 'anonymous' });
    globalThis.fetch = respond(503, { status: 503, code: 'DOWN', title: 'x', type: 'x' });
    await expect(savedSlugsAction()).resolves.toEqual({ status: 'unknown' });
  });
});

describe('setSavedAction', () => {
  it('saves with a PUT to the car’s slug, and redraws the Saved cars page', async () => {
    globalThis.fetch = respond(200, { slug: 'a-car', saved: true });
    await expect(setSavedAction('a-car', true)).resolves.toEqual({ status: 'ok', saved: true });
    expect(calls[0]?.url).toMatch(/\/v1\/saved-vehicles\/a-car$/);
    expect(calls[0]?.init.method).toBe('PUT');
    expect(revalidations.paths).toEqual(['/saved']);
  });

  it('removes with a DELETE', async () => {
    globalThis.fetch = respond(200, { slug: 'a-car', saved: false });
    await expect(setSavedAction('a-car', false)).resolves.toEqual({ status: 'ok', saved: false });
    expect(calls[0]?.init.method).toBe('DELETE');
  });

  it('refuses a slug that is not a slug before calling anything', async () => {
    globalThis.fetch = respond(200);
    const result = await setSavedAction('Not A Slug', true);
    expect(result.status).toBe('refused');
    expect(calls).toHaveLength(0);
  });

  it('says signed-out without a cookie, or on a 401', async () => {
    cookieJar.clear();
    globalThis.fetch = respond(200);
    await expect(setSavedAction('a-car', true)).resolves.toEqual({ status: 'signed-out' });
    expect(calls).toHaveLength(0);

    cookieJar.set('dd_session', 'expired');
    globalThis.fetch = respond(401, {
      status: 401,
      code: 'UNAUTHENTICATED',
      title: 'x',
      type: 'x',
    });
    await expect(setSavedAction('a-car', true)).resolves.toEqual({ status: 'signed-out' });
  });

  it('passes the API’s refusal on', async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'LISTING_NOT_SAVEABLE',
      detail: 'This car is no longer on the marketplace, so it cannot be saved.',
    });
    await expect(setSavedAction('a-car', true)).resolves.toEqual({
      status: 'refused',
      message: 'This car is no longer on the marketplace, so it cannot be saved.',
    });
    expect(revalidations.paths).toEqual([]);
  });
});
