import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPhoneService } from '../../../../src/modules/auth/phone.service.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import type { CachePort } from '../../../../src/platform/cache/cache.port.js';
import type {
  PhoneOtpPort,
  PhoneOtpVerdict,
} from '../../../../src/platform/phone-otp/phone-otp.port.js';

/**
 * B8 — what the server does with the browser's access token (**R39**).
 *
 * Four things have to hold, and each of them refuses differently. This file is
 * about the third and fourth in particular, because they are the ones a
 * client-side OTP widget makes possible to get wrong:
 *
 *   · the identifier MSG91 names must be **the number this request claims**,
 *     or a dealer could verify a handset they hold and register one they do
 *     not;
 *   · a token is good for one verification, so a captured one cannot be
 *     replayed against a second account.
 */
const USER = '00000000-0000-4000-8000-000000000001';

function otpAnswering(verdict: PhoneOtpVerdict): PhoneOtpPort {
  return { driver: 'fake', identify: vi.fn(() => Promise.resolve(verdict)) };
}

function prismaWith(user: { id: string } | null, update: () => unknown = () => ({})): PrismaClient {
  return {
    user: {
      findUnique: vi.fn(() => Promise.resolve(user)),
      update: vi.fn(() => Promise.resolve(update())),
    },
  } as unknown as PrismaClient;
}

let cache: CachePort;

beforeEach(() => {
  cache = createMemoryCache();
});

const VERIFIED: PhoneOtpVerdict = { status: 'VERIFIED', identifier: '919840012345' };

