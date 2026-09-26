import type { Prisma, PrismaClient, Vehicle } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export type VehicleRow = Vehicle;

export type VehicleWrite = Omit<
  Prisma.VehicleUncheckedUpdateInput,
  'id' | 'dealerId' | 'createdAt' | 'updatedAt' | 'createdBy'
>;

export interface VehicleCreate {
  dealerId: string;
  registrationNumber: string;
  rtoCode: string | null;
  createdBy: string | null;
}

export type SpelledField = 'make' | 'model';

export function createVehiclesRepository(prisma: PrismaClient) {
  return {
    async create(input: VehicleCreate, tx?: Tx): Promise<VehicleRow> {
      const client = tx ?? prisma;
      return client.vehicle.create({ data: input });
    },

    async findOwned(dealerId: string, vehicleId: string, tx?: Tx): Promise<VehicleRow | null> {
      const client = tx ?? prisma;
      return client.vehicle.findFirst({ where: { id: vehicleId, dealerId } });
    },

    async findById(vehicleId: string, tx?: Tx): Promise<VehicleRow | null> {
      const client = tx ?? prisma;
      return client.vehicle.findUnique({ where: { id: vehicleId } });
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
      return client.vehicle.findUnique({ where: { id: vehicleId } });
    },

    async deleteOwned(dealerId: string, vehicleId: string, tx?: Tx): Promise<boolean> {
      const client = tx ?? prisma;
      const result = await client.vehicle.deleteMany({ where: { id: vehicleId, dealerId } });
      return result.count > 0;
    },

    async listForDealer(dealerId: string): Promise<VehicleRow[]> {
      return prisma.vehicle.findMany({
        where: { dealerId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
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
  };
}

export type VehiclesRepository = ReturnType<typeof createVehiclesRepository>;
