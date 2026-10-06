import { createHash } from 'node:crypto';

import { normaliseIndianMobile, type PhoneOtpWidget } from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { DomainError, UpstreamUnavailableError } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  OTP_ALREADY_USED,
  OTP_NOT_VERIFIED,
  OTP_UNAVAILABLE,
  OTP_WIDGET_NOT_CONFIGURED,
} from './auth.messages.js';

export const OTP_PURPOSES = [
  'DEALER_PHONE_LINK',
  'DEALER_LOGIN',
  'CUSTOMER_LOGIN',
  'ASSISTED_DEALER_PHONE',
] as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export interface ProvePhoneInput {
  phone: string;
  accessToken: string;
  purpose: OtpPurpose;
  userId?: string | undefined;
  ip?: string | undefined;
}

export interface ProvenPhone {
  phone: string;
  purpose: OtpPurpose;
  provenAt: Date;
}

export interface PhoneProofDeps {
  otp: PhoneOtpPort;
  cache: CachePort;
}

export const TOKEN_SPENT_WINDOW_SECONDS = 15 * 60;

export const REPLAY_GUARD_FAILS_OPEN: Readonly<Record<OtpPurpose, boolean>> = {
  DEALER_PHONE_LINK: true,
  DEALER_LOGIN: false,
  CUSTOMER_LOGIN: false,
  ASSISTED_DEALER_PHONE: false,
};

const TOKEN_FIELD = 'body.accessToken';

export function createPhoneProofService({ otp, cache }: PhoneProofDeps) {
  function refused(input: ProvePhoneInput, reason: string): DomainError {
    logger.info(
      {
        event: 'phone.verify.refused',
        purpose: input.purpose,
        userId: input.userId,
        driver: otp.driver,
        ip: input.ip,
        reason,
      },
      'phone verification refused',
    );
    return verificationFailed(OTP_NOT_VERIFIED, 'Not verified.');
  }

  return {
    widget(): PhoneOtpWidget {
      if (otp.driver === 'fake') {
        return {
          enabled: true,
          driver: 'fake',
          widgetId: null,
          tokenAuth: null,
          devCode: env.PHONE_OTP_DEV_CODE,
          reason: null,
        };
      }

      const widgetId = env.MSG91_WIDGET_ID;
      const tokenAuth = env.MSG91_WIDGET_TOKEN;

      if (!widgetId || !tokenAuth) {
        return {
          enabled: false,
          driver: 'msg91',
          widgetId: null,
          tokenAuth: null,
          devCode: null,
          reason: OTP_WIDGET_NOT_CONFIGURED,
        };
      }

      return { enabled: true, driver: 'msg91', widgetId, tokenAuth, devCode: null, reason: null };
    },

    async prove(input: ProvePhoneInput): Promise<ProvenPhone> {
      const phone = normaliseIndianMobile(input.phone);
      if (!phone) throw refused(input, 'not an Indian mobile number');

      const verdict = await otp.identify(input.accessToken);

      if (verdict.status === 'UNAVAILABLE') throw unavailable();
      if (verdict.status === 'REJECTED') throw refused(input, verdict.reason);
      if (normaliseIndianMobile(verdict.identifier) !== phone) {
        throw refused(input, 'identifier mismatch');
      }

      await consumeToken(cache, input);

      return { phone, purpose: input.purpose, provenAt: new Date() };
    },
  };
}

export type PhoneProofService = ReturnType<typeof createPhoneProofService>;

export function spentTokenKey(accessToken: string): string {
  return `phone-otp:spent:${createHash('sha256').update(accessToken).digest('hex')}`;
}

async function consumeToken(cache: CachePort, input: ProvePhoneInput): Promise<void> {
  let seen: number;
  try {
    seen = (await cache.increment(spentTokenKey(input.accessToken), TOKEN_SPENT_WINDOW_SECONDS))
      .count;
  } catch (error) {
    if (REPLAY_GUARD_FAILS_OPEN[input.purpose]) {
      logger.warn(
        { err: error, purpose: input.purpose },
        'phone otp replay guard unavailable — allowing the verification',
      );
      return;
    }

    logger.warn(
      { err: error, purpose: input.purpose },
      'phone otp replay guard unavailable — refusing a sign-in it cannot prove is not a replay',
    );
    throw unavailable();
  }

  if (seen > 1) throw verificationFailed(OTP_ALREADY_USED, 'Already used.');
}

function verificationFailed(message: string, detail: string): DomainError {
  return new DomainError('PHONE_VERIFICATION_FAILED', message, {
    errors: [{ field: TOKEN_FIELD, code: 'PHONE_VERIFICATION_FAILED', message: detail }],
  });
}

function unavailable(): UpstreamUnavailableError {
  return new UpstreamUnavailableError(OTP_UNAVAILABLE, { code: 'PHONE_OTP_UNAVAILABLE' });
}
