import {
  ADMIN_EDITABLE_LISTING_STATUSES,
  LIFECYCLE_ACTION_PERMISSION,
  isListingDeletable,
  isListingEditable,
  isVehicleMake,
  parseRegistration,
  vehicleIssues,
  type AdminUpdateVehicleInput,
  type CreateVehicleInput,
  type DealerInventoryQuery,
  type DealerInventoryResponse,
  type DealerVehicle,
  type ListingLifecycleAction,
  type RequestReactivationInput,
  type UpdateVehicleInput,
  type VehicleSuggestQuery,
  type VehicleSuggestions,
  type WithdrawListingInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import {
  authorizeDealerWrite,
  type AdminPrincipal,
  type DealerWriteActor,
} from '../auth/auth.facade.js';

import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  errorCode,
} from '../../platform/errors.js';
import {
  assertTransition,
  createDraftListing,
  fileReactivationRequest,
  lockListing,
  lockListingForVehicle,
  transition,
} from '../listings/listings.facade.js';
import { decodeKeysetOrDateCursor, encodeKeysetCursor } from '../../platform/pagination.js';
import { completenessOf, toDealerVehicle, toInventoryRow } from './vehicles.mapper.js';
import {
  ASSISTED_DEALER_INACTIVE,
  DEALER_NOT_APPROVED,
  DUPLICATE_REGISTRATION,
  REGISTRATION_ALREADY_LISTED,
  VEHICLE_INCOMPLETE,
  VEHICLE_MAKE_UNKNOWN,
  VEHICLE_NOT_DELETABLE,
  VEHICLE_NOT_EDITABLE,
  VEHICLE_NOT_FOUND,
} from './vehicles.messages.js';
import type { VehicleRow, VehicleWrite, VehiclesRepository } from './vehicles.repository.js';

export interface VehicleActor extends DealerWriteActor {
  permissions?: readonly string[];
}

export interface AssistedVehicleActor {
  dealerId: string;
  userId: string;
  memberId: string;
}

export const ASSISTED_VEHICLE_PERMISSIONS: readonly string[] = [
  'vehicle:read',
  'vehicle:write',
  'listing:submit',
];

const CLOSED_DEALER_STATUSES = new Set(['SUSPENDED', 'REJECTED', 'CLOSED']);

export interface VehiclesDeps {
  prisma: PrismaClient;
  repo: VehiclesRepository;
  audit: AuditService;
}

export const SUGGESTION_LIMIT = 8;

export type DirectLifecycleAction = Exclude<ListingLifecycleAction, 'requestReactivation'>;

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

