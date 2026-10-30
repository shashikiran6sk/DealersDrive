import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar } from '../../setup.js';
import {
  currentAdmin,
  currentCustomerSession,
  currentSession,
  destinationFor,
  hasSession,
  isConsoleRefusal,
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

describe('currentCustomerSession', () => {
  it('does not ask the API when the browser has no person session', async () => {
    const fetch = respond(200);
    globalThis.fetch = fetch;

    expect(await currentCustomerSession()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('recognises a verified customer using the existing shared session', async () => {
    cookieJar.set('dd_session', 'verified-dealer-or-customer');
    const customer = {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Asha Menon',
      phone: '+919840012345',
      phoneDisplay: '+91 98400 12345',
    };
    const fetch = respond(200, { customer });
    globalThis.fetch = fetch;

    expect(await currentCustomerSession()).toEqual({ customer });
    const [url, options] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/auth/customer/me');
    expect(options?.cache).toBe('no-store');
    expect(options?.headers).toMatchObject({ Cookie: 'dd_session=verified-dealer-or-customer' });
    expect(cookieJar.get('dd_session')).toBe('verified-dealer-or-customer');
  });

  it('returns null for an incomplete Google dealer or an expired session', async () => {
    cookieJar.set('dd_session', 'google-dealer');
    globalThis.fetch = respond(401, { status: 401, code: 'NOT_AUTHENTICATED' });

    expect(await currentCustomerSession()).toBeNull();
    expect(cookieJar.get('dd_session')).toBe('google-dealer');
  });

  it('rejects a dealer response that is missing the customer contract', async () => {
    cookieJar.set('dd_session', 'google-dealer');
    globalThis.fetch = respond(200, { next: 'ONBOARDING', user: { fullName: 'Google Dealer' } });

    await expect(currentCustomerSession()).rejects.toThrow();
  });

  it('does not mistake a service outage for an incomplete account', async () => {
    cookieJar.set('dd_session', 'verified-customer');
    globalThis.fetch = respond(503, { status: 503, code: 'SERVICE_UNAVAILABLE' });

    await expect(currentCustomerSession()).rejects.toThrow();
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

  /**
   * A Sales Representative has a live operations session but no console. The
   * sign-in page must render for them rather than throw — otherwise the page
   * that explains the refusal is the page that crashes on it.
   */
  it('returns null for a member whose role has no console', async () => {
    globalThis.fetch = respond(403, {
      status: 403,
      code: 'ADMIN_CONSOLE_FORBIDDEN',
      title: 'Forbidden',
    });

    expect(await currentAdmin()).toBeNull();
  });

  it('still lets an ordinary 403 through', async () => {
    globalThis.fetch = respond(403, { status: 403, code: 'FORBIDDEN', title: 'Forbidden' });

    await expect(currentAdmin()).rejects.toThrow();
    expect(isConsoleRefusal(new Error('plain'))).toBe(false);
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
