import {
  isListingDeletable,
  isListingEditable,
  parseRegistration,
  type CreateVehicleInput,
  type DealerVehicle,
  type UpdateVehicleInput,
  type VehicleSuggestQuery,
  type VehicleSuggestions,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, NotFoundError, errorCode } from '../../platform/errors.js';
import { createDraftListing, lockListingForVehicle } from '../listings/listings.facade.js';
import { toDealerVehicle } from './vehicles.mapper.js';
import {
  DUPLICATE_REGISTRATION,
  VEHICLE_NOT_DELETABLE,
  VEHICLE_NOT_EDITABLE,
  VEHICLE_NOT_FOUND,
} from './vehicles.messages.js';
import type { VehicleRow, VehicleWrite, VehiclesRepository } from './vehicles.repository.js';

export interface VehicleActor {
  dealerId: string;
  userId: string;
}

export interface VehiclesDeps {
  prisma: PrismaClient;
  repo: VehiclesRepository;
  audit: AuditService;
}

export const SUGGESTION_LIMIT = 8;

function duplicate(): ConflictError {
  return new ConflictError('DUPLICATE_REGISTRATION', DUPLICATE_REGISTRATION, {
    errors: [
      {
        field: 'body.registrationNumber',
        code: 'DUPLICATE_REGISTRATION',
        message: DUPLICATE_REGISTRATION,
      },
    ],
  });
}

function notFound(): NotFoundError {
  return new NotFoundError(VEHICLE_NOT_FOUND, { code: 'VEHICLE_NOT_FOUND' });
}

function rtoCodeOf(registrationNumber: string): string | null {
  const parsed = parseRegistration(registrationNumber);
  return parsed.ok ? parsed.value.rtoCode : null;
}

