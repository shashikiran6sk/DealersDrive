import {
  ADMIN_MEMBER_STATUS_LABELS,
  ADMIN_ROLE_LABELS,
  timeAgo,
  type AdminMemberDto,
  type AdminMemberHistoryResponse,
  type AdminMembersQuery,
  type AdminMembersResponse,
  type DisableAdminMemberInput,
  type InviteAdminMemberInput,
  type UpdateAdminMemberInput,
} from '@dealers-drive/contracts';
import type { AdminMember, AdminRole, PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  isAllowlistedAdmin,
  ADMIN_MEMBERSHIP_LOCK,
  revokeAdminSessions,
  syncLegacyAdminColumns,
  type AdminPrincipal,
} from '../auth/auth.facade.js';
import {
  HISTORY_LABELS,
  LAST_SUPER_ADMIN,
  MEMBER_ALREADY_DISABLED,
  MEMBER_ALREADY_EXISTS,
  MEMBER_BOOTSTRAP,
  MEMBER_NOT_DISABLED,
  MEMBER_NOT_FOUND,
  MEMBER_SELF,
} from './admin-members.messages.js';

export interface AdminMembersDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

type MemberRow = AdminMember & {
  user: { email: string | null; fullName: string | null };
};

const MEMBER_INCLUDE = { user: { select: { email: true, fullName: true } } } as const;

const HISTORY_LIMIT = 50;

const MEMBERSHIP_LOCK = ADMIN_MEMBERSHIP_LOCK;

function assertManager(admin: AdminPrincipal): void {
  if (!admin.permissions.includes('admin:access:manage')) {
    throw new ForbiddenError('This action needs the admin:access:manage permission.');
  }
}

