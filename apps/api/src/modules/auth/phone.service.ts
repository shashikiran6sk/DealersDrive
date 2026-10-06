import type { PrismaClient } from '@prisma/client';
import {
  formatPhone,
  toE164,
  type PhoneAvailabilityInput,
  type PhoneOtpWidget,
  type VerifyPhoneInput,
  type VerifyPhoneResponse,
} from '@dealers-drive/contracts';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, errorCode } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import { ALREADY_REGISTERED } from '../../platform/messages.js';
import { loadMergeCandidates, mergeAccounts, mergeRefusal } from './account-merge.js';
import { createPhoneProofService } from './phone-proof.service.js';
import type { IssuedSession, SessionService } from './session.service.js';

export interface PhoneServiceDeps {
  prisma: PrismaClient;
  otp: PhoneOtpPort;
  cache: CachePort;
  audit: AuditService;
  sessions: SessionService;
}

export interface PhoneVerification {
  response: VerifyPhoneResponse;
  session: IssuedSession | null;
}

export function createPhoneService({ prisma, otp, cache, audit, sessions }: PhoneServiceDeps) {
  const proof = createPhoneProofService({ otp, cache });

  async function isMergeable(holderId: string, userId: string): Promise<boolean> {
    return withTransaction(prisma, async (tx) => {
      const users = await loadMergeCandidates(tx, holderId, userId);
      const holder = users.get(holderId);
      const current = users.get(userId);
      return Boolean(holder && current && mergeRefusal(holder, current) === null);
    });
  }

  return {
    widget(): PhoneOtpWidget {
      return proof.widget();
    },

    async assertAvailable(userId: string, input: PhoneAvailabilityInput): Promise<void> {
      const phone = toE164(input.phone);
      const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (holder && holder.id !== userId && !(await isMergeable(holder.id, userId))) {
        throw alreadyRegistered();
      }
    },

    async verify(
      userId: string,
      input: VerifyPhoneInput,
      context: { ip?: string; userAgent?: string } = {},
    ): Promise<PhoneVerification> {
      const { phone } = await proof.prove({
        phone: input.phone,
        accessToken: input.accessToken,
        purpose: 'DEALER_PHONE_LINK',
        userId,
        ip: context.ip,
      });

      const holder = await prisma.user.findUnique({
        where: { phone },
        select: { id: true, phoneVerifiedAt: true },
      });
      if (holder && holder.id !== userId) {
        if (!holder.phoneVerifiedAt) throw alreadyRegistered();
        return linkToHolder(holder.id, userId, phone, holder.phoneVerifiedAt, context);
      }

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
        response: {
          phone,
          phoneDisplay: formatPhone(phone),
          verifiedAt: verifiedAt.toISOString(),
          accountsLinked: false,
        },
        session: null,
      };
    },
  };

  async function linkToHolder(
    holderId: string,
    userId: string,
    phone: string,
    verifiedAt: Date,
    context: { ip?: string; userAgent?: string },
  ): Promise<PhoneVerification> {
    try {
      await withTransaction(prisma, (tx) =>
        mergeAccounts(tx, audit, { survivorId: holderId, absorbedId: userId, proof: 'PHONE_OTP' }),
      );
    } catch (error) {
      if (error instanceof ConflictError) throw alreadyRegistered(error.message);
      throw error;
    }

    const session = await sessions.issue({
      userId: holderId,
      scope: 'DEALER',
      ip: context.ip,
      userAgent: context.userAgent,
    });

    logger.info(
      {
        event: 'phone.verify.linked',
        purpose: 'DEALER_PHONE_LINK',
        userId: holderId,
        driver: otp.driver,
      },
      'phone number verified and accounts linked',
    );

    return {
      response: {
        phone,
        phoneDisplay: formatPhone(phone),
        verifiedAt: verifiedAt.toISOString(),
        accountsLinked: true,
      },
      session,
    };
  }
}

export type PhoneService = ReturnType<typeof createPhoneService>;

function alreadyRegistered(
  message = 'That mobile number is already registered to another dealership.',
): ConflictError {
  return new ConflictError('PHONE_ALREADY_REGISTERED', message, {
    errors: [
      { field: 'body.phone', code: 'PHONE_ALREADY_REGISTERED', message: ALREADY_REGISTERED },
    ],
  });
}
