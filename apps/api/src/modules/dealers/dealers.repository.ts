import { initialsOf, slugify } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

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

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F088
    async newEnquiryCount(_dealerId: string): Promise<number> {
      return 0;
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

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F088
    async enquiryCounts(
      _dealerId: string,
      _from: Date,
    ): Promise<{ thisWeek: number; previousWeek: number }> {
      return { thisWeek: 0, previousWeek: 0 };
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F088
    async recentEnquiries(_dealerId: string, _limit: number): Promise<RecentEnquiryRow[]> {
      return [];
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async expiringListingCount(_dealerId: string, _horizon: Date): Promise<number> {
      return 0;
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F050/F064
    async weeklyActivity(
      _dealerId: string,
      _weekStart: Date,
      _monthStart: Date,
    ): Promise<{ creditsUsedThisMonth: number; listingsAddedThisWeek: number }> {
      return { creditsUsedThisMonth: 0, listingsAddedThisWeek: 0 };
    },
  };
}

export interface RecentEnquiryRow {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
  vehicle: {
    year: number;
    make: { name: string };
    model: { name: string };
    variant: { name: string } | null;
  } | null;
}

export type DealersRepository = ReturnType<typeof createDealersRepository>;
