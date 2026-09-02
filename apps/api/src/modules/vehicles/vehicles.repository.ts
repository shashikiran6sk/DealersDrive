import type { Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

/**
 * Layer 2 of tenant isolation (ARCHITECTURE §7).
 *
 * **Every dealer-scoped method takes `dealerId` as its first required
 * parameter.** Not optional, not looked up inside — an explicit argument, so
 * an unscoped query is a type error rather than a data leak. There is no
 * `findById(id)` overload; public reads go through the explicitly-named
 * `findPublicById`, which resolves visibility from `listing_search`.
 */
export const vehicleInclude = {
  make: true,
  model: true,
  variant: true,
  color: true,
  city: true,
  media: { include: { media: true }, orderBy: { position: 'asc' } },
  listings: { orderBy: { submittedAt: 'desc' } },
} satisfies Prisma.VehicleInclude;

export type VehicleWithRelations = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;

export function createVehiclesRepository(prisma: PrismaClient) {
  return {
    async findForDealer(dealerId: string, vehicleId: string): Promise<VehicleWithRelations | null> {
      return prisma.vehicle.findFirst({
        where: { id: vehicleId, dealerId, deletedAt: null },
        include: vehicleInclude,
      });
    },

    async listForDealer(
      dealerId: string,
      filter: { cursor?: Date; limit: number; q?: string },
    ): Promise<VehicleWithRelations[]> {
      return prisma.vehicle.findMany({
        where: {
          dealerId,
          deletedAt: null,
          ...(filter.cursor ? { createdAt: { lt: filter.cursor } } : {}),
          ...(filter.q
            ? {
                OR: [
                  { make: { name: { contains: filter.q, mode: 'insensitive' } } },
                  { model: { name: { contains: filter.q, mode: 'insensitive' } } },
                  { variant: { name: { contains: filter.q, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        include: vehicleInclude,
        orderBy: { createdAt: 'desc' },
        take: filter.limit + 1,
      });
    },

    async countForDealer(dealerId: string): Promise<number> {
      return prisma.vehicle.count({ where: { dealerId, deletedAt: null } });
    },

    async create(dealerId: string, data: Prisma.VehicleUncheckedCreateInput) {
      return prisma.vehicle.create({ data: { ...data, dealerId }, include: vehicleInclude });
    },

    /** Same as `create`, inside a caller's transaction — a draft and its first
     *  report row must land together or not at all. */
    async createIn(tx: Tx, dealerId: string, data: Prisma.VehicleUncheckedCreateInput) {
      return tx.vehicle.create({ data: { ...data, dealerId }, include: vehicleInclude });
    },

    /**
     * Does this dealer already hold this plate on a live vehicle?
     *
     * Belt and braces with the partial unique index added by the rc_lookup
     * migration. The index is the guarantee; this read is what turns it into a
     * useful message with a link to the existing car, rather than a raw
     * constraint violation surfacing as a 500.
     */
    /**
     * `exceptVehicleId` is what makes this usable from PATCH as well as POST.
     * A dealer re-typing the same plate on the car that already carries it is
     * correcting a typo elsewhere in the form, not creating a duplicate, and
     * refusing that would make the field uneditable once set.
     */
    async findByRegistration(dealerId: string, regNumberMasked: string, exceptVehicleId?: string) {
      return prisma.vehicle.findFirst({
        where: {
          dealerId,
          regNumberMasked,
          deletedAt: null,
          ...(exceptVehicleId ? { id: { not: exceptVehicleId } } : {}),
        },
        select: { id: true, makeId: true, modelId: true, year: true },
      });
    },

    // ── RC lookup cache ──────────────────────────────────────────────────
    //
    // Cross-tenant by design: an RC is a fact about a car, not a dealership,
    // and two dealers appraising the same trade-in should not both be charged
    // for it. There is deliberately no `dealerId` parameter here — see the
    // note on the `RcLookup` model, and the documented exception in
    // tenant-isolation.test.ts.

    async findRcLookup(regHash: string) {
      return prisma.rcLookup.findFirst({
        where: { regHash, expiresAt: { gt: new Date() } },
      });
    },

    async findRcLookupById(id: string) {
      return prisma.rcLookup.findUnique({ where: { id } });
    },

    /**
     * Upsert rather than create: two dealers can look up the same plate in the
     * same second, and the loser of that race should refresh the row rather
     * than collide with the unique index on `regHash`.
     */
    async saveRcLookup(input: {
      regHash: string;
      provider: string;
      specs: Prisma.InputJsonValue;
      resolved: Prisma.InputJsonValue;
      /** `JsonNull` for a cached miss — there were no records to keep. */
      records: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;
      expiresAt: Date;
      found: boolean;
    }) {
      const { regHash, ...rest } = input;
      return prisma.rcLookup.upsert({
        where: { regHash },
        create: { regHash, ...rest },
        update: { ...rest, fetchedAt: new Date() },
      });
    },

    /** Reclaims expired rows. Called on a schedule, never on the request path. */
    async sweepRcLookups(): Promise<number> {
      const { count } = await prisma.rcLookup.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return count;
    },

    /**
     * Checks that a catalogue reference exists **and is coherent** — that the
     * model really belongs to the make, and the variant to the model.
     *
     * Existence alone would not be enough. ARCHITECTURE §6.2 constrains dealers
     * to dropdowns precisely because a Kia Seltos filed under Maruti Suzuki
     * takes search, filters and SEO down with it, and nothing downstream
     * re-checks the pairing. One query answers both questions, so there is no
     * reason to answer only the easy one.
     *
     * Returns the first reference that fails, or `null` when they all hold.
     */
    async findBrokenCatalogueRef(refs: {
      makeId?: string | undefined;
      modelId?: string | undefined;
      variantId?: string | null | undefined;
      colorId?: string | null | undefined;
      cityId?: string | undefined;
    }): Promise<string | null> {
      if (refs.makeId !== undefined) {
        const make = await prisma.make.findUnique({
          where: { id: refs.makeId },
          select: { id: true },
        });
        if (!make) return 'makeId';
      }

      if (refs.modelId !== undefined) {
        const model = await prisma.model.findFirst({
          // The make constraint is the coherence check: a real model id filed
          // under the wrong make fails here rather than corrupting the facets.
          where: {
            id: refs.modelId,
            ...(refs.makeId === undefined ? {} : { makeId: refs.makeId }),
          },
          select: { id: true },
        });
        if (!model) return 'modelId';
      }

      if (refs.variantId !== undefined && refs.variantId !== null) {
        const variant = await prisma.variant.findFirst({
          where: {
            id: refs.variantId,
            ...(refs.modelId === undefined ? {} : { modelId: refs.modelId }),
          },
          select: { id: true },
        });
        if (!variant) return 'variantId';
      }

      if (refs.colorId !== undefined && refs.colorId !== null) {
        const color = await prisma.color.findUnique({
          where: { id: refs.colorId },
          select: { id: true },
        });
        if (!color) return 'colorId';
      }

      if (refs.cityId !== undefined) {
        const city = await prisma.city.findUnique({
          where: { id: refs.cityId },
          select: { id: true },
        });
        if (!city) return 'cityId';
      }

      return null;
    },

    /**
     * The `dealerId` in the WHERE clause is not redundant with the guard: the
     * service re-checks ownership inside the transaction that performs the
     * write, so there is no gap between "you may" and "this row is yours".
     */
    async update(
      dealerId: string,
      vehicleId: string,
      data: Prisma.VehicleUncheckedUpdateInput,
      tx?: Tx,
    ) {
      const client = tx ?? prisma;

      /**
       * A PATCH that names no field is a no-op, not a miss. Prisma skips the
       * statement entirely when there is nothing to SET and answers
       * `count: 0` — the same answer it gives for a row belonging to another
       * dealer — so reading `count` alone would turn the wizard's photo step,
       * which owns no scalar fields of its own, into a 404. The empty case
       * resolves through the same dealer-scoped WHERE, so `null` keeps meaning
       * exactly one thing: no such row for this dealer.
       */
      const writes = Object.values(data).some((value) => value !== undefined);
      if (!writes) {
        return client.vehicle.findFirst({
          where: { id: vehicleId, dealerId, deletedAt: null },
          include: vehicleInclude,
        });
      }

      const result = await client.vehicle.updateMany({
        where: { id: vehicleId, dealerId, deletedAt: null },
        data,
      });
      if (result.count === 0) return null;
      return client.vehicle.findUnique({ where: { id: vehicleId }, include: vehicleInclude });
    },

    async softDelete(dealerId: string, vehicleId: string): Promise<boolean> {
      const result = await prisma.vehicle.updateMany({
        where: { id: vehicleId, dealerId, deletedAt: null },
        data: { deletedAt: new Date(), status: 'ARCHIVED' },
      });
      return result.count > 0;
    },

    async readyPhotoCount(dealerId: string, vehicleId: string): Promise<number> {
      return prisma.vehicleMedia.count({
        where: { vehicleId, vehicle: { dealerId }, media: { status: 'READY' } },
      });
    },

    async slugExists(slug: string): Promise<boolean> {
      const found = await prisma.vehicle.findUnique({ where: { slug }, select: { id: true } });
      return found !== null;
    },

    // ─────────── public reads — deliberately not dealer-scoped ─────────────

    async findPublicById(vehicleId: string): Promise<VehicleWithRelations | null> {
      return prisma.vehicle.findFirst({
        where: { id: vehicleId, deletedAt: null },
        include: vehicleInclude,
      });
    },

    /**
     * Why a saved car dropped out of the catalogue. A car that has left must
     * never 404 the whole batch request (A4).
     */
    async unavailableReason(
      vehicleId: string,
    ): Promise<'SOLD' | 'EXPIRED' | 'REMOVED' | 'NOT_FOUND'> {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: { listings: { orderBy: { submittedAt: 'desc' }, take: 1 } },
      });
      if (!vehicle) return 'NOT_FOUND';
      if (vehicle.status === 'SOLD') return 'SOLD';

      const listing = vehicle.listings[0];
      if (!listing) return 'NOT_FOUND';
      if (listing.status === 'EXPIRED') return 'EXPIRED';
      if (listing.status === 'SOLD') return 'SOLD';
      return 'REMOVED';
    },
  };
}

export type VehiclesRepository = ReturnType<typeof createVehiclesRepository>;
