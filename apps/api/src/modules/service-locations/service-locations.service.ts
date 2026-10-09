import type { AddServiceDistrictInput, ServiceLocationSettings } from '@dealers-drive/contracts';
import { ServiceLocationsResponse } from '@dealers-drive/contracts';
import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type { AdminPrincipal } from '../auth/auth.facade.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';

function authorize(principal: AdminPrincipal) {
  if (!principal.permissions.includes('admin:config:write')) throw new ForbiddenError();
}

export function createServiceLocationsService(prisma: PrismaClient, audit: AuditService) {
  return {
    async catalogue(publicOnly = false) {
      const data = await prisma.serviceState.findMany({
        where: publicOnly ? { active: true, onboardingEnabled: true } : {},
        orderBy: { name: 'asc' },
        include: {
          districts: {
            where: publicOnly ? { active: true, onboardingEnabled: true } : {},
            orderBy: { name: 'asc' },
          },
        },
      });
      return ServiceLocationsResponse.parse({ data });
    },
    async history(principal: AdminPrincipal) {
      authorize(principal);
      const rows = await prisma.auditLog.findMany({
        where: { entityType: { in: ['ServiceState', 'ServiceDistrict'] } },
        orderBy: { id: 'desc' },
        take: 100,
        select: {
          id: true,
          action: true,
          entityId: true,
          createdAt: true,
          before: true,
          after: true,
        },
      });
      return {
        data: rows.map(({ createdAt, id, ...row }) => ({
          ...row,
          id: String(id),
          at: createdAt.toISOString(),
        })),
      };
    },
    async change(
      principal: AdminPrincipal,
      kind: 'state' | 'district',
      id: string,
      input: ServiceLocationSettings,
    ) {
      authorize(principal);
      if (kind === 'state' && input.photographyAvailable !== undefined) {
        throw new DomainError(
          'DISTRICT_COVERAGE_REQUIRED',
          'Photography coverage is configured for individual districts.',
        );
      }
      await withTransaction(prisma, async (tx) => {
        const entityType = kind === 'state' ? 'ServiceState' : 'ServiceDistrict';
        const before =
          kind === 'state'
            ? await tx.serviceState.findUnique({ where: { id } })
            : await tx.serviceDistrict.findUnique({ where: { id } });
        if (!before) throw new NotFoundError();
        if (before.version !== input.expectedVersion)
          throw new ConflictError(
            'LOCATION_VERSION_CONFLICT',
            'Another administrator changed this location. Reload before saving.',
          );
        const data = {
          active: input.active,
          onboardingEnabled: input.onboardingEnabled,
          ...(input.photographyAvailable === undefined
            ? {}
            : { photographyAvailable: input.photographyAvailable }),
          version: { increment: 1 },
        };
        const changed =
          kind === 'state'
            ? await tx.serviceState.updateMany({
                where: { id, version: input.expectedVersion },
                data,
              })
            : await tx.serviceDistrict.updateMany({
                where: { id, version: input.expectedVersion },
                data,
              });
        if (changed.count !== 1)
          throw new ConflictError(
            'LOCATION_VERSION_CONFLICT',
            'Another administrator changed this location. Reload before saving.',
          );
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: principal.userId,
          action: 'service_location.updated',
          entityType,
          entityId: id,
          before: {
            active: before.active,
            onboardingEnabled: before.onboardingEnabled,
            version: before.version,
            ...('photographyAvailable' in before
              ? { photographyAvailable: before.photographyAvailable }
              : {}),
          },
          after: {
            active: input.active,
            onboardingEnabled: input.onboardingEnabled,
            ...(input.photographyAvailable === undefined
              ? {}
              : { photographyAvailable: input.photographyAvailable }),
            version: input.expectedVersion + 1,
          },
        });
      });
      return this.catalogue();
    },
    async addDistrict(principal: AdminPrincipal, input: AddServiceDistrictInput) {
      authorize(principal);
      try {
        await withTransaction(prisma, async (tx) => {
          const state = await tx.serviceState.findUnique({ where: { id: input.stateId } });
          if (!state) throw new NotFoundError('Select a configured state.');
          const name = input.name.replace(/\s+/g, ' ');
          const duplicate = await tx.serviceDistrict.findFirst({
            where: { stateId: state.id, aliases: { has: name.toLowerCase() } },
          });
          if (duplicate)
            throw new ConflictError(
              'DISTRICT_ALREADY_CONFIGURED',
              'That district is already configured in this state.',
            );
          const row = await tx.serviceDistrict.create({
            data: {
              id: `district-${randomUUID()}`,
              stateId: state.id,
              name,
              aliases: [name.toLowerCase()],
              sourceUrl: input.sourceUrl,
              onboardingEnabled: false,
              photographyAvailable: false,
            },
          });
          await audit.record(tx, {
            actorType: 'ADMIN',
            actorId: principal.userId,
            action: 'service_location.district_added',
            entityType: 'ServiceDistrict',
            entityId: row.id,
            after: {
              stateId: state.id,
              name,
              sourceUrl: row.sourceUrl,
              sourceReviewed: true,
              onboardingEnabled: false,
              photographyAvailable: false,
            },
          });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictError(
            'DISTRICT_ALREADY_CONFIGURED',
            'That district is already configured in this state.',
          );
        }
        throw error;
      }
      return this.catalogue();
    },
  };
}
export type ServiceLocationsService = ReturnType<typeof createServiceLocationsService>;
