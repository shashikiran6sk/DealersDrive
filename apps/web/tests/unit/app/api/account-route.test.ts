import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieJar } from '../../../setup';

import type { CustomerAccountLookup } from '@/features/auth/customer-account';

/**
 * `GET /api/account` — the header's one question, asked after the page has
 * painted. It replaces a Server Action call: a GET is not queued behind the
 * router's other actions, can be cancelled, and is never cached. Each answer
 * also refreshes the readable `dd_auth` hint the next page paints from; an
 * outage answers 503 and leaves the hint alone, because "the API is down" is
 * not "signed out".
 */
const lookup = vi.hoisted(() => vi.fn<() => Promise<CustomerAccountLookup>>());

vi.mock('@/features/auth/customer-account', () => ({ lookupCustomerAccount: lookup }));

const { GET } = await import('@/app/api/account/route');

const ASHA = {
  fullName: 'Asha Menon',
  phoneMasked: '+91 98XXXXXX12',
  workspaces: [],
  invitations: 0,
};

beforeEach(() => {
  lookup.mockReset();
  cookieJar.delete('dd_auth');
});

describe('GET /api/account', () => {
  it('answers the signed-in account, privately, and marks the browser signed in', async () => {
    lookup.mockResolvedValue({ status: 'signed-in', account: ASHA });
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ status: 'signed-in', account: ASHA });
    expect(cookieJar.get('dd_auth')).toBe('1');
  });

  it('answers signed-out and marks the browser signed out', async () => {
    lookup.mockResolvedValue({ status: 'signed-out' });
    const response = await GET();

    expect(await response.json()).toEqual({ status: 'signed-out' });
    expect(cookieJar.get('dd_auth')).toBe('0');
  });

  it('answers 503 when it cannot tell, and does not touch the hint', async () => {
    cookieJar.set('dd_auth', '1');
    lookup.mockResolvedValue({ status: 'unavailable' });
    const response = await GET();

    expect(response.status).toBe(503);
    expect(cookieJar.get('dd_auth')).toBe('1');
  });
});
