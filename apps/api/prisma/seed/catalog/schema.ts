/**
 * The Indian passenger-vehicle catalogue: shape, and the shorthand it is
 * written in.
 *
 * ## Why this is a dataset and not an API call
 *
 * There is no reliable free source for Indian make → model → variant covering
 * 2010 onwards, and the requirement is specifically *2010 onwards*:
 *
 * - **Indian Automotive Data Hub** (RapidAPI, MIT) — the closest fit, and
 *   still wrong: it serves *currently on sale* cars only. A used-car
 *   marketplace's catalogue is mostly discontinued models, so the half it
 *   omits is the half we need. Third-party hosted, rate-limited, no stated
 *   update cadence.
 * - **Vahan / data.gov.in** — a registration lookup, not a catalogue. It
 *   answers "what is registration TN09BX1234", which needs a car that already
 *   exists; it cannot enumerate the variants of a Swift.
 * - **CarAPI, carmakemodeldb, Teoalida** — US/EU-shaped, paid, and thin on
 *   Indian trim names. `VXi` / `ZXi+` / `Asta (O)` / `W8(O)` are how Indian
 *   cars are actually advertised, and none of them carry those.
 * - **Global open datasets** (`vbalagovic/cars-dataset`, `plowman/open-vehicle-db`)
 *   — broad on brands, absent on Indian trim lines for the same reason.
 *
 * A runtime dependency on any of them would also break the property that makes
 * this taxonomy worth having (ARCHITECTURE §6.2): dealers pick from a closed
 * list, so search facets, filters and SEO slugs are exact. A catalogue that
 * changes shape when someone else's API does is not closed.
 *
 * So it is committed, versioned and reviewable — a diff shows exactly which
 * variant someone added — and it is seeded, not fetched.
 *
 * ## The shorthand
 *
 * Written per *powertrain* rather than per variant, because that is how Indian
 * cars are actually specified: a trim ladder is offered on an engine, and the
 * same ladder repeats on the next engine. `p()` takes one engine and the trims
 * sold on it and expands to one `Variant` row each, which keeps a model that
 * ships 14 variants to three readable lines instead of fourteen.
 */

export type CatalogFuel = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC' | 'HYBRID' | 'LPG';
export type CatalogGearbox = 'MANUAL' | 'AUTOMATIC';
export type CatalogBody = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'MUV' | 'LUXURY';

export interface CatalogVariant {
  slug: string;
  name: string;
  fuel: CatalogFuel;
  transmission: CatalogGearbox;
  engineCc: number | null;
  seats: number;
}

export interface CatalogModel {
  slug: string;
  name: string;
  bodyType: CatalogBody;
  yearFrom: number;
  /** `null` while still on sale. Bounds the wizard's year dropdown. */
  yearTo: number | null;
  variants: CatalogVariant[];
}

export interface CatalogMake {
  slug: string;
  name: string;
  popularity: number;
  models: CatalogModel[];
}

/**
 * The slug rule, fixed here because ids are permanent once a dealer's car
 * points at one and a URL has been indexed.
 *
 * `+` becomes `-plus` before anything else runs: it is meaningful in Indian
 * trim names — `ZXi` and `ZXi+` are different cars at different prices — and
 * the general "strip punctuation" pass would collapse them onto one slug and
 * silently merge two variants.
 */
export function variantSlug(name: string): string {
  return name
    .replace(/\+/g, '-plus')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** One engine, and every trim sold with it. */
export function p(
  fuel: CatalogFuel,
  transmission: CatalogGearbox,
  engineCc: number | null,
  seats: number,
  trims: readonly string[],
): CatalogVariant[] {
  return trims.map((name) => ({
    slug: variantSlug(name),
    name,
    fuel,
    transmission,
    engineCc,
    seats,
  }));
}

export function m(
  slug: string,
  name: string,
  bodyType: CatalogBody,
  yearFrom: number,
  yearTo: number | null,
  variants: CatalogVariant[][],
): CatalogModel {
  const flat = variants.flat();

  // Two powertrains can legitimately offer the same trim name — a `VXi` petrol
  // manual and a `VXi` CNG manual are both real — but they cannot share a slug,
  // because `@@unique([modelId, slug])` would reject the second and the seed
  // would fail halfway through with a constraint error naming neither. Suffix
  // the duplicate with what actually distinguishes it.
  const seen = new Map<string, number>();
  for (const variant of flat) {
    const count = seen.get(variant.slug) ?? 0;
    seen.set(variant.slug, count + 1);
    if (count > 0) {
      variant.slug = variantSlug(
        `${variant.name} ${variant.fuel} ${variant.transmission === 'AUTOMATIC' ? 'AT' : 'MT'}`,
      );
    }
  }

  return { slug, name, bodyType, yearFrom, yearTo, variants: flat };
}

export function make(
  slug: string,
  name: string,
  popularity: number,
  models: CatalogModel[],
): CatalogMake {
  return { slug, name, popularity, models };
}
