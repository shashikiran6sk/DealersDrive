import {
  type PublicStorefrontDto,
  type StorefrontInventoryQuery,
  type StorefrontInventoryResponse,
  type StorefrontVehicleResponse,
} from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { NotFoundError } from '../../platform/errors.js';
import { mediaUrl } from '../../platform/media/urls.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  cardInclude,
  detailInclude,
  needsVocabulary,
  orderOf,
  resolveFilters,
  toPublicVehicleDetail,
  toVehicleCard,
  vehicleWhere,
} from '../search/search.facade.js';
import {
  isDomainLive,
  publicStorefrontDto,
  storefrontInclude,
  type StorefrontRow,
} from './storefront.mapper.js';
import { assertStorefrontEnabled, type StorefrontEnvironment } from './storefront.security.js';
import { liveDomainWhere, liveStorefrontWhere } from './storefront.visibility.js';

export function storefrontListingWhere(dealerId: string): Prisma.ListingWhereInput {
  return {
    dealerId,
    storefrontPublished: true,
    status: { in: ['ACTIVE', 'RESERVED'] },
    slug: { not: null },
    dealer: { status: 'ACTIVE' },
  };
}

export function createStorefrontPublic(prisma: PrismaClient, config: StorefrontEnvironment) {
  async function resolve(hostname: string): Promise<StorefrontRow> {
    assertStorefrontEnabled(config);
    const row = await prisma.dealerStorefront.findFirst({
      where: {
        ...liveStorefrontWhere(config.STOREFRONT_DEFAULT_DOMAIN_READY),
        AND: [
          {
            domains: {
              some: { ...liveDomainWhere(config.STOREFRONT_DEFAULT_DOMAIN_READY), hostname },
            },
          },
        ],
      },
      include: storefrontInclude,
    });
    const requested = row?.domains.find((domain) => domain.hostname === hostname);
    const primary = row?.domains.find((domain) => domain.isPrimary);
    if (
      !row ||
      !requested ||
      !isDomainLive(requested) ||
      !primary ||
      !isDomainLive(primary) ||
      (requested.kind === 'DEFAULT' && !config.STOREFRONT_DEFAULT_DOMAIN_READY)
    ) {
      logger.info({ event: 'storefront.resolve.unavailable' }, 'storefront hostname unavailable');
      throw new NotFoundError('This dealership website is unavailable.');
    }
    return row;
  }

  async function site(row: StorefrontRow, hostname: string): Promise<PublicStorefrontDto> {
    const ids = [
      row.logoMediaId ?? row.dealer.logoMediaId,
      row.heroMediaId ?? row.dealer.coverMediaId,
      ...row.yardMediaIds,
    ].filter((id): id is string => id !== null);
    const media = await prisma.media.findMany({
      where: {
        id: { in: ids },
        dealerId: row.dealerId,
        status: 'READY',
        ownerType: { in: ['DEALER_COVER', 'DEALER_LOGO'] },
      },
      select: { id: true },
    });
    return publicStorefrontDto(
      row,
      hostname,
      new Map(media.map((image) => [image.id, mediaUrl(image.id, 1600)])),
    );
  }

  async function inventory(
    dealerId: string,
    query: StorefrontInventoryQuery,
  ): Promise<StorefrontInventoryResponse> {
    const started = performance.now();
    const visibility = storefrontListingWhere(dealerId);
    const models = needsVocabulary(query)
      ? await prisma.vehicle.groupBy({
          by: ['make', 'model'],
          where: { dealerId, listing: { is: visibility } },
        })
      : [];
    const filters = resolveFilters(query, {
      makes: models.flatMap((row) => (row.make ? [row.make] : [])),
      models,
    });
    const where = {
      ...visibility,
      vehicle: { is: vehicleWhere(filters) },
    } satisfies Prisma.ListingWhereInput;
    const include = {
      ...cardInclude,
      vehicle: {
        include: {
          ...cardInclude.vehicle.include,
          images: {
            ...cardInclude.vehicle.include.images,
            where: { isPrimary: true, media: { status: 'READY', dealerId } },
          },
          _count: { select: { images: { where: { media: { status: 'READY', dealerId } } } } },
        },
      },
    } satisfies Prisma.ListingInclude;
    const [rows, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include,
        orderBy: orderOf(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.listing.count({ where }),
    ]);
    logger.info(
      {
        event: 'storefront.inventory',
        dealerId,
        durationMs: Math.round(performance.now() - started),
        count: rows.length,
      },
      'storefront inventory read',
    );
    return {
      data: rows.map(toVehicleCard),
      page: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async function vehicle(dealerId: string, slug: string): Promise<StorefrontVehicleResponse> {
    const row = await prisma.listing.findFirst({
      where: { ...storefrontListingWhere(dealerId), status: 'ACTIVE', slug },
      include: {
        ...detailInclude,
        vehicle: {
          include: {
            images: {
              ...detailInclude.vehicle.include.images,
              where: { media: { status: 'READY', dealerId } },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundError('This car is unavailable.');
    return toPublicVehicleDetail(row);
  }
  return { resolve, site, inventory, vehicle };
}
