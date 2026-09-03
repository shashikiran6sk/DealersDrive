import type { PrismaClient } from '@prisma/client';

/**
 * Cities, and only cities.
 *
 * ── Extracted from `catalog.repository.ts` by decision D1 ───────────────────
 * The baseline keeps `cities()` and `cityBySlug()` next to `makes()`,
 * `models()` and `variants()` on one repository. D1 deletes the vehicle
 * catalogue; cities survive it, because they are not catalogue data — they
 * drive the header selector, the dealer directory, search filters and dealer
 * profiles. Both methods are verbatim; only their address changes.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function createLocationsRepository(prisma: PrismaClient) {
  return {
    async cities() {
      return prisma.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    },

    async cityBySlug(slug: string) {
      return prisma.city.findUnique({ where: { slug } });
    },
  };
}

export type LocationsRepository = ReturnType<typeof createLocationsRepository>;
