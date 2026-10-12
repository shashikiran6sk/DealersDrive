import type { AdminPermission } from '@dealers-drive/contracts';

import type { Tx } from '../../platform/db/prisma.js';
import { ForbiddenError } from '../../platform/errors.js';
import {
  ADMIN_MEMBERSHIP_LOCK,
  isAdmitted,
  isSeatSuspended,
  permissionsForMember,
  type AdminPrincipal,
} from '../auth/auth.facade.js';

export async function assertCurrentAdmin(
  tx: Tx,
  admin: AdminPrincipal,
  permission: AdminPermission,
  refusal: string,
  revoked: string,
): Promise<void> {
  if (!admin.permissions.includes(permission)) throw new ForbiddenError(refusal);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ADMIN_MEMBERSHIP_LOCK}))`;
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${admin.userId}::uuid FOR SHARE`;
  const actor = await tx.user.findUnique({
    where: { id: admin.userId },
    include: { roles: true, adminMember: true },
  });
  if (
    !actor ||
    !isAdmitted({ email: actor.email, status: actor.status, member: actor.adminMember }) ||
    isSeatSuspended(actor.roles, 'ADMIN') ||
    !actor.adminMember ||
    !permissionsForMember(actor.adminMember.role).includes(permission)
  )
    throw new ForbiddenError(revoked);
}
