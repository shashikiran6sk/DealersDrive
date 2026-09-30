import {
  formatPhone,
  type CustomerProfile,
  type CustomerSignInInput,
  type CustomerSignInResponse,
  type CustomerSignUpInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { ForbiddenError } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import { CUSTOMER_SUSPENDED } from './auth.messages.js';
import { createIdentityService } from './identity.service.js';
import { createPhoneProofService, type OtpChannelConfig } from './phone-proof.service.js';
import { ensureSeat, isSeatSuspended, type RoleSeat } from './roles.js';
import type { SessionService } from './session.service.js';
import { issueSignUpTicket, redeemSignUpTicket } from './sign-up-ticket.js';

export interface CustomerAuthDeps {
  prisma: PrismaClient;
  sessions: SessionService;
  otp: PhoneOtpPort;
  cache: CachePort;
  config: OtpChannelConfig;
  audit: AuditService;
}

export interface SignInContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface IssuedCustomerSession {
  token: string;
  expiresAt: Date;
}

export type CustomerSignInResult = CustomerSignInResponse & {
  session: IssuedCustomerSession | null;
};

interface SignableUser {
  id: string;
  fullName: string | null;
  phone: string | null;
  status: string;
  roles: readonly RoleSeat[];
}

export function createCustomerAuthService({
  prisma,
  sessions,
  otp,
  cache,
  audit,
  config,
}: CustomerAuthDeps) {
  const proof = createPhoneProofService({ otp, cache, config });
  const identities = createIdentityService({ prisma, audit });

  function assertMaySignIn(user: SignableUser): void {
    if (user.status !== 'ACTIVE' || isSeatSuspended(user.roles, 'CUSTOMER')) {
      throw new ForbiddenError(CUSTOMER_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
    }
  }

  async function open(
    user: SignableUser & { fullName: string; phone: string },
    context: SignInContext,
    action: 'auth.login.customer' | 'auth.identity.created',
  ): Promise<{ customer: CustomerProfile; session: IssuedCustomerSession }> {
    await ensureSeat(prisma, { userId: user.id, role: 'CUSTOMER' });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const session = await sessions.issue({
      userId: user.id,
      scope: 'CUSTOMER',
      ip: context.ip,
      userAgent: context.userAgent,
    });

    logger.info(
      { event: 'auth.session.created', scope: 'CUSTOMER', method: 'PHONE', userId: user.id },
      'customer session created',
    );
    await audit.recordDetached({
      actorType: 'CUSTOMER',
      actorId: user.id,
      action,
      entityType: 'User',
      entityId: user.id,
      after: action === 'auth.identity.created' ? { provider: 'PHONE', seat: 'CUSTOMER' } : null,
    });

    return { customer: profileOf(user), session };
  }

  return {
    widget: () => proof.widget(),

    async signIn(
      input: CustomerSignInInput,
      context: SignInContext = {},
    ): Promise<CustomerSignInResult> {
      const proven = await proof.prove({
        phone: input.phone,
        accessToken: input.accessToken,
        purpose: 'CUSTOMER_LOGIN',
        ip: context.ip,
      });

      const user = await identities.findByVerifiedPhone(proven.phone);

      if (user?.fullName && user.phone) {
        assertMaySignIn(user);
        const opened = await open(
          { ...user, fullName: user.fullName, phone: user.phone },
          context,
          'auth.login.customer',
        );
        return {
          status: 'SIGNED_IN',
          customer: opened.customer,
          signUpToken: null,
          expiresAt: null,
          phoneDisplay: opened.customer.phoneDisplay,
          session: opened.session,
        };
      }

      if (user) assertMaySignIn(user);

      const ticket = issueSignUpTicket(proven.phone);
      return {
        status: 'NAME_REQUIRED',
        customer: null,
        signUpToken: ticket.token,
        expiresAt: ticket.expiresAt.toISOString(),
        phoneDisplay: formatPhone(proven.phone),
        session: null,
      };
    },

    async signUp(
      input: CustomerSignUpInput,
      context: SignInContext = {},
    ): Promise<{ customer: CustomerProfile; session: IssuedCustomerSession }> {
      const ticket = await redeemSignUpTicket(cache, input.signUpToken);

      const account = await identities.createWithPhone(
        { phone: ticket.phone, purpose: 'CUSTOMER_LOGIN', provenAt: new Date(ticket.issuedAt) },
        { fullName: input.fullName },
      );

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: account.userId },
        include: { roles: true },
      });
      assertMaySignIn(user);

      const named = user.fullName
        ? user
        : await prisma.user.update({
            where: { id: user.id },
            data: { fullName: input.fullName },
            include: { roles: true },
          });

      return open(
        { ...named, fullName: named.fullName ?? input.fullName, phone: ticket.phone },
        context,
        account.created ? 'auth.identity.created' : 'auth.login.customer',
      );
    },

    async me(userId: string): Promise<{ customer: CustomerProfile }> {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return {
        customer: profileOf({
          id: user.id,
          fullName: user.fullName ?? '',
          phone: user.phone ?? '',
        }),
      };
    },

    async logout(token: string | undefined): Promise<void> {
      await sessions.revoke(token);
    },
  };
}

export type CustomerAuthService = ReturnType<typeof createCustomerAuthService>;

function profileOf(user: { id: string; fullName: string; phone: string }): CustomerProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    phoneDisplay: formatPhone(user.phone),
  };
}
