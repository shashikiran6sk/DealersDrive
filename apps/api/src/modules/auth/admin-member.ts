import { adminPermissionsFor } from '@dealers-drive/contracts';
import type {
  AdminMember,
  AdminMemberStatus,
  AdminRole,
  Prisma,
  PrismaClient,
} from '@prisma/client';

import { isAllowlistedAdmin } from './admin-allowlist.js';
import { grantSeat, setSeatStatus } from './roles.js';

type Db = PrismaClient | Prisma.TransactionClient;

export interface AdmissionSubject {
  email: string | null;
  status: string;
  member: Pick<AdminMember, 'status' | 'source' | 'role'> | null;
}

export function isAdmitted(subject: AdmissionSubject): boolean {
  const { member } = subject;
  if (subject.status !== 'ACTIVE' || !member || member.status !== 'ACTIVE') return false;
  if (member.source === 'BOOTSTRAP') return isAllowlistedAdmin(subject.email);
  return true;
}

export function permissionsForMember(role: AdminRole): string[] {
  return adminPermissionsFor(role);
}

export async function findMemberByUser(db: Db, userId: string): Promise<AdminMember | null> {
  return db.adminMember.findUnique({ where: { userId } });
}

export async function syncLegacyAdminColumns(
  db: Db,
  input: {
    userId: string;
    role: AdminRole;
    status: AdminMemberStatus;
    grantedBy: string | null;
  },
): Promise<void> {
  const admitted = input.status !== 'DISABLED';
  await db.user.update({
    where: { id: input.userId },
    data: { isPlatformAdmin: admitted, adminRole: admitted ? input.role : null },
  });

  if (admitted && input.grantedBy) {
    await grantSeat(db, { userId: input.userId, role: 'ADMIN', grantedBy: input.grantedBy });
    return;
  }
  await setSeatStatus(db, {
    userIds: [input.userId],
    role: 'ADMIN',
    status: admitted ? 'ACTIVE' : 'SUSPENDED',
    reason: admitted ? null : 'Admin Member disabled',
  });
}

export async function revokeAdminSessions(db: Db, userId: string): Promise<number> {
  const revoked = await db.session.updateMany({
    where: { userId, scope: 'ADMIN', revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return revoked.count;
}
