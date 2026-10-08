import {
  legalEnabled,
  requireCurrentVersion,
  requireTerms,
  requireDealerAgreement,
  recordEvidence,
} from '../legal/legal.facade.js';
import {
  enquiryTransitionPermission,
  formatRegistration,
  vehicleTitle,
  type CreateEnquiryInput,
  type CustomerEnquiriesResponse,
  type CustomerEnquiryQuery,
  type DealerEnquiriesResponse,
  type DealerEnquiry,
  type DealerEnquiryCounts,
  type DealerEnquiryQuery,
  type EnquiryReceipt,
  type EnquiryStatus,
  type UpdateEnquiryInput,
} from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { authorizeDealerWrite, type CustomerPrincipal } from '../auth/auth.facade.js';
import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';
import { decodeKeysetOrDateCursor, encodeKeysetCursor } from '../../platform/pagination.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  PUBLIC_AVAILABLE_LISTING_WHERE,
  PUBLIC_VISIBLE_LISTING_WHERE,
} from '../search/search.facade.js';
import {
  CUSTOMER_SELECT,
  INBOX_SELECT,
  toCustomerEnquiry,
  toDealerEnquiry,
} from './enquiries.mapper.js';
import {
  ALREADY_OPEN,
  ENQUIRY_NOT_FOUND,
  ENQUIRY_TRANSITION_FORBIDDEN,
  LISTING_NOT_AVAILABLE,
  LISTING_NOT_FOUND,
  LISTING_RESERVED,
  OWN_LISTING,
} from './enquiries.messages.js';

export interface EnquiriesDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

export const BLOCKING_STATUSES = [
  'NEW',
  'CONTACTED',
  'SPAM',
] as const satisfies readonly EnquiryStatus[];

export interface EnquiryActor {
  dealerId: string;
  userId: string;
  permissions: readonly string[];
  sessionId?: string;
}

const STATUS_AUDIT_ACTIONS: Record<EnquiryStatus, string> = {
  NEW: 'enquiry.reopened',
  CONTACTED: 'enquiry.contacted',
  CLOSED: 'enquiry.closed',
  SPAM: 'enquiry.spam',
};

function notFound(): NotFoundError {
  return new NotFoundError(ENQUIRY_NOT_FOUND, { code: 'ENQUIRY_NOT_FOUND' });
}

function stampsFor(
  current: { contactedAt: Date | null; contactedById: string | null },
  status: EnquiryStatus,
  now: Date,
  actorId: string,
): Prisma.EnquiryUncheckedUpdateInput {
  const firstContact = status === 'CONTACTED' && current.contactedAt === null;
  return {
    status,
    contactedAt: firstContact ? now : current.contactedAt,
    contactedById: firstContact ? actorId : current.contactedById,
    closedAt: status === 'CLOSED' ? now : null,
    closedById: status === 'CLOSED' ? actorId : null,
  };
}

