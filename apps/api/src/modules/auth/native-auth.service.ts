import { createHash, randomBytes } from 'node:crypto';
import {
  formatPhone,
  normaliseIndianMobile,
  type NativeOtpChallenge,
  type NativeCustomerSignIn,
  type NativeCustomerSignUp,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { CounterResult, CachePort } from '../../platform/cache/cache.port.js';
import { DomainError, RateLimitError, UpstreamUnavailableError } from '../../platform/errors.js';
import type { NativeWidgetPort } from '../../platform/phone-otp/native-widget.port.js';
import type { CustomerAuthService } from './customer-auth.service.js';
import type { SignInContext } from './customer-auth.service.js';
import type { NativeCustomerSignUpInput } from '@dealers-drive/contracts';
import type { CustomerReactivationInput } from '@dealers-drive/contracts';
import { NATIVE_AUTH_MESSAGES } from './native-auth.messages.js';
import {
  expired,
  issueNativeChallenge,
  openNativeChallenge,
  sealNativeChallenge,
  NATIVE_CHALLENGE_TTL_SECONDS,
  type NativeChallengeData,
} from './native-otp-challenge.js';

export interface NativeAuthDeps {
  cache: CachePort;
  customers: CustomerAuthService;
  widget: NativeWidgetPort;
  productionReady: () => Promise<boolean>;
}

export function createNativeAuthService({
  cache,
  customers,
  widget,
  productionReady,
}: NativeAuthDeps) {
  function assertEnabled(): void {
    if (!env.NATIVE_CUSTOMER_AUTH_ENABLED) throw unavailable();
  }
  async function enabled(): Promise<void> {
    assertEnabled();
    if (env.APP_ENV === 'production' && !(await productionReady()))
      throw new UpstreamUnavailableError('Approved policy publication is not ready.', {
        code: 'LEGAL_PUBLICATION_NOT_READY',
      });
  }
  async function count(key: string, seconds: number): Promise<CounterResult> {
    try {
      return await cache.increment(key, seconds);
    } catch {
      throw unavailable();
    }
  }
  async function limit(key: string, maximum: number, seconds: number): Promise<void> {
    const result = await count(key, seconds);
    if (result.count > maximum)
      throw new RateLimitError(NATIVE_AUTH_MESSAGES.limited, result.retryAfterSeconds);
  }
  async function active(token: string): Promise<NativeChallengeData> {
    await enabled();
    const data = openNativeChallenge(token);
    let used: number;
    try {
      used = await cache.peek(`native-otp:spent:${data.nonce}`);
    } catch {
      throw unavailable();
    }
    if (used > 0) throw expired();
    return data;
  }
  async function spend(phone: string, ip: string): Promise<void> {
    const hash = createHash('sha256').update(phone).digest('hex');
    const ipHash = createHash('sha256').update(ip).digest('hex');
    await limit(`native-otp:cooldown:${hash}`, 1, 60);
    await limit(`native-otp:send:ip:${ipHash}`, 20, 600);
    await limit(`native-otp:send:phone:${hash}`, 5, 3600);
    await limit('native-otp:send:global', 1000, 86400);
  }
  function response(token: string): NativeOtpChallenge {
    const data = openNativeChallenge(token);
    return {
      challenge: token,
      phoneDisplay: formatPhone(data.phone),
      expiresAt: new Date(data.issuedAt + NATIVE_CHALLENGE_TTL_SECONDS * 1000).toISOString(),
      retryAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }
  return {
    enabled,
    assertEnabled,
    async request(phoneInput: string, ip = 'unknown'): Promise<NativeOtpChallenge> {
      await enabled();
      const phone = normaliseIndianMobile(phoneInput);
      if (!phone) throw new DomainError('VALIDATION_ERROR', 'Enter a valid Indian mobile number.');
      await spend(phone, ip);
      const reqId =
        env.PHONE_OTP_DRIVER === 'fake'
          ? randomBytes(16).toString('hex')
          : await widget.send(phone);
      return response(issueNativeChallenge(phone, reqId));
    },
    async resend(token: string, ip = 'unknown'): Promise<NativeOtpChallenge> {
      const data = await active(token);
      await spend(data.phone, ip);
      await limit(`native-otp:resend:${data.nonce}`, 3, NATIVE_CHALLENGE_TTL_SECONDS);
      const reqId = env.PHONE_OTP_DRIVER === 'fake' ? data.reqId : await widget.resend(data.reqId);
      return response(sealNativeChallenge({ ...data, reqId }));
    },
    async verify(
      token: string,
      otp: string,
      context: SignInContext = {},
    ): Promise<NativeCustomerSignIn> {
      const data = await active(token);
      await limit(`native-otp:attempt:${data.nonce}`, 5, NATIVE_CHALLENGE_TTL_SECONDS);
      let accessToken: string;
      if (env.PHONE_OTP_DRIVER === 'fake') {
        if (otp !== env.PHONE_OTP_DEV_CODE)
          throw new DomainError('NATIVE_OTP_INVALID', NATIVE_AUTH_MESSAGES.invalid);
        accessToken = `dev-otp:${data.phone.slice(1)}:${otp}:${data.nonce}`;
      } else accessToken = await widget.verify(data.reqId, otp);
      if ((await count(`native-otp:spent:${data.nonce}`, NATIVE_CHALLENGE_TTL_SECONDS)).count > 1)
        throw expired();
      const result = await customers.signIn({ phone: data.phone, accessToken }, context);
      if (result.status === 'SIGNED_IN' && result.session && result.customer)
        return {
          status: 'SIGNED_IN',
          customer: result.customer,
          credential: {
            token: result.session.token,
            expiresAt: result.session.expiresAt.toISOString(),
          },
        };
      if (result.status === 'NAME_REQUIRED' && result.signUpToken && result.expiresAt)
        return {
          status: 'NAME_REQUIRED',
          signUpToken: result.signUpToken,
          expiresAt: result.expiresAt,
          phoneDisplay: result.phoneDisplay,
        };
      if (result.status === 'REACTIVATION_REQUIRED' && result.reactivationToken && result.expiresAt)
        return {
          status: 'REACTIVATION_REQUIRED',
          reactivationToken: result.reactivationToken,
          expiresAt: result.expiresAt,
          phoneDisplay: result.phoneDisplay,
          fullName: result.reactivationName ?? '',
        };
      throw unavailable();
    },
    async signUp(
      input: NativeCustomerSignUpInput,
      context: SignInContext = {},
    ): Promise<NativeCustomerSignUp> {
      await enabled();
      const result = await customers.signUp(input, context);
      return {
        customer: result.customer,
        credential: {
          token: result.session.token,
          expiresAt: result.session.expiresAt.toISOString(),
        },
      };
    },
    async reactivate(
      input: CustomerReactivationInput,
      context: SignInContext = {},
    ): Promise<NativeCustomerSignUp> {
      await enabled();
      const result = await customers.reactivate(input, context);
      return {
        customer: result.customer,
        credential: {
          token: result.session.token,
          expiresAt: result.session.expiresAt.toISOString(),
        },
      };
    },
  };
}
export type NativeAuthService = ReturnType<typeof createNativeAuthService>;
function unavailable(): UpstreamUnavailableError {
  return new UpstreamUnavailableError(NATIVE_AUTH_MESSAGES.unavailable, {
    code: 'NATIVE_AUTH_UNAVAILABLE',
  });
}
