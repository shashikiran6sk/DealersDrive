import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar } from '../../setup.js';
import {
  currentAdmin,
  currentSession,
  destinationFor,
  hasSession,
} from '../../../src/lib/session.js';

/**
 * Who the request belongs to, asked two different ways — and the difference
 * between them is a redirect loop.
 *
 * `hasSession` reads the cookie jar and answers "there is a cookie". That is
 * not an authorization check and nothing may be shown on the strength of it.
 * `currentSession` asks the API, which is the only thing that can say whether
 * the cookie still *works*. The sign-in screens ask the second question,
 * because a stale cookie answering the first one would bounce a person between
 * sign-in and a console that refuses them, forever.
 */
const ORIGINAL_FETCH = globalThis.fetch;

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response),
  );
}

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', 'http://api.test');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe('hasSession', () => {
  it('is true when a cookie is present', async () => {
    cookieJar.set('dd_session', 'anything');

    expect(await hasSession()).toBe(true);
  });

  it('is false when it is not', async () => {
    expect(await hasSession()).toBe(false);
  });
});

describe('currentSession', () => {
  it('returns the session the API recognises', async () => {
    globalThis.fetch = respond(200, { next: 'DASHBOARD', dealer: { slug: 'x' } });

    expect(await currentSession()).toMatchObject({ next: 'DASHBOARD' });
  });

  /** The case that breaks the loop: a cookie that exists and no longer works. */
  it('returns null for a session the API rejects', async () => {
    cookieJar.set('dd_session', 'stale');
    globalThis.fetch = respond(401, { status: 401, code: 'NOT_AUTHENTICATED', title: 'no' });

    expect(await currentSession()).toBeNull();
  });

  /** An API that is down is not the same as a person who is signed out. */
  it('lets any other failure through', async () => {
    globalThis.fetch = respond(500, { status: 500, code: 'INTERNAL', title: 'boom' });

    await expect(currentSession()).rejects.toThrow();
  });
});

describe('currentAdmin', () => {
  it('returns the overview when the admin session is live', async () => {
    globalThis.fetch = respond(200, { operator: { email: 'ops@dealers-drive.in' } });

    expect(await currentAdmin()).toMatchObject({ operator: { email: 'ops@dealers-drive.in' } });
  });

  it('returns null when it is not', async () => {
    globalThis.fetch = respond(401, { status: 401, code: 'NOT_AUTHENTICATED', title: 'no' });

    expect(await currentAdmin()).toBeNull();
  });

  it('lets any other failure through', async () => {
    globalThis.fetch = respond(503, { status: 503, code: 'NOT_CONFIGURED', title: 'nope' });

    await expect(currentAdmin()).rejects.toThrow();
  });
});

describe('destinationFor', () => {
  it('sends an unfinished sign-up to onboarding', () => {
    expect(destinationFor({ next: 'ONBOARDING' } as never)).toBe('/dealer/onboarding');
  });

  it.each(['DASHBOARD', 'PENDING_APPROVAL'] as const)('sends %s to the console', (next) => {
    expect(destinationFor({ next } as never)).toBe('/dealer');
  });
});
