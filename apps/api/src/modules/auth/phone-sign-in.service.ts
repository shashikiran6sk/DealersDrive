import type { PhoneSignInInput, PhoneSignInResponse } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { ForbiddenError, NotFoundError } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import { ACCOUNT_SUSPENDED, DEALER_NOT_FOUND, DEALERSHIP_SUSPENDED } from './auth.messages.js';
import { createIdentityService } from './identity.service.js';
import { createPhoneProofService } from './phone-proof.service.js';
import { resolveDealerPostAuthDestination } from './post-auth.js';
import { ensureSeat, isSeatSuspended } from './roles.js';
import type { SessionService } from './session.service.js';

export interface PhoneSignInDeps {
  prisma: PrismaClient;
  sessions: SessionService;
  otp: PhoneOtpPort;
  cache: CachePort;
  audit: AuditService;
}

export interface PhoneSignInResult extends PhoneSignInResponse {
  token: string;
  expiresAt: Date;
}

export interface SignInContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export function createPhoneSignInService({ prisma, sessions, otp, cache, audit }: PhoneSignInDeps) {
  const proof = createPhoneProofService({ otp, cache });
  const identities = createIdentityService({ prisma, audit });

  return {
    widget: () => proof.widget(),

    async signInDealer(
      input: PhoneSignInInput,
      context: SignInContext = {},
    ): Promise<PhoneSignInResult> {
      const proven = await proof.prove({
        phone: input.phone,
        accessToken: input.accessToken,
        purpose: 'DEALER_LOGIN',
        ip: context.ip,
      });

      const user = await identities.findByVerifiedPhone(proven.phone);
      const member = user
        ? await prisma.dealerMember.findFirst({
            where: { userId: user.id, status: 'ACTIVE' },
            select: { id: true },
          })
        : null;
      const isDealer =
        user?.roles.some((seat) => seat.role === 'DEALER') === true || member !== null;

      if (!user || !isDealer) {
        logger.info(
          { event: 'auth.phone.sign_in.refused', reason: 'no-dealer-account' },
          'phone sign-in for a number no dealer account holds',
        );
        throw new NotFoundError(DEALER_NOT_FOUND, { code: 'DEALER_NOT_FOUND' });
      }

      if (user.status !== 'ACTIVE') {
        throw new ForbiddenError(ACCOUNT_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
      }
      if (isSeatSuspended(user.roles, 'DEALER')) {
        throw new ForbiddenError(DEALERSHIP_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
      }

      const destination = await resolveDealerPostAuthDestination(prisma, user.id, input.returnTo);

      await ensureSeat(prisma, { userId: user.id, role: 'DEALER' });
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const session = await sessions.issue({
        userId: user.id,
        scope: 'DEALER',
        ip: context.ip,
        userAgent: context.userAgent,
      });

      logger.info(
        { event: 'auth.session.created', scope: 'DEALER', method: 'PHONE', userId: user.id },
        'dealer session created',
      );
      await audit.recordDetached({
        actorType: 'DEALER',
        actorId: user.id,
        action: 'auth.login.phone',
        entityType: 'User',
        entityId: user.id,
        after: { next: destination.next },
      });

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        next: destination.next,
        returnTo: destination.returnTo,
      };
    },
  };
}

export type PhoneSignInService = ReturnType<typeof createPhoneSignInService>;
