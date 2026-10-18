import type * as EnvModule from '../../../../src/config/env.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../../src/config/env.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import type { CustomerAuthService } from '../../../../src/modules/auth/customer-auth.service.js';
import { createNativeAuthService } from '../../../../src/modules/auth/native-auth.service.js';
import {
  issueNativeChallenge,
  openNativeChallenge,
} from '../../../../src/modules/auth/native-otp-challenge.js';

const ORIGINAL = {
  NATIVE_CUSTOMER_AUTH_ENABLED: env.NATIVE_CUSTOMER_AUTH_ENABLED,
  APP_ENV: env.APP_ENV,
  PHONE_OTP_DRIVER: env.PHONE_OTP_DRIVER,
};
const PHONE = '+919845599999';
const NOW = Date.UTC(2026, 9, 14, 13, 0);

function harness() {
  env.NATIVE_CUSTOMER_AUTH_ENABLED = true;
  const cache = createMemoryCache();
  const signIn = vi.fn().mockResolvedValue({
    status: 'NAME_REQUIRED',
    signUpToken: 'signed-name-ticket',
    expiresAt: new Date(NOW + 600_000).toISOString(),
    phoneDisplay: 'verified number',
    customer: null,
    session: null,
  });
  const customers = { signIn } as unknown as CustomerAuthService;
  const widget = {
    send: vi.fn().mockResolvedValue('request-id'),
    resend: vi.fn().mockResolvedValue('request-id'),
    verify: vi.fn().mockResolvedValue('verified.jwt.token'),
  };
  const ready = vi.fn().mockResolvedValue(false);
  return {
    cache,
    signIn,
    widget,
    ready,
    service: createNativeAuthService({ cache, customers, widget, productionReady: ready }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.assign(env, ORIGINAL);
});

describe('native challenge and login controls', () => {
  it('mediates real widget request/resend/verify and reuses the existing customer sign-in service', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const h = harness();
    env.PHONE_OTP_DRIVER = 'msg91';
    const first = await h.service.request(PHONE, 'one-ip');
    expect(h.widget.send).toHaveBeenCalledWith(PHONE);
    vi.advanceTimersByTime(60_001);
    h.widget.resend.mockResolvedValueOnce('new-request');
    const retry = await h.service.resend(first.challenge, 'one-ip');
    expect(openNativeChallenge(retry.challenge).reqId).toBe('new-request');
    expect(retry.expiresAt).toBe(first.expiresAt);
    await h.service.verify(retry.challenge, '123456');
    expect(h.widget.verify).toHaveBeenCalledWith('new-request', '123456');
    expect(h.signIn).toHaveBeenCalledWith(
      { phone: PHONE, accessToken: 'verified.jwt.token' },
      { native: true },
    );
  });
  it('caps requests by IP and verified number even when the generic limiter is disabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const h = harness();
    for (let i = 0; i < 20; i++)
      await h.service.request(`+9198455${String(i).padStart(5, '0')}`, 'one-ip');
    await expect(h.service.request('+919845500099', 'one-ip')).rejects.toMatchObject({
      status: 429,
    });
    const number = harness();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(60_001);
      await number.service.request(PHONE, 'another-ip');
    }
    vi.advanceTimersByTime(60_001);
    await expect(number.service.request(PHONE, 'another-ip')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('binds phone and provider request, refusing tamper, expiry and future tickets', () => {
    const token = issueNativeChallenge(PHONE, 'req-id', NOW);
    expect(openNativeChallenge(token, NOW + 1)).toMatchObject({ phone: PHONE, reqId: 'req-id' });
    expect(() => openNativeChallenge(token + 'x', NOW)).toThrow();
    expect(() => openNativeChallenge(token, NOW - 1)).toThrow();
    expect(() => openNativeChallenge(token, NOW + 600_000)).toThrow();
    expect(() => openNativeChallenge('bad.token.extra', NOW)).toThrow();
    expect(() =>
      openNativeChallenge(issueNativeChallenge('not-a-phone', 'request', NOW), NOW),
    ).toThrow();
  });
  it('does not call a provider or expose credentials under the development fake', async () => {
    const h = harness();
    const challenge = await h.service.request(PHONE, 'test-ip');
    expect(challenge).toMatchObject({ phoneDisplay: '+91 98455 99999' });
    expect(h.widget.send).not.toHaveBeenCalled();
    const result = await h.service.verify(challenge.challenge, env.PHONE_OTP_DEV_CODE);
    expect(result.status).toBe('NAME_REQUIRED');
    expect(h.signIn).toHaveBeenCalledWith(expect.objectContaining({ phone: PHONE }), {
      native: true,
    });
    await expect(
      h.service.verify(challenge.challenge, env.PHONE_OTP_DEV_CODE),
    ).rejects.toMatchObject({ code: 'NATIVE_OTP_EXPIRED' });
    expect(h.signIn).toHaveBeenCalledTimes(1);
  });
  it('allows one successful continuation even for concurrent repeated verification', async () => {
    const h = harness();
    const challenge = await h.service.request(PHONE);
    const outcomes = await Promise.allSettled([
      h.service.verify(challenge.challenge, env.PHONE_OTP_DEV_CODE),
      h.service.verify(challenge.challenge, env.PHONE_OTP_DEV_CODE),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(h.signIn).toHaveBeenCalledTimes(1);
  });
  it('enforces the retry cooldown, five attempts and fixed challenge expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const h = harness();
    const challenge = await h.service.request(PHONE);
    await expect(h.service.resend(challenge.challenge)).rejects.toMatchObject({ status: 429 });
    vi.advanceTimersByTime(60_001);
    const resend = await h.service.resend(challenge.challenge);
    expect(resend.expiresAt).toBe(challenge.expiresAt);
    for (let i = 0; i < 5; i++)
      await expect(h.service.verify(challenge.challenge, '000000')).rejects.toMatchObject({
        code: 'NATIVE_OTP_INVALID',
      });
    await expect(
      h.service.verify(challenge.challenge, env.PHONE_OTP_DEV_CODE),
    ).rejects.toMatchObject({ status: 429 });
    expect(h.signIn).not.toHaveBeenCalled();
  });
  it('limits guesses per number and per address across fresh challenges', async () => {
    const h = harness();
    for (let i = 0; i < 2; i++) {
      const challenge = issueNativeChallenge(PHONE, `request-${String(i)}`);
      for (let attempt = 0; attempt < 5; attempt++)
        await expect(
          h.service.verify(challenge, '000000', { ip: 'phone-ip' }),
        ).rejects.toMatchObject({ code: 'NATIVE_OTP_INVALID' });
    }
    await expect(
      h.service.verify(issueNativeChallenge(PHONE, 'request-3'), env.PHONE_OTP_DEV_CODE, {
        ip: 'other-ip',
      }),
    ).rejects.toMatchObject({ status: 429 });
    const other = harness();
    for (let i = 0; i < 20; i++)
      await expect(
        other.service.verify(issueNativeChallenge(`+9198455${String(10000 + i)}`, 'r'), '000000', {
          ip: 'shared-ip',
        }),
      ).rejects.toMatchObject({ code: 'NATIVE_OTP_INVALID' });
    await expect(
      other.service.verify(issueNativeChallenge(PHONE, 'r'), env.PHONE_OTP_DEV_CODE, {
        ip: 'shared-ip',
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(h.signIn).not.toHaveBeenCalled();
    expect(other.signIn).not.toHaveBeenCalled();
  });
  it('limits native sign-up per address like the website', async () => {
    const h = harness();
    const signUp = vi.fn().mockResolvedValue({
      customer: { id: 'customer' },
      session: { token: 'token', expiresAt: new Date(NOW) },
    });
    const service = createNativeAuthService({
      cache: h.cache,
      customers: { signIn: h.signIn, signUp } as unknown as CustomerAuthService,
      widget: h.widget,
      productionReady: h.ready,
    });
    const input = { signUpToken: 'ticket', fullName: 'Native Customer' };
    for (let i = 0; i < 10; i++) await service.signUp(input, { ip: 'sign-up-ip' });
    await expect(service.signUp(input, { ip: 'sign-up-ip' })).rejects.toMatchObject({
      status: 429,
    });
    expect(signUp).toHaveBeenCalledTimes(10);
    expect(signUp).toHaveBeenLastCalledWith(input, { ip: 'sign-up-ip', native: true });
  });
  it('fails closed when shared counters cannot protect spending/replay', async () => {
    const h = harness();
    vi.spyOn(h.cache, 'increment').mockRejectedValue(new Error('cache offline'));
    await expect(h.service.request(PHONE)).rejects.toMatchObject({ status: 503 });
    expect(h.widget.send).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    const next = harness();
    vi.spyOn(next.cache, 'peek').mockRejectedValue(new Error('cache offline'));
    await expect(
      next.service.verify(issueNativeChallenge(PHONE, 'request'), env.PHONE_OTP_DEV_CODE),
    ).rejects.toMatchObject({ status: 503 });
    expect(next.signIn).not.toHaveBeenCalled();
  });
  it('holds production OTP/sign-up for authoritative approved publication', async () => {
    const h = harness();
    env.APP_ENV = 'production';
    await expect(h.service.request(PHONE)).rejects.toMatchObject({
      code: 'LEGAL_PUBLICATION_NOT_READY',
    });
    expect(h.widget.send).not.toHaveBeenCalled();
    expect(() => h.service.assertEnabled()).not.toThrow();
  });
  it('keeps the new deployment capability disabled by default', async () => {
    const h = harness();
    env.NATIVE_CUSTOMER_AUTH_ENABLED = false;
    await expect(h.service.request(PHONE)).rejects.toMatchObject({
      code: 'NATIVE_AUTH_UNAVAILABLE',
    });
  });
});

vi.mock('../../../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return { ...actual, env: { ...actual.env } };
});
