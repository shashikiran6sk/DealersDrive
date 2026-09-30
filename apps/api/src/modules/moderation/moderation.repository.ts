import type {
  Listing,
  ListingStatus,
  Prisma,
  PrismaClient,
  ReactivationRequestStatus,
} from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import type { ApprovalState } from './moderation.approval.js';

export const queueInclude = {
  vehicle: { include: { photography: true, _count: { select: { images: true } } } },
  dealer: { select: { id: true, brandName: true, slug: true, city: true, district: true } },
} satisfies Prisma.ListingInclude;

export type QueueRow = Prisma.ListingGetPayload<{ include: typeof queueInclude }>;

export const detailInclude = {
  vehicle: { include: { photography: true, _count: { select: { images: true } } } },
  dealer: {
    select: {
      id: true,
      brandName: true,
      slug: true,
      city: true,
      district: true,
      status: true,
      contactPhone: true,
    },
  },
  checks: true,
} satisfies Prisma.ListingInclude;

export type DetailRow = Prisma.ListingGetPayload<{ include: typeof detailInclude }>;

export const reactivationInclude = {
  listing: { include: { vehicle: true } },
  dealer: { select: { id: true, brandName: true, slug: true } },
} satisfies Prisma.ListingReactivationRequestInclude;

export type ReactivationRow = Prisma.ListingReactivationRequestGetPayload<{
  include: typeof reactivationInclude;
}>;

export interface ReactivationFilter {
  status: ReactivationRequestStatus;
  after?: Date;
  take: number;
}

export function reactivationSortKeyOf(row: {
  status: ReactivationRequestStatus;
  requestedAt: Date;
  reviewedAt: Date | null;
}): Date {
  return row.status === 'PENDING' ? row.requestedAt : (row.reviewedAt ?? row.requestedAt);
}

export interface HistoryRow {
  action: string;
  actorType: string;
  after: Prisma.JsonValue;
  createdAt: Date;
}

export interface QueueFilter {
  status: ListingStatus;
  q?: string;
  after?: Date;
  take: number;
}

function searchOf(q: string): Prisma.ListingWhereInput {
  const plate = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return {
    OR: [
      ...(plate ? [{ vehicle: { registrationNumber: { contains: plate } } }] : []),
      { vehicle: { make: { contains: q, mode: 'insensitive' } } },
      { vehicle: { model: { contains: q, mode: 'insensitive' } } },
      { dealer: { brandName: { contains: q, mode: 'insensitive' } } },
    ],
  };
}

export function isOldestFirst(status: ListingStatus): boolean {
  return status === 'PENDING_REVIEW';
}

export function sortKeyOf(row: QueueRow): Date {
  return isOldestFirst(row.status) ? (row.lastSubmittedAt ?? row.createdAt) : row.updatedAt;
}

export function createModerationRepository(prisma: PrismaClient) {
  return {
    async queue(filter: QueueFilter): Promise<QueueRow[]> {
      const oldestFirst = isOldestFirst(filter.status);
      const key = oldestFirst ? 'lastSubmittedAt' : 'updatedAt';
      return prisma.listing.findMany({
        where: {
          status: filter.status,
          ...(filter.q ? searchOf(filter.q) : {}),
          ...(filter.after
            ? { [key]: oldestFirst ? { gt: filter.after } : { lt: filter.after } }
            : {}),
        },
        orderBy: [{ [key]: oldestFirst ? 'asc' : 'desc' }, { id: 'asc' }],
        take: filter.take,
        include: queueInclude,
      });
    },

    async detail(listingId: string): Promise<DetailRow | null> {
      return prisma.listing.findUnique({ where: { id: listingId }, include: detailInclude });
    },

    async history(listingId: string, actions: readonly string[]): Promise<HistoryRow[]> {
      return prisma.auditLog.findMany({
        where: { entityType: 'Listing', entityId: listingId, action: { in: [...actions] } },
        orderBy: { id: 'asc' },
        select: { action: true, actorType: true, after: true, createdAt: true },
      });
    },

    async reactivations(filter: ReactivationFilter): Promise<ReactivationRow[]> {
      const oldestFirst = filter.status === 'PENDING';
      const key = oldestFirst ? 'requestedAt' : 'reviewedAt';
      return prisma.listingReactivationRequest.findMany({
        where: {
          status: filter.status,
          ...(filter.after
            ? { [key]: oldestFirst ? { gt: filter.after } : { lt: filter.after } }
            : {}),
        },
        orderBy: [{ [key]: oldestFirst ? 'asc' : 'desc' }, { id: 'asc' }],
        take: filter.take,
        include: reactivationInclude,
      });
    },

    async reactivation(id: string): Promise<ReactivationRow | null> {
      return prisma.listingReactivationRequest.findUnique({
        where: { id },
        include: reactivationInclude,
      });
    },

    async reactivationCounts(): Promise<{ status: ReactivationRequestStatus; count: number }[]> {
      const grouped = await prisma.listingReactivationRequest.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      return grouped.map((row) => ({ status: row.status, count: row._count._all }));
    },

    async pendingReactivations(): Promise<number> {
      return prisma.listingReactivationRequest.count({ where: { status: 'PENDING' } });
    },

    async statusCounts(): Promise<{ status: ListingStatus; count: number }[]> {
      const grouped = await prisma.listing.groupBy({ by: ['status'], _count: { _all: true } });
      return grouped.map((row) => ({ status: row.status, count: row._count._all }));
    },
  };
}

export type ModerationRepository = ReturnType<typeof createModerationRepository>;

export async function approvalStateOf(
  tx: Tx,
  listing: Listing,
  minImages: number,
): Promise<ApprovalState> {
  const dealer = await tx.dealer.findUniqueOrThrow({
    where: { id: listing.dealerId },
    select: { status: true, city: true },
  });
  const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: listing.vehicleId } });
  const checks = await tx.listingCheck.findMany({
    where: { listingId: listing.id },
    select: { key: true },
  });
  const imageCount = await tx.vehicleMedia.count({ where: { vehicleId: listing.vehicleId } });
  const primaries = await tx.vehicleMedia.count({
    where: { vehicleId: listing.vehicleId, isPrimary: true },
  });

  return {
    dealerStatus: dealer.status,
    dealerCity: dealer.city,
    vehicle,
    checkedKeys: checks.map((check) => check.key),
    imageCount,
    hasPrimary: primaries === 1,
    minImages,
  };
}
