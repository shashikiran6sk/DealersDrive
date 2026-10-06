import type { PlatformRole, Prisma, UserRoleStatus } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  MERGE_REFUSED_CONFLICTING,
  MERGE_REFUSED_STAFF,
  MERGE_REFUSED_UNAVAILABLE,
  OTHER_GOOGLE_ALREADY_LINKED,
} from './auth.messages.js';

export const IDENTITY_ALREADY_LINKED = 'IDENTITY_ALREADY_LINKED';

export type MergeProof = 'PHONE_OTP' | 'GOOGLE_OAUTH';

export interface MergeRequest {
  survivorId: string;
  absorbedId: string;
  proof: MergeProof;
}

export interface MergeOutcome {
  survivorId: string;
  merged: boolean;
}

export type MergeRefusal = 'unavailable' | 'staff' | 'google-on-both' | 'phone-on-both';

type MergeCandidate = Prisma.UserGetPayload<{
  include: { roles: true; identities: { select: { id: true; provider: true } } };
}>;

const MERGE_INCLUDE = {
  roles: true,
  identities: { select: { id: true, provider: true } },
} as const;

export function mergeRefusal(
  survivor: MergeCandidate,
  absorbed: MergeCandidate,
): MergeRefusal | null {
  if (survivor.status !== 'ACTIVE' || absorbed.status !== 'ACTIVE') return 'unavailable';
  if (!survivor.phone || !survivor.phoneVerifiedAt) return 'unavailable';
  if (isStaff(survivor) || isStaff(absorbed)) return 'staff';
  if (absorbed.phone) return 'phone-on-both';
  const survivorGoogle = survivor.identities.some((identity) => identity.provider === 'GOOGLE');
  const absorbedGoogle = absorbed.identities.some((identity) => identity.provider === 'GOOGLE');
  if (survivorGoogle && absorbedGoogle) return 'google-on-both';
  return null;
}

function isStaff(user: MergeCandidate): boolean {
  return user.isPlatformAdmin || user.roles.some((seat) => seat.role === 'ADMIN');
}

export function refusalError(reason: MergeRefusal): ConflictError {
  const message =
    reason === 'staff'
      ? MERGE_REFUSED_STAFF
      : reason === 'google-on-both'
        ? OTHER_GOOGLE_ALREADY_LINKED
        : reason === 'phone-on-both'
          ? MERGE_REFUSED_CONFLICTING
          : MERGE_REFUSED_UNAVAILABLE;
  return new ConflictError(IDENTITY_ALREADY_LINKED, message, { extra: { reason } });
}

