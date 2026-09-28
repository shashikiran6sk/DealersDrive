import type { PrismaClient } from '@prisma/client';
import {
  formatPhone,
  toE164,
  type PhoneAvailabilityInput,
  type PhoneOtpWidget,
  type VerifyPhoneInput,
  type VerifyPhoneResponse,
} from '@dealers-drive/contracts';

import type { CachePort } from '../../platform/cache/cache.port.js';
import { ConflictError, errorCode } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import { ALREADY_REGISTERED } from '../../platform/messages.js';
import { createPhoneProofService } from './phone-proof.service.js';

export interface PhoneServiceDeps {
  prisma: PrismaClient;
  otp: PhoneOtpPort;
  cache: CachePort;
}

export function createPhoneService({ prisma, otp, cache }: PhoneServiceDeps) {
  const proof = createPhoneProofService({ otp, cache });

  return {
    widget(): PhoneOtpWidget {
      return proof.widget();
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
      const { phone } = await proof.prove({
        phone: input.phone,
        accessToken: input.accessToken,
        purpose: 'DEALER_PHONE_LINK',
        userId,
        ip: context.ip,
      });

      const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (holder && holder.id !== userId) throw alreadyRegistered();

      const verifiedAt = new Date();
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { phone, phoneVerifiedAt: verifiedAt },
        });
      } catch (error) {
        if (errorCode(error) === 'P2002') throw alreadyRegistered();
        throw error;
      }

      logger.info(
        {
          event: 'phone.verify.succeeded',
          purpose: 'DEALER_PHONE_LINK',
          userId,
          driver: otp.driver,
        },
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

function alreadyRegistered(): ConflictError {
  return new ConflictError(
    'PHONE_ALREADY_REGISTERED',
    'That mobile number is already registered to another dealership.',
    {
      errors: [
        { field: 'body.phone', code: 'PHONE_ALREADY_REGISTERED', message: ALREADY_REGISTERED },
      ],
    },
  );
}