describe('the widget configuration', () => {
  function widget(driver: PhoneOtpPort['driver'] = 'fake') {
    return createPhoneService({
      prisma: prismaWith(null),
      otp: { ...otpAnswering(VERIFIED), driver },
      cache,
    }).widget();
  }

  it('never hands the auth key to the browser', () => {
    expect(JSON.stringify(widget())).not.toContain('authkey');
  });

  it('tells the screen which code the development driver accepts', () => {
    expect(widget()).toMatchObject({ enabled: true, driver: 'fake', devCode: '123456' });
  });

  /**
   * Unreachable as configured — `env.ts` refuses to boot on `msg91` without
   * both values — and answered rather than thrown anyway. A sign-up screen
   * that renders an explanation beats one that renders a 500, which is the
   * same shape `GET /v1/auth/providers` takes for a missing Google client.
   */
  it('explains itself rather than throwing when the widget is not configured', () => {
    expect(widget('msg91')).toMatchObject({
      enabled: false,
      driver: 'msg91',
      widgetId: null,
      tokenAuth: null,
      reason: expect.stringContaining('MSG91_WIDGET_ID'),
    });
  });

  it('hands over the two values the widget needs, and only those', async () => {
    vi.stubEnv('MSG91_WIDGET_ID', 'widget-1');
    vi.stubEnv('MSG91_WIDGET_TOKEN', 'token-1');
    vi.stubEnv('MSG91_AUTH_KEY', 'the-secret-auth-key');
    vi.resetModules();

    const { createPhoneService: build } =
      await import('../../../../src/modules/auth/phone.service.js');
    const configured = build({
      prisma: prismaWith(null),
      otp: { ...otpAnswering(VERIFIED), driver: 'msg91' },
      cache,
    }).widget();

    expect(configured).toEqual({
      enabled: true,
      driver: 'msg91',
      widgetId: 'widget-1',
      tokenAuth: 'token-1',
      devCode: null,
      reason: null,
    });
    // The one credential that must never cross this boundary.
    expect(JSON.stringify(configured)).not.toContain('the-secret-auth-key');

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe('asking whether a number is free', () => {
  function service(prisma = prismaWith(null)) {
    return createPhoneService({ prisma, otp: otpAnswering(VERIFIED), cache });
  }

  it('passes a number nobody holds', async () => {
    await expect(service().assertAvailable(USER, { phone: '9840012345' })).resolves.toBeUndefined();
  });

  it('passes the number this account already holds', async () => {
    const prisma = prismaWith({ id: USER });

    await expect(
      service(prisma).assertAvailable(USER, { phone: '9840012345' }),
    ).resolves.toBeUndefined();
  });

  it('refuses a number another account holds', async () => {
    const prisma = prismaWith({ id: 'somebody-else' });

    await expect(
      service(prisma).assertAvailable(USER, { phone: '9840012345' }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED', status: 409 });
  });

  /**
   * The index is over the stored string, so the question has to be asked about
   * the same string a write would store — `98400 12345` and `+919840012345`
   * are one number.
   */
  it('normalises before it asks', async () => {
    const prisma = prismaWith(null);
    await service(prisma).assertAvailable(USER, { phone: '98400 12345' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: '+919840012345' } }),
    );
  });

  /** It costs no provider call: the whole point is to run before one. */
  it('does not touch the provider', async () => {
    const otp = otpAnswering(VERIFIED);
    await createPhoneService({ prisma: prismaWith(null), otp, cache }).assertAvailable(USER, {
      phone: '9840012345',
    });

    expect(otp.identify).not.toHaveBeenCalled();
  });
});

describe('verifying a number', () => {
  function service(otp: PhoneOtpPort, prisma = prismaWith(null)) {
    return createPhoneService({ prisma, otp, cache });
  }

  it('records the number when the provider names it', async () => {
    const prisma = prismaWith(null);
    const result = await service(otpAnswering(VERIFIED), prisma).verify(USER, {
      phone: '9840012345',
      accessToken: 'token',
    });

    expect(result.phone).toBe('+919840012345');
    expect(result.phoneDisplay).toBe('+91 98400 12345');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER },
        data: expect.objectContaining({ phone: '+919840012345' }),
      }),
    );
  });

  /**
   * The binding check, and the reason `phone` is in the request body at all:
   * it is not trusted input, it is the assertion being tested.
   */
  it('refuses a token that proves a different handset', async () => {
    const otp = otpAnswering({ status: 'VERIFIED', identifier: '919999999999' });
    const prisma = prismaWith(null);

    await expect(
      service(otp, prisma).verify(USER, { phone: '9840012345', accessToken: 'token' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_FAILED', status: 422 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  /**
   * One message for a wrong token and for a token belonging to somebody else.
   * "That code was for a different number" would confirm to whoever holds a
   * stolen token which number it belongs to.
   */
  it('says the same thing for a refused token as for a mismatched one', async () => {
    const refused = service(otpAnswering({ status: 'REJECTED', reason: 'expired' }));
    const mismatched = service(otpAnswering({ status: 'VERIFIED', identifier: '919999999999' }));

    const first = await refused
      .verify(USER, { phone: '9840012345', accessToken: 'a' })
      .catch((error: Error) => error.message);
    const second = await mismatched
      .verify(USER, { phone: '9840012345', accessToken: 'b' })
      .catch((error: Error) => error.message);

    expect(first).toBe(second);
  });

  /** A vendor outage is not a wrong code, and must not read as one. */
  it('answers 503 when the provider could not be reached', async () => {
    await expect(
      service(otpAnswering({ status: 'UNAVAILABLE' })).verify(USER, {
        phone: '9840012345',
        accessToken: 'token',
      }),
    ).rejects.toMatchObject({ code: 'PHONE_OTP_UNAVAILABLE', status: 503 });
  });

  it('accepts one verification per token, and no more', async () => {
    const otp = otpAnswering(VERIFIED);
    const first = service(otp);

    await first.verify(USER, { phone: '9840012345', accessToken: 'one-shot' });

    await expect(
      first.verify(USER, { phone: '9840012345', accessToken: 'one-shot' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_FAILED' });
  });

  /** The replay guard does not keep the token: cache keys are not a place for one. */
  it('never puts the token itself in the shared cache', async () => {
    const peeked = vi.spyOn(cache, 'increment');
    await service(otpAnswering(VERIFIED)).verify(USER, {
      phone: '9840012345',
      accessToken: 'secret-token',
    });

    expect(peeked.mock.calls[0]?.[0]).not.toContain('secret-token');
  });

  it('refuses a number another account already holds', async () => {
    const prisma = prismaWith({ id: 'somebody-else' });

    await expect(
      service(otpAnswering(VERIFIED), prisma).verify(USER, {
        phone: '9840012345',
        accessToken: 'token',
      }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED', status: 409 });
  });

  /** The read above is the message; the unique index is the guarantee. */
  it('turns the index’s own refusal into the same answer', async () => {
    const prisma = prismaWith(null, () => {
      throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
    });

    await expect(
      service(otpAnswering(VERIFIED), prisma).verify(USER, {
        phone: '9840012345',
        accessToken: 'token',
      }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED' });
  });

  /**
   * A replay guard is not a spend control, and a database blip must not make
   * signing up impossible — the same reasoning `createRateLimiter` applies.
   */
  it('verifies anyway when the replay guard cannot be reached', async () => {
    vi.spyOn(cache, 'increment').mockRejectedValue(new Error('cache down'));

    await expect(
      service(otpAnswering(VERIFIED)).verify(USER, {
        phone: '9840012345',
        accessToken: 'token',
      }),
    ).resolves.toMatchObject({ phone: '+919840012345' });
  });
});
