import { requireCurrentAcceptance, acceptTerms } from '../legal/legal.facade.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import {
  formatPhone,
  type CustomerProfile,
  type CustomerSignInInput,
  type CustomerSignInResponse,
  type CustomerSignUpInput,
  type CustomerReactivationInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { ForbiddenError } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  CUSTOMER_SUSPENDED,
  CUSTOMER_DEACTIVATED,
  CUSTOMER_PHONE_CHANGED,
} from './auth.messages.js';
import { createCustomerAccountService } from './customer-account.service.js';
import {
  issueCustomerReactivation,
  redeemCustomerReactivation,
} from './customer-reactivation-ticket.js';
import { createIdentityService } from './identity.service.js';
import { createPhoneProofService } from './phone-proof.service.js';
import { ensureSeat, isSeatSuspended, type RoleSeat } from './roles.js';
import type { SessionService } from './session.service.js';
import { issueSignUpTicket, redeemSignUpTicket } from './sign-up-ticket.js';

export interface CustomerAuthDeps {
  prisma: PrismaClient;
  sessions: SessionService;
  otp: PhoneOtpPort;
  cache: CachePort;
  audit: AuditService;
}

export interface SignInContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
  native?: boolean;
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
  customerDeactivatedAt?: Date | null;
}

export function createCustomerAuthService({
  prisma,
  sessions,
  otp,
  cache,
  audit,
}: CustomerAuthDeps) {
  const proof = createPhoneProofService({ otp, cache });
  const identities = createIdentityService({ prisma, audit });
  const accounts = createCustomerAccountService({ prisma, sessions, audit });

  function assertMaySignIn(user: SignableUser): void {
    if (user.status !== 'ACTIVE' || isSeatSuspended(user.roles, 'CUSTOMER')) {
      throw new ForbiddenError(CUSTOMER_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
    }
    if (user.customerDeactivatedAt)
      throw new ForbiddenError(CUSTOMER_DEACTIVATED, { code: 'CUSTOMER_DEACTIVATED' });
  }

  async function open(
    user: SignableUser & { fullName: string; phone: string },
    context: SignInContext,
    action: 'auth.login.customer' | 'auth.identity.created',
    authenticatedAt: Date,
  ): Promise<{ customer: CustomerProfile; session: IssuedCustomerSession }> {
    const session = await withTransaction(prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { roles: true },
      });
      assertMaySignIn(current);
      if (
        current.phone !== user.phone ||
        !current.phoneVerifiedAt ||
        current.phoneVerifiedAt > authenticatedAt
      )
        throw new ForbiddenError(CUSTOMER_PHONE_CHANGED, { code: 'CUSTOMER_PHONE_CHANGED' });
      await ensureSeat(tx, { userId: user.id, role: 'CUSTOMER' });
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return sessions.issue(
        {
          userId: user.id,
          scope: 'CUSTOMER',
          authenticationMethod: 'PHONE_OTP',
          authenticatedAt,
          native: context.native === true,
          ip: context.ip,
          userAgent: context.userAgent,
        },
        tx,
      );
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
    accountStatus: accounts.status,
    deactivate: accounts.deactivate,
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
      if (
        user?.customerDeactivatedAt &&
        user.status === 'ACTIVE' &&
        !isSeatSuspended(user.roles, 'CUSTOMER')
      ) {
        const ticket = issueCustomerReactivation(user.id, proven.phone);
        return {
          status: 'REACTIVATION_REQUIRED',
          customer: null,
          signUpToken: null,
          reactivationToken: ticket.token,
          reactivationName: user.fullName ?? '',
          expiresAt: ticket.expiresAt.toISOString(),
          phoneDisplay: formatPhone(proven.phone),
          session: null,
        };
      }

      if (user?.fullName && user.phone) {
        assertMaySignIn(user);
        const opened = await open(
          { ...user, fullName: user.fullName, phone: user.phone },
          context,
          'auth.login.customer',
          proven.provenAt,
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
      requireCurrentAcceptance(input.agreement);
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

      await withTransaction(prisma, async (tx) => {
        await acceptTerms(tx, named.id, input.agreement, 'customer-registration');
      });

      return open(
        { ...named, fullName: named.fullName ?? input.fullName, phone: ticket.phone },
        context,
        account.created ? 'auth.identity.created' : 'auth.login.customer',
        new Date(ticket.issuedAt),
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
    async reactivate(input: CustomerReactivationInput, context: SignInContext = {}) {
      const ticket = await redeemCustomerReactivation(cache, input.reactivationToken);
      const user = await withTransaction(prisma, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${ticket.userId}::uuid FOR UPDATE`;
        const current = await tx.user.findUniqueOrThrow({
          where: { id: ticket.userId },
          include: { roles: true },
        });
        if (current.status !== 'ACTIVE' || isSeatSuspended(current.roles, 'CUSTOMER'))
          throw new ForbiddenError(CUSTOMER_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
        if (
          current.phone !== ticket.phone ||
          !current.phoneVerifiedAt ||
          current.phoneVerifiedAt.getTime() > ticket.issuedAt ||
          !current.fullName
        )
          throw new ForbiddenError(CUSTOMER_PHONE_CHANGED, { code: 'CUSTOMER_PHONE_CHANGED' });
        if (current.customerDeactivatedAt) {
          await tx.user.update({
            where: { id: current.id },
            data: { customerDeactivatedAt: null },
          });
          await audit.record(tx, {
            actorType: 'CUSTOMER',
            actorId: current.id,
            action: 'auth.customer.reactivated',
            entityType: 'User',
            entityId: current.id,
            after: { customerDeactivated: false },
          });
        }
        return {
          ...current,
          customerDeactivatedAt: null,
          phone: ticket.phone,
          fullName: current.fullName,
        };
      });
      return open(user, context, 'auth.login.customer', new Date(ticket.issuedAt));
    },

    async logout(token: string | undefined): Promise<void> {
      if (await sessions.resolvePerson(token)) await sessions.revoke(token);
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
