import type { Tx } from '../../platform/db/prisma.js';
import { UnauthorizedError } from '../../platform/errors.js';
import type { CustomerPrincipal } from './session.port.js';

export async function authorizeCustomerWrite(tx: Tx, customer: CustomerPrincipal): Promise<void> {
  const users = await tx.$queryRaw<
    {
      status: string;
      phone: string | null;
      phoneVerifiedAt: Date | null;
      fullName: string | null;
    }[]
  >`
    SELECT "status","phone","phoneVerifiedAt","fullName" FROM "users"
    WHERE "id"=${customer.userId}::uuid FOR SHARE SKIP LOCKED`;
  const user = users[0];
  if (
    !user ||
    user.status !== 'ACTIVE' ||
    !user.phone ||
    !user.phoneVerifiedAt ||
    !user.fullName ||
    user.phone !== customer.phone
  )
    throw new UnauthorizedError('Verify your customer account again to send an enquiry.');
  const roles = await tx.$queryRaw<
    { role: string; status: string }[]
  >`SELECT "role","status" FROM "user_roles"
    WHERE "userId"=${customer.userId}::uuid FOR SHARE`;
  if (
    roles.some(
      (role) =>
        role.status === 'SUSPENDED' &&
        (role.role === 'CUSTOMER' || (customer.via === 'DEALER' && role.role === 'DEALER')),
    )
  )
    throw new UnauthorizedError();
  if (!customer.sessionId) throw new UnauthorizedError();
  const sessions = await tx.$queryRaw<
    { userId: string; scope: string; revokedAt: Date | null; expiresAt: Date }[]
  >`
    SELECT "userId","scope","revokedAt","expiresAt" FROM "sessions"
    WHERE "id"=${customer.sessionId}::uuid FOR SHARE SKIP LOCKED`;
  const session = sessions[0];
  if (
    !session ||
    session.userId !== customer.userId ||
    session.scope !== customer.via ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now()
  )
    throw new UnauthorizedError();
}
