import type { EnquiryStatus, Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export const enquiryInclude = {
  vehicle: { include: { make: true, model: true, variant: true } },
} satisfies Prisma.EnquiryInclude;

export type EnquiryWithVehicle = Prisma.EnquiryGetPayload<{ include: typeof enquiryInclude }>;

export function createEnquiriesRepository(prisma: PrismaClient) {
  return {
    /**
     * `DD-EN-#####` from a dedicated sequence offset to start at 10000.
     * Never derived from the uuid, never guessable-sequential per dealer —
     * the sequence is platform-wide, and platform-wide lead volume is not
     * sensitive (§14.2).
     */
    async nextReference(tx: Tx): Promise<string> {
      const rows = await tx.$queryRaw<{ reference: string }[]>`
        SELECT 'DD-EN-' || nextval('enquiry_reference_seq')::text AS reference`;
      const reference = rows[0]?.reference;
      if (!reference) throw new Error('enquiry_reference_seq returned nothing');
      return reference;
    },

    /** Same phone + same vehicle within 24h is the same lead (§14.2). */
    async findRecentDuplicate(
      phone: string,
      vehicleId: string | null,
      dealerId: string,
      tx?: Tx,
    ): Promise<EnquiryWithVehicle | null> {
      const client = tx ?? prisma;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return client.enquiry.findFirst({
        where: {
          phone,
          dealerId,
          vehicleId,
          createdAt: { gte: since },
        },
        include: enquiryInclude,
        orderBy: { createdAt: 'desc' },
      });
    },

    async create(tx: Tx, data: Prisma.EnquiryUncheckedCreateInput): Promise<EnquiryWithVehicle> {
      return tx.enquiry.create({ data, include: enquiryInclude });
    },

    // ─────────── dealer-scoped (dealerId first, always) ────────────────────

    async listForDealer(
      dealerId: string,
      filter: { status?: EnquiryStatus; cursor?: Date; limit: number },
    ): Promise<EnquiryWithVehicle[]> {
      return prisma.enquiry.findMany({
        where: {
          dealerId,
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.cursor ? { createdAt: { lt: filter.cursor } } : {}),
        },
        include: enquiryInclude,
        orderBy: { createdAt: 'desc' },
        take: filter.limit + 1,
      });
    },

    async findForDealer(dealerId: string, enquiryId: string): Promise<EnquiryWithVehicle | null> {
      return prisma.enquiry.findFirst({
        where: { id: enquiryId, dealerId },
        include: enquiryInclude,
      });
    },

    /** One grouped query, not four list calls (§14.3). */
    async countsForDealer(dealerId: string): Promise<Record<EnquiryStatus, number>> {
      const rows = await prisma.enquiry.groupBy({
        by: ['status'],
        where: { dealerId },
        _count: { _all: true },
      });

      const counts: Record<EnquiryStatus, number> = { NEW: 0, CONTACTED: 0, CLOSED: 0, SPAM: 0 };
      for (const row of rows) counts[row.status] = row._count._all;
      return counts;
    },

    async updateForDealer(
      dealerId: string,
      enquiryId: string,
      data: Prisma.EnquiryUncheckedUpdateInput,
    ): Promise<EnquiryWithVehicle | null> {
      const result = await prisma.enquiry.updateMany({
        where: { id: enquiryId, dealerId },
        data,
      });
      if (result.count === 0) return null;
      return prisma.enquiry.findUnique({ where: { id: enquiryId }, include: enquiryInclude });
    },

    async recentForDealer(dealerId: string, limit: number): Promise<EnquiryWithVehicle[]> {
      return prisma.enquiry.findMany({
        where: { dealerId, status: { not: 'SPAM' } },
        include: enquiryInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    },

    async recordReveal(
      tx: Tx,
      data: { dealerId: string; vehicleId: string | null; ip: string; userAgent?: string },
    ): Promise<void> {
      await tx.phoneReveal.create({
        data: {
          dealerId: data.dealerId,
          vehicleId: data.vehicleId,
          ip: data.ip,
          userAgent: data.userAgent ?? null,
        },
      });
    },

    async revealsToday(ip: string): Promise<number> {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return prisma.phoneReveal.count({ where: { ip, createdAt: { gte: since } } });
    },
  };
}

export type EnquiriesRepository = ReturnType<typeof createEnquiriesRepository>;