export async function loadMergeCandidates(
  tx: Tx,
  first: string,
  second: string,
): Promise<Map<string, MergeCandidate>> {
  const ordered = [first, second].sort();
  for (const id of ordered) {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
  const rows = await tx.user.findMany({
    where: { id: { in: ordered } },
    include: MERGE_INCLUDE,
  });
  return new Map(rows.map((row) => [row.id, row]));
}

export async function mergeAccounts(
  tx: Tx,
  audit: AuditService,
  request: MergeRequest,
): Promise<MergeOutcome> {
  const { survivorId, absorbedId } = request;
  if (survivorId === absorbedId) return { survivorId, merged: false };

  const users = await loadMergeCandidates(tx, survivorId, absorbedId);
  const survivor = users.get(survivorId);
  const absorbed = users.get(absorbedId);
  if (!survivor || !absorbed) throw refusalError('unavailable');

  if (absorbed.mergedIntoId === survivorId) return { survivorId, merged: false };
  if (absorbed.mergedIntoId !== null) throw refusalError('unavailable');

  const refusal = mergeRefusal(survivor, absorbed);
  if (refusal) {
    logger.warn(
      { event: 'auth.identity.merge_refused', proof: request.proof, reason: refusal },
      'accounts could not be merged',
    );
    throw refusalError(refusal);
  }

  await moveMemberships(tx, absorbedId, survivorId);
  await moveSeats(tx, absorbed.roles, survivor.roles, survivorId);
  const moved = await moveCustomerHistory(tx, absorbedId, survivorId);

  await tx.oAuthIdentity.updateMany({
    where: { userId: absorbedId },
    data: { userId: survivorId },
  });

  const now = new Date();
  await tx.user.update({
    where: { id: absorbedId },
    data: { email: null, status: 'DELETED', mergedIntoId: survivorId, mergedAt: now },
  });

  const takeEmail = survivor.email === null && absorbed.email !== null;
  await tx.user.update({
    where: { id: survivorId },
    data: {
      ...(takeEmail
        ? { email: absorbed.email, emailVerifiedAt: absorbed.emailVerifiedAt ?? now }
        : {}),
      fullName: survivor.fullName ?? absorbed.fullName,
      lastLoginAt: now,
    },
  });

  await tx.session.updateMany({
    where: { userId: absorbedId, revokedAt: null },
    data: { revokedAt: now },
  });

  await audit.record(tx, {
    actorType: 'SYSTEM',
    actorId: survivorId,
    action: 'auth.identity.merged',
    entityType: 'User',
    entityId: survivorId,
    before: { absorbedUserId: absorbedId },
    after: {
      survivorUserId: survivorId,
      proof: request.proof,
      emailMoved: takeEmail,
      identitiesMoved: absorbed.identities.length,
      ...moved,
    },
  });

  logger.info(
    { event: 'auth.identity.merged', proof: request.proof, survivorId, absorbedId },
    'two accounts of one person were merged',
  );

  return { survivorId, merged: true };
}

async function moveMemberships(tx: Tx, from: string, to: string): Promise<void> {
  const memberships = await tx.dealerMember.findMany({
    where: { userId: from },
    select: { id: true, dealerId: true },
  });
  if (memberships.length === 0) return;

  const overlap = await tx.dealerMember.count({
    where: { userId: to, dealerId: { in: memberships.map((row) => row.dealerId) } },
  });
  if (overlap > 0) throw refusalError('phone-on-both');

  await tx.dealerMember.updateMany({ where: { userId: from }, data: { userId: to } });
}

async function moveSeats(
  tx: Tx,
  absorbed: readonly { role: PlatformRole; status: UserRoleStatus; reason: string | null }[],
  survivor: readonly { role: PlatformRole; status: UserRoleStatus }[],
  survivorId: string,
): Promise<void> {
  for (const seat of absorbed) {
    const held = survivor.find((entry) => entry.role === seat.role);
    if (!held) {
      await tx.userRole.create({
        data: {
          userId: survivorId,
          role: seat.role,
          status: seat.status,
          reason: seat.reason,
          suspendedAt: seat.status === 'SUSPENDED' ? new Date() : null,
        },
      });
    } else if (seat.status === 'SUSPENDED' && held.status === 'ACTIVE') {
      await tx.userRole.update({
        where: { userId_role: { userId: survivorId, role: seat.role } },
        data: { status: 'SUSPENDED', reason: seat.reason, suspendedAt: new Date() },
      });
    }
  }
}

async function moveCustomerHistory(
  tx: Tx,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const held = await tx.savedVehicle.findMany({
    where: { customerId: to },
    select: { listingId: true },
  });
  const duplicates = await tx.savedVehicle.deleteMany({
    where: { customerId: from, listingId: { in: held.map((row) => row.listingId) } },
  });
  const saved = await tx.savedVehicle.updateMany({
    where: { customerId: from },
    data: { customerId: to },
  });
  const enquiries = await tx.enquiry.updateMany({
    where: { customerId: from },
    data: { customerId: to },
  });
  await tx.enquiry.updateMany({ where: { contactedById: from }, data: { contactedById: to } });
  await tx.enquiry.updateMany({ where: { closedById: from }, data: { closedById: to } });
  const tickets = await tx.supportTicket.updateMany({
    where: { customerId: from },
    data: { customerId: to },
  });
  await tx.supportTicketMessage.updateMany({ where: { authorId: from }, data: { authorId: to } });

  return {
    savedVehiclesMoved: saved.count,
    savedVehiclesAlreadyHeld: duplicates.count,
    enquiriesMoved: enquiries.count,
    supportTicketsMoved: tickets.count,
  };
}
