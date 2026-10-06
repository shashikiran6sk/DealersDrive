import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  claimDealershipAction,
  confirmClaimEmailAction,
} from '../../../../src/features/claim/claim-actions.js';
import { cookieJar } from '../../../setup';

const ORIGINAL_FETCH = globalThis.fetch;
const TOKEN = 'b'.repeat(43);

function respond(status: number, body: unknown = {}, setCookie: string[] = []): typeof fetch {
  const reply = {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { getSetCookie: () => setCookie },
  } as unknown as Response;
  return vi.fn(() => Promise.resolve(reply));
}

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', 'http://api.test');
  cookieJar.clear();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe('confirmClaimEmailAction', () => {
  it('refuses a malformed token without calling the API', async () => {
    globalThis.fetch = respond(200);
    expect((await confirmClaimEmailAction('short')).error).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns the new state, or the API’s words', async () => {
    globalThis.fetch = respond(200, { state: 'AWAITING_CLAIM' });
    expect((await confirmClaimEmailAction(TOKEN)).preview?.state).toBe('AWAITING_CLAIM');

    globalThis.fetch = respond(409, {
      status: 409,
      code: 'CLAIM_LINK_EXPIRED',
      title: 'Conflict',
      detail: 'This link has expired.',
    });
    expect(await confirmClaimEmailAction(TOKEN)).toEqual({ error: 'This link has expired.' });
  });
});

describe('claimDealershipAction', () => {
  it('relays the new session cookie and returns where to go', async () => {
    globalThis.fetch = respond(200, { dealerId: 'd-1', returnTo: '/dealer' }, [
      'dd_session=abc123; Path=/; HttpOnly; SameSite=Lax',
    ]);
    const result = await claimDealershipAction(TOKEN, '9840012345', 'token');
    expect(result).toEqual({ verified: true, returnTo: '/dealer' });
    expect(cookieJar.get('dd_session')).toBe('abc123');
  });

  it('answers a refusal without setting a cookie', async () => {
    globalThis.fetch = respond(403, {
      status: 403,
      code: 'CLAIM_PHONE_MISMATCH',
      title: 'Forbidden',
      detail: 'That is not the mobile number this dealership was registered with.',
    });
    const result = await claimDealershipAction(TOKEN, '9840012345', 'token');
    expect(result.error).toContain('not the mobile number');
    expect(cookieJar.has('dd_session')).toBe(false);
  });
});
