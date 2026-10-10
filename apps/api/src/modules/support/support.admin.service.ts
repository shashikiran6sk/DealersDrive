import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
  SUPPORT_STATUS_LABELS,
  canTransitionSupportTicket,
  istDayStart,
  type AdminSupportTicketDetail,
  type AdminSupportTicketQuery,
  type AdminSupportTicketsResponse,
  type SupportAssignee,
  type SupportMessageInput,
  type SupportNoteInput,
  type SupportTicketCounts,
  type SupportTicketStatus,
  type UpdateSupportTicketInput,
} from '@dealers-drive/contracts';
import type { AdminRole, Prisma } from '@prisma/client';
import { isPersistedRetry } from './message-retry.js';

import {
  ADMIN_MEMBERSHIP_LOCK,
  isAdmitted,
  isSeatSuspended,
  permissionsForMember,
  type AdminPrincipal,
} from '../auth/auth.facade.js';
import { getContext } from '../../middleware/request-context.js';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { decodeKeysetCursor, encodeKeysetCursor } from '../../platform/pagination.js';
import {
  ADMIN_DETAIL_SELECT,
  ADMIN_ROW_SELECT,
  supportHistoryOf,
  toAdminSupportDetail,
  toAdminSupportRow,
  toAssignee,
  type Person,
} from './support.admin.mapper.js';
import {
  ADMIN_TICKET_NOT_FOUND,
  ASSIGNEE_INVALID,
  SUPPORT_HISTORY_LABELS,
  TICKET_CLOSED_FOR_SUPPORT,
  TRANSITION_REFUSED,
} from './support.messages.js';
import type { SupportDeps } from './support.service.js';

export const MIN_PHONE_DIGITS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

const REFERENCE = /^(?:dd\s*-?\s*)?(\d{1,9})$/i;

function notFound(): NotFoundError {
  return new NotFoundError(ADMIN_TICKET_NOT_FOUND, { code: 'SUPPORT_TICKET_NOT_FOUND' });
}

export function supportSearch(raw: string | undefined): Prisma.SupportTicketWhereInput | null {
  const q = raw?.trim() ?? '';
  if (q === '') return null;
  const reference = REFERENCE.exec(q);
  const digits = q.replace(/\D/g, '');
  const plate = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const insensitive = { contains: q, mode: 'insensitive' as const };
  return {
    OR: [
      ...(reference ? [{ number: Number(reference[1]) }] : []),
      { subject: insensitive },
      { customer: { fullName: insensitive } },
      ...(digits.length >= MIN_PHONE_DIGITS ? [{ customer: { phone: { contains: digits } } }] : []),
      { enquiry: { dealer: { brandName: insensitive } } },
      { enquiry: { listing: { vehicle: { make: insensitive } } } },
      { enquiry: { listing: { vehicle: { model: insensitive } } } },
      ...(plate
        ? [{ enquiry: { listing: { vehicle: { registrationNumber: { contains: plate } } } } }]
        : []),
    ],
  };
}

export function supportWindow(
  from: string | undefined,
  to: string | undefined,
): Prisma.SupportTicketWhereInput | null {
  if (!from && !to) return null;
  return {
    createdAt: {
      ...(from ? { gte: istDayStart(from) } : {}),
      ...(to ? { lt: new Date(istDayStart(to).getTime() + DAY_MS) } : {}),
    },
  };
}

function assigneeFilter(
  admin: AdminPrincipal,
  assignee: AdminSupportTicketQuery['assignee'],
): Prisma.SupportTicketWhereInput | null {
  if (assignee === undefined) return null;
  if (assignee === 'me') return { assignedAdminId: admin.userId };
  if (assignee === 'unassigned') return { assignedAdminId: null };
  return { assignedAdminId: assignee };
}

export function statusAction(from: SupportTicketStatus, to: SupportTicketStatus): string {
  if (to === 'RESOLVED') return 'support_ticket.resolved';
  if (to === 'CLOSED') return 'support_ticket.closed';
  if (from === 'RESOLVED') return 'support_ticket.reopened';
  return 'support_ticket.status_changed';
}

