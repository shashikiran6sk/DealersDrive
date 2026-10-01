import {
  INVITATION_TTL_DAYS,
  normaliseIndianMobile,
  type DealerTeamResponse,
  type InviteMemberInput,
  type TeamInvitation,
  type TeamMember,
  type UpdateMemberInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import { byRoleThenJoined, toTeamInvitation, toTeamMember } from './team.mapper.js';
import {
  ALREADY_MEMBER,
  INVITATION_NOT_FOUND,
  MEMBER_NOT_FOUND,
  OWNER_LOCKED,
} from './team.messages.js';

export interface TeamDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

export interface TeamActor {
  dealerId: string;
  userId: string;
}

export const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function lockDealership(tx: Tx, dealerId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id" = ${dealerId}::uuid FOR UPDATE`;
}

function memberNotFound(): NotFoundError {
  return new NotFoundError(MEMBER_NOT_FOUND, { code: 'MEMBER_NOT_FOUND' });
}

export function createTeamService({ prisma, audit }: TeamDeps) {
  async function manageableMember(tx: Tx, actor: TeamActor, memberId: string) {
    const member = await tx.dealerMember.findFirst({
      where: { id: memberId, dealerId: actor.dealerId, status: 'ACTIVE' },
      include: { user: true },
    });
    if (!member) throw memberNotFound();
    if (member.role === 'OWNER' || member.userId === actor.userId) {
      throw new ConflictError('OWNER_LOCKED', OWNER_LOCKED);
    }
    return member;
  }

  return {
    async team(dealerId: string, viewerId: string): Promise<DealerTeamResponse> {
      const now = new Date();
      const [members, invitations] = await Promise.all([
        prisma.dealerMember.findMany({
          where: { dealerId, status: 'ACTIVE' },
          include: { user: true },
        }),
        prisma.dealerInvitation.findMany({
          where: { dealerId, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return {
        members: [...members].sort(byRoleThenJoined).map((row) => toTeamMember(row, viewerId)),
        invitations: invitations.map((row) => toTeamInvitation(row, now)),
      };
    },

    async invite(actor: TeamActor, input: InviteMemberInput): Promise<TeamInvitation> {
      const phone = normaliseIndianMobile(input.phone) ?? input.phone;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

      return withTransaction(prisma, async (tx) => {
        await lockDealership(tx, actor.dealerId);

        const holder = await tx.user.findUnique({ where: { phone }, select: { id: true } });
        if (holder) {
          const member = await tx.dealerMember.findUnique({
            where: { dealerId_userId: { dealerId: actor.dealerId, userId: holder.id } },
            select: { status: true },
          });
          if (member?.status === 'ACTIVE') {
            throw new ConflictError('MEMBER_ALREADY_EXISTS', ALREADY_MEMBER);
          }
        }

        const waiting = await tx.dealerInvitation.findFirst({
          where: { dealerId: actor.dealerId, phone, status: 'PENDING' },
        });
        const row = waiting
          ? await tx.dealerInvitation.update({
              where: { id: waiting.id },
              data: { role: input.role, expiresAt, invitedBy: actor.userId },
            })
          : await tx.dealerInvitation.create({
              data: {
                dealerId: actor.dealerId,
                phone,
                role: input.role,
                expiresAt,
                invitedBy: actor.userId,
              },
            });

        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: waiting ? 'member.invitation_renewed' : 'member.invited',
          entityType: 'DealerInvitation',
          entityId: row.id,
          before: waiting ? { role: waiting.role } : null,
          after: { role: row.role, existingAccount: holder !== null },
        });

        return toTeamInvitation(row, now);
      });
    },

    async revokeInvitation(actor: TeamActor, invitationId: string): Promise<void> {
      await withTransaction(prisma, async (tx) => {
        await lockDealership(tx, actor.dealerId);
        const invitation = await tx.dealerInvitation.findFirst({
          where: { id: invitationId, dealerId: actor.dealerId, status: 'PENDING' },
        });
        if (!invitation) {
          throw new NotFoundError(INVITATION_NOT_FOUND, { code: 'INVITATION_NOT_FOUND' });
        }

        await tx.dealerInvitation.update({
          where: { id: invitation.id },
          data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actor.userId },
        });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: 'member.invitation_revoked',
          entityType: 'DealerInvitation',
          entityId: invitation.id,
          before: { status: 'PENDING', role: invitation.role },
          after: { status: 'REVOKED' },
        });
      });
    },

    async updateMember(
      actor: TeamActor,
      memberId: string,
      input: UpdateMemberInput,
    ): Promise<TeamMember> {
      return withTransaction(prisma, async (tx) => {
        await lockDealership(tx, actor.dealerId);
        const member = await manageableMember(tx, actor, memberId);
        if (member.role === input.role) return toTeamMember(member, actor.userId);

        const updated = await tx.dealerMember.update({
          where: { id: member.id },
          data: { role: input.role },
          include: { user: true },
        });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: 'member.role_changed',
          entityType: 'DealerMember',
          entityId: member.id,
          before: { role: member.role },
          after: { role: updated.role },
        });
        return toTeamMember(updated, actor.userId);
      });
    },

    async removeMember(actor: TeamActor, memberId: string): Promise<void> {
      await withTransaction(prisma, async (tx) => {
        await lockDealership(tx, actor.dealerId);
        const member = await manageableMember(tx, actor, memberId);

        await tx.dealerMember.update({
          where: { id: member.id },
          data: { status: 'REMOVED', removedAt: new Date(), removedBy: actor.userId },
        });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: 'member.removed',
          entityType: 'DealerMember',
          entityId: member.id,
          before: { status: 'ACTIVE', role: member.role },
          after: { status: 'REMOVED' },
        });
      });
    },
  };
}

export type TeamService = ReturnType<typeof createTeamService>;
