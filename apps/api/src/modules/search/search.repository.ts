import type { Prisma, PrismaClient } from '@prisma/client';

export const PUBLIC_LISTING_WHERE = {
  status: 'ACTIVE',
  slug: { not: null },
  dealer: { status: 'ACTIVE' },
} satisfies Prisma.ListingWhereInput;

export function publicListingsOf(dealerSlug?: string): Prisma.ListingWhereInput {
  return dealerSlug
    ? { ...PUBLIC_LISTING_WHERE, dealer: { ...PUBLIC_LISTING_WHERE.dealer, slug: dealerSlug } }
    : PUBLIC_LISTING_WHERE;
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
    cards(skip: number, take: number, dealerSlug?: string): Promise<CardRow[]> {
      return prisma.listing.findMany({
        where: publicListingsOf(dealerSlug),
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

    count(dealerSlug?: string): Promise<number> {
      return prisma.listing.count({ where: publicListingsOf(dealerSlug) });
    },

    publicDealerExists(slug: string): Promise<boolean> {
      return prisma.dealer
        .count({ where: { slug, status: PUBLIC_LISTING_WHERE.dealer.status } })
        .then((found) => found > 0);
    },
  };
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;
