import {
  statusAfterCustomerReply,
  type CreateSupportTicketInput,
  type CustomerSupportTicket,
  type CustomerSupportTicketQuery,
  type CustomerSupportTicketsResponse,
  type SupportMessageInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { CustomerPrincipal } from '../auth/auth.facade.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { getContext } from '../../middleware/request-context.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
import { decodeKeysetCursor, encodeKeysetCursor } from '../../platform/pagination.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  CUSTOMER_TICKET_SELECT,
  TICKET_ROW_SELECT,
  toCustomerSupportTicket,
  toSupportTicketRow,
} from './support.mapper.js';
import { ENQUIRY_NOT_YOURS, TICKET_CLOSED, TICKET_NOT_FOUND } from './support.messages.js';

export interface SupportDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

export function ticketNotFound(): NotFoundError {
  return new NotFoundError(TICKET_NOT_FOUND, { code: 'SUPPORT_TICKET_NOT_FOUND' });
}

export function createSupportService({ prisma, audit }: SupportDeps) {
  async function read(customerId: string, ticketId: string): Promise<CustomerSupportTicket> {
    const row = await prisma.supportTicket.findFirst({
      where: { id: ticketId, customerId },
      select: CUSTOMER_TICKET_SELECT,
    });
    if (!row) throw ticketNotFound();
    return toCustomerSupportTicket(row);
  }

  return {
    async mine(
      customer: CustomerPrincipal,
      query: CustomerSupportTicketQuery,
    ): Promise<CustomerSupportTicketsResponse> {
      const cursor = query.cursor ? decodeKeysetCursor(query.cursor) : null;
      const rows = await prisma.supportTicket.findMany({
        where: {
          customerId: customer.userId,
          ...(cursor
            ? {
                OR: [
                  { updatedAt: { lt: cursor.at } },
                  { updatedAt: cursor.at, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: TICKET_ROW_SELECT,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      return {
        data: page.map((row) => toSupportTicketRow(row)),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.updatedAt, last.id) : null,
          hasMore,
        },
      };
    },

    async detail(customer: CustomerPrincipal, ticketId: string): Promise<CustomerSupportTicket> {
      return read(customer.userId, ticketId);
    },

    async create(
      customer: CustomerPrincipal,
      input: CreateSupportTicketInput,
    ): Promise<CustomerSupportTicket> {
      const ticket = await withTransaction(prisma, async (tx) => {
        if (input.enquiryId) {
          const own = await tx.enquiry.findFirst({
            where: { id: input.enquiryId, customerId: customer.userId },
            select: { id: true },
          });
          if (!own) throw new DomainError('SUPPORT_ENQUIRY_INVALID', ENQUIRY_NOT_YOURS);
        }

        const created = await tx.supportTicket.create({
          data: {
            customerId: customer.userId,
            category: input.category,
            subject: input.subject,
            description: input.description,
            enquiryId: input.enquiryId ?? null,
          },
          select: { id: true, number: true },
        });

        await audit.record(tx, {
          actorType: 'CUSTOMER',
          actorId: customer.userId,
          action: 'support_ticket.created',
          entityType: 'SupportTicket',
          entityId: created.id,
          after: {
            number: created.number,
            category: input.category,
            status: 'OPEN',
            enquiryId: input.enquiryId ?? null,
          },
        });
        await enqueueOutbox(tx, {
          type: 'SupportTicketCreated',
          aggregateType: 'SupportTicket',
          aggregateId: created.id,
          actor: { type: 'CUSTOMER', id: customer.userId },
          traceId: getContext()?.traceId ?? 'support-ticket-created',
          payload: { ticketId: created.id, customerId: customer.userId },
        });
        return created;
      });

      logger.info(
        { event: 'support_ticket.created', ticketId: ticket.id, via: customer.via },
        'support ticket created',
      );
      return read(customer.userId, ticket.id);
    },

    async reply(
      customer: CustomerPrincipal,
      ticketId: string,
      input: SupportMessageInput,
    ): Promise<CustomerSupportTicket> {
      await withTransaction(prisma, async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "support_tickets"
          WHERE "id" = ${ticketId}::uuid AND "customerId" = ${customer.userId}::uuid
          FOR UPDATE`;
        if (locked.length === 0) throw ticketNotFound();

        const current = await tx.supportTicket.findUniqueOrThrow({
          where: { id: ticketId },
          select: { status: true },
        });
        const next = statusAfterCustomerReply(current.status);
        if (next === null) throw new ConflictError('SUPPORT_TICKET_CLOSED', TICKET_CLOSED);

        const now = new Date();
        await tx.supportTicketMessage.create({
          data: {
            ticketId,
            authorType: 'CUSTOMER',
            authorId: customer.userId,
            body: input.message,
            createdAt: now,
          },
        });
        await tx.supportTicket.update({
          where: { id: ticketId },
          data: {
            status: next,
            updatedAt: now,
            ...(current.status === 'RESOLVED' ? { resolvedAt: null } : {}),
          },
        });

        if (next !== current.status) {
          await audit.record(tx, {
            actorType: 'CUSTOMER',
            actorId: customer.userId,
            action:
              current.status === 'RESOLVED'
                ? 'support_ticket.reopened'
                : 'support_ticket.status_changed',
            entityType: 'SupportTicket',
            entityId: ticketId,
            before: { status: current.status },
            after: { status: next, cause: 'customer_reply' },
          });
        }
      });

      return read(customer.userId, ticketId);
    },
  };
}

export type SupportService = ReturnType<typeof createSupportService>;
