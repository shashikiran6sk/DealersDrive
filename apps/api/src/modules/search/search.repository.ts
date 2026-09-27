import { slugify } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

export const PUBLIC_LISTING_WHERE = {
  status: 'ACTIVE',
  slug: { not: null },
  dealer: { status: 'ACTIVE' },
} satisfies Prisma.ListingWhereInput;

export interface ListingScope {
  dealerSlug?: string;
  districts?: readonly string[];
}

export function publicListingsOf(scope: ListingScope = {}): Prisma.ListingWhereInput {
  const { dealerSlug, districts } = scope;
  if (dealerSlug === undefined && districts === undefined) return PUBLIC_LISTING_WHERE;

  return {
    ...PUBLIC_LISTING_WHERE,
    dealer: {
      ...PUBLIC_LISTING_WHERE.dealer,
      ...(dealerSlug === undefined ? {} : { slug: dealerSlug }),
      ...(districts === undefined ? {} : { district: { in: [...districts] } }),
    },
  };
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

export function createSearchRepository(prisma: PrismaClient) {
  return {
    cards(skip: number, take: number, scope: ListingScope = {}): Promise<CardRow[]> {
      return prisma.listing.findMany({
        where: publicListingsOf(scope),
        include: cardInclude,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      });
    },

    detail(slug: string): Promise<DetailRow | null> {
      return prisma.listing.findFirst({
        where: { ...PUBLIC_LISTING_WHERE, slug },
        include: detailInclude,
      });
    },

    count(scope: ListingScope = {}): Promise<number> {
      return prisma.listing.count({ where: publicListingsOf(scope) });
    },

    async districtNames(slug: string): Promise<string[]> {
      const rows = await prisma.dealer.findMany({
        where: { status: PUBLIC_LISTING_WHERE.dealer.status, district: { not: null } },
        distinct: ['district'],
        select: { district: true },
      });
      return rows
        .map((row) => row.district)
        .filter((name): name is string => name !== null && slugify(name) === slug);
    },

    publicDealerExists(slug: string): Promise<boolean> {
      return prisma.dealer
        .count({ where: { slug, status: PUBLIC_LISTING_WHERE.dealer.status } })
        .then((found) => found > 0);
    },
  };
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;
