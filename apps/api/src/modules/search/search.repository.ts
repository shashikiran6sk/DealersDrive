import type {
  BodyType,
  FuelType,
  Prisma,
  PrismaClient,
  Transmission,
  VehicleColor,
} from '@prisma/client';

import type { Counted, PublicDealerRow } from './search.facets.js';
import type { Vocabulary } from './search.filters.js';
import type { SuggestRow } from './search.suggest.js';

export const PUBLIC_DEALER_STATUS = 'ACTIVE' as const;

export const PUBLIC_VISIBLE_LISTING_WHERE = {
  status: { in: ['ACTIVE', 'RESERVED'] },
  slug: { not: null },
  dealer: { status: PUBLIC_DEALER_STATUS },
} satisfies Prisma.ListingWhereInput;

export const PUBLIC_AVAILABLE_LISTING_WHERE = {
  status: 'ACTIVE',
  slug: { not: null },
  dealer: { status: PUBLIC_DEALER_STATUS },
} satisfies Prisma.ListingWhereInput;

export type PublicListingRule = 'visible' | 'available';

export function publicListingWhere(rule: PublicListingRule): Prisma.ListingWhereInput {
  return rule === 'visible' ? PUBLIC_VISIBLE_LISTING_WHERE : PUBLIC_AVAILABLE_LISTING_WHERE;
}

export const cardInclude = {
  vehicle: {
    include: {
      images: { where: { isPrimary: true }, select: { mediaId: true } },
      _count: { select: { images: true } },
    },
  },
  dealer: { select: { brandName: true, slug: true, city: true } },
} satisfies Prisma.ListingInclude;

export type CardRow = Prisma.ListingGetPayload<{ include: typeof cardInclude }>;

export const detailInclude = {
  vehicle: {
    include: {
      images: {
        select: { mediaId: true, position: true, isPrimary: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  },
  dealer: { select: { brandName: true, slug: true, city: true, district: true } },
} satisfies Prisma.ListingInclude;

export type DetailRow = Prisma.ListingGetPayload<{ include: typeof detailInclude }>;

const dealerSelect = {
  id: true,
  slug: true,
  brandName: true,
  city: true,
  district: true,
} satisfies Prisma.DealerSelect;

export function createSearchRepository(prisma: PrismaClient) {
  return {
    cards(
      where: Prisma.ListingWhereInput,
      orderBy: Prisma.ListingOrderByWithRelationInput[],
      skip: number,
      take: number,
    ): Promise<CardRow[]> {
      return prisma.listing.findMany({ where, include: cardInclude, orderBy, skip, take });
    },

    count(where: Prisma.ListingWhereInput): Promise<number> {
      return prisma.listing.count({ where });
    },

    detail(slug: string): Promise<DetailRow | null> {
      return prisma.listing.findFirst({
        where: { ...PUBLIC_VISIBLE_LISTING_WHERE, slug },
        include: detailInclude,
      });
    },

    publicDealers(): Promise<PublicDealerRow[]> {
      return prisma.dealer.findMany({
        where: { status: PUBLIC_DEALER_STATUS },
        select: dealerSelect,
        orderBy: { brandName: 'asc' },
      });
    },

    publicDealer(slug: string): Promise<PublicDealerRow | null> {
      return prisma.dealer.findFirst({
        where: { slug, status: PUBLIC_DEALER_STATUS },
        select: dealerSelect,
      });
    },

    async vocabulary(): Promise<Vocabulary> {
      const models = await prisma.vehicle.groupBy({
        by: ['make', 'model'],
        where: { listing: { is: PUBLIC_VISIBLE_LISTING_WHERE } },
      });
      return {
        makes: models.flatMap((row) => (row.make === null ? [] : [row.make])),
        models,
      };
    },

    async byMake(where: Prisma.VehicleWhereInput): Promise<Counted<string | null>[]> {
      const rows = await prisma.vehicle.groupBy({ by: ['make'], where, _count: { _all: true } });
      return rows.map((row) => ({ value: row.make, count: row._count._all }));
    },

    async byColor(where: Prisma.VehicleWhereInput): Promise<Counted<VehicleColor | null>[]> {
      const rows = await prisma.vehicle.groupBy({ by: ['color'], where, _count: { _all: true } });
      return rows.map((row) => ({ value: row.color, count: row._count._all }));
    },

    async byFuel(where: Prisma.VehicleWhereInput): Promise<Counted<FuelType | null>[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['fuelType'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({ value: row.fuelType, count: row._count._all }));
    },

    async byTransmission(where: Prisma.VehicleWhereInput): Promise<Counted<Transmission | null>[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['transmission'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({ value: row.transmission, count: row._count._all }));
    },

    async byBodyType(where: Prisma.VehicleWhereInput): Promise<Counted<BodyType | null>[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['bodyType'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({ value: row.bodyType, count: row._count._all }));
    },

    async byOwners(where: Prisma.VehicleWhereInput): Promise<Counted<number | null>[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['ownerCount'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({ value: row.ownerCount, count: row._count._all }));
    },

    async byYear(where: Prisma.VehicleWhereInput): Promise<Counted<number | null>[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['manufacturingYear'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({ value: row.manufacturingYear, count: row._count._all }));
    },

    async byDealer(where: Prisma.VehicleWhereInput): Promise<Counted<string>[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['dealerId'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({ value: row.dealerId, count: row._count._all }));
    },

    async groupModels(
      where: Prisma.VehicleWhereInput,
    ): Promise<{ make: string | null; model: string | null; count: number }[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['make', 'model'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({ make: row.make, model: row.model, count: row._count._all }));
    },

    async suggestRows(where: Prisma.VehicleWhereInput): Promise<SuggestRow[]> {
      const rows = await prisma.vehicle.groupBy({
        by: ['make', 'model', 'variant'],
        where,
        _count: { _all: true },
      });
      return rows.map((row) => ({
        make: row.make,
        model: row.model,
        variant: row.variant,
        count: row._count._all,
      }));
    },

    countVehicles(where: Prisma.VehicleWhereInput): Promise<number> {
      return prisma.vehicle.count({ where });
    },
  };
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;
