import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar } from '../../../setup.js';
import {
  customerPhoneSignInAction,
  customerSignUpAction,
  dealerPhoneSignInAction,
} from '../../../../src/features/auth/sign-in-actions.js';
import { parseSessionCookie } from '../../../../src/lib/session-cookie.js';

/**
 * The Server Actions behind the Login screen (**R63**).
 *
 * A phone sign-in is an API call made from this server, so the session the API
 * issues arrives as a `Set-Cookie` on a response the browser never sees. What
 * these pin is that it reaches the browser anyway — relayed onto this
 * response — and that the first-time customer's sign-up ticket is kept where
 * page script cannot read it.
 */
const ORIGINAL_FETCH = globalThis.fetch;

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function respond(status: number, body: unknown = {}, setCookie: string[] = []): typeof fetch {
  return vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { getSetCookie: () => setCookie },
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

function bodyOf(call: Call | undefined): unknown {
  return typeof call?.init.body === 'string' ? JSON.parse(call.init.body) : null;
}

const SESSION =
  'dd_session=tok-123; Path=/; Expires=Wed, 28 Oct 2026 10:00:00 GMT; HttpOnly; SameSite=Lax';

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('dealerPhoneSignInAction', () => {
  it('posts the proof and relays the session the API issued', async () => {
    globalThis.fetch = respond(200, { next: 'DASHBOARD', returnTo: '/dealer/inventory' }, [
      SESSION,
    ]);

    const result = await dealerPhoneSignInAction('98400 12345', 'token', '/dealer/inventory');

    expect(result).toEqual({ returnTo: '/dealer/inventory' });
    expect(calls[0]?.url).toMatch(/\/v1\/auth\/sign-in\/phone\/dealer$/);
    expect(bodyOf(calls[0])).toEqual({
      phone: '98400 12345',
      accessToken: 'token',
      returnTo: '/dealer/inventory',
    });
    expect(cookieJar.get('dd_session')).toBe('tok-123');
  });

  it('answers the API’s refusal, and relays nothing', async () => {
    globalThis.fetch = respond(422, {
      type: 'about:blank',
      title: 'Unprocessable',
      status: 422,
      code: 'PHONE_VERIFICATION_FAILED',
      detail: 'That code could not be verified. Request a new one and try again.',
    });

    const result = await dealerPhoneSignInAction('9840012345', 'token');

    expect(result.error).toMatch(/could not be verified/);
    expect(cookieJar.has('dd_session')).toBe(false);
  });

  it('refuses a number that is not one, without calling the API', async () => {
    globalThis.fetch = respond(200);

    const result = await dealerPhoneSignInAction('0416224889', 'token');

    expect(result.error).toBeDefined();
    expect(calls).toHaveLength(0);
  });
});

describe('customerPhoneSignInAction', () => {
  it('signs an existing customer in', async () => {
    globalThis.fetch = respond(
      200,
      {
        status: 'SIGNED_IN',
        customer: {
          id: 'c1',
          fullName: 'Ravi',
          phone: '+919840012345',
          phoneDisplay: '+91 98400 12345',
        },
        signUpToken: null,
        expiresAt: null,
        phoneDisplay: '+91 98400 12345',
      },
      [SESSION],
    );

    const result = await customerPhoneSignInAction('9840012345', 'token');

    expect(result).toMatchObject({ status: 'SIGNED_IN', fullName: 'Ravi' });
    expect(cookieJar.get('dd_session')).toBe('tok-123');
    expect(cookieJar.has('dd_signup')).toBe(false);
  });

  /** The ticket goes into an HttpOnly cookie on this domain, never into the page. */
  it('keeps a new customer’s ticket out of the page', async () => {
    globalThis.fetch = respond(200, {
      status: 'NAME_REQUIRED',
      customer: null,
      signUpToken: 'sealed-ticket',
      expiresAt: '2026-09-28T10:10:00.000Z',
      phoneDisplay: '+91 98400 12345',
    });

    const result = await customerPhoneSignInAction('9840012345', 'token');

    expect(result).toEqual({ status: 'NAME_REQUIRED', phoneDisplay: '+91 98400 12345' });
    expect(JSON.stringify(result)).not.toContain('sealed-ticket');
    expect(cookieJar.get('dd_signup')).toBe('sealed-ticket');
    expect(cookieJar.has('dd_session')).toBe(false);
  });
});

describe('customerSignUpAction', () => {
  it('sends the ticket with the name, relays the session, and forgets the ticket', async () => {
    cookieJar.set('dd_signup', 'sealed-ticket');
    globalThis.fetch = respond(
      201,
      {
        customer: {
          id: 'c1',
          fullName: 'Ravi',
          phone: '+919840012345',
          phoneDisplay: '+91 98400 12345',
        },
      },
      [SESSION],
    );

    const result = await customerSignUpAction('  Ravi  ');

    expect(result).toEqual({ done: true });
    expect(bodyOf(calls[0])).toEqual({ signUpToken: 'sealed-ticket', fullName: 'Ravi' });
    expect(cookieJar.get('dd_session')).toBe('tok-123');
    expect(cookieJar.has('dd_signup')).toBe(false);
  });

  it('asks for a name before calling anything', async () => {
    cookieJar.set('dd_signup', 'sealed-ticket');
    globalThis.fetch = respond(201);

    const result = await customerSignUpAction('   ');

    expect(result.fieldError).toBe('Enter your name.');
    expect(calls).toHaveLength(0);
  });

  it('sends the customer back to the number when there is no ticket', async () => {
    globalThis.fetch = respond(201);

    const result = await customerSignUpAction('Ravi');

    expect(result.error).toMatch(/Enter your mobile number again/);
    expect(calls).toHaveLength(0);
  });

  it('forgets a ticket the API says has expired', async () => {
    cookieJar.set('dd_signup', 'old-ticket');
    globalThis.fetch = respond(422, {
      type: 'about:blank',
      title: 'Unprocessable',
      status: 422,
      code: 'SIGN_UP_EXPIRED',
      detail: 'That verification has expired.',
    });

    const result = await customerSignUpAction('Ravi');

    expect(result.error).toMatch(/Enter your mobile number again/);
    expect(cookieJar.has('dd_signup')).toBe(false);
  });
});

describe('parseSessionCookie', () => {
  it('carries the attributes the API set', () => {
    const parsed = parseSessionCookie([
      'other=1; Path=/',
      'dd_session=abc; Domain=.dealers-drive.in; Path=/; Expires=Wed, 28 Oct 2026 10:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    ]);

    expect(parsed).toEqual({
      value: 'abc',
      domain: '.dealers-drive.in',
      path: '/',
      secure: true,
      expires: new Date('2026-10-28T10:00:00.000Z'),
    });
  });

  it('finds nothing when there is no session cookie', () => {
    expect(parseSessionCookie(['dd_oauth=x; Path=/'])).toBeNull();
    expect(parseSessionCookie(['dd_session=; Path=/'])).toBeNull();
  });
});
