import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
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

const VERIFIED: PhoneOtpVerdict = {
  status: 'VERIFIED',
  identifier: '919840012345',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 300_000),
};

let cache: CachePort;

beforeEach(() => {
  cache = createMemoryCache();
});

function proof(otp: PhoneOtpPort = otpAnswering(VERIFIED)) {
  return createPhoneProofService({ otp, cache });
}

describe('proving a handset', () => {
  it.each(['ADMIN_ENROLL', 'ADMIN_LOGIN'] as const)(
    'requires challenge freshness for %s even when a provider proves the number',
    async (purpose) => {
      await expect(
        proof().prove({ phone: '9840012345', accessToken: 'controlled-proof', purpose }),
      ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_FAILED' });
    },
  );
  it.each(OTP_PURPOSES)('answers the canonical number for %s', async (purpose) => {
    const proven = await proof().prove({
      phone: '98400 12345',
      accessToken: `token-${purpose}`,
      purpose,
      freshAfter: new Date(0),
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
  it('is the same answer the onboarding step already gets', () => {
    expect(proof().widget()).toMatchObject({ enabled: true, driver: 'fake', devCode: '123456' });
  });
});
