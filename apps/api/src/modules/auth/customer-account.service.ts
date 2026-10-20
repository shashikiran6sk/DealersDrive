import { CustomerAccountStatus, CustomerDeactivationReceipt } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ForbiddenError } from '../../platform/errors.js';
import { withdrawCustomerSharing } from '../legal/legal.facade.js';
import type { CustomerPrincipal } from './session.port.js';
import type { PresentedCustomerCredential } from './customer-session.js';
import type { SessionService } from './session.service.js';
import { requireCustomerAccess } from './customer-access.js';
import { CUSTOMER_REAUTH_REQUIRED } from './auth.messages.js';

const FRESH_AUTH_MS = 10 * 60 * 1000;
export function createCustomerAccountService({
  prisma,
  sessions,
  audit,
}: {
  prisma: PrismaClient;
  sessions: SessionService;
  audit: AuditService;
}) {
  async function recent(customer: CustomerPrincipal, credential: PresentedCustomerCredential) {
    const session = credential.native
      ? await sessions.resolveNative(credential.token)
      : await sessions.resolve(credential.token, 'CUSTOMER');
    return session &&
      session.userId === customer.userId &&
      session.authenticationMethod === 'PHONE_OTP' &&
      session.authenticatedAt &&
      session.user.phoneVerifiedAt &&
      session.authenticatedAt >= session.user.phoneVerifiedAt &&
      session.authenticatedAt.getTime() >= Date.now() - FRESH_AUTH_MS &&
      session.authenticatedAt.getTime() <= Date.now()
      ? session
      : null;
  }
  return {
    async status(this: void, customer: CustomerPrincipal, credential: PresentedCustomerCredential) {
      return CustomerAccountStatus.parse({
        canDeactivate: Boolean(await recent(customer, credential)),
      });
    },
    async deactivate(
      this: void,
      customer: CustomerPrincipal,
      credential: PresentedCustomerCredential,
    ) {
      const session = await recent(customer, credential);
      if (!session)
        throw new ForbiddenError(CUSTOMER_REAUTH_REQUIRED, { code: 'CUSTOMER_REAUTH_REQUIRED' });
      await withTransaction(prisma, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${customer.userId}::uuid FOR UPDATE`;
        const user = await requireCustomerAccess(tx, customer.userId);
        const current = await tx.session.findFirst({
          where: {
            id: session.id,
            userId: customer.userId,
            scope: 'CUSTOMER',
            authenticationMethod: 'PHONE_OTP',
            revokedAt: null,
            expiresAt: { gt: new Date() },
            authenticatedAt: {
              gte: new Date(
                Math.max(Date.now() - FRESH_AUTH_MS, user.phoneVerifiedAt?.getTime() ?? Date.now()),
              ),
              lte: new Date(),
            },
          },
        });
        if (!current)
          throw new ForbiddenError(CUSTOMER_REAUTH_REQUIRED, { code: 'CUSTOMER_REAUTH_REQUIRED' });
        const withdrawn = await withdrawCustomerSharing(tx, customer.userId);
        const now = new Date();
        await tx.user.update({
          where: { id: customer.userId },
          data: { customerDeactivatedAt: now },
        });
        await tx.session.updateMany({
          where: { userId: customer.userId, scope: 'CUSTOMER', revokedAt: null },
          data: { revokedAt: now },
        });
        await audit.record(tx, {
          actorType: 'CUSTOMER',
          actorId: customer.userId,
          action: 'auth.customer.deactivated',
          entityType: 'User',
          entityId: customer.userId,
          after: {
            customerDeactivated: true,
            sharingGrantsWithdrawn: withdrawn.grants,
            legacyEnquiriesWithdrawn: withdrawn.legacyEnquiries,
          },
        });
      });
      return CustomerDeactivationReceipt.parse({ deactivated: true });
    },
  };
}
