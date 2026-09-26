import type {
  AdminListingDetail,
  AdminListingQuery,
  AdminListingsResponse,
  ListingCheckKey,
  SetPhotographyInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import { decodeCursor, encodeCursor } from '../../platform/pagination.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';
import type { VehicleImagesService } from '../vehicle-images/vehicle-images.facade.js';
import {
  LISTING_NOT_FOUND,
  TRANSITION_REFUSALS,
  lockListing,
  transition,
} from '../listings/listings.facade.js';
import {
  PHOTOGRAPHY_OPEN_STATUSES,
  toAdminListingDetail,
  toAdminListingRow,
} from './moderation.mapper.js';
import { PHOTOGRAPHY_CLOSED } from './moderation.messages.js';
import { HISTORY_LABELS } from './moderation.messages.js';
import { sortKeyOf, type ModerationRepository } from './moderation.repository.js';

export interface ModerationDeps {
  prisma: PrismaClient;
  repo: ModerationRepository;
  audit: AuditService;
  images: Pick<VehicleImagesService, 'images'>;
}

function notFound(): NotFoundError {
  return new NotFoundError(LISTING_NOT_FOUND, { code: 'LISTING_NOT_FOUND' });
}

export function createModerationService({ prisma, repo, audit, images }: ModerationDeps) {
  async function detail(listingId: string): Promise<AdminListingDetail> {
    const listing = await repo.detail(listingId);
    if (!listing) throw notFound();
    const [history, gallery] = await Promise.all([
      repo.history(listingId, Object.keys(HISTORY_LABELS)),
      images.images(listing.vehicleId, listing.status),
    ]);
    return toAdminListingDetail(listing, history, gallery);
  }

  async function decide(
    admin: AdminPrincipal,
    listingId: string,
    event: 'requestChanges' | 'reject',
    reason: string,
  ): Promise<AdminListingDetail> {
    await withTransaction(prisma, async (tx) => {
      const listing = await lockListing(tx, listingId);
      if (!listing) throw notFound();
      await transition(tx, audit, listing, event, { type: 'ADMIN', id: admin.userId }, { reason });
    });
    return detail(listingId);
  }

  return {
    detail,

    async setPhotography(
      admin: AdminPrincipal,
      listingId: string,
      input: SetPhotographyInput,
    ): Promise<AdminListingDetail> {
      await withTransaction(prisma, async (tx) => {
        const listing = await lockListing(tx, listingId);
        if (!listing) throw notFound();
        if (!PHOTOGRAPHY_OPEN_STATUSES.some((status) => status === listing.status)) {
          throw new ConflictError('PHOTOGRAPHY_CLOSED', PHOTOGRAPHY_CLOSED, {
            extra: { listingStatus: listing.status },
          });
        }

        const note = input.note === undefined ? undefined : input.note || null;
        const before = await tx.vehiclePhotography.findUnique({
          where: { vehicleId: listing.vehicleId },
        });
        await tx.vehiclePhotography.upsert({
          where: { vehicleId: listing.vehicleId },
          create: {
            vehicleId: listing.vehicleId,
            status: input.status,
            note: note ?? null,
            updatedBy: admin.userId,
          },
          update: {
            status: input.status,
            ...(note === undefined ? {} : { note }),
            updatedBy: admin.userId,
          },
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'vehicle.photography_set',
          entityType: 'Vehicle',
          entityId: listing.vehicleId,
          before: { status: before?.status ?? 'NOT_STARTED' },
          after: { status: input.status, listingId },
        });
      });
      return detail(listingId);
    },

    async requestChanges(admin: AdminPrincipal, listingId: string, reason: string) {
      return decide(admin, listingId, 'requestChanges', reason);
    },

    async reject(admin: AdminPrincipal, listingId: string, reason: string) {
      return decide(admin, listingId, 'reject', reason);
    },

    async setCheck(
      admin: AdminPrincipal,
      listingId: string,
      key: ListingCheckKey,
      checked: boolean,
    ): Promise<AdminListingDetail> {
      await withTransaction(prisma, async (tx) => {
        const listing = await lockListing(tx, listingId);
        if (!listing) throw notFound();
        if (listing.status !== 'PENDING_REVIEW') {
          const refusal = TRANSITION_REFUSALS.requestChanges;
          throw new ConflictError(
            refusal.code,
            'Only a listing waiting for review can be verified.',
            {
              extra: { listingStatus: listing.status },
            },
          );
        }

        if (checked) {
          await tx.listingCheck.upsert({
            where: { listingId_key: { listingId, key } },
            create: { listingId, key, checkedBy: admin.userId },
            update: {},
          });
        } else {
          await tx.listingCheck.deleteMany({ where: { listingId, key } });
        }

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'listing.check_set',
          entityType: 'Listing',
          entityId: listingId,
          after: { key, checked },
        });
      });

      return detail(listingId);
    },

    async listings(query: AdminListingQuery): Promise<AdminListingsResponse> {
      const status = query.status ?? 'PENDING_REVIEW';
      const [rows, counts] = await Promise.all([
        repo.queue({
          status,
          ...(query.q ? { q: query.q } : {}),
          ...(query.cursor ? { after: decodeCursor(query.cursor) } : {}),
          take: query.limit + 1,
        }),
        repo.statusCounts(),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const now = new Date();

      return {
        status,
        data: page.map((row) => toAdminListingRow(row, now)),
        page: { nextCursor: hasMore && last ? encodeCursor(sortKeyOf(last)) : null, hasMore },
        counts: Object.fromEntries(counts.map((row) => [row.status, row.count])),
      };
    },
  };
}

export type ModerationService = ReturnType<typeof createModerationService>;
