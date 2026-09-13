import { describe, expect, it, vi } from 'vitest';

import { createMsg91PhoneOtp } from '../../../../src/platform/phone-otp/msg91.adapter.js';

/**
 * R39 — the MSG91 widget's server-side check, against a stubbed `fetch`.
 *
 * The request shape is asserted because it is the whole integration: one
 * `POST` carrying the auth key and the browser's token. The *response*
 * handling is asserted harder, because MSG91 does not publish this body and
 * the shape reported in the wild varies — so the adapter looks for the
 * identifier in the response and then in the token, and treats "verified, but
 * for nobody we can name" as a refusal rather than a success.
 */
function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

describe('the MSG91 phone-OTP adapter', () => {
  it('posts the token and the auth key to the widget endpoint', async () => {
    const fetchImpl = respond({ type: 'success', message: '919840012345' });
    await createMsg91PhoneOtp(fetchImpl).identify('token-1');

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe('https://control.msg91.com/api/v5/widget/verifyAccessToken');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toEqual({
      authkey: expect.any(String),
      'access-token': 'token-1',
    });
  });

  it('reads the identifier out of the response when it carries one', async () => {
    const otp = createMsg91PhoneOtp(respond({ type: 'success', message: '919840012345' }));
    await expect(otp.identify('token')).resolves.toEqual({
      status: 'VERIFIED',
      identifier: '919840012345',
    });
  });

  /**
   * The second place to look, and safe **only in this order**: the signature
   * has already been checked by the call above, so the payload being read is
   * one MSG91 issued. A forged token never gets here.
   */
  it('falls back to the token’s own claim when the response is a bare acknowledgement', async () => {
    const otp = createMsg91PhoneOtp(respond({ type: 'success', message: 'Token verified' }));
    await expect(otp.identify(jwt({ identifier: '919840012345' }))).resolves.toEqual({
      status: 'VERIFIED',
      identifier: '919840012345',
    });
  });

  it('accepts the identifier with a leading plus, normalised', async () => {
    const otp = createMsg91PhoneOtp(respond({ type: 'success', mobile: '+919840012345' }));
    await expect(otp.identify('token')).resolves.toEqual({
      status: 'VERIFIED',
      identifier: '919840012345',
    });
  });

  /** Accepting this would be accepting any valid token for any number. */
  it('refuses a verification that names nobody', async () => {
    const otp = createMsg91PhoneOtp(respond({ type: 'success', message: 'Token verified' }));
    await expect(otp.identify('opaque-token')).resolves.toMatchObject({ status: 'REJECTED' });
  });

  it('refuses what the provider refuses', async () => {
    const otp = createMsg91PhoneOtp(respond({ type: 'error', message: 'Invalid token' }, 400));
    await expect(otp.identify('token')).resolves.toMatchObject({ status: 'REJECTED' });
  });

  it('does not return the provider’s words to the caller', async () => {
    const otp = createMsg91PhoneOtp(respond({ type: 'error', message: 'widget 123 not found' }));
    const verdict = await otp.identify('token');

    expect(verdict.status).toBe('REJECTED');
    expect(JSON.stringify(verdict)).not.toContain('widget 123');
  });

  /**
   * Distinct from a refusal on purpose. Collapsing them would tell a dealer
   * their code was wrong during a vendor outage and send them round the resend
   * loop spending SMS against a provider that is down.
   */
  it('answers UNAVAILABLE when MSG91 cannot be reached', async () => {
    const otp = createMsg91PhoneOtp(
      vi.fn<typeof fetch>(() => Promise.reject(new Error('ECONNRESET'))),
    );

    await expect(otp.identify('token')).resolves.toEqual({ status: 'UNAVAILABLE' });
  });

  it.each([
    ['a token that is not a JWT at all', 'opaque'],
    ['a JWT whose payload is not base64', 'aaa.!!!!.bbb'],
    ['a JWT whose payload is not an object', 'aaa.WyJhIl0.bbb'],
  ])('refuses %s when the response names nobody', async (_label, token) => {
    const otp = createMsg91PhoneOtp(respond({ type: 'success', message: 'Token verified' }));
    await expect(otp.identify(token)).resolves.toMatchObject({ status: 'REJECTED' });
  });

  /** Some accounts answer with the number as a JSON number rather than a string. */
  it('accepts an identifier that arrives as a number', async () => {
    const otp = createMsg91PhoneOtp(respond({ type: 'success', mobile: 919840012345 }));
    await expect(otp.identify('token')).resolves.toEqual({
      status: 'VERIFIED',
      identifier: '919840012345',
    });
  });

  it('treats an unreadable body as a refusal rather than a crash', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('<html>gateway</html>', { status: 502 })),
    );

    await expect(createMsg91PhoneOtp(fetchImpl).identify('token')).resolves.toMatchObject({
      status: 'REJECTED',
    });
  });
});
