import { initialsOf, slugify } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export const dealerInclude = {
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
        orderBy: { brandName: 'asc' },
      });

      return rows.map((dealer) => ({
        id: dealer.id,
        slug: dealer.slug,
        brandName: dealer.brandName,
        initials: initialsOf(dealer.brandName),
        // `citySlug` went with the `cities` table. The directory's filter is
        // derived from the name the dealership carries, so a link stays stable
        // as long as the dealership does not move — which is the same promise
        // the slug made, without a table to keep in step with it.
        cityName: dealer.city,
        citySlug: dealer.city === null ? null : slugify(dealer.city),
        state: dealer.state,
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

    /**
     * The row currently occupying a slot, whatever state it is in.
     *
     * Both write paths need it for the same reason: the stored object's key
     * ends in the row's id, so replacing or removing a document means knowing
     * which id is being displaced before it is overwritten.
     */
    async documentByType(dealerId: string, type: Prisma.DealerDocumentUncheckedCreateInput['type']) {
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

    /**
     * One dealership carrying this name **in this city**, or this GSTIN
     * anywhere — ignoring the one asking.
     *
     * The two unique indexes are the real guarantee; this read is what turns a
     * collision into a message against the field the dealer just typed. Both
     * comparisons are case-insensitive, because "Sri Lakshmi Motors" and "SRI
     * LAKSHMI MOTORS" in one town are one business applying twice and a
     * case-sensitive index would let the second one through.
     *
     * The name clause carries the city with it. A name on its own says nothing
     * — three families in three towns trade as "Sri Balaji Motors" — so a name
     * asked about without a city cannot conflict, and this returns false for
     * it rather than guessing at the dealership's current one. Callers that
     * mean "does this name still fit where I am" pass both.
     */
    async findConflicting(
      exceptDealerId: string,
      fields: { legalName?: string; city?: string; gstin?: string },
    ): Promise<{ legalName: boolean; gstin: boolean }> {
      const legalName = fields.legalName?.toLowerCase();
      const city = fields.city?.toLowerCase();
      const gstin = fields.gstin?.toLowerCase();
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
      if (clauses.length === 0) return { legalName: false, gstin: false };

      const rows = await prisma.dealer.findMany({
        where: { id: { not: exceptDealerId }, OR: clauses },
        select: { legalName: true, city: true, gstin: true },
      });

      const lower = (value: string | null): string | null => value?.toLowerCase() ?? null;
      return {
        legalName:
          named &&
          rows.some((row) => lower(row.legalName) === legalName && lower(row.city) === city),
        gstin: rows.some((row) => lower(row.gstin) === gstin),
      };
    },

    async mediaById(mediaId: string) {
      return prisma.media.findUnique({ where: { id: mediaId } });
    },

    async createMedia(data: Prisma.MediaUncheckedCreateInput) {
      return prisma.media.create({ data });
    },

    /**
     * ORPHAN rather than a delete. The row is the only record that the bytes
     * ever existed; a sweeper reconciles orphaned rows against storage, and a
     * row deleted the instant its object is removed leaves nothing to reconcile
     * against if the storage call is the half that fails.
     */
    async orphanMedia(mediaId: string) {
      return prisma.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
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
