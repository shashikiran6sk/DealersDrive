import { initialsOf, slugify } from '@dealers-drive/contracts';
import type { ListingStatus, Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export const dealerInclude = {
  documents: true,
  members: { include: { user: true }, where: { status: 'ACTIVE' as const } },
  profileEdits: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.DealerInclude;

export type DealerWithRelations = Prisma.DealerGetPayload<{ include: typeof dealerInclude }>;

function placeSlug(value: string | null): string | null {
  return value ? slugify(value) : null;
}

export function createDealersRepository(prisma: PrismaClient) {
  return {
    async findById(dealerId: string): Promise<DealerWithRelations | null> {
      return prisma.dealer.findUnique({ where: { id: dealerId }, include: dealerInclude });
    },

    async findBySlug(slug: string): Promise<DealerWithRelations | null> {
      return prisma.dealer.findUnique({ where: { slug }, include: dealerInclude });
    },

    async findPublicBySlug(slug: string): Promise<DealerWithRelations | null> {
      return prisma.dealer.findFirst({
        where: { slug, status: 'ACTIVE' },
        include: dealerInclude,
      });
    },

    async slugById(dealerId: string): Promise<string | null> {
      const row = await prisma.dealer.findUnique({
        where: { id: dealerId },
        select: { slug: true },
      });
      return row?.slug ?? null;
    },

    async listActive() {
      const rows = await prisma.dealer.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { brandName: 'asc' },
      });

      return rows.map((dealer) => ({
        id: dealer.id,
        slug: dealer.slug,
        brandName: dealer.brandName,
        initials: initialsOf(dealer.brandName),
        cityName: dealer.city,
        citySlug: placeSlug(dealer.city),
        districtName: dealer.district,
        districtSlug: placeSlug(dealer.district),
        state: dealer.state,
        coverMediaId: dealer.coverMediaId,
        tagline: dealer.tagline,
        specialities: dealer.specialities,
        yearsOperating: dealer.establishedYear
          ? Math.max(1, new Date().getUTCFullYear() - dealer.establishedYear)
          : 1,
      }));
    },

    async update(dealerId: string, data: Prisma.DealerUncheckedUpdateInput, tx?: Tx) {
      const client = tx ?? prisma;
      return client.dealer.update({
        where: { id: dealerId },
        data,
        include: dealerInclude,
      });
    },

    async documents(dealerId: string) {
      return prisma.dealerDocument.findMany({
        where: { dealerId },
        orderBy: { type: 'asc' },
      });
    },

    async documentById(documentId: string) {
      return prisma.dealerDocument.findUnique({ where: { id: documentId } });
    },

    async documentByType(
      dealerId: string,
      type: Prisma.DealerDocumentUncheckedCreateInput['type'],
    ) {
      return prisma.dealerDocument.findUnique({ where: { dealerId_type: { dealerId, type } } });
    },

    async upsertDocument(
      dealerId: string,
      type: Prisma.DealerDocumentUncheckedCreateInput['type'],
      data: Omit<Prisma.DealerDocumentUncheckedUpdateInput, 'dealerId' | 'type'>,
    ) {
      return prisma.dealerDocument.upsert({
        where: { dealerId_type: { dealerId, type } },
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Prisma types a Json column as JsonValue
        create: { ...(data as Prisma.DealerDocumentUncheckedCreateInput), dealerId, type },
        update: data,
      });
    },

    async deleteDocument(
      dealerId: string,
      type: Prisma.DealerDocumentUncheckedCreateInput['type'],
    ) {
      const result = await prisma.dealerDocument.updateMany({
        where: { dealerId, type },
        data: { status: 'REQUIRED', mediaId: null, fileName: null, rejectionReason: null },
      });
      return result.count > 0;
    },

    async findConflicting(
      exceptDealerId: string,
      fields: { legalName?: string; city?: string; gstin?: string; pan?: string },
    ): Promise<{ legalName: boolean; gstin: boolean; pan: boolean }> {
      const legalName = fields.legalName?.toLowerCase();
      const city = fields.city?.toLowerCase();
      const gstin = fields.gstin?.toLowerCase();
      const pan = fields.pan?.toLowerCase();
      const named = legalName !== undefined && city !== undefined;

      const clauses: Prisma.DealerWhereInput[] = [];
      if (named) {
        clauses.push({
          legalName: { equals: legalName, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
        });
      }
      if (gstin !== undefined) {
        clauses.push({ gstin: { equals: gstin, mode: 'insensitive' } });
      }
      if (pan !== undefined) {
        clauses.push({ pan: { equals: pan, mode: 'insensitive' } });
      }
      if (clauses.length === 0) return { legalName: false, gstin: false, pan: false };

      const rows = await prisma.dealer.findMany({
        where: { id: { not: exceptDealerId }, OR: clauses },
        select: { legalName: true, city: true, gstin: true, pan: true },
      });

      const lower = (value: string | null): string | null => value?.toLowerCase() ?? null;
      return {
        legalName:
          named &&
          rows.some((row) => lower(row.legalName) === legalName && lower(row.city) === city),
        gstin: gstin !== undefined && rows.some((row) => lower(row.gstin) === gstin),
        pan: pan !== undefined && rows.some((row) => lower(row.pan) === pan),
      };
    },

    async mediaById(mediaId: string) {
      return prisma.media.findUnique({ where: { id: mediaId } });
    },

    async createMedia(data: Prisma.MediaUncheckedCreateInput) {
      return prisma.media.create({ data });
    },

    async readyMediaIds(mediaIds: string[]): Promise<Set<string>> {
      if (mediaIds.length === 0) return new Set();
      const rows = await prisma.media.findMany({
        where: { id: { in: mediaIds }, status: 'READY' },
        select: { id: true },
      });
      return new Set(rows.map((row) => row.id));
    },

    async markMediaReady(mediaId: string) {
      return prisma.media.update({ where: { id: mediaId }, data: { status: 'READY' } });
    },

    async orphanMedia(mediaId: string) {
      return prisma.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
    },

    async ownerOf(dealerId: string) {
      return prisma.dealerMember.findFirst({
        where: { dealerId, role: 'OWNER', status: 'ACTIVE' },
        include: { user: true },
      });
    },

    async newEnquiryCount(dealerId: string): Promise<number> {
      return prisma.enquiry.count({ where: { dealerId, status: 'NEW' } });
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async pendingListingCount(_dealerId: string): Promise<number> {
      return 0;
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async viewRollups(
      _dealerId: string,
      _from: Date,
    ): Promise<{ day: Date; views: number | null }[]> {
      return [];
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async previousWeekViews(_dealerId: string, _from: Date): Promise<number | null> {
      return null;
    },

    async enquiryCounts(
      dealerId: string,
      from: Date,
    ): Promise<{ thisWeek: number; previousWeek: number }> {
      const previousFrom = new Date(from.getTime() - 7 * 86_400_000);
      const [thisWeek, previousWeek] = await Promise.all([
        prisma.enquiry.count({ where: { dealerId, status: 'NEW', createdAt: { gte: from } } }),
        prisma.enquiry.count({
          where: {
            dealerId,
            status: { not: 'SPAM' },
            createdAt: { gte: previousFrom, lt: from },
          },
        }),
      ]);
      return { thisWeek, previousWeek };
    },

    async recentEnquiries(dealerId: string, limit: number): Promise<RecentEnquiryRow[]> {
      const rows = await prisma.enquiry.findMany({
        where: { dealerId, status: { not: 'SPAM' } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          createdAt: true,
          customer: { select: { fullName: true, phone: true } },
          listing: {
            select: {
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
          },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.customer.fullName,
        phone: row.customer.phone,
        createdAt: row.createdAt,
        vehicle: row.listing.vehicle,
      }));
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- nothing expires a listing yet (R47)
    async expiringListingCount(_dealerId: string, _horizon: Date): Promise<number> {
      return 0;
    },

    async listingCounts(dealerId: string): Promise<Partial<Record<ListingStatus, number>>> {
      const grouped = await prisma.listing.groupBy({
        by: ['status'],
        where: { dealerId },
        _count: { _all: true },
      });
      return Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    },

    async weeklyActivity(
      dealerId: string,
      weekStart: Date,
      _monthStart: Date,
    ): Promise<{ creditsUsedThisMonth: number; listingsAddedThisWeek: number }> {
      const listingsAddedThisWeek = await prisma.listing.count({
        where: { dealerId, publishedAt: { gte: weekStart } },
      });
      return { creditsUsedThisMonth: 0, listingsAddedThisWeek };
    },
  };
}

export interface RecentEnquiryRow {
  id: string;
  name: string | null;
  phone: string | null;
  createdAt: Date;
  vehicle: {
    manufacturingYear: number | null;
    make: string | null;
    model: string | null;
    variant: string | null;
    registrationNumber: string;
  };
}

export type DealersRepository = ReturnType<typeof createDealersRepository>;
