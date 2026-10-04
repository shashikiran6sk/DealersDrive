import {
  SAVED_SLUGS_MAX,
  type SavedState,
  type SavedVehicleSlugs,
  type SavedVehiclesQuery,
  type SavedVehiclesResponse,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { CustomerPrincipal } from '../auth/auth.facade.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import { decodeKeysetOrDateCursor, encodeKeysetCursor } from '../../platform/pagination.js';
import { PUBLIC_VISIBLE_LISTING_WHERE } from '../search/search.facade.js';
import { savedInclude, toSavedVehicle } from './saved-vehicles.mapper.js';
import { LISTING_NOT_FOUND, LISTING_NOT_SAVEABLE } from './saved-vehicles.messages.js';

export interface SavedVehiclesDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

export function createSavedVehiclesService({ prisma, audit }: SavedVehiclesDeps) {
  async function listingBySlug(slug: string): Promise<{ id: string; dealerId: string }> {
    const listing = await prisma.listing.findUnique({
      where: { slug },
      select: { id: true, dealerId: true },
    });
    if (!listing) throw new NotFoundError(LISTING_NOT_FOUND, { code: 'LISTING_NOT_FOUND' });
    return listing;
  }

  return {
    async list(
      customer: CustomerPrincipal,
      query: SavedVehiclesQuery,
    ): Promise<SavedVehiclesResponse> {
      const cursor = query.cursor ? decodeKeysetOrDateCursor(query.cursor) : null;
      const rows = await prisma.savedVehicle.findMany({
        where: {
          customerId: customer.userId,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.at } },
                  ...(cursor.id ? [{ createdAt: cursor.at, id: { lt: cursor.id } }] : []),
                ],
              }
            : {}),
        },
        include: savedInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      return {
        data: page.map(toSavedVehicle),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.createdAt, last.id) : null,
          hasMore,
        },
      };
    },

    async slugs(customer: CustomerPrincipal): Promise<SavedVehicleSlugs> {
      const rows = await prisma.savedVehicle.findMany({
        where: { customerId: customer.userId },
        select: { listing: { select: { slug: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: SAVED_SLUGS_MAX,
      });
      return { slugs: rows.flatMap((row) => (row.listing.slug ? [row.listing.slug] : [])) };
    },

    async save(customer: CustomerPrincipal, slug: string): Promise<SavedState> {
      const listing = await listingBySlug(slug);

      return withTransaction(prisma, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${listing.id}::uuid FOR SHARE`;
        const pair = { customerId: customer.userId, listingId: listing.id };

        const already = await tx.savedVehicle.findUnique({
          where: { customerId_listingId: pair },
          select: { id: true },
        });
        if (already) return { slug, saved: true };

        const visible = await tx.listing.count({
          where: { ...PUBLIC_VISIBLE_LISTING_WHERE, id: listing.id },
        });
        if (visible === 0) throw new ConflictError('LISTING_NOT_SAVEABLE', LISTING_NOT_SAVEABLE);

        const created = await tx.savedVehicle.createMany({ data: [pair], skipDuplicates: true });
        if (created.count > 0) {
          await audit.record(tx, {
            actorType: 'CUSTOMER',
            actorId: customer.userId,
            dealerId: listing.dealerId,
            action: 'vehicle.saved',
            entityType: 'Listing',
            entityId: listing.id,
          });
        }
        return { slug, saved: true };
      });
    },

    async unsave(customer: CustomerPrincipal, slug: string): Promise<SavedState> {
      const listing = await listingBySlug(slug);

      return withTransaction(prisma, async (tx) => {
        const removed = await tx.savedVehicle.deleteMany({
          where: { customerId: customer.userId, listingId: listing.id },
        });
        if (removed.count > 0) {
          await audit.record(tx, {
            actorType: 'CUSTOMER',
            actorId: customer.userId,
            dealerId: listing.dealerId,
            action: 'vehicle.unsaved',
            entityType: 'Listing',
            entityId: listing.id,
          });
        }
        return { slug, saved: false };
      });
    },
  };
}

export type SavedVehiclesService = ReturnType<typeof createSavedVehiclesService>;