export function createVehiclesService({ prisma, repo, audit }: VehiclesDeps) {
  async function requireOwned(dealerId: string, vehicleId: string): Promise<VehicleRow> {
    const vehicle = await repo.findOwned(dealerId, vehicleId);
    if (!vehicle) throw notFound();
    return vehicle;
  }

  async function lockEditable(tx: Tx, vehicleId: string): Promise<void> {
    const listing = await lockListingForVehicle(tx, vehicleId);
    if (!listing) throw notFound();
    if (!isListingEditable(listing.status)) {
      throw new ConflictError('VEHICLE_NOT_EDITABLE', VEHICLE_NOT_EDITABLE, {
        extra: { listingStatus: listing.status },
      });
    }
  }

  async function spelled(field: 'make' | 'model', value: string): Promise<string> {
    return (await repo.existingSpelling(field, value)) ?? value;
  }

  async function writeOf(input: UpdateVehicleInput): Promise<VehicleWrite> {
    const data: VehicleWrite = {};

    if (input.registrationNumber !== undefined) {
      data.registrationNumber = input.registrationNumber;
      data.rtoCode = rtoCodeOf(input.registrationNumber);
    }
    if (input.make !== undefined) data.make = input.make && (await spelled('make', input.make));
    if (input.model !== undefined) {
      data.model = input.model && (await spelled('model', input.model));
    }
    if (input.variant !== undefined) data.variant = input.variant;
    if (input.manufacturingYear !== undefined) data.manufacturingYear = input.manufacturingYear;
    if (input.registrationYear !== undefined) data.registrationYear = input.registrationYear;
    if (input.fuelType !== undefined) data.fuelType = input.fuelType;
    if (input.transmission !== undefined) data.transmission = input.transmission;
    if (input.bodyType !== undefined) data.bodyType = input.bodyType;
    if (input.kilometersDriven !== undefined) data.kilometersDriven = input.kilometersDriven;
    if (input.ownerCount !== undefined) data.ownerCount = input.ownerCount;
    if (input.color !== undefined) data.color = input.color;
    if (input.insuranceType !== undefined) data.insuranceType = input.insuranceType;
    if (input.insuranceValidUntil !== undefined) {
      data.insuranceValidUntil =
        input.insuranceValidUntil === null
          ? null
          : new Date(`${input.insuranceValidUntil}T00:00:00Z`);
    }
    if (input.pricePaise !== undefined) {
      data.pricePaise = input.pricePaise === null ? null : BigInt(input.pricePaise);
    }
    if (input.negotiability !== undefined) data.negotiability = input.negotiability;
    if (input.description !== undefined) data.description = input.description || null;

    return data;
  }

  return {
    async create(actor: VehicleActor, input: CreateVehicleInput): Promise<DealerVehicle> {
      if (await repo.heldRegistration(actor.dealerId, input.registrationNumber)) {
        throw duplicate();
      }

      try {
        const created = await withTransaction(prisma, async (tx) => {
          const row = await repo.create(
            {
              dealerId: actor.dealerId,
              registrationNumber: input.registrationNumber,
              rtoCode: rtoCodeOf(input.registrationNumber),
              createdBy: actor.userId,
            },
            tx,
          );
          const listing = await createDraftListing(tx, row);
          await audit.record(tx, {
            actorType: 'DEALER',
            actorId: actor.userId,
            dealerId: actor.dealerId,
            action: 'vehicle.created',
            entityType: 'Vehicle',
            entityId: row.id,
            after: { registrationNumber: row.registrationNumber, listingId: listing.id },
          });
          return { ...row, listing };
        });
        return toDealerVehicle(created);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw duplicate();
        throw error;
      }
    },

    async get(dealerId: string, vehicleId: string): Promise<DealerVehicle> {
      return toDealerVehicle(await requireOwned(dealerId, vehicleId));
    },

    async update(
      actor: VehicleActor,
      vehicleId: string,
      input: UpdateVehicleInput,
    ): Promise<DealerVehicle> {
      const current = await requireOwned(actor.dealerId, vehicleId);
      if (current.listing && !isListingEditable(current.listing.status)) {
        throw new ConflictError('VEHICLE_NOT_EDITABLE', VEHICLE_NOT_EDITABLE, {
          extra: { listingStatus: current.listing.status },
        });
      }

      if (
        input.registrationNumber !== undefined &&
        input.registrationNumber !== current.registrationNumber &&
        (await repo.heldRegistration(actor.dealerId, input.registrationNumber, vehicleId))
      ) {
        throw duplicate();
      }

      const data = await writeOf(input);
      const fields = Object.keys(data).filter((field) => field !== 'rtoCode');
      if (fields.length === 0) return toDealerVehicle(current);

      try {
        const updated = await withTransaction(prisma, async (tx) => {
          await lockEditable(tx, vehicleId);
          const row = await repo.updateOwned(actor.dealerId, vehicleId, data, tx);
          if (!row) throw notFound();
          await audit.record(tx, {
            actorType: 'DEALER',
            actorId: actor.userId,
            dealerId: actor.dealerId,
            action: 'vehicle.updated',
            entityType: 'Vehicle',
            entityId: vehicleId,
            after: { fields },
          });
          return row;
        });
        return toDealerVehicle(updated);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw duplicate();
        throw error;
      }
    },

    async remove(actor: VehicleActor, vehicleId: string): Promise<void> {
      const current = await requireOwned(actor.dealerId, vehicleId);

      await withTransaction(prisma, async (tx) => {
        const listing = await lockListingForVehicle(tx, vehicleId);
        if (listing && !isListingDeletable(listing.status)) {
          throw new ConflictError('VEHICLE_NOT_DELETABLE', VEHICLE_NOT_DELETABLE, {
            extra: { listingStatus: listing.status },
          });
        }
        const deleted = await repo.deleteOwned(actor.dealerId, vehicleId, tx);
        if (!deleted) throw notFound();
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: 'vehicle.deleted',
          entityType: 'Vehicle',
          entityId: vehicleId,
          before: { registrationNumber: current.registrationNumber },
        });
      });
    },

    async suggestions(query: VehicleSuggestQuery): Promise<VehicleSuggestions> {
      return {
        field: query.field,
        values: await repo.suggestions(query.field, query.q, SUGGESTION_LIMIT),
      };
    },
  };
}

export type VehiclesService = ReturnType<typeof createVehiclesService>;
