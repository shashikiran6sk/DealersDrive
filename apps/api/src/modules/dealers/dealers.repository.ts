import { initialsOf } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export const dealerInclude = {
  city: true,
  documents: true,
  members: { include: { user: true }, where: { status: 'ACTIVE' as const } },
} satisfies Prisma.DealerInclude;

export type DealerWithRelations = Prisma.DealerGetPayload<{ include: typeof dealerInclude }>;

export function createDealersRepository(prisma: PrismaClient) {
  return {
    async findById(dealerId: string): Promise<DealerWithRelations | null> {
      return prisma.dealer.findUnique({ where: { id: dealerId }, include: dealerInclude });
    },

    async findBySlug(slug: string): Promise<DealerWithRelations | null> {
      return prisma.dealer.findUnique({ where: { slug }, include: dealerInclude });
    },

    /** Only ACTIVE dealers are ever public — the directory included (§11.1). */
    async findPublicBySlug(slug: string): Promise<DealerWithRelations | null> {
      return prisma.dealer.findFirst({
        where: { slug, status: 'ACTIVE' },
        include: dealerInclude,
      });
    },

    async listActive() {
      const rows = await prisma.dealer.findMany({
        where: { status: 'ACTIVE' },
        include: { city: true },
        orderBy: { brandName: 'asc' },
      });

      return rows.map((dealer) => ({
        id: dealer.id,
        slug: dealer.slug,
        brandName: dealer.brandName,
        initials: initialsOf(dealer.brandName),
        cityName: dealer.city?.name ?? null,
        citySlug: dealer.city?.slug ?? null,
        state: dealer.city?.state ?? 'Tamil Nadu',
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

    async ownerOf(dealerId: string) {
      return prisma.dealerMember.findFirst({
        where: { dealerId, role: 'OWNER', status: 'ACTIVE' },
        include: { user: true },
      });
    },

    /**
     * ── Reconstruction slice ──────────────────────────────────────────────
     * The baseline body is
     *   `prisma.enquiry.count({ where: { dealerId, status: 'NEW' } })`
     * and the `Enquiry` model arrives at **F088**. With no enquiries table
     * there are no enquiries, so zero is the answer rather than a placeholder
     * — but it is not the baseline's code, and the query is restored with the
     * model. `pendingListingCount` is the same story against **F064**.
     */
    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F088
    async newEnquiryCount(_dealerId: string): Promise<number> {
      return 0;
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async pendingListingCount(_dealerId: string): Promise<number> {
      return 0;
    },
  };
}

export type DealersRepository = ReturnType<typeof createDealersRepository>;
