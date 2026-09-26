import type { Prisma, PrismaClient } from '@prisma/client';

export const PUBLIC_LISTING_WHERE = {
  status: 'ACTIVE',
  slug: { not: null },
  dealer: { status: 'ACTIVE' },
} satisfies Prisma.ListingWhereInput;

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
    cards(skip: number, take: number): Promise<CardRow[]> {
      return prisma.listing.findMany({
        where: PUBLIC_LISTING_WHERE,
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

    count(): Promise<number> {
      return prisma.listing.count({ where: PUBLIC_LISTING_WHERE });
    },
  };
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;
