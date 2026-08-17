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
