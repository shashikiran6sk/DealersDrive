import type { Tx } from '../../platform/db/prisma.js';
import { ForbiddenError } from '../../platform/errors.js';
import { isSeatSuspended } from './roles.js';
import {
  CUSTOMER_DEACTIVATED,
  CUSTOMER_SUSPENDED,
  CUSTOMER_PHONE_CHANGED,
} from './auth.messages.js';

export async function requireCustomerAccess(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR SHARE`;
  const user = await tx.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!user || user.status !== 'ACTIVE' || isSeatSuspended(user.roles, 'CUSTOMER'))
    throw new ForbiddenError(CUSTOMER_SUSPENDED, { code: 'ACCOUNT_UNAVAILABLE' });
  if (user.customerDeactivatedAt)
    throw new ForbiddenError(CUSTOMER_DEACTIVATED, { code: 'CUSTOMER_DEACTIVATED' });
  if (!user.phone || !user.phoneVerifiedAt || !user.fullName)
    throw new ForbiddenError(CUSTOMER_PHONE_CHANGED, { code: 'CUSTOMER_PHONE_CHANGED' });
  return user;
}
