import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieJar } from '../../../setup.js';
import {
  startAdminPhoneChallenge,
  verifyAdminPhone,
  revokeAdminPhone,
} from '@/features/auth/admin-phone/actions';

const originalFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];
const input = {
  challengeId: '11111111-1111-4111-8111-111111111111',
  browserToken: 'a'.repeat(43),
  accessToken: 'controlled-proof',
};
function respond(status: number, body: unknown, setCookie: string[] = []) {
  globalThis.fetch = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: setCookie.length ? { 'Set-Cookie': setCookie[0] ?? '' } : {},
      }),
    );
  }) as unknown as typeof fetch;
}
beforeEach(() => {
  calls = [];
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
describe('admin mobile server actions', () => {
  it.each(['LOGIN', 'ENROLL'] as const)(
    'starts %s with a trusted Origin and the right cookie scope',
    async (mode) => {
      cookieJar.set('dd_session', 'person');
      cookieJar.set('dd_admin_session', 'admin');
      const challenge = {
        ...input,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        resendAfterSeconds: 60,
      };
      respond(200, challenge);
      expect((await startAdminPhoneChallenge(mode, '9000001234')).challenge).toEqual(challenge);
      expect(calls[0]?.url).toContain(
        mode === 'LOGIN'
          ? '/v1/auth/admin/phone/challenge'
          : '/v1/admin/profile/security/phone/challenge',
      );
      expect(new Headers(calls[0]?.init.headers).get('Origin')).toBeTruthy();
      expect(new Headers(calls[0]?.init.headers).get('Cookie')).toBe('dd_admin_session=admin');
    },
  );
  it('rejects malformed challenge and verification input without API calls', async () => {
    respond(200, {});
    expect((await startAdminPhoneChallenge('LOGIN', 'invalid')).error).toBeDefined();
    expect((await verifyAdminPhone('LOGIN', { ...input, userId: 'forged' })).error).toBeDefined();
    expect(calls).toHaveLength(0);
  });
  it('relays only the admin session and preserves person cookies and hints', async () => {
    cookieJar.set('dd_session', 'person');
    cookieJar.set('dd_auth', '0');
    respond(200, { returnTo: '/admin' }, [
      'dd_admin_session=rotated-admin; HttpOnly; SameSite=Lax; Path=/; Secure',
    ]);
    await expect(verifyAdminPhone('LOGIN', input)).rejects.toThrow('NEXT_REDIRECT:/admin');
    expect(cookieJar.get('dd_admin_session')).toBe('rotated-admin');
    expect(cookieJar.get('dd_session')).toBe('person');
    expect(cookieJar.get('dd_auth')).toBe('0');
  });
  it('refuses a successful response carrying only a person cookie', async () => {
    respond(200, {}, ['dd_session=person; HttpOnly; Path=/']);
    expect((await verifyAdminPhone('LOGIN', input)).error).toMatch(
      /session could not be established/,
    );
    expect(cookieJar.has('dd_admin_session')).toBe(false);
  });
  it('does not set sessions during enrollment', async () => {
    respond(200, { linked: true });
    expect(await verifyAdminPhone('ENROLL', input)).toEqual({});
    expect(cookieJar.has('dd_admin_session')).toBe(false);
  });
  it('shows a generic outage and relays no credentials after failure', async () => {
    respond(503, {
      code: 'PHONE_OTP_UNAVAILABLE',
      detail: 'provider private error',
      title: 'Unavailable',
      status: 503,
    });
    const result = await verifyAdminPhone('LOGIN', input);
    expect(result.error).not.toContain('private');
    expect(cookieJar.has('dd_admin_session')).toBe(false);
  });
  it('requires explicit revocation confirmation before making a request', async () => {
    respond(200, {});
    await revokeAdminPhone(new FormData());
    expect(calls).toHaveLength(0);
  });
});
