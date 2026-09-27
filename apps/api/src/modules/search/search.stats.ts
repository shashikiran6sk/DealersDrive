import type { PrismaClient } from '@prisma/client';

import { PUBLIC_LISTING_WHERE } from './search.repository.js';

export interface PublicInventoryStat {
  dealer_slug: string;
  count: number;
  from_price: bigint | null;
}

export function createPublicInventoryStats(prisma: PrismaClient) {
  return {
    async dealerStats(): Promise<PublicInventoryStat[]> {
      const groups = await prisma.vehicle.groupBy({
        by: ['dealerId'],
        where: { listing: { is: PUBLIC_LISTING_WHERE } },
        _count: { _all: true },
        _min: { pricePaise: true },
      });
      if (groups.length === 0) return [];

      const dealers = await prisma.dealer.findMany({
        where: { id: { in: groups.map((group) => group.dealerId) } },
        select: { id: true, slug: true },
      });
      const slugs = new Map(dealers.map((dealer) => [dealer.id, dealer.slug]));

      return groups.flatMap((group) => {
        const slug = slugs.get(group.dealerId);
        return slug
          ? [{ dealer_slug: slug, count: group._count._all, from_price: group._min.pricePaise }]
          : [];
      });
    },
  };
}