async function lockTicket(tx: Tx, ticketId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "support_tickets" WHERE "id" = ${ticketId}::uuid FOR UPDATE`;
  if (locked.length === 0) throw notFound();
  return tx.supportTicket.findUniqueOrThrow({
    where: { id: ticketId },
    select: {
      status: true,
      priority: true,
      assignedAdminId: true,
      updatedAt: true,
      customerId: true,
    },
  });
}

function rolesHolding(permission: AdminPermission): AdminRole[] {
  return [...ADMIN_PERMISSIONS[permission]];
}

export function createAdminSupportService({ prisma, audit }: SupportDeps) {
  async function assignableAdmins(): Promise<Person[]> {
    const members = await prisma.adminMember.findMany({
      where: {
        status: 'ACTIVE',
        role: { in: rolesHolding('admin:support:manage') },
        user: { status: 'ACTIVE' },
      },
      select: {
        source: true,
        role: true,
        status: true,
        user: { select: { id: true, fullName: true, email: true, status: true } },
      },
      orderBy: { user: { email: 'asc' } },
    });
    return members
      .filter((member) =>
        isAdmitted({ email: member.user.email, status: member.user.status, member }),
      )
      .map((member) => ({
        id: member.user.id,
        fullName: member.user.fullName,
        email: member.user.email,
      }));
  }

  async function assignees(): Promise<SupportAssignee[]> {
    return (await assignableAdmins()).map(toAssignee);
  }

  async function detail(ticketId: string): Promise<AdminSupportTicketDetail> {
    const row = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: ADMIN_DETAIL_SELECT,
    });
    if (!row) throw notFound();

    const [ticketCount, trail, team] = await Promise.all([
      prisma.supportTicket.count({ where: { customerId: row.customer.id } }),
      prisma.auditLog.findMany({
        where: {
          entityType: 'SupportTicket',
          entityId: ticketId,
          action: { in: Object.keys(SUPPORT_HISTORY_LABELS) },
        },
        orderBy: { id: 'asc' },
        select: {
          action: true,
          actorType: true,
          actorId: true,
          before: true,
          after: true,
          createdAt: true,
        },
      }),
      assignableAdmins(),
    ]);

    const mentioned = new Set<string>();
    for (const entry of trail) {
      if (entry.actorType === 'ADMIN' && entry.actorId) mentioned.add(entry.actorId);
      const after = entry.after;
      if (typeof after === 'object' && after !== null && !Array.isArray(after)) {
        const assigned = after.assignedAdminId;
        if (typeof assigned === 'string') mentioned.add(assigned);
      }
    }
    const people = new Map<string, Person>(team.map((person) => [person.id, person]));
    const missing = [...mentioned].filter((id) => !people.has(id));
    if (missing.length > 0) {
      const former = await prisma.user.findMany({
        where: { id: { in: missing } },
        select: { id: true, fullName: true, email: true },
      });
      for (const person of former) people.set(person.id, person);
    }

    return toAdminSupportDetail(row, {
      ticketCount,
      history: supportHistoryOf(trail, people),
      assignees: team.map(toAssignee),
    });
  }

  return {
    assignees,
    detail,

    async list(
      admin: AdminPrincipal,
      query: AdminSupportTicketQuery,
    ): Promise<AdminSupportTicketsResponse> {
      const filters: Prisma.SupportTicketWhereInput[] = [];
      if (query.category) filters.push({ category: query.category });
      if (query.priority) filters.push({ priority: query.priority });
      const assigned = assigneeFilter(admin, query.assignee);
      if (assigned) filters.push(assigned);
      const window = supportWindow(query.from, query.to);
      if (window) filters.push(window);
      const search = supportSearch(query.q);
      if (search) filters.push(search);
      const scope: Prisma.SupportTicketWhereInput = { AND: filters };

      const cursor = query.cursor ? decodeKeysetCursor(query.cursor) : null;
      const where: Prisma.SupportTicketWhereInput = {
        AND: [
          scope,
          ...(query.status ? [{ status: query.status }] : []),
          ...(cursor
            ? [
                {
                  OR: [
                    { updatedAt: { lt: cursor.at } },
                    { updatedAt: cursor.at, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      };

      const [rows, grouped, team] = await Promise.all([
        prisma.supportTicket.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          select: ADMIN_ROW_SELECT,
        }),
        prisma.supportTicket.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
        assignees(),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const of = (status: SupportTicketStatus) =>
        grouped.find((row) => row.status === status)?._count._all ?? 0;
      const counts: SupportTicketCounts = {
        ALL: grouped.reduce((sum, row) => sum + row._count._all, 0),
        OPEN: of('OPEN'),
        IN_PROGRESS: of('IN_PROGRESS'),
        WAITING_FOR_CUSTOMER: of('WAITING_FOR_CUSTOMER'),
        RESOLVED: of('RESOLVED'),
        CLOSED: of('CLOSED'),
      };

      return {
        data: page.map(toAdminSupportRow),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.updatedAt, last.id) : null,
          hasMore,
        },
        counts,
        assignees: team,
      };
    },

    async reply(
      admin: AdminPrincipal,
      ticketId: string,
      input: SupportMessageInput,
    ): Promise<AdminSupportTicketDetail> {
      await withTransaction(prisma, async (tx) => {
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
          !permissionsForMember(actor.adminMember.role).includes('admin:support:manage')
        )
          throw new ForbiddenError('Your support access is no longer available.');
        const current = await lockTicket(tx, ticketId);
        if (
          await isPersistedRetry(
            tx,
            ticketId,
            'SUPPORT',
            input.message,
            input.clientMessageId,
            admin.userId,
          )
        )
          return;
        if (current.status === 'CLOSED') {
          throw new ConflictError('SUPPORT_TICKET_CLOSED', TICKET_CLOSED_FOR_SUPPORT);
        }
        const now = new Date();
        await tx.supportTicketMessage.create({
          data: {
            ticketId,
            authorType: 'SUPPORT',
            authorId: admin.userId,
            body: input.message,
            clientMessageId: input.clientMessageId ?? null,
            createdAt: now,
          },
        });
        await tx.supportTicket.update({
          where: { id: ticketId },
          data: { updatedAt: now, unansweredCustomerMessages: 0 },
        });
      });
      return detail(ticketId);
    },

    async note(
      admin: AdminPrincipal,
      ticketId: string,
      input: SupportNoteInput,
    ): Promise<AdminSupportTicketDetail> {
      await withTransaction(prisma, async (tx) => {
        await lockTicket(tx, ticketId);
        await tx.supportTicketNote.create({
          data: { ticketId, authorId: admin.userId, body: input.note },
        });
      });
      return detail(ticketId);
    },

    async update(
      admin: AdminPrincipal,
      ticketId: string,
      input: UpdateSupportTicketInput,
    ): Promise<AdminSupportTicketDetail> {
      await withTransaction(prisma, async (tx) => {
        const current = await lockTicket(tx, ticketId);
        const data: Prisma.SupportTicketUpdateInput = {};
        const now = new Date();
        const record = (
          action: string,
          before: Record<string, unknown>,
          after: Record<string, unknown>,
        ) =>
          audit.record(tx, {
            actorType: 'ADMIN',
            actorId: admin.userId,
            action,
            entityType: 'SupportTicket',
            entityId: ticketId,
            before,
            after,
          });

        if (input.status !== undefined && input.status !== current.status) {
          if (!canTransitionSupportTicket(current.status, input.status)) {
            throw new ConflictError(
              'SUPPORT_TICKET_TRANSITION',
              TRANSITION_REFUSED(
                SUPPORT_STATUS_LABELS[current.status].toLowerCase(),
                SUPPORT_STATUS_LABELS[input.status].toLowerCase(),
              ),
            );
          }
          data.status = input.status;
          if (input.status === 'RESOLVED') data.resolvedAt = now;
          if (current.status === 'RESOLVED' && input.status !== 'CLOSED') data.resolvedAt = null;
          if (input.status === 'CLOSED') data.closedAt = now;
          await record(
            statusAction(current.status, input.status),
            { status: current.status },
            { status: input.status },
          );
          await enqueueOutbox(tx, {
            type: 'SupportTicketStatusChanged',
            aggregateType: 'SupportTicket',
            aggregateId: ticketId,
            actor: { type: 'ADMIN', id: admin.userId },
            traceId: getContext()?.traceId ?? 'support-ticket-status-changed',
            payload: {
              ticketId,
              customerId: current.customerId,
              fromStatus: current.status,
              status: input.status,
            },
          });
        }

        if (input.priority !== undefined && input.priority !== current.priority) {
          data.priority = input.priority;
          await record(
            'support_ticket.priority_changed',
            { priority: current.priority },
            { priority: input.priority },
          );
        }

        if (
          input.assignedAdminId !== undefined &&
          input.assignedAdminId !== current.assignedAdminId
        ) {
          if (input.assignedAdminId !== null) {
            const team = await assignableAdmins();
            if (!team.some((person) => person.id === input.assignedAdminId)) {
              throw new DomainError('SUPPORT_ASSIGNEE_INVALID', ASSIGNEE_INVALID);
            }
          }
          data.assignee =
            input.assignedAdminId === null
              ? { disconnect: true }
              : { connect: { id: input.assignedAdminId } };
          await record(
            input.assignedAdminId === null
              ? 'support_ticket.unassigned'
              : 'support_ticket.assigned',
            { assignedAdminId: current.assignedAdminId },
            { assignedAdminId: input.assignedAdminId },
          );
        }

        if (Object.keys(data).length === 0) return;
        data.updatedAt = data.status !== undefined ? now : current.updatedAt;
        await tx.supportTicket.update({ where: { id: ticketId }, data });
      });
      return detail(ticketId);
    },
  };
}

export type AdminSupportService = ReturnType<typeof createAdminSupportService>;
