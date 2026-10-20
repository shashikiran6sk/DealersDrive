import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_ACCOUNT_TEXT } from '@dealers-drive/contracts';
import { cookieJar } from '../../setup';
import {
  deactivateCustomerAction,
  requestCustomerDeletionAction,
} from '../../../src/features/account/account-actions';
import {
  customerPhoneSignInAction,
  customerReactivateAction,
} from '../../../src/features/auth/sign-in-actions';

const originalFetch = globalThis.fetch;
const one = '11111111-1111-4111-8111-111111111111';
const two = '22222222-2222-4222-8222-222222222222';
const profile = {
  id: one,
  fullName: 'Account Customer',
  phone: '+919556600001',
  phoneDisplay: '+91 95566 00001',
};
let calls: { url: string; body: unknown }[] = [];
function response(body: unknown, status = 200, setCookie: string[] = []): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { getSetCookie: () => setCookie },
  } as unknown as Response;
}
function fetcher(route: (url: string, body: unknown) => Response): typeof fetch {
  return vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
    calls.push({ url, body });
    return Promise.resolve(route(url, body));
  });
}
beforeEach(() => {
  calls = [];
  cookieJar.set('dd_session', 'customer-cookie');
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
describe('owned account action boundaries', () => {
  it('rejects missing affirmation and a stale account before any mutation', async () => {
    globalThis.fetch = fetcher(() => response({ customer: profile }));
    expect((await deactivateCustomerAction(false, one)).done).toBeUndefined();
    expect(calls).toHaveLength(0);
    expect((await deactivateCustomerAction(true, two)).error).toBe(
      CUSTOMER_ACCOUNT_TEXT.changedAccount,
    );
    expect(calls).toHaveLength(1);
    const deleted = await requestCustomerDeletionAction({
      confirmed: true,
      message: '',
      clientRequestId: one,
      expectedAccountId: two,
    });
    expect(deleted.error).toBe(CUSTOMER_ACCOUNT_TEXT.changedAccount);
    expect(calls.every((call) => call.url.endsWith('/customer/me'))).toBe(true);
  });
  it('clears only the person cookie after a validated deactivation receipt', async () => {
    cookieJar.set('dd_admin_session', 'retained-admin-cookie');
    globalThis.fetch = fetcher((url) =>
      response(url.endsWith('/customer/me') ? { customer: profile } : { deactivated: true }),
    );
    expect(await deactivateCustomerAction(true, one)).toEqual({ done: true });
    expect(cookieJar.has('dd_session')).toBe(false);
    expect(cookieJar.get('dd_admin_session')).toBe('retained-admin-cookie');
    expect(calls[1]?.body).toEqual({ confirmed: true });
  });
  it('never reports success or clears a cookie for a malformed receipt', async () => {
    globalThis.fetch = fetcher((url) =>
      response(url.endsWith('/customer/me') ? { customer: profile } : { deactivated: false }),
    );
    expect((await deactivateCustomerAction(true, one)).done).toBeUndefined();
    expect(cookieJar.get('dd_session')).toBe('customer-cookie');
  });
  it('keeps the reactivation proof out of client state and requires the matching server-cookie flow', async () => {
    globalThis.fetch = fetcher(() =>
      response({
        status: 'REACTIVATION_REQUIRED',
        customer: null,
        signUpToken: null,
        reactivationToken: 'private-confirmation-ticket',
        reactivationName: profile.fullName,
        expiresAt: '2030-01-01T00:00:00.000Z',
        phoneDisplay: profile.phoneDisplay,
      }),
    );
    const state = await customerPhoneSignInAction('9556600001', 'fake-provider-proof');
    expect(state.status).toBe('REACTIVATION_REQUIRED');
    expect(JSON.stringify(state)).not.toContain('private-confirmation-ticket');
    expect(cookieJar.has('dd_session')).toBe(false);
    expect(cookieJar.get('dd_customer_reactivation')).toContain('private-confirmation-ticket');
    const before = calls.length;
    expect((await customerReactivateAction(two)).done).toBeUndefined();
    expect(calls).toHaveLength(before);
    globalThis.fetch = fetcher(() =>
      response({ customer: profile }, 200, [
        'dd_session=new-customer-token; Path=/; HttpOnly; SameSite=Lax',
      ]),
    );
    if (!state.reactivationId) throw new Error('Missing flow id');
    expect(await customerReactivateAction(state.reactivationId)).toEqual({ done: true });
    expect(cookieJar.has('dd_customer_reactivation')).toBe(false);
    expect(cookieJar.get('dd_session')).toBe('new-customer-token');
  });
  it('does not resume a reactivation flow after a different sign-in has established a cookie', async () => {
    cookieJar.set(
      'dd_customer_reactivation',
      JSON.stringify({ flowId: one, token: 'private-ticket' }),
    );
    globalThis.fetch = fetcher(() => response({ customer: profile }));
    expect((await customerReactivateAction(one)).done).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});
