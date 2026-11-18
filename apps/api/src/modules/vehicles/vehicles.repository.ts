import type {
  Listing,
  ListingReactivationRequest,
  ListingStatus,
  Prisma,
  PrismaClient,
  Vehicle,
} from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export type ListingRow = Listing & { reactivations?: ListingReactivationRequest[] };

export type VehicleRow = Vehicle & { listing: ListingRow | null };

const withListing = {
  listing: { include: { reactivations: { orderBy: { requestedAt: 'desc' }, take: 1 } } },
} satisfies Prisma.VehicleInclude;

export type VehicleWrite = Omit<
  Prisma.VehicleUncheckedUpdateInput,
  'id' | 'dealerId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByMemberId'
>;

export interface VehicleCreate {
  dealerId: string;
  registrationNumber: string;
  rtoCode: string | null;
  createdBy: string | null;
  createdByMemberId?: string | null;
}

export type SpelledField = 'make' | 'model';

export type ScopedField = 'model' | 'variant';

export interface ValueScope {
  make: string;
  model?: string;
  dealerId?: string;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function scopeWhere(field: ScopedField, scope: ValueScope): Prisma.VehicleWhereInput {
  const vetted: Prisma.VehicleWhereInput = { listing: { is: { publishedAt: { not: null } } } };
  return {
    make: scope.make,
    ...(field === 'variant' ? { model: { equals: scope.model ?? '', mode: 'insensitive' } } : {}),
    [field]: { not: null },
    ...(scope.dealerId ? { OR: [{ dealerId: scope.dealerId }, vetted] } : vetted),
  };
}

export interface InventoryFilter {
  status?: ListingStatus;
  q?: string;
  before?: { at: Date; id: string | null };
  take: number;
}

function searchOf(q: string): Prisma.VehicleWhereInput {
  const plate = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return {
    OR: [
      ...(plate ? [{ registrationNumber: { contains: plate } }] : []),
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
    ],
  };
}

export function createVehiclesRepository(prisma: PrismaClient) {
  return {
    async create(input: VehicleCreate, tx?: Tx): Promise<VehicleRow> {
      const client = tx ?? prisma;
      return client.vehicle.create({ data: input, include: withListing });
    },

    async findOwned(dealerId: string, vehicleId: string, tx?: Tx): Promise<VehicleRow | null> {
      const client = tx ?? prisma;
      return client.vehicle.findFirst({ where: { id: vehicleId, dealerId }, include: withListing });
    },

    async findById(vehicleId: string, tx?: Tx): Promise<VehicleRow | null> {
      const client = tx ?? prisma;
      return client.vehicle.findUnique({ where: { id: vehicleId }, include: withListing });
    },

    async updateOwned(
      dealerId: string,
      vehicleId: string,
      data: VehicleWrite,
      tx?: Tx,
    ): Promise<VehicleRow | null> {
      const client = tx ?? prisma;
      const result = await client.vehicle.updateMany({
        where: { id: vehicleId, dealerId },
        data,
      });
      if (result.count === 0) return null;
      return client.vehicle.findUnique({ where: { id: vehicleId }, include: withListing });
    },

    async deleteOwned(dealerId: string, vehicleId: string, tx?: Tx): Promise<boolean> {
      const client = tx ?? prisma;
      const result = await client.vehicle.deleteMany({ where: { id: vehicleId, dealerId } });
      return result.count > 0;
    },

    async heldRegistration(
      dealerId: string,
      registrationNumber: string,
      exceptVehicleId?: string,
    ): Promise<Vehicle | null> {
      return prisma.vehicle.findFirst({
        where: {
          dealerId,
          registrationNumber,
          releasedAt: null,
          ...(exceptVehicleId ? { id: { not: exceptVehicleId } } : {}),
        },
      });
    },

    async listForDealer(dealerId: string): Promise<VehicleRow[]> {
      return prisma.vehicle.findMany({
        where: { dealerId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: withListing,
      });
    },

    async createdByMember(dealerId: string, memberId: string): Promise<VehicleRow[]> {
      return prisma.vehicle.findMany({
        where: { dealerId, createdByMemberId: memberId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: withListing,
      });
    },

    async inventory(dealerId: string, filter: InventoryFilter): Promise<VehicleRow[]> {
      return prisma.vehicle.findMany({
        where: {
          dealerId,
          ...(filter.status ? { listing: { is: { status: filter.status } } } : {}),
          ...(filter.q ? searchOf(filter.q) : {}),
          ...(filter.before
            ? {
                AND: [
                  {
                    OR: [
                      { createdAt: { lt: filter.before.at } },
                      ...(filter.before.id
                        ? [{ createdAt: filter.before.at, id: { lt: filter.before.id } }]
                        : []),
                    ],
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: filter.take,
        include: withListing,
      });
    },

    async statusCounts(dealerId: string): Promise<{ status: ListingStatus; count: number }[]> {
      const grouped = await prisma.listing.groupBy({
        by: ['status'],
        where: { dealerId },
        _count: { _all: true },
      });
      return grouped.map((row) => ({ status: row.status, count: row._count._all }));
    },

    async existingSpelling(field: SpelledField, value: string): Promise<string | null> {
      const row = await prisma.vehicle.findFirst({
        where: { [field]: { equals: value, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
        select: { [field]: true },
      });
      const spelled: unknown = row?.[field];
      return typeof spelled === 'string' ? spelled : null;
    },

    async suggestions(field: SpelledField, prefix: string, limit: number): Promise<string[]> {
      const rows = await prisma.vehicle.findMany({
        where: { [field]: { startsWith: prefix, mode: 'insensitive' } },
        distinct: [field],
        orderBy: { [field]: 'asc' },
        take: limit,
        select: { [field]: true },
      });
      return rows
        .map((row): unknown => row[field])
        .filter((value): value is string => typeof value === 'string');
    },

    async scopedValues(field: ScopedField, scope: ValueScope, limit: number): Promise<string[]> {
      const where = scopeWhere(field, scope);
      if (field === 'model') {
        const rows = await prisma.vehicle.groupBy({
          by: ['model'],
          where,
          _count: { model: true },
          orderBy: [{ _count: { model: 'desc' } }, { model: 'asc' }],
          take: limit,
        });
        return rows.map((row) => row.model).filter(isText);
      }
      const rows = await prisma.vehicle.groupBy({
        by: ['variant'],
        where,
        _count: { variant: true },
        orderBy: [{ _count: { variant: 'desc' } }, { variant: 'asc' }],
        take: limit,
      });
      return rows.map((row) => row.variant).filter(isText);
    },
  };
}

export type VehiclesRepository = ReturnType<typeof createVehiclesRepository>;