function alreadyListed(): ConflictError {
  return new ConflictError('DUPLICATE_REGISTRATION', REGISTRATION_ALREADY_LISTED, {
    errors: [
      {
        field: 'registrationNumber',
        code: 'DUPLICATE_REGISTRATION',
        message: REGISTRATION_ALREADY_LISTED,
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

function auditValue(vehicle: object, field: string): string | number | null {
  const value: unknown = Object.entries(vehicle).find(([key]) => key === field)?.[1];
  if (typeof value === 'bigint') return String(value);
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

export function createVehiclesService({ prisma, repo, audit }: VehiclesDeps) {
  async function requireOwned(dealerId: string, vehicleId: string): Promise<VehicleRow> {
    const vehicle = await repo.findOwned(dealerId, vehicleId);
    if (!vehicle) throw notFound();
    return vehicle;
  }

  async function lockEditable(tx: Tx, actor: VehicleActor, vehicleId: string): Promise<string[]> {
    const listing = await lockListingForVehicle(tx, vehicleId);
    if (!listing) throw notFound();
    const permissions = await authorizeDealerWrite(tx, actor, 'vehicle:write');
    if (!isListingEditable(listing.status)) {
      throw new ConflictError('VEHICLE_NOT_EDITABLE', VEHICLE_NOT_EDITABLE, {
        extra: { listingStatus: listing.status },
      });
    }
    return permissions;
  }

  async function authorizeAssisted(
    tx: Tx,
    actor: AssistedVehicleActor,
    requireApproved: boolean,
  ): Promise<string[]> {
    const [dealer] = await tx.$queryRaw<{ status: string; assistedByMemberId: string | null }[]>`
      SELECT "status", "assistedByMemberId" FROM "dealers"
      WHERE "id" = ${actor.dealerId}::uuid FOR UPDATE`;
    if (!dealer || dealer.assistedByMemberId !== actor.memberId) throw notFound();
    if (CLOSED_DEALER_STATUSES.has(dealer.status)) {
      throw new ConflictError('ASSISTED_DEALER_INACTIVE', ASSISTED_DEALER_INACTIVE);
    }
    if (requireApproved && dealer.status !== 'ACTIVE') {
      throw new ConflictError('DEALER_NOT_APPROVED', DEALER_NOT_APPROVED);
    }
    return [...ASSISTED_VEHICLE_PERMISSIONS];
  }

  async function requireAssistedVehicle(
    actor: AssistedVehicleActor,
    vehicleId: string,
    tx?: Tx,
  ): Promise<VehicleRow> {
    const vehicle = await repo.findOwned(actor.dealerId, vehicleId, tx);
    if (!vehicle || vehicle.createdByMemberId !== actor.memberId) throw notFound();
    return vehicle;
  }

  function incomplete(vehicle: VehicleRow): DomainError | null {
    const issues = vehicleIssues(completenessOf(vehicle));
    if (issues.length === 0) return null;
    return new DomainError('VEHICLE_INCOMPLETE', VEHICLE_INCOMPLETE, {
      errors: issues.map((issue) => ({
        field: issue.field,
        code: 'REQUIRED',
        message: issue.message,
      })),
    });
  }

  async function spelled(field: 'make' | 'model', value: string): Promise<string> {
    return (await repo.existingSpelling(field, value)) ?? value;
  }

  function offListMake(input: UpdateVehicleInput): boolean {
    return typeof input.make === 'string' && !isVehicleMake(input.make);
  }

  function checkMake(input: UpdateVehicleInput, storedMake: string | null): void {
    if (!offListMake(input) || input.make === storedMake) return;
    throw new DomainError('VEHICLE_MAKE_UNKNOWN', VEHICLE_MAKE_UNKNOWN, {
      errors: [{ field: 'make', code: 'UNKNOWN_MAKE', message: VEHICLE_MAKE_UNKNOWN }],
    });
  }

  async function checkMakeLocked(tx: Tx, input: UpdateVehicleInput, vehicleId: string) {
    if (!offListMake(input)) return;
    const locked = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      select: { make: true },
    });
    checkMake(input, locked?.make ?? null);
  }

  async function writeOf(input: UpdateVehicleInput): Promise<VehicleWrite> {
    const data: VehicleWrite = {};

    if (input.registrationNumber !== undefined) {
      data.registrationNumber = input.registrationNumber;
      data.rtoCode = rtoCodeOf(input.registrationNumber);
    }
    if (input.make !== undefined) data.make = input.make;
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
          const permissions = await authorizeDealerWrite(tx, actor, 'vehicle:write');
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
          return { vehicle: { ...row, listing }, permissions };
        });
        return toDealerVehicle(created.vehicle, created.permissions);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw duplicate();
        throw error;
      }
    },

    async inventory(
      dealerId: string,
      query: DealerInventoryQuery,
      permissions?: readonly string[],
    ): Promise<DealerInventoryResponse> {
      const [rows, counts] = await Promise.all([
        repo.inventory(dealerId, {
          ...(query.status ? { status: query.status } : {}),
          ...(query.q ? { q: query.q } : {}),
          ...(query.cursor ? { before: decodeKeysetOrDateCursor(query.cursor) } : {}),
          take: query.limit + 1,
        }),
        repo.statusCounts(dealerId),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      return {
        data: page.map((row) => toInventoryRow(row, permissions)),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.createdAt, last.id) : null,
          hasMore,
        },
        counts: {
          ALL: counts.reduce((sum, row) => sum + row.count, 0),
          ...Object.fromEntries(counts.map((row) => [row.status, row.count])),
        },
      };
    },

    async get(
      dealerId: string,
      vehicleId: string,
      permissions?: readonly string[],
    ): Promise<DealerVehicle> {
      return toDealerVehicle(await requireOwned(dealerId, vehicleId), permissions);
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

      checkMake(input, current.make);
      const data = await writeOf(input);
      const fields = Object.keys(data).filter((field) => field !== 'rtoCode');
      if (fields.length === 0) return toDealerVehicle(current, actor.permissions);

      try {
        const updated = await withTransaction(prisma, async (tx) => {
          const permissions = await lockEditable(tx, actor, vehicleId);
          await checkMakeLocked(tx, input, vehicleId);
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
          return { vehicle: row, permissions };
        });
        return toDealerVehicle(updated.vehicle, updated.permissions);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw duplicate();
        throw error;
      }
    },

    async adminUpdate(
      admin: AdminPrincipal,
      listingId: string,
      input: AdminUpdateVehicleInput,
    ): Promise<void> {
      try {
        await withTransaction(prisma, async (tx) => {
          const listing = await lockListing(tx, listingId);
          if (!listing) throw notFound();
          if (!ADMIN_EDITABLE_LISTING_STATUSES.includes(listing.status)) {
            throw new ConflictError(
              'VEHICLE_NOT_EDITABLE',
              'This listing can no longer be edited. Reload the page.',
              {
                extra: { listingStatus: listing.status },
              },
            );
          }
          const current = await repo.findOwned(listing.dealerId, listing.vehicleId, tx);
          if (!current) throw notFound();
          if (
            admin.memberId &&
            (current.createdByMemberId === admin.memberId ||
              listing.submittedByMemberId === admin.memberId)
          ) {
            throw new ForbiddenError(
              'Another reviewer must edit a listing you prepared or submitted.',
              { code: 'SELF_REVIEW_FORBIDDEN' },
            );
          }
          if (current.updatedAt.toISOString() !== input.expectedUpdatedAt) {
            throw new ConflictError(
              'VEHICLE_CHANGED',
              'These details have changed. Reload the page before saving.',
            );
          }
          checkMake(input.details, current.make);
          const data = await writeOf(input.details);
          const fields = Object.keys(data).filter(
            (field) =>
              field !== 'rtoCode' && auditValue(data, field) !== auditValue(current, field),
          );
          if (fields.length === 0) return;
          const timedData = {
            ...data,
            updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
          };
          const updated = await repo.updateOwned(
            listing.dealerId,
            listing.vehicleId,
            timedData,
            tx,
          );
          if (!updated) throw notFound();
          const issues = vehicleIssues(completenessOf(updated));
          if ((listing.status === 'ACTIVE' || listing.status === 'RESERVED') && issues.length > 0) {
            throw new DomainError(
              'VEHICLE_INCOMPLETE',
              'Keep all required vehicle details complete before saving.',
              {
                errors: issues.map((issue) => ({ ...issue, code: 'REQUIRED' })),
              },
            );
          }
          if (listing.status === 'PENDING_REVIEW') {
            await tx.listingCheck.deleteMany({ where: { listingId } });
          }
          await tx.listing.update({ where: { id: listingId }, data: { updatedAt: new Date() } });
          const before = Object.fromEntries(
            fields.map((field) => [field, auditValue(current, field)]),
          );
          const after = Object.fromEntries(
            fields.map((field) => [field, auditValue(updated, field)]),
          );
          await audit.record(tx, {
            actorType: 'ADMIN',
            actorId: admin.userId,
            dealerId: listing.dealerId,
            action: 'listing.details_updated',
            entityType: 'Listing',
            entityId: listingId,
            before,
            after: { ...after, vehicleId: listing.vehicleId, fields },
          });
        });
      } catch (error) {
        if (errorCode(error) === 'P2002') throw alreadyListed();
        throw error;
      }
    },

    async remove(actor: VehicleActor, vehicleId: string): Promise<void> {
      const current = await requireOwned(actor.dealerId, vehicleId);

      await withTransaction(prisma, async (tx) => {
        const listing = await lockListingForVehicle(tx, vehicleId);
        await authorizeDealerWrite(tx, actor, 'vehicle:delete');
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

    async submit(actor: VehicleActor, vehicleId: string): Promise<DealerVehicle> {
      await requireOwned(actor.dealerId, vehicleId);

      try {
        const submitted = await withTransaction(prisma, async (tx) => {
          const listing = await lockListingForVehicle(tx, vehicleId);
          const vehicle = await repo.findOwned(actor.dealerId, vehicleId, tx);
          if (!listing || !vehicle) throw notFound();
          const permissions = await authorizeDealerWrite(tx, actor, 'listing:submit', true);

          const event = listing.status === 'CHANGES_REQUESTED' ? 'resubmit' : 'submit';
          assertTransition(listing.status, event, 'DEALER');

          const issues = vehicleIssues(completenessOf(vehicle));
          if (issues.length > 0) {
            throw new DomainError('VEHICLE_INCOMPLETE', VEHICLE_INCOMPLETE, {
              errors: issues.map((issue) => ({
                field: issue.field,
                code: 'REQUIRED',
                message: issue.message,
              })),
            });
          }

          const claimedAt = vehicle.claimedAt ?? new Date();
          if (!vehicle.claimedAt) {
            await repo.updateOwned(actor.dealerId, vehicleId, { claimedAt }, tx);
          }

          const moved = await transition(tx, audit, listing, event, {
            type: 'DEALER',
            id: actor.userId,
          });
          return { vehicle: { ...vehicle, claimedAt, listing: moved }, permissions };
        });
        return toDealerVehicle(submitted.vehicle, submitted.permissions);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw alreadyListed();
        throw error;
      }
    },

    async assistedCreate(
      actor: AssistedVehicleActor,
      input: CreateVehicleInput,
    ): Promise<DealerVehicle> {
      if (await repo.heldRegistration(actor.dealerId, input.registrationNumber)) {
        throw duplicate();
      }
      try {
        const created = await withTransaction(prisma, async (tx) => {
          const permissions = await authorizeAssisted(tx, actor, false);
          const row = await repo.create(
            {
              dealerId: actor.dealerId,
              registrationNumber: input.registrationNumber,
              rtoCode: rtoCodeOf(input.registrationNumber),
              createdBy: null,
              createdByMemberId: actor.memberId,
            },
            tx,
          );
          const listing = await createDraftListing(tx, row);
          await audit.record(tx, {
            actorType: 'SALES',
            actorId: actor.userId,
            dealerId: actor.dealerId,
            action: 'vehicle.created',
            entityType: 'Vehicle',
            entityId: row.id,
            after: {
              registrationNumber: row.registrationNumber,
              listingId: listing.id,
              assistedByMemberId: actor.memberId,
            },
          });
          return { vehicle: { ...row, listing }, permissions };
        });
        return toDealerVehicle(created.vehicle, created.permissions);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw duplicate();
        throw error;
      }
    },

    async assistedList(actor: AssistedVehicleActor) {
      const rows = await repo.createdByMember(actor.dealerId, actor.memberId);
      return rows.map((row) => toInventoryRow(row, ASSISTED_VEHICLE_PERMISSIONS));
    },

    async assistedGet(actor: AssistedVehicleActor, vehicleId: string): Promise<DealerVehicle> {
      return toDealerVehicle(
        await requireAssistedVehicle(actor, vehicleId),
        ASSISTED_VEHICLE_PERMISSIONS,
      );
    },

    async assistedUpdate(
      actor: AssistedVehicleActor,
      vehicleId: string,
      input: UpdateVehicleInput,
    ): Promise<DealerVehicle> {
      const current = await requireAssistedVehicle(actor, vehicleId);
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

      checkMake(input, current.make);
      const data = await writeOf(input);
      const fields = Object.keys(data).filter((field) => field !== 'rtoCode');
      if (fields.length === 0) return toDealerVehicle(current, ASSISTED_VEHICLE_PERMISSIONS);

      try {
        const updated = await withTransaction(prisma, async (tx) => {
          const listing = await lockListingForVehicle(tx, vehicleId);
          if (!listing) throw notFound();
          const permissions = await authorizeAssisted(tx, actor, false);
          if (!isListingEditable(listing.status)) {
            throw new ConflictError('VEHICLE_NOT_EDITABLE', VEHICLE_NOT_EDITABLE, {
              extra: { listingStatus: listing.status },
            });
          }
          await checkMakeLocked(tx, input, vehicleId);
          const row = await repo.updateOwned(actor.dealerId, vehicleId, data, tx);
          if (!row) throw notFound();
          await audit.record(tx, {
            actorType: 'SALES',
            actorId: actor.userId,
            dealerId: actor.dealerId,
            action: 'vehicle.updated',
            entityType: 'Vehicle',
            entityId: vehicleId,
            after: { fields, assistedByMemberId: actor.memberId },
          });
          return { vehicle: row, permissions };
        });
        return toDealerVehicle(updated.vehicle, updated.permissions);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw duplicate();
        throw error;
      }
    },

    async assistedSubmit(actor: AssistedVehicleActor, vehicleId: string): Promise<DealerVehicle> {
      await requireAssistedVehicle(actor, vehicleId);
      try {
        const submitted = await withTransaction(prisma, async (tx) => {
          const listing = await lockListingForVehicle(tx, vehicleId);
          const vehicle = await requireAssistedVehicle(actor, vehicleId, tx);
          if (!listing) throw notFound();
          const permissions = await authorizeAssisted(tx, actor, true);

          const event = listing.status === 'CHANGES_REQUESTED' ? 'resubmit' : 'submit';
          assertTransition(listing.status, event, 'SALES');
          const refusal = incomplete(vehicle);
          if (refusal) throw refusal;

          const claimedAt = vehicle.claimedAt ?? new Date();
          if (!vehicle.claimedAt) {
            await repo.updateOwned(actor.dealerId, vehicleId, { claimedAt }, tx);
          }
          const moved = await transition(tx, audit, listing, event, {
            type: 'SALES',
            id: actor.userId,
            memberId: actor.memberId,
          });
          return { vehicle: { ...vehicle, claimedAt, listing: moved }, permissions };
        });
        return toDealerVehicle(submitted.vehicle, submitted.permissions);
      } catch (error) {
        if (errorCode(error) === 'P2002') throw alreadyListed();
        throw error;
      }
    },

    async lifecycle(
      actor: VehicleActor,
      vehicleId: string,
      action: DirectLifecycleAction,
      withdrawal?: WithdrawListingInput,
    ): Promise<DealerVehicle> {
      await requireOwned(actor.dealerId, vehicleId);

      const moved = await withTransaction(prisma, async (tx) => {
        const listing = await lockListingForVehicle(tx, vehicleId);
        const vehicle = await repo.findOwned(actor.dealerId, vehicleId, tx);
        if (!listing || !vehicle) throw notFound();
        const permissions = await authorizeDealerWrite(
          tx,
          actor,
          LIFECYCLE_ACTION_PERMISSION[action],
          true,
        );

        await transition(
          tx,
          audit,
          listing,
          action,
          { type: 'DEALER', id: actor.userId },
          withdrawal ? { withdrawal: { reason: withdrawal.reason, note: withdrawal.note } } : {},
        );
        const row = await repo.findOwned(actor.dealerId, vehicleId, tx);
        if (!row) throw notFound();
        return { vehicle: row, permissions };
      });
      return toDealerVehicle(moved.vehicle, moved.permissions);
    },

    async requestReactivation(
      actor: VehicleActor,
      vehicleId: string,
      input: RequestReactivationInput,
    ): Promise<DealerVehicle> {
      await requireOwned(actor.dealerId, vehicleId);

      const requested = await withTransaction(prisma, async (tx) => {
        const listing = await lockListingForVehicle(tx, vehicleId);
        if (!listing || listing.dealerId !== actor.dealerId) throw notFound();
        const permissions = await authorizeDealerWrite(tx, actor, 'listing:reactivate', true);

        await fileReactivationRequest(
          tx,
          audit,
          listing,
          { type: 'DEALER', id: actor.userId },
          input.reason,
        );
        const row = await repo.findOwned(actor.dealerId, vehicleId, tx);
        if (!row) throw notFound();
        return { vehicle: row, permissions };
      });
      return toDealerVehicle(requested.vehicle, requested.permissions);
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
