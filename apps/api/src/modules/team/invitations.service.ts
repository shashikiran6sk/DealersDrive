import {
  DEALER_ROLE_LABELS,
  type AcceptInvitationResponse,
  type MyInvitationsResponse,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { CustomerPrincipal } from '../auth/auth.facade.js';
import { ensureSeat } from '../auth/auth.facade.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import { effectiveStatus, toMyInvitation } from './team.mapper.js';
import {
  ALREADY_IN_DEALERSHIP,
  DEALERSHIP_NOT_ACCEPTING,
  INVITATION_CLOSED,
  INVITATION_EXPIRED,
  INVITATION_NOT_FOUND,
} from './team.messages.js';
import { lockDealership } from './team.service.js';

export interface InvitationsDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

function notFound(): NotFoundError {
  return new NotFoundError(INVITATION_NOT_FOUND, { code: 'INVITATION_NOT_FOUND' });
}

async function lockOwnPending(tx: Tx, customer: CustomerPrincipal, invitationId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "dealer_invitations"
    WHERE "id" = ${invitationId}::uuid AND "phone" = ${customer.phone}
    FOR UPDATE`;
  if (locked.length === 0) throw notFound();

  const invitation = await tx.dealerInvitation.findUniqueOrThrow({
    where: { id: invitationId },
    include: { dealer: { select: { brandName: true, status: true } } },
  });
  const status = effectiveStatus(invitation);
  if (status === 'EXPIRED') {
    throw new ConflictError('INVITATION_EXPIRED', INVITATION_EXPIRED);
  }
  if (status !== 'PENDING') {
    throw new ConflictError('INVITATION_CLOSED', INVITATION_CLOSED[status] ?? INVITATION_EXPIRED, {
      extra: { invitationStatus: status },
    });
  }
  return invitation;
}

export function createInvitationsService({ prisma, audit }: InvitationsDeps) {
  return {
    async mine(customer: CustomerPrincipal): Promise<MyInvitationsResponse> {
      const rows = await prisma.dealerInvitation.findMany({
        where: {
          phone: customer.phone,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
          dealer: {
            status: 'ACTIVE',
            members: { none: { userId: customer.userId, status: 'ACTIVE' } },
          },
        },
        include: { dealer: { select: { brandName: true, city: true } } },
        orderBy: { createdAt: 'desc' },
      });

      const inviterIds = [
        ...new Set(rows.flatMap((row) => (row.invitedBy ? [row.invitedBy] : []))),
      ];
      const inviters = inviterIds.length
        ? await prisma.user.findMany({
            where: { id: { in: inviterIds } },
            select: { id: true, fullName: true },
          })
        : [];
      const names = new Map(inviters.map((user) => [user.id, user.fullName]));

      return {
        data: rows.map((row) =>
          toMyInvitation(row, (row.invitedBy ? names.get(row.invitedBy) : null) ?? null),
        ),
      };
    },

    async accept(
      customer: CustomerPrincipal,
      invitationId: string,
    ): Promise<AcceptInvitationResponse> {
      return withTransaction(prisma, async (tx) => {
        const candidate = await tx.dealerInvitation.findFirst({
          where: { id: invitationId, phone: customer.phone },
          select: { dealerId: true },
        });
        if (!candidate) throw notFound();
        await lockDealership(tx, candidate.dealerId);
        const invitation = await lockOwnPending(tx, customer, invitationId);

        if (invitation.dealer.status !== 'ACTIVE') {
          throw new ConflictError('DEALERSHIP_NOT_ACCEPTING', DEALERSHIP_NOT_ACCEPTING);
        }

        const existing = await tx.dealerMember.findUnique({
          where: {
            dealerId_userId: { dealerId: invitation.dealerId, userId: customer.userId },
          },
        });
        if (existing?.status === 'ACTIVE') {
          throw new ConflictError('ALREADY_A_MEMBER', ALREADY_IN_DEALERSHIP);
        }

        const joined = { role: invitation.role, invitedBy: invitation.invitedBy };
        const member = existing
          ? await tx.dealerMember.update({
              where: { id: existing.id },
              data: { ...joined, status: 'ACTIVE', removedAt: null, removedBy: null },
            })
          : await tx.dealerMember.create({
              data: {
                ...joined,
                dealerId: invitation.dealerId,
                userId: customer.userId,
                permissions: [],
              },
            });

        await tx.dealerInvitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED', respondedBy: customer.userId, respondedAt: new Date() },
        });
        await ensureSeat(tx, { userId: customer.userId, role: 'DEALER' });

        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: customer.userId,
          dealerId: invitation.dealerId,
          action: 'member.joined',
          entityType: 'DealerMember',
          entityId: member.id,
          before: existing ? { status: existing.status } : null,
          after: { role: member.role, invitationId: invitation.id },
        });

        return {
          membershipId: member.id,
          dealer: { brandName: invitation.dealer.brandName },
          role: member.role,
          roleLabel: DEALER_ROLE_LABELS[member.role],
        };
      });
    },

    async decline(customer: CustomerPrincipal, invitationId: string): Promise<void> {
      await withTransaction(prisma, async (tx) => {
        const invitation = await lockOwnPending(tx, customer, invitationId);
        await tx.dealerInvitation.update({
          where: { id: invitation.id },
          data: { status: 'DECLINED', respondedBy: customer.userId, respondedAt: new Date() },
        });
        await audit.record(tx, {
          actorType: 'CUSTOMER',
          actorId: customer.userId,
          dealerId: invitation.dealerId,
          action: 'member.invitation_declined',
          entityType: 'DealerInvitation',
          entityId: invitation.id,
          after: { status: 'DECLINED' },
        });
      });
    },
  };
}

export type InvitationsService = ReturnType<typeof createInvitationsService>;
