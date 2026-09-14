import { createHash } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import {
  formatPhone,
  toE164,
  type PhoneAvailabilityInput,
  type PhoneOtpWidget,
  type VerifyPhoneInput,
  type VerifyPhoneResponse,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { ConflictError, DomainError, UpstreamUnavailableError } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';

export interface PhoneServiceDeps {
  prisma: PrismaClient;
  otp: PhoneOtpPort;
  cache: CachePort;
}

const TOKEN_SPENT_WINDOW_SECONDS = 15 * 60;

export function createPhoneService({ prisma, otp, cache }: PhoneServiceDeps) {
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
          reason: 'Set MSG91_WIDGET_ID and MSG91_WIDGET_TOKEN to verify mobile numbers.',
        };
      }

      return { enabled: true, driver: 'msg91', widgetId, tokenAuth, devCode: null, reason: null };
    },

    async assertAvailable(userId: string, input: PhoneAvailabilityInput): Promise<void> {
      const phone = toE164(input.phone);
      const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (holder && holder.id !== userId) throw alreadyRegistered();
    },

    async verify(
      userId: string,
      input: VerifyPhoneInput,
      context: { ip?: string } = {},
    ): Promise<VerifyPhoneResponse> {
      const phone = toE164(input.phone);
      const claimed = phone.replace(/\D/g, '');

      const verdict = await otp.identify(input.accessToken);

      if (verdict.status === 'UNAVAILABLE') {
        throw new UpstreamUnavailableError(
          'We could not reach the verification service. Try again in a moment.',
          { code: 'PHONE_OTP_UNAVAILABLE' },
        );
      }

      if (verdict.status === 'REJECTED' || verdict.identifier !== claimed) {
        logger.info(
          {
            event: 'phone.verify.refused',
            userId,
            driver: otp.driver,
            ip: context.ip,
            reason: verdict.status === 'REJECTED' ? verdict.reason : 'identifier mismatch',
          },
          'phone verification refused',
        );
        throw new DomainError(
          'PHONE_VERIFICATION_FAILED',
          'That code could not be verified. Request a new one and try again.',
          {
            errors: [
              {
                field: 'body.accessToken',
                code: 'PHONE_VERIFICATION_FAILED',
                message: 'Not verified.',
              },
            ],
          },
        );
      }

      await consumeToken(cache, input.accessToken);

      const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (holder && holder.id !== userId) throw alreadyRegistered();

      const verifiedAt = new Date();
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { phone, phoneVerifiedAt: verifiedAt },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') throw alreadyRegistered();
        throw error;
      }

      logger.info(
        { event: 'phone.verify.succeeded', userId, driver: otp.driver },
        'phone number verified',
      );

      return {
        phone,
        phoneDisplay: formatPhone(phone),
        verifiedAt: verifiedAt.toISOString(),
      };
    },
  };
}

export type PhoneService = ReturnType<typeof createPhoneService>;

async function consumeToken(cache: CachePort, accessToken: string): Promise<void> {
  const key = `phone-otp:spent:${createHash('sha256').update(accessToken).digest('hex')}`;

  let seen: number;
  try {
    seen = (await cache.increment(key, TOKEN_SPENT_WINDOW_SECONDS)).count;
  } catch (error) {
    logger.warn({ err: error }, 'phone otp replay guard unavailable — allowing the verification');
    return;
  }

  if (seen > 1) {
    throw new DomainError(
      'PHONE_VERIFICATION_FAILED',
      'That code has already been used. Request a new one and try again.',
      {
        errors: [
          {
            field: 'body.accessToken',
            code: 'PHONE_VERIFICATION_FAILED',
            message: 'Already used.',
          },
        ],
      },
    );
  }
}

function alreadyRegistered(): ConflictError {
  return new ConflictError(
    'PHONE_ALREADY_REGISTERED',
    'That mobile number is already registered to another dealership.',
    {
      errors: [
        { field: 'body.phone', code: 'PHONE_ALREADY_REGISTERED', message: 'Already registered.' },
      ],
    },
  );
}
