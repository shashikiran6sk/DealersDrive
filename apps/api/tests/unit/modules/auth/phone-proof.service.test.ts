import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WHATSAPP_OTP_KEY,
  createPhoneProofService,
  OTP_PURPOSES,
  REPLAY_GUARD_FAILS_OPEN,
  spentTokenKey,
  type OtpPurpose,
} from '../../../../src/modules/auth/phone-proof.service.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import type { CachePort } from '../../../../src/platform/cache/cache.port.js';
import type {
  PhoneOtpPort,
  PhoneOtpVerdict,
} from '../../../../src/platform/phone-otp/phone-otp.port.js';

/**
 * R58 — one proof of a handset, for every purpose that needs one.
 *
 * `phone.service.test.ts` still covers the dealer's onboarding link end to end;
 * this file is about what the extraction adds: the proof no longer knows which
 * flow asked for it, so the things that must hold for *every* flow are pinned
 * here once.
 */
function otpAnswering(verdict: PhoneOtpVerdict): PhoneOtpPort {
  return { driver: 'fake', identify: vi.fn(() => Promise.resolve(verdict)) };
}

const VERIFIED: PhoneOtpVerdict = { status: 'VERIFIED', identifier: '919840012345' };

let cache: CachePort;

beforeEach(() => {
  cache = createMemoryCache();
});

function channel(whatsapp: boolean) {
  return { boolean: vi.fn((key: string) => Promise.resolve(key === WHATSAPP_OTP_KEY && whatsapp)) };
}

function proof(otp: PhoneOtpPort = otpAnswering(VERIFIED), whatsapp = false) {
  return createPhoneProofService({ otp, cache, config: channel(whatsapp) });
}