export function createEnquiriesService({ prisma, audit }: EnquiriesDeps) {
  async function counts(dealerId: string): Promise<DealerEnquiryCounts> {
    const grouped = await prisma.enquiry.groupBy({
      by: ['status'],
      where: { dealerId },
      _count: { _all: true },
    });
    const of = (status: EnquiryStatus) =>
      grouped.find((row) => row.status === status)?._count._all ?? 0;
    return {
      ALL: grouped.reduce((sum, row) => sum + row._count._all, 0),
      NEW: of('NEW'),
      CONTACTED: of('CONTACTED'),
      CLOSED: of('CLOSED'),
      SPAM: of('SPAM'),
    };
  }

  return {
    counts,

    async mine(
      customer: CustomerPrincipal,
      query: CustomerEnquiryQuery,
    ): Promise<CustomerEnquiriesResponse> {
      const cursor = query.cursor ? decodeKeysetOrDateCursor(query.cursor) : null;
      const rows = await prisma.enquiry.findMany({
        where: {
          customerId: customer.userId,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.at } },
                  ...(cursor.id ? [{ createdAt: cursor.at, id: { lt: cursor.id } }] : []),
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: CUSTOMER_SELECT,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      return {
        data: page.map(toCustomerEnquiry),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.createdAt, last.id) : null,
          hasMore,
        },
      };
    },

    async one(customer: CustomerPrincipal, id: string) {
      const row = await prisma.enquiry.findFirst({
        where: { id, customerId: customer.userId },
        select: CUSTOMER_SELECT,
      });
      if (!row) throw notFound();
      return toCustomerEnquiry(row);
    },

    async inbox(dealerId: string, query: DealerEnquiryQuery): Promise<DealerEnquiriesResponse> {
      await requireDealerAgreement(prisma, dealerId);
      const cursor = query.cursor ? decodeKeysetOrDateCursor(query.cursor) : null;
      const [rows, tabs] = await Promise.all([
        prisma.enquiry.findMany({
          where: {
            dealerId,
            ...(query.status ? { status: query.status } : {}),
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: cursor.at } },
                    ...(cursor.id ? [{ createdAt: cursor.at, id: { lt: cursor.id } }] : []),
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          select: INBOX_SELECT,
        }),
        counts(dealerId),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const now = new Date();

      return {
        data: page.map((row) => toDealerEnquiry(row, now)),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.createdAt, last.id) : null,
          hasMore,
        },
        counts: tabs,
      };
    },

    async setStatus(
      actor: EnquiryActor,
      enquiryId: string,
      input: UpdateEnquiryInput,
    ): Promise<DealerEnquiry> {
      return withTransaction(prisma, async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "enquiries"
          WHERE "id" = ${enquiryId}::uuid AND "dealerId" = ${actor.dealerId}::uuid
          FOR UPDATE`;
        if (locked.length === 0) throw notFound();
        const permissions = await authorizeDealerWrite(tx, actor, 'enquiry:contact');
        await requireDealerAgreement(tx, actor.dealerId);
        await requireTerms(tx, actor.userId);

        const current = await tx.enquiry.findUniqueOrThrow({
          where: { id: enquiryId },
          select: { status: true, contactedAt: true, contactedById: true },
        });
        if (current.status === input.status) {
          return toDealerEnquiry(
            await tx.enquiry.findUniqueOrThrow({ where: { id: enquiryId }, select: INBOX_SELECT }),
          );
        }

        const needed = enquiryTransitionPermission(current.status, input.status);
        if (!permissions.includes(needed)) {
          throw new ForbiddenError(ENQUIRY_TRANSITION_FORBIDDEN, {
            code: 'ENQUIRY_ACTION_FORBIDDEN',
            extra: { enquiryStatus: current.status, permission: needed },
          });
        }

        const updated = await tx.enquiry.update({
          where: { id: enquiryId },
          data: stampsFor(current, input.status, new Date(), actor.userId),
          select: INBOX_SELECT,
        });

        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: STATUS_AUDIT_ACTIONS[input.status],
          entityType: 'Enquiry',
          entityId: enquiryId,
          before: { status: current.status },
          after: { status: input.status },
        });

        return toDealerEnquiry(updated);
      });
    },

    async withdrawSharing(
      customer: CustomerPrincipal,
      enquiryId: string,
    ): Promise<{ withdrawn: true }> {
      return withTransaction(prisma, async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "enquiries" WHERE "id" = ${enquiryId}::uuid
          AND "customerId" = ${customer.userId}::uuid FOR UPDATE`;
        if (rows.length === 0) throw notFound();
        await tx.enquiry.updateMany({
          where: { id: enquiryId, sharingWithdrawnAt: null },
          data: { sharingWithdrawnAt: new Date() },
        });
        await recordEvidence(tx, {
          actorId: customer.userId,
          subjectType: 'ENQUIRY',
          subjectId: enquiryId,
          documentId: 'enquiry',
          action: 'WITHDRAW',
          context: 'future-dealer-disclosure-withdrawn',
        });
        return { withdrawn: true };
      });
    },

    async create(customer: CustomerPrincipal, input: CreateEnquiryInput): Promise<EnquiryReceipt> {
      if (legalEnabled() && !input.sharing?.granted)
        throw new DomainError(
          'ENQUIRY_PERMISSION_REQUIRED',
          'Choose whether to share your details with this dealership before sending.',
        );
      requireCurrentVersion(input.sharing?.version);
      const listing = await prisma.listing.findUnique({
        where: { slug: input.listingSlug },
        select: { id: true },
      });
      if (!listing) throw new NotFoundError(LISTING_NOT_FOUND, { code: 'LISTING_NOT_FOUND' });

      return withTransaction(prisma, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${listing.id}::uuid FOR SHARE`;
        const available = await tx.listing.findFirst({
          where: { ...PUBLIC_AVAILABLE_LISTING_WHERE, id: listing.id },
          select: {
            id: true,
            dealerId: true,
            dealer: { select: { brandName: true } },
            vehicle: {
              select: {
                manufacturingYear: true,
                make: true,
                model: true,
                variant: true,
                registrationNumber: true,
              },
            },
          },
        });
        if (!available) {
          const reserved = await tx.listing.count({
            where: { ...PUBLIC_VISIBLE_LISTING_WHERE, id: listing.id, status: 'RESERVED' },
          });
          throw reserved > 0
            ? new ConflictError('LISTING_RESERVED', LISTING_RESERVED)
            : new ConflictError('LISTING_NOT_AVAILABLE', LISTING_NOT_AVAILABLE);
        }

        await requireTerms(tx, customer.userId);
        const ownDealership = await tx.dealerMember.findFirst({
          where: { userId: customer.userId, dealerId: available.dealerId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (ownDealership) throw new DomainError('ENQUIRY_OWN_LISTING', OWN_LISTING);

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`enquiry:${customer.userId}:${available.id}`}))`;

        const open = await tx.enquiry.findFirst({
          where: {
            customerId: customer.userId,
            listingId: available.id,
            status: { in: [...BLOCKING_STATUSES] },
          },
          select: { id: true },
        });
        if (open) throw new ConflictError('ENQUIRY_ALREADY_OPEN', ALREADY_OPEN);

        const enquiry = await tx.enquiry.create({
          data: {
            customerId: customer.userId,
            dealerId: available.dealerId,
            listingId: available.id,
            message: input.message ?? null,
          },
        });

        await recordEvidence(tx, {
          actorId: customer.userId,
          subjectType: 'ENQUIRY',
          subjectId: enquiry.id,
          documentId: 'enquiry',
          action: 'GRANT',
          context: 'named-listing-dealer-disclosure',
        });
        await audit.record(tx, {
          actorType: 'CUSTOMER',
          actorId: customer.userId,
          dealerId: available.dealerId,
          action: 'enquiry.created',
          entityType: 'Enquiry',
          entityId: enquiry.id,
          after: { listingId: available.id, hasMessage: enquiry.message !== null },
        });

        await enqueueOutbox(tx, {
          type: 'EnquiryCreated',
          aggregateType: 'Enquiry',
          aggregateId: enquiry.id,
          dealerId: available.dealerId,
          actor: { type: 'CUSTOMER', id: customer.userId },
          traceId: getContext()?.traceId ?? 'enquiry-created',
          payload: { enquiryId: enquiry.id, listingId: available.id },
        });

        logger.info(
          {
            event: 'enquiry.created',
            enquiryId: enquiry.id,
            dealerId: available.dealerId,
            via: customer.via,
          },
          'enquiry created',
        );

        return {
          id: enquiry.id,
          status: enquiry.status,
          createdAt: enquiry.createdAt.toISOString(),
          dealerName: available.dealer.brandName,
          vehicleTitle:
            vehicleTitle(available.vehicle) ||
            formatRegistration(available.vehicle.registrationNumber),
        };
      });
    },
  };
}

export type EnquiriesService = ReturnType<typeof createEnquiriesService>;