export function createAdminMembersService({ prisma, audit }: AdminMembersDeps) {
  function lockedReason(admin: AdminPrincipal, member: MemberRow): string | null {
    if (member.userId === admin.userId) return 'This is you';
    if (member.source === 'BOOTSTRAP' || isAllowlistedAdmin(member.user.email)) {
      return 'Set in ADMIN_ALLOWLIST';
    }
    return null;
  }

  function toDto(
    admin: AdminPrincipal,
    member: MemberRow,
    inviters: ReadonlyMap<string, string | null>,
  ): AdminMemberDto {
    return {
      id: member.id,
      userId: member.userId,
      name: member.user.fullName,
      email: member.user.email ?? '',
      role: member.role,
      roleLabel: ADMIN_ROLE_LABELS[member.role],
      status: member.status,
      statusLabel: ADMIN_MEMBER_STATUS_LABELS[member.status],
      source: member.source,
      invitedByEmail: member.invitedBy ? (inviters.get(member.invitedBy) ?? null) : null,
      invitedAt: member.invitedAt.toISOString(),
      activatedAt: member.activatedAt?.toISOString() ?? null,
      lastLoginLabel: member.lastLoginAt ? timeAgo(member.lastLoginAt) : 'Never',
      disabledAt: member.disabledAt?.toISOString() ?? null,
      disabledReason: member.disabledReason,
      isYou: member.userId === admin.userId,
      lockedReason: lockedReason(admin, member),
    };
  }

  async function inviterEmails(members: readonly MemberRow[]): Promise<Map<string, string | null>> {
    const ids = [
      ...new Set(members.map((m) => m.invitedBy).filter((id): id is string => id !== null)),
    ];
    if (ids.length === 0) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    });
    return new Map(users.map((user) => [user.id, user.email]));
  }

  async function dtoOf(admin: AdminPrincipal, member: MemberRow): Promise<AdminMemberDto> {
    return toDto(admin, member, await inviterEmails([member]));
  }

  async function lockMember(tx: Tx, id: string): Promise<MemberRow> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${MEMBERSHIP_LOCK}))`;
    const member = await tx.adminMember.findUnique({ where: { id }, include: MEMBER_INCLUDE });
    if (!member) throw new NotFoundError(MEMBER_NOT_FOUND, { code: 'ADMIN_MEMBER_NOT_FOUND' });
    return member;
  }

  function assertManageable(admin: AdminPrincipal, member: MemberRow): void {
    if (member.userId === admin.userId) {
      throw new ForbiddenError(MEMBER_SELF, { code: 'ADMIN_MEMBER_SELF' });
    }
    if (member.source === 'BOOTSTRAP' || isAllowlistedAdmin(member.user.email)) {
      throw new ConflictError('ADMIN_MEMBER_BOOTSTRAP', MEMBER_BOOTSTRAP);
    }
  }

  async function assertNotLastSuperAdmin(tx: Tx, member: MemberRow, nextRole?: AdminRole) {
    if (member.role !== 'SUPER_ADMIN' || member.status !== 'ACTIVE') return;
    if (nextRole === 'SUPER_ADMIN') return;
    const others = await tx.adminMember.count({
      where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: member.id } },
    });
    if (others === 0) throw new ConflictError('ADMIN_MEMBER_LAST_SUPER_ADMIN', LAST_SUPER_ADMIN);
  }

  return {
    async list(admin: AdminPrincipal, query: AdminMembersQuery): Promise<AdminMembersResponse> {
      assertManager(admin);

      const [members, grouped] = await Promise.all([
        prisma.adminMember.findMany({
          where: {
            ...(query.status ? { status: query.status } : {}),
            ...(query.role ? { role: query.role } : {}),
          },
          include: MEMBER_INCLUDE,
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.adminMember.groupBy({
          by: ['status'],
          where: query.role ? { role: query.role } : {},
          _count: { _all: true },
        }),
      ]);

      const inviters = await inviterEmails(members);
      const counts = { ALL: 0, INVITED: 0, ACTIVE: 0, DISABLED: 0 };
      for (const row of grouped) {
        counts[row.status] = row._count._all;
        counts.ALL += row._count._all;
      }

      return { data: members.map((member) => toDto(admin, member, inviters)), counts };
    },

    async invite(admin: AdminPrincipal, input: InviteAdminMemberInput): Promise<AdminMemberDto> {
      assertManager(admin);

      const member = await withTransaction(prisma, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${MEMBERSHIP_LOCK}))`;
        const user =
          (await tx.user.findUnique({ where: { email: input.email } })) ??
          (await tx.user.create({
            data: { email: input.email, fullName: input.name ?? null },
          }));

        if (user.status !== 'ACTIVE') {
          throw new ConflictError('ADMIN_MEMBER_UNAVAILABLE', MEMBER_ALREADY_EXISTS);
        }
        const existing = await tx.adminMember.findUnique({ where: { userId: user.id } });
        if (existing) throw new ConflictError('ADMIN_MEMBER_EXISTS', MEMBER_ALREADY_EXISTS);

        if (input.name && !user.fullName) {
          await tx.user.update({ where: { id: user.id }, data: { fullName: input.name } });
        }

        const created = await tx.adminMember.create({
          data: {
            userId: user.id,
            role: input.role,
            status: 'INVITED',
            source: 'INVITED',
            invitedBy: admin.userId,
          },
          include: MEMBER_INCLUDE,
        });

        await syncLegacyAdminColumns(tx, {
          userId: user.id,
          role: created.role,
          status: created.status,
          grantedBy: admin.userId,
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: 'admin_member.invited',
          entityType: 'AdminMember',
          entityId: created.id,
          after: { email: input.email, role: created.role, status: created.status },
        });

        return created;
      });

      logger.info(
        { event: 'admin_member.invited', adminMemberId: member.id, actorId: admin.userId },
        'team member invited',
      );
      return dtoOf(admin, member);
    },

    async changeRole(
      admin: AdminPrincipal,
      id: string,
      input: UpdateAdminMemberInput,
    ): Promise<AdminMemberDto> {
      assertManager(admin);

      const member = await withTransaction(prisma, async (tx) => {
        const current = await lockMember(tx, id);
        assertManageable(admin, current);
        if (current.role === input.role) return current;
        await assertNotLastSuperAdmin(tx, current, input.role);

        const updated = await tx.adminMember.update({
          where: { id },
          data: { role: input.role, roleChangedAt: new Date() },
          include: MEMBER_INCLUDE,
        });
        await syncLegacyAdminColumns(tx, {
          userId: updated.userId,
          role: updated.role,
          status: updated.status,
          grantedBy: updated.invitedBy,
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: 'admin_member.role_changed',
          entityType: 'AdminMember',
          entityId: id,
          before: { role: current.role },
          after: { role: updated.role },
        });
        return updated;
      });

      return dtoOf(admin, member);
    },

    async disable(
      admin: AdminPrincipal,
      id: string,
      input: DisableAdminMemberInput,
    ): Promise<AdminMemberDto> {
      assertManager(admin);

      const member = await withTransaction(prisma, async (tx) => {
        const current = await lockMember(tx, id);
        assertManageable(admin, current);
        if (current.status === 'DISABLED') {
          throw new ConflictError('ADMIN_MEMBER_DISABLED', MEMBER_ALREADY_DISABLED);
        }
        await assertNotLastSuperAdmin(tx, current);

        const updated = await tx.adminMember.update({
          where: { id },
          data: {
            status: 'DISABLED',
            disabledAt: new Date(),
            disabledBy: admin.userId,
            disabledReason: input.reason,
          },
          include: MEMBER_INCLUDE,
        });
        await syncLegacyAdminColumns(tx, {
          userId: updated.userId,
          role: updated.role,
          status: 'DISABLED',
          grantedBy: null,
        });
        const sessionsRevoked = await revokeAdminSessions(tx, updated.userId);

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: 'admin_member.disabled',
          entityType: 'AdminMember',
          entityId: id,
          before: { status: current.status },
          after: { status: 'DISABLED', reason: input.reason, sessionsRevoked },
        });
        return updated;
      });

      logger.info(
        { event: 'admin_member.disabled', adminMemberId: id, actorId: admin.userId },
        'team member disabled',
      );
      return dtoOf(admin, member);
    },

    async activate(admin: AdminPrincipal, id: string): Promise<AdminMemberDto> {
      assertManager(admin);

      const member = await withTransaction(prisma, async (tx) => {
        const current = await lockMember(tx, id);
        assertManageable(admin, current);
        if (current.status !== 'DISABLED') {
          throw new ConflictError('ADMIN_MEMBER_NOT_DISABLED', MEMBER_NOT_DISABLED);
        }

        const status = current.activatedAt ? 'ACTIVE' : 'INVITED';
        const updated = await tx.adminMember.update({
          where: { id },
          data: { status, disabledAt: null, disabledBy: null, disabledReason: null },
          include: MEMBER_INCLUDE,
        });
        await syncLegacyAdminColumns(tx, {
          userId: updated.userId,
          role: updated.role,
          status,
          grantedBy: admin.userId,
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: 'admin_member.reactivated',
          entityType: 'AdminMember',
          entityId: id,
          before: { status: 'DISABLED' },
          after: { status },
        });
        return updated;
      });

      return dtoOf(admin, member);
    },

    async history(admin: AdminPrincipal, id: string): Promise<AdminMemberHistoryResponse> {
      assertManager(admin);

      const member = await prisma.adminMember.findUnique({
        where: { id },
        include: MEMBER_INCLUDE,
      });
      if (!member) throw new NotFoundError(MEMBER_NOT_FOUND, { code: 'ADMIN_MEMBER_NOT_FOUND' });

      const rows = await prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'AdminMember', entityId: id },
            { action: 'admin.login.success', entityType: 'User', entityId: member.userId },
          ],
        },
        orderBy: { id: 'desc' },
        take: HISTORY_LIMIT,
      });

      const actorIds = [
        ...new Set(rows.map((row) => row.actorId).filter((value): value is string => !!value)),
      ];
      const actors = actorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, email: true },
          })
        : [];
      const actorEmail = new Map(actors.map((actor) => [actor.id, actor.email]));

      return {
        member: await dtoOf(admin, member),
        history: rows.map((row) => ({
          id: String(row.id),
          action: row.action,
          label: HISTORY_LABELS[row.action] ?? row.action,
          actorEmail: row.actorId ? (actorEmail.get(row.actorId) ?? null) : null,
          detail: detailOf(row.action, row.before, row.after),
          at: row.createdAt.toISOString(),
        })),
      };
    },
  };
}

export type AdminMembersService = ReturnType<typeof createAdminMembersService>;

function field(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entry: unknown = Object.getOwnPropertyDescriptor(value, key)?.value;
  return typeof entry === 'string' ? entry : null;
}

function roleLabel(role: string | null): string {
  const known = Object.entries(ADMIN_ROLE_LABELS).find(([key]) => key === role);
  return known ? known[1] : (role ?? '—');
}

function detailOf(action: string, before: unknown, after: unknown): string | null {
  switch (action) {
    case 'admin_member.invited':
      return `as ${roleLabel(field(after, 'role'))}`;
    case 'admin_member.role_changed':
      return `${roleLabel(field(before, 'role'))} → ${roleLabel(field(after, 'role'))}`;
    case 'admin_member.disabled':
      return field(after, 'reason');
    default:
      return null;
  }
}
