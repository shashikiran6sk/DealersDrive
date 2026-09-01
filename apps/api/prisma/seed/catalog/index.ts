/**
 * The Indian passenger-vehicle catalogue, assembled and self-checked.
 *
 * See `schema.ts` for why this is a committed dataset rather than an API call.
 * Coverage is every passenger marque sold new in India from 2010 onwards, plus
 * the models still in circulation from before that — a 2009 Santro Xing is a
 * 2026 used-car listing.
 *
 * `assertCatalogueIntegrity` runs at seed time rather than in a test, because
 * the failure it catches is a partially-seeded database: Prisma would reject
 * the second of two colliding slugs a few hundred inserts in, leaving the
 * catalogue half-written and the error message pointing at a unique constraint
 * rather than at the duplicate. Failing before the first INSERT is the
 * difference between a clear message and an afternoon.
 */
import { DEPARTED } from './departed.js';
import { LUXURY } from './luxury.js';
import { MASS_MARKET } from './mass-market.js';
import { MASS_MARKET_2 } from './mass-market-2.js';
import type { CatalogMake } from './schema.js';

export * from './schema.js';

export const VEHICLE_CATALOGUE: CatalogMake[] = [
  ...MASS_MARKET,
  ...MASS_MARKET_2,
  ...DEPARTED,
  ...LUXURY,
];

export interface CatalogueStats {
  makes: number;
  models: number;
  variants: number;
}

export function catalogueStats(catalogue = VEHICLE_CATALOGUE): CatalogueStats {
  const models = catalogue.flatMap((make) => make.models);
  return {
    makes: catalogue.length,
    models: models.length,
    variants: models.reduce((sum, model) => sum + model.variants.length, 0),
  };
}

/**
 * Every constraint the database will later enforce, checked in memory first.
 * Throws with the offending slug named; the schema's unique indexes would only
 * say that *a* constraint failed.
 */
export function assertCatalogueIntegrity(catalogue = VEHICLE_CATALOGUE): void {
  const problems: string[] = [];
  const makeSlugs = new Set<string>();
  const thisYear = new Date().getFullYear();

  for (const make of catalogue) {
    if (makeSlugs.has(make.slug)) problems.push(`Duplicate make slug: ${make.slug}`);
    makeSlugs.add(make.slug);

    if (make.models.length === 0) problems.push(`Make ${make.slug} has no models`);

    const modelSlugs = new Set<string>();
    for (const model of make.models) {
      const ref = `${make.slug}/${model.slug}`;
      if (modelSlugs.has(model.slug)) problems.push(`Duplicate model slug: ${ref}`);
      modelSlugs.add(model.slug);

      // A model with no variants would make the Variant step of the wizard a
      // dead end, and that step is mandatory (`VEHICLE_WIZARD_STEPS`).
      if (model.variants.length === 0) problems.push(`Model ${ref} has no variants`);

      if (model.yearTo !== null && model.yearTo < model.yearFrom) {
        problems.push(`Model ${ref} ends (${model.yearTo}) before it starts (${model.yearFrom})`);
      }
      if (model.yearFrom > thisYear + 1) {
        problems.push(`Model ${ref} starts in ${model.yearFrom}, which is not yet a model year`);
      }

      const variantSlugs = new Set<string>();
      for (const variant of model.variants) {
        if (variantSlugs.has(variant.slug)) {
          problems.push(`Duplicate variant slug: ${ref}/${variant.slug} (${variant.name})`);
        }
        variantSlugs.add(variant.slug);

        if (variant.slug.length === 0) {
          problems.push(`Variant "${variant.name}" in ${ref} slugified to nothing`);
        }
        // Electric cars have no displacement; everything else must have one, or
        // the spec sheet on the detail page renders a blank row.
        if (variant.fuel === 'ELECTRIC') {
          if (variant.engineCc !== null) {
            problems.push(`Electric variant ${ref}/${variant.slug} has an engine size`);
          }
        } else if (variant.engineCc === null || variant.engineCc < 500) {
          problems.push(`Variant ${ref}/${variant.slug} has an implausible engine size`);
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `The vehicle catalogue is inconsistent:\n  ${problems.slice(0, 40).join('\n  ')}` +
        (problems.length > 40 ? `\n  …and ${problems.length - 40} more` : ''),
    );
  }
}