describe('proving a handset', () => {
  it.each(OTP_PURPOSES)('answers the canonical number for %s', async (purpose) => {
    const proven = await proof().prove({
      phone: '98400 12345',
      accessToken: `token-${purpose}`,
      purpose,
    });

    expect(proven).toMatchObject({ phone: '+919840012345', purpose });
    expect(proven.provenAt).toBeInstanceOf(Date);
  });

  /**
   * The claim and the provider's answer are compared in one canonical form, so
   * the spelling on either side cannot decide the outcome.
   */
  it.each(['9840012345', '919840012345', '+919840012345'])(
    'matches a provider identifier written %j',
    async (identifier) => {
      const otp = otpAnswering({ status: 'VERIFIED', identifier });

      await expect(
        proof(otp).prove({ phone: '09840012345', accessToken: 't', purpose: 'CUSTOMER_LOGIN' }),
      ).resolves.toMatchObject({ phone: '+919840012345' });
    },
  );

  it('refuses a token that proves a different handset', async () => {
    const otp = otpAnswering({ status: 'VERIFIED', identifier: '919999999999' });

    await expect(
      proof(otp).prove({ phone: '9840012345', accessToken: 't', purpose: 'DEALER_LOGIN' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_FAILED', status: 422 });
  });

  /** Not a number is refused before the provider is asked anything. */
  it('refuses a claim that is not an Indian mobile without calling the provider', async () => {
    const otp = otpAnswering(VERIFIED);

    await expect(
      proof(otp).prove({ phone: '0416224889', accessToken: 't', purpose: 'CUSTOMER_LOGIN' }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_FAILED' });
    expect(otp.identify).not.toHaveBeenCalled();
  });

  it('answers 503, not a wrong code, when the provider is down', async () => {
    await expect(
      proof(otpAnswering({ status: 'UNAVAILABLE' })).prove({
        phone: '9840012345',
        accessToken: 't',
        purpose: 'CUSTOMER_LOGIN',
      }),
    ).rejects.toMatchObject({ code: 'PHONE_OTP_UNAVAILABLE', status: 503 });
  });

  /** Naming the number a token belongs to would confirm it to whoever stole it. */
  it('says the same thing for a refused token, a mismatch and a non-number', async () => {
    const messages = await Promise.all([
      proof(otpAnswering({ status: 'REJECTED', reason: 'expired' }))
        .prove({ phone: '9840012345', accessToken: 'a', purpose: 'CUSTOMER_LOGIN' })
        .catch((error: Error) => error.message),
      proof(otpAnswering({ status: 'VERIFIED', identifier: '919999999999' }))
        .prove({ phone: '9840012345', accessToken: 'b', purpose: 'CUSTOMER_LOGIN' })
        .catch((error: Error) => error.message),
      proof()
        .prove({ phone: 'not a number', accessToken: 'c', purpose: 'CUSTOMER_LOGIN' })
        .catch((error: Error) => error.message),
    ]);

    expect(new Set(messages).size).toBe(1);
  });
});

describe('a token proves one thing, once', () => {
  /**
   * The spent-token key does not carry the purpose, deliberately: a token
   * accepted to link a dealer's phone must not then sign somebody in, and a
   * token accepted for a customer sign-in must not then link a dealership.
   */
  it.each([
    ['DEALER_PHONE_LINK', 'CUSTOMER_LOGIN'],
    ['CUSTOMER_LOGIN', 'DEALER_LOGIN'],
    ['DEALER_LOGIN', 'DEALER_PHONE_LINK'],
  ] as const)('refuses a token spent on %s when it is presented for %s', async (first, second) => {
    const service = proof();
    await service.prove({ phone: '9840012345', accessToken: 'one-shot', purpose: first });

    await expect(
      service.prove({ phone: '9840012345', accessToken: 'one-shot', purpose: second }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_FAILED' });
  });

  it('keys the spent token by a hash, never by the token', () => {
    expect(spentTokenKey('secret-token')).toMatch(/^phone-otp:spent:[0-9a-f]{64}$/);
    expect(spentTokenKey('secret-token')).not.toContain('secret-token');
  });

  it('does not spend a token it refused', async () => {
    const increment = vi.spyOn(cache, 'increment');

    await proof(otpAnswering({ status: 'REJECTED', reason: 'expired' }))
      .prove({ phone: '9840012345', accessToken: 't', purpose: 'CUSTOMER_LOGIN' })
      .catch(() => undefined);

    expect(increment).not.toHaveBeenCalled();
  });
});

describe('when the replay guard is unreachable', () => {
  beforeEach(() => {
    vi.spyOn(cache, 'increment').mockRejectedValue(new Error('cache down'));
  });

  /**
   * Linking a number to an account that already signed in with Google is the
   * pre-R58 behaviour and stays as it was: a database blip must not make
   * onboarding impossible.
   */
  it('still links a dealer’s phone', async () => {
    await expect(
      proof().prove({ phone: '9840012345', accessToken: 't', purpose: 'DEALER_PHONE_LINK' }),
    ).resolves.toMatchObject({ phone: '+919840012345' });
  });

  /**
   * A sign-in is different: the proof is the whole of the authentication, and
   * one that cannot rule out a replay would mint a session for whoever holds a
   * captured token.
   */
  it.each(['DEALER_LOGIN', 'CUSTOMER_LOGIN'] as const)('refuses a %s', async (purpose) => {
    await expect(
      proof().prove({ phone: '9840012345', accessToken: 't', purpose }),
    ).rejects.toMatchObject({ code: 'PHONE_OTP_UNAVAILABLE', status: 503 });
  });

  it('fails open for linking only', () => {
    const open = (Object.keys(REPLAY_GUARD_FAILS_OPEN) as OtpPurpose[]).filter(
      (purpose) => REPLAY_GUARD_FAILS_OPEN[purpose],
    );
    expect(open).toEqual(['DEALER_PHONE_LINK']);
  });
});

describe('the widget configuration', () => {
  it('is the same answer the onboarding step already gets', async () => {
    await expect(proof().widget()).resolves.toMatchObject({
      enabled: true,
      driver: 'fake',
      devCode: '123456',
      channel: 'sms',
    });
  });
});

/**
 * The OTP channel: the admin's `otp.whatsappEnabled` decides which MSG91
 * widget the browser is handed — the widget both generates the code and
 * delivers it — and the server says which, so the screen can label its button.
 * Verification never looks at it.
 */
describe('the OTP channel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function msg91(env: Record<string, string>, whatsapp: boolean | Error) {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.resetModules();
    const { createPhoneProofService: build } =
      await import('../../../../src/modules/auth/phone-proof.service.js');
    const config = {
      boolean: vi.fn(() =>
        whatsapp instanceof Error ? Promise.reject(whatsapp) : Promise.resolve(whatsapp),
      ),
    };
    const service = build({
      otp: { ...otpAnswering(VERIFIED), driver: 'msg91' },
      cache,
      config,
    });
    return { widget: await service.widget(), config };
  }

  const BOTH = {
    MSG91_WIDGET_ID: 'sms-widget',
    MSG91_WIDGET_TOKEN: 'sms-token',
    MSG91_WHATSAPP_WIDGET_ID: 'wa-widget',
    MSG91_WHATSAPP_WIDGET_TOKEN: 'wa-token',
    MSG91_AUTH_KEY: 'the-secret-auth-key',
  };

  it('hands over the WhatsApp widget, and says so, when WhatsApp OTP is on', async () => {
    const { widget, config } = await msg91(BOTH, true);
    expect(config.boolean).toHaveBeenCalledWith('otp.whatsappEnabled');
    expect(widget).toEqual({
      enabled: true,
      driver: 'msg91',
      widgetId: 'wa-widget',
      tokenAuth: 'wa-token',
      devCode: null,
      reason: null,
      channel: 'whatsapp',
    });
    expect(JSON.stringify(widget)).not.toContain('the-secret-auth-key');
  });

  it('hands over the SMS widget when WhatsApp OTP is off', async () => {
    const { widget } = await msg91(BOTH, false);
    expect(widget).toMatchObject({
      widgetId: 'sms-widget',
      tokenAuth: 'sms-token',
      channel: 'sms',
    });
  });

  it('falls back to SMS, honestly, when WhatsApp is on but has no widget configured', async () => {
    const { widget } = await msg91(
      {
        MSG91_WIDGET_ID: 'sms-widget',
        MSG91_WIDGET_TOKEN: 'sms-token',
        MSG91_WHATSAPP_WIDGET_ID: '',
      },
      true,
    );
    expect(widget).toMatchObject({ enabled: true, widgetId: 'sms-widget', channel: 'sms' });
  });

  it('falls back to SMS when the setting cannot be read, rather than failing sign-in', async () => {
    const { widget } = await msg91(BOTH, new Error('database down'));
    expect(widget).toMatchObject({ enabled: true, widgetId: 'sms-widget', channel: 'sms' });
  });

  it('keeps the local development driver as it is, only labelling the channel', async () => {
    await expect(proof(otpAnswering(VERIFIED), true).widget()).resolves.toEqual({
      enabled: true,
      driver: 'fake',
      widgetId: null,
      tokenAuth: null,
      devCode: '123456',
      reason: null,
      channel: 'whatsapp',
    });
  });

  it('verifies a code identically whichever channel carried it', async () => {
    const results = [];
    for (const whatsapp of [false, true]) {
      const otp = otpAnswering(VERIFIED);
      const proven = await proof(otp, whatsapp).prove({
        phone: '98400 12345',
        accessToken: `token-${String(whatsapp)}`,
        purpose: 'CUSTOMER_LOGIN',
      });
      expect(otp.identify).toHaveBeenCalledWith(`token-${String(whatsapp)}`);
      results.push({ phone: proven.phone, purpose: proven.purpose });
    }
    expect(results[0]).toEqual(results[1]);

    const refused = otpAnswering({ status: 'REJECTED', reason: 'wrong code' });
    await expect(
      proof(refused, true).prove({
        phone: '9840012345',
        accessToken: 't',
        purpose: 'DEALER_LOGIN',
      }),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_FAILED', status: 422 });
  });
});
