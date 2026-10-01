import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar } from '../../../setup.js';
import {
  customerAccountAction,
  customerLogoutAction,
  enterWorkspaceAction,
} from '../../../../src/features/auth/customer-account-actions.js';

/**
 * The header's two Server Actions (**R67**). Every public page renders the
 * header, so the account check must cost nothing for somebody with no session
 * and must never break the page; logout must end the session even when the
 * API cannot be reached.
 */
const ORIGINAL_FETCH = globalThis.fetch;

let urls: string[] = [];

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn((url: string) => {
    urls.push(url);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { getSetCookie: () => [] },
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  urls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('customerAccountAction', () => {
  it('asks nothing of the API when there is no session cookie', async () => {
    globalThis.fetch = respond(200);

    await expect(customerAccountAction()).resolves.toBeNull();
    expect(urls).toEqual([]);
  });

  it('answers the signed-in customer’s name and masked number, never the number itself', async () => {
    cookieJar.set('dd_session', 'session-token');
    globalThis.fetch = respond(200, {
      customer: {
        id: '00000000-0000-4000-8000-000000000001',
        fullName: 'Asha Menon',
        phone: '+919840012345',
        phoneDisplay: '+91 98400 12345',
      },
    });

    await expect(customerAccountAction()).resolves.toEqual({
      fullName: 'Asha Menon',
      phoneMasked: '+91 98XXXXXX45',
      workspaces: [],
    });
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\/v1\/auth\/customer\/me$/),
        expect.stringMatching(/\/v1\/auth\/workspaces$/),
      ]),
    );
  });

  it.each([
    ['a session that is not a customer’s', 401],
    ['an API that is down', 503],
  ])('answers null, never an error, for %s', async (_label, status) => {
    cookieJar.set('dd_session', 'session-token');
    globalThis.fetch = respond(status, { status, code: 'X', title: 'X', type: 'about:blank' });

    await expect(customerAccountAction()).resolves.toBeNull();
  });
});

describe('the dealerships in the account (R93)', () => {
  it('carries each membership, never asking twice for the account', async () => {
    cookieJar.set('dd_session', 'session-token');
    globalThis.fetch = vi.fn((url: string) => {
      urls.push(url);
      const body = url.endsWith('/workspaces')
        ? {
            data: [
              {
                membershipId: '00000000-0000-4000-8000-0000000000a1',
                dealer: {
                  id: '00000000-0000-4000-8000-0000000000d1',
                  slug: 'abc-motors',
                  brandName: 'ABC Motors',
                  status: 'ACTIVE',
                },
                role: 'MANAGER',
                roleLabel: 'Manager',
                enterable: true,
                current: true,
              },
            ],
          }
        : {
            customer: {
              id: '00000000-0000-4000-8000-000000000001',
              fullName: 'Arun Kumar',
              phone: '+919840012345',
              phoneDisplay: '+91 98400 12345',
            },
          };
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(body)),
        headers: { getSetCookie: () => [] },
      } as unknown as Response);
    }) as unknown as typeof fetch;

    const account = await customerAccountAction();
    expect(account?.workspaces).toEqual([
      {
        membershipId: '00000000-0000-4000-8000-0000000000a1',
        brandName: 'ABC Motors',
        roleLabel: 'Manager',
        enterable: true,
        current: true,
      },
    ]);
    expect(urls).toHaveLength(2);
  });

  it('chooses a dealership by membership and opens the console', async () => {
    cookieJar.set('dd_session', 'session-token');
    const sent: { url: string; body: unknown }[] = [];
    globalThis.fetch = vi.fn((url: string, init?: RequestInit) => {
      sent.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ data: [] })),
        headers: { getSetCookie: () => [] },
      } as unknown as Response);
    }) as unknown as typeof fetch;

    await expect(enterWorkspaceAction('m-1')).rejects.toThrow(/\/dealer/);
    expect(sent[0]?.url).toMatch(/\/v1\/auth\/workspaces\/current$/);
    expect(sent[0]?.body).toEqual({ membershipId: 'm-1' });
  });
});

describe('customerLogoutAction', () => {
  it('ends the session at the API and drops the cookie', async () => {
    cookieJar.set('dd_session', 'session-token');
    globalThis.fetch = respond(204);

    await customerLogoutAction();

    expect(urls[0]).toMatch(/\/v1\/auth\/customer\/logout$/);
    expect(cookieJar.has('dd_session')).toBe(false);
  });

  it('drops the cookie even when the API cannot be reached', async () => {
    cookieJar.set('dd_session', 'session-token');
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('down')));

    await customerLogoutAction();

    expect(cookieJar.has('dd_session')).toBe(false);
  });
});
