import type { PrismaClient } from '@prisma/client';

/**
 * The curated taxonomy. Dealers never free-type make, model, variant, colour
 * or RTO — if they did, search, filters and SEO would all die at once (§6.2).
 */
export function createCatalogRepository(prisma: PrismaClient) {
  return {
    async bundle() {
      const [makes, cities, rto, colors] = await Promise.all([
        // `_count` rather than the rows: the bundle carries how many variants
        // a model has, not what they are (see `CatalogBundle`).
        prisma.make.findMany({
          orderBy: [{ popularity: 'desc' }, { name: 'asc' }],
          include: {
            models: {
              orderBy: { name: 'asc' },
              include: { _count: { select: { variants: true } } },
            },
          },
        }),
        prisma.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
        prisma.rto.findMany({ orderBy: { code: 'asc' } }),
        prisma.color.findMany({ orderBy: { sortOrder: 'asc' } }),
      ]);

      return { makes, cities, rto, colors };
    },

    async cities() {
      return prisma.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    },

    async cityBySlug(slug: string) {
      return prisma.city.findUnique({ where: { slug } });
    },

    async makeById(id: string) {
      return prisma.make.findUnique({ where: { id } });
    },

    async modelById(id: string) {
      return prisma.model.findUnique({ where: { id }, include: { make: true } });
    },

    async variantById(id: string) {
      return prisma.variant.findUnique({ where: { id } });
    },

    /** A13b. The dependent step: one model's variants, with its make for the header. */
    async variantsForModel(modelId: string) {
      return prisma.model.findUnique({
        where: { id: modelId },
        include: {
          make: true,
          variants: { orderBy: [{ fuel: 'asc' }, { transmission: 'asc' }, { name: 'asc' }] },
        },
      });
    },

    async colorById(id: string) {
      return prisma.color.findUnique({ where: { id } });
    },

    async rtoByCode(code: string) {
      return prisma.rto.findUnique({ where: { code } });
    },

    /**
     * Makes and models, lean, for the RC resolver (`rc-match.ts`).
     *
     * Deliberately not `bundle()`: that carries a per-model variant count and
     * is shaped for the wizard's dropdowns. The resolver needs names, slugs
     * and production years and nothing else, and it runs on the critical path
     * of a dealer adding a car.
     */
    async taxonomyForMatching() {
      return prisma.make.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          models: {
            select: {
              id: true,
              slug: true,
              name: true,
              bodyType: true,
              yearFrom: true,
              yearTo: true,
            },
          },
        },
      });
    },

    /** One model's variants as plain rows — `variantsForModel` includes the make. */
    async variantRowsForModel(modelId: string) {
      return prisma.variant.findMany({
        where: { modelId },
        select: {
          id: true,
          name: true,
          fuel: true,
          transmission: true,
          engineCc: true,
          seats: true,
        },
        orderBy: { name: 'asc' },
      });
    },

    /**
     * The first colour in a family, by sort order.
     *
     * An RC says `WHITE` and the catalogue has both Pearl White and Arctic
     * White. This returns the canonical one so the dealer's dropdown opens on
     * a sensible default rather than empty — they still change it if the car
     * is the other white, and `sortOrder` is what makes "canonical" a data
     * decision rather than an alphabetical accident.
     */
    async colorByFamily(family: string) {
      return prisma.color.findFirst({ where: { family }, orderBy: { sortOrder: 'asc' } });
    },

    /** Feature names are taxonomy-constrained; anything else is rejected. */
    async knownFeatures(): Promise<string[]> {
      await Promise.resolve();
      return FEATURE_TAXONOMY;
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;

export const FEATURE_TAXONOMY = [
  'Sunroof',
  '6 airbags',
  'ABS with EBD',
  'Android Auto',
  'Apple CarPlay',
  'Cruise control',
  'Reverse camera',
  'Push-button start',
  'Alloy wheels',
  'Climate control',
  'Rear defogger',
  'Leather seats',
  'Ventilated seats',
  '360 camera',
  'Hill hold assist',
];
