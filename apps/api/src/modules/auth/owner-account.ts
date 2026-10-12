import { ConflictError, ForbiddenError } from '../../platform/errors.js';
import type { Tx } from '../../platform/db/prisma.js';
import {
  OWNER_ACCOUNT_UNAVAILABLE,
  OWNER_EMAIL_MISMATCH,
  OWNER_HAS_DEALERSHIP,
  OWNER_IDENTITY_SPLIT,
  OWNER_PHONE_MISMATCH,
  OWNER_STAFF_ACCOUNT,
} from './auth.messages.js';
import { isAllowlistedAdmin } from './admin-allowlist.js';
import { ensureSeat } from './roles.js';

export interface VerifiedContact {
  phone: string;
  phoneVerifiedAt: Date;
  email: string;
  emailVerifiedAt: Date;
  fullName: string | null;
}

export interface OwnerAccount {
  userId: string;
  created: boolean;
}

const ACCOUNT_SELECT = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  status: true,
  isPlatformAdmin: true,
  phoneVerifiedAt: true,
  emailVerifiedAt: true,
  adminMember: { select: { id: true } },
  roles: { select: { role: true, status: true } },
  memberships: { where: { status: 'ACTIVE' as const }, select: { id: true } },
};

function conflict(code: string, message: string): ConflictError {
  return new ConflictError(code, message);
}

export async function provisionOwnerAccount(
  tx: Tx,
  contact: VerifiedContact,
): Promise<OwnerAccount> {
  const email = contact.email.toLowerCase();
  if (isAllowlistedAdmin(email)) {
    throw new ForbiddenError(OWNER_STAFF_ACCOUNT, { code: 'OWNER_STAFF_ACCOUNT' });
  }
  const [byPhone, byEmail] = await Promise.all([
    tx.user.findUnique({ where: { phone: contact.phone }, select: ACCOUNT_SELECT }),
    tx.user.findUnique({ where: { email }, select: ACCOUNT_SELECT }),
  ]);
  if (byPhone && byEmail && byPhone.id !== byEmail.id) {
    throw conflict('OWNER_IDENTITY_SPLIT', OWNER_IDENTITY_SPLIT);
  }

  const existing = byPhone ?? byEmail;
  if (!existing) {
    const user = await tx.user.create({
      data: {
        phone: contact.phone,
        phoneVerifiedAt: contact.phoneVerifiedAt,
        email,
        emailVerifiedAt: contact.emailVerifiedAt,
        fullName: contact.fullName,
      },
      select: { id: true },
    });
    await ensureSeat(tx, { userId: user.id, role: 'DEALER' });
    return { userId: user.id, created: true };
  }

  if (existing.phone && existing.phone !== contact.phone) {
    throw conflict('OWNER_PHONE_MISMATCH', OWNER_PHONE_MISMATCH);
  }
  if (existing.email && existing.email.toLowerCase() !== email) {
    throw conflict('OWNER_EMAIL_MISMATCH', OWNER_EMAIL_MISMATCH);
  }
  const staff =
    existing.isPlatformAdmin ||
    existing.adminMember !== null ||
    existing.roles.some((seat) => seat.role === 'ADMIN');
  if (staff) throw new ForbiddenError(OWNER_STAFF_ACCOUNT, { code: 'OWNER_STAFF_ACCOUNT' });
  if (
    existing.status !== 'ACTIVE' ||
    existing.roles.some((seat) => seat.role === 'DEALER' && seat.status === 'SUSPENDED')
  ) {
    throw new ForbiddenError(OWNER_ACCOUNT_UNAVAILABLE, { code: 'OWNER_ACCOUNT_UNAVAILABLE' });
  }
  if (existing.memberships.length > 0) {
    throw conflict('OWNER_HAS_DEALERSHIP', OWNER_HAS_DEALERSHIP);
  }

  await tx.user.update({
    where: { id: existing.id },
    data: {
      phone: contact.phone,
      phoneVerifiedAt: existing.phoneVerifiedAt ?? contact.phoneVerifiedAt,
      email,
      emailVerifiedAt: existing.emailVerifiedAt ?? contact.emailVerifiedAt,
      fullName: existing.fullName ?? contact.fullName,
    },
  });
  await ensureSeat(tx, { userId: existing.id, role: 'DEALER' });
  return { userId: existing.id, created: false };
}
