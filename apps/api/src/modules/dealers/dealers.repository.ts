import { initialsOf, slugify } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export const dealerInclude = {
  documents: true,
  members: { include: { user: true }, where: { status: 'ACTIVE' as const } },
  /**
   * The newest edit this dealership has proposed to its own public words, and
   * only the newest (**R34**).
   *
   * `take: 1` because the profile screen asks one question — *"is there
   * anything to tell this dealer about their last save"* — and the answer is
   * always about the most recent request. Older rows are the dealership's
   * publishing history; nothing renders them, and pulling them all would grow
   * this include without bound on the busiest dealerships.
   *
   * In the include rather than in a second query so that every path holding a
   * `DealerWithRelations` can answer it. `toProfile` is called from five places
   * and one of them forgetting to look would be a dealer told nothing about a
   * refusal.
   */
  profileEdits: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.DealerInclude;

export type DealerWithRelations = Prisma.DealerGetPayload<{ include: typeof dealerInclude }>;

/**
 * A locality's slug, or null when there is no locality.
 *
 * Truthiness rather than `=== null`, and the difference is not pedantry: a
 * column can hold `''` — `normaliseLocality` maps a field of spaces to it — and
 * `slugify('')` is an empty slug, which is a filter value that matches
 * everything and displays as nothing. Both mean "not answered", and both have
 * to reach the response as null so the chip is dropped rather than rendered
 * blank.
 */
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

    /** Only ACTIVE dealers are ever public — the directory included (§11.1). */
    async findPublicBySlug(slug: string): Promise<DealerWithRelations | null> {
      return prisma.dealer.findFirst({
        where: { slug, status: 'ACTIVE' },
        include: dealerInclude,
      });
    },

    /**
     * The dealership's slug, and nothing else.
     *
     * Every storage key a dealership owns is derived from it
     * (`dealer-storage-keys.ts`), and the three KYC write paths need it without
     * needing anything else about the dealership — so they ask for one column
     * rather than pulling `dealerInclude`'s documents and members across to
     * read a string off the row.
     */
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
        // `citySlug` went with the `cities` table. The directory's filter is
        // derived from the name the dealership carries, so a link stays stable
        // as long as the dealership does not move — which is the same promise
        // the slug made, without a table to keep in step with it.
        cityName: dealer.city,
        citySlug: placeSlug(dealer.city),
        // The area a buyer would drive across, as opposed to the town they
        // would name. Both are derived from the dealership's own text, so
        // neither can drift from a lookup table that no longer exists (D6).
        districtName: dealer.district,
        districtSlug: placeSlug(dealer.district),
        state: dealer.state,
        // The yard photograph, as an id. The directory turns it into a URL only
        // for the page it is rendering, and only for the rows whose media is
        // actually servable — see `readyMediaIds` below.
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

    /**
     * The row currently occupying a slot, whatever state it is in.
     *
     * Both write paths need it for the same reason: the stored object's key
     * ends in the row's id, so replacing or removing a document means knowing
     * which id is being displaced before it is overwritten.
     */
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

    /**
     * One dealership carrying this name **in this city**, or this GSTIN or PAN
     * anywhere — ignoring the one asking.
     *
     * The three unique indexes are the real guarantee; this read is what turns
     * a collision into a message against the field the dealer just typed. Every
     * comparison is case-insensitive, because "Sri Lakshmi Motors" and "SRI
     * LAKSHMI MOTORS" in one town are one business applying twice and a
     * case-sensitive index would let the second one through.
     *
     * The name clause carries the city with it. A name on its own says nothing
     * — three families in three towns trade as "Sri Balaji Motors" — so a name
     * asked about without a city cannot conflict, and this returns false for
     * it rather than guessing at the dealership's current one. Callers that
     * mean "does this name still fit where I am" pass both.
     *
     * **One query, however many fields are asked about.** A dealer filling in
     * step 3 sends GSTIN and PAN together, and two round trips to answer one
     * question is a round trip nobody needed — the clauses are OR'd and the
     * three answers are read back off the same rows (**R38**).
     */
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
        // The `!== undefined` guards are belt and braces rather than a fix:
        // `lower()` returns `string | null` and never `undefined`, so an
        // unasked-about field could not have matched anyway. They are here so
        // the intent — *a field nobody asked about cannot clash* — is stated
        // rather than inferred from a type two lines away.
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

    /**
     * Which of these uploads can actually be served.
     *
     * `media.serve()` answers only for a READY row, so a `coverMediaId`
     * pointing at anything else must not become a URL on a public page — the
     * card would render a broken image where the honest answer is the
     * `ImageSlot`. One query for the whole directory page rather than one per
     * card.
     */
    async readyMediaIds(mediaIds: string[]): Promise<Set<string>> {
      if (mediaIds.length === 0) return new Set();
      const rows = await prisma.media.findMany({
        where: { id: { in: mediaIds }, status: 'READY' },
        select: { id: true },
      });
      return new Set(rows.map((row) => row.id));
    },

    /**
     * The one promotion this module performs, on commit of a yard photograph.
     *
     * Vehicle photos are promoted by F034's worker after it re-encodes them.
     * This one has nothing to re-encode yet and is the dealership's own
     * deliberate act, so it is READY the moment its bytes are confirmed.
     */
    async markMediaReady(mediaId: string) {
      return prisma.media.update({ where: { id: mediaId }, data: { status: 'READY' } });
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

    /*
     * ── C18, the dashboard's six reads (F048) ─────────────────────────────
     *
     * Every one of them queries a model that does not exist yet:
     * `ListingViewDaily` and `Listing` at **F064**, `Enquiry` at **F088**,
     * `CreditTransaction` at **F050**. So each returns the answer that is true
     * with no rows — an empty result or a zero — with the baseline's query in
     * the comment above it.
     *
     * **They are on the repository rather than inlined in the service, and
     * that is the whole point of doing it this way.** `dashboard()` keeps the
     * baseline's derivation intact and verbatim — the greeting, the seven-day
     * series, the height scaling, the four delta sentences — because that is
     * the code a reviewer has to check against the baseline and the code a
     * later feature must not re-invent. What is held back is six queries, each
     * one line, each named. A service that computed zeros inline would hide the
     * derivation behind the slice, and restoring the models would then mean
     * rewriting the part that was never in question.
     *
     * Each of these is restored by the feature named against it, and F048's
     * entry in the feature map lists them.
     */

    /**
     * Daily view rollups for this dealership since `from`.
     *
     * Baseline:
     * ```ts
     * prisma.listingViewDaily.groupBy({
     *   by: ['day'],
     *   where: { dealerId, day: { gte: from } },
     *   _sum: { views: true },
     * })
     * ```
     * `ListingViewDaily` arrives at **F064**.
     */
    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async viewRollups(
      _dealerId: string,
      _from: Date,
    ): Promise<{ day: Date; views: number | null }[]> {
      return [];
    },

    /**
     * Views in the week before `from`, or null when that week has no rows at
     * all.
     *
     * **Null and zero are different answers and the dashboard renders them
     * differently**: null is "no data for last week", zero is a real week with
     * no traffic, and reporting the first as the second fabricates a −100%
     * trend. Prisma's `_sum` is null for an empty aggregate, which is exactly
     * the distinction wanted, so the shape is kept rather than flattened.
     *
     * Baseline:
     * ```ts
     * (await prisma.listingViewDaily.aggregate({
     *   where: { dealerId, day: { gte: previousWeekStart, lt: from } },
     *   _sum: { views: true },
     * }))._sum.views
     * ```
     * `ListingViewDaily` arrives at **F064**.
     */
    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async previousWeekViews(_dealerId: string, _from: Date): Promise<number | null> {
      return null;
    },

    /**
     * NEW enquiries since `from`, and every non-SPAM enquiry in the week
     * before it — the pair the "vs last week" sentence is built from.
     *
     * One method for two counts because they are only ever wanted together and
     * must be measured against one clock.
     *
     * Baseline: two `prisma.enquiry.count` calls. `Enquiry` arrives at
     * **F088**.
     */
    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F088
    async enquiryCounts(
      _dealerId: string,
      _from: Date,
    ): Promise<{ thisWeek: number; previousWeek: number }> {
      return { thisWeek: 0, previousWeek: 0 };
    },

    /**
     * The newest enquiries, for the console's right-hand panel.
     *
     * Baseline: `enquiries.recentForDealer(dealerId, limit)` — a facade call
     * into the enquiries module, which arrives at **F088** and brings the
     * `EnquiriesService` dependency with it.
     */
    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F088
    async recentEnquiries(_dealerId: string, _limit: number): Promise<RecentEnquiryRow[]> {
      return [];
    },

    /**
     * Approved listings expiring inside seven days — the dashboard's one
     * alert.
     *
     * Baseline:
     * ```ts
     * prisma.listing.count({
     *   where: { dealerId, status: 'APPROVED', expiresAt: { lte: horizon } },
     * })
     * ```
     * `Listing` arrives at **F064**.
     */
    // eslint-disable-next-line @typescript-eslint/require-await -- restored at F064
    async expiringListingCount(_dealerId: string, _horizon: Date): Promise<number> {
      return 0;
    },

    /**
     * Credits spent on listing submissions this calendar month, and listings
     * approved since `from` — the two "delta" numbers under the stat cards.
     *
     * Baseline: a `prisma.creditTransaction.count` on `reason: 'HOLD_SUBMIT'`
     * and a `prisma.listing.count` on `approvedAt`. `CreditTransaction`
     * arrives at **F050** and `Listing` at **F064**.
     */
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

/**
 * One enquiry as the dashboard panel needs it (**F048**).
 *
 * Declared here rather than inferred from a Prisma payload because the model it
 * will be inferred *from* does not exist yet. When `Enquiry` lands at F088 this
 * becomes a `Prisma.EnquiryGetPayload<…>` and the shape below is what that
 * payload has to satisfy — which is the useful half of writing it out: the
 * fields the console actually reads are recorded, rather than "whatever the
 * include happened to select".
 *
 * `vehicle` is null for a general enquiry — somebody asking the dealership a
 * question rather than asking about one car — and the panel renders that as
 * "General enquiry" rather than dropping the row.
 */
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
