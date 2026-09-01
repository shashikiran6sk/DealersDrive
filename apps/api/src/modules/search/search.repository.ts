import { initialsOf, type VehicleQuery } from '@dealers-drive/contracts';
import { Prisma, type PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

/**
 * `listing_search` — the denormalized read model (ARCHITECTURE §11.1).
 *
 * Membership is one rule: an APPROVED **or SOLD** listing belonging to an
 * ACTIVE dealer. Availability is a second, narrower one: `is_sold = false`.
 * Before sold cars stayed on the marketplace the two were the same question,
 * and the whole visibility model was the first rule alone.
 *
 * Keeping them apart is now load-bearing, because every count in the product —
 * cars available, per-city counts, body-type tiles, facet counts, "from ₹x" —
 * means *available*, and a sold car leaking into one of them would advertise
 * stock nobody can buy. `buildWhere` therefore adds `is_sold = false` by
 * default and a caller must ask for sold rows explicitly; the only caller that
 * does is the results page, which shows them last.
 */

export interface SearchRow {
  listing_id: string;
  vehicle_id: string;
  dealer_id: string;
  dealer_name: string;
  dealer_slug: string;
  dealer_initials: string;
  make_slug: string;
  model_slug: string;
  variant_slug: string | null;
  make_name: string;
  model_name: string;
  variant_name: string | null;
  title: string;
  vehicle_slug: string;
  year: number;
  price_paise: bigint;
  km: number;
  fuel: string;
  transmission: string;
  body_type: string;
  owner_number: number;
  seats: number | null;
  airbags: number | null;
  color_slug: string | null;
  color_family: string | null;
  rto_code: string | null;
  rto_state: string | null;
  city_slug: string;
  city_name: string;
  lat: number | null;
  lng: number | null;
  features: string[];
  photo_count: number;
  primary_media_id: string | null;
  primary_blurhash: string | null;
  approved_at: Date;
  is_sold: boolean;
  sold_at: Date | null;
}

/**
 * Every column except `search_doc`. The tsvector has no Prisma representation,
 * so `SELECT *` fails to deserialise — and it is an index, not data anyone
 * reads. Listing the columns keeps that failure impossible.
 */
const COLUMNS = Prisma.raw(`
  listing_id, vehicle_id, dealer_id, dealer_name, dealer_slug, dealer_initials,
  make_slug, model_slug, variant_slug, make_name, model_name, variant_name,
  title, vehicle_slug, year, price_paise, km, fuel, transmission, body_type,
  owner_number, seats, airbags, color_slug, color_family, rto_code, rto_state,
  city_slug, city_name, lat, lng, features, photo_count,
  primary_media_id, primary_blurhash, approved_at, is_sold, sold_at`);

export function createSearchRepository(prisma: PrismaClient) {
  return {
    /**
     * Rebuilds one listing's row, or removes it if it no longer satisfies
     * `(APPROVED or SOLD) && dealer ACTIVE`. Idempotent — the subscriber that
     * calls it assumes it will run twice.
     *
     * Marking a car sold is now an `index`, not an `unindex`: the row stays and
     * `is_sold` flips. Withdrawing the listing is what deletes it.
     */
    async index(listingId: string, client: Tx | PrismaClient = prisma): Promise<boolean> {
      const listing = await client.listing.findUnique({
        where: { id: listingId },
        include: {
          dealer: { include: { city: true } },
          vehicle: {
            include: {
              make: true,
              model: true,
              variant: true,
              color: true,
              city: true,
              media: { include: { media: true }, orderBy: { position: 'asc' } },
            },
          },
        },
      });

      // A sold listing is still *displayed*, so it is still indexed. What it is
      // not is available, and `is_sold` below is where that is recorded.
      const visible =
        listing &&
        (listing.status === 'APPROVED' || listing.status === 'SOLD') &&
        listing.dealer.status === 'ACTIVE' &&
        listing.vehicle.deletedAt === null &&
        listing.vehicle.slug !== null &&
        listing.vehicle.pricePaise !== null &&
        listing.vehicle.kmDriven !== null;

      if (!visible) {
        await this.remove(listingId, client);
        return false;
      }

      const isSold = listing.status === 'SOLD' || listing.vehicle.status === 'SOLD';

      const { vehicle, dealer } = listing;
      const city = vehicle.city ?? dealer.city;
      if (!city) {
        await this.remove(listingId, client);
        return false;
      }

      const ready = vehicle.media.filter((row) => row.media.status === 'READY');
      const primary =
        ready.find((row) => row.media.id === vehicle.primaryMediaId) ?? ready[0] ?? null;

      const title = [vehicle.make.name, vehicle.model.name, vehicle.variant?.name]
        .filter(Boolean)
        .join(' ');

      await client.$executeRaw`
        INSERT INTO listing_search (
          listing_id, vehicle_id, dealer_id, dealer_name, dealer_slug, dealer_initials,
          make_slug, model_slug, variant_slug, make_name, model_name, variant_name,
          title, vehicle_slug, year, price_paise, km, fuel, transmission, body_type,
          owner_number, seats, airbags, color_slug, color_family, rto_code, rto_state,
          city_slug, city_name, lat, lng, features, photo_count,
          primary_media_id, primary_blurhash, approved_at, is_sold, sold_at
        ) VALUES (
          ${listing.id}::uuid, ${vehicle.id}::uuid, ${dealer.id}::uuid,
          ${dealer.brandName}, ${dealer.slug}, ${initialsOf(dealer.brandName)},
          ${vehicle.make.slug}, ${vehicle.model.slug}, ${vehicle.variant?.slug ?? null},
          ${vehicle.make.name}, ${vehicle.model.name}, ${vehicle.variant?.name ?? null},
          ${title}, ${vehicle.slug}, ${vehicle.year}, ${vehicle.pricePaise}, ${vehicle.kmDriven},
          ${vehicle.fuel}, ${vehicle.transmission}, ${vehicle.bodyType},
          ${vehicle.ownerNumber ?? 1}, ${vehicle.seats}, ${vehicle.airbags},
          ${vehicle.color?.slug ?? null}, ${vehicle.color?.family ?? null},
          ${vehicle.rtoCode}, ${vehicle.rtoCode ? vehicle.rtoCode.split('-')[0] : null},
          ${city.slug}, ${city.name}, ${city.lat}, ${city.lng},
          ${vehicle.features}::text[], ${ready.length},
          ${primary?.media.id ?? null}::uuid, ${primary?.media.blurhash ?? null},
          ${listing.approvedAt ?? new Date()},
          ${isSold}, ${isSold ? (listing.soldAt ?? new Date()) : null}
        )
        ON CONFLICT (listing_id) DO UPDATE SET
          vehicle_id = EXCLUDED.vehicle_id,
          dealer_id = EXCLUDED.dealer_id,
          dealer_name = EXCLUDED.dealer_name,
          dealer_slug = EXCLUDED.dealer_slug,
          dealer_initials = EXCLUDED.dealer_initials,
          make_slug = EXCLUDED.make_slug, model_slug = EXCLUDED.model_slug,
          variant_slug = EXCLUDED.variant_slug, make_name = EXCLUDED.make_name,
          model_name = EXCLUDED.model_name, variant_name = EXCLUDED.variant_name,
          title = EXCLUDED.title, vehicle_slug = EXCLUDED.vehicle_slug,
          year = EXCLUDED.year, price_paise = EXCLUDED.price_paise, km = EXCLUDED.km,
          fuel = EXCLUDED.fuel, transmission = EXCLUDED.transmission,
          body_type = EXCLUDED.body_type, owner_number = EXCLUDED.owner_number,
          seats = EXCLUDED.seats, airbags = EXCLUDED.airbags,
          color_slug = EXCLUDED.color_slug, color_family = EXCLUDED.color_family,
          rto_code = EXCLUDED.rto_code, rto_state = EXCLUDED.rto_state,
          city_slug = EXCLUDED.city_slug, city_name = EXCLUDED.city_name,
          lat = EXCLUDED.lat, lng = EXCLUDED.lng, features = EXCLUDED.features,
          photo_count = EXCLUDED.photo_count,
          primary_media_id = EXCLUDED.primary_media_id,
          primary_blurhash = EXCLUDED.primary_blurhash,
          approved_at = EXCLUDED.approved_at,
          is_sold = EXCLUDED.is_sold, sold_at = EXCLUDED.sold_at`;

      return true;
    },

    async remove(listingId: string, client: Tx | PrismaClient = prisma): Promise<void> {
      await client.$executeRaw`DELETE FROM listing_search WHERE listing_id = ${listingId}::uuid`;
    },

    /** Every listing a dealer owns leaves the catalogue at once on suspension. */
    async removeByDealer(dealerId: string, client: Tx | PrismaClient = prisma): Promise<number> {
      return client.$executeRaw`DELETE FROM listing_search WHERE dealer_id = ${dealerId}::uuid`;
    },

    async listListingIdsForDealer(dealerId: string): Promise<string[]> {
      const rows = await prisma.listing.findMany({
        where: { dealerId },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    },

    /**
     * Results include sold cars; every count reported alongside them does not.
     *
     * `total` is what the page paginates over — it has to include sold rows or
     * the last page would be unreachable. `available` is what the result label
     * counts, and `orderBy` pins `is_sold` first in every sort, so the sold
     * ones only ever appear once a buyer has scrolled past everything they can
     * actually buy.
     */
    async search(
      query: VehicleQuery,
      options: { dealerSlug?: string } = {},
    ): Promise<{ rows: SearchRow[]; total: number; available: number }> {
      const withSold = buildWhere(query, { ...options, includeSold: true });
      const availableOnly = buildWhere(query, options);
      const offset = (query.page - 1) * query.limit;

      const rows = await prisma.$queryRaw<SearchRow[]>`
        SELECT ${COLUMNS} FROM listing_search
        ${withSold}
        ${orderBy(query)}
        LIMIT ${query.limit} OFFSET ${offset}`;

      const [counted, availableCount] = await Promise.all([
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT count(*)::bigint AS count FROM listing_search ${withSold}`,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT count(*)::bigint AS count FROM listing_search ${availableOnly}`,
      ]);

      return {
        rows,
        total: Number(counted[0]?.count ?? 0n),
        available: Number(availableCount[0]?.count ?? 0n),
      };
    },

    /**
     * Sold rows included on purpose: a saved car that has sold must come back
     * so the list can mark it, not vanish without explanation (A7).
     */
    async byIds(ids: string[]): Promise<SearchRow[]> {
      if (ids.length === 0) return [];
      return prisma.$queryRaw<SearchRow[]>`
        SELECT ${COLUMNS} FROM listing_search
        WHERE vehicle_id = ANY(${ids}::uuid[])`;
    },

    /**
     * Available cars only, both of them.
     *
     * A sold car is visible on the marketplace but is not openable: A5 must
     * 404 it, and `similar` must not recommend it. That used to follow from
     * sold rows not being in this table at all; now that they are, it has to be
     * said out loud, and it is said here rather than at each of the four call
     * sites — a caller that forgot would put a sold car back on a detail page.
     */
    async byVehicleId(vehicleId: string): Promise<SearchRow | null> {
      const rows = await prisma.$queryRaw<SearchRow[]>`
        SELECT ${COLUMNS} FROM listing_search
        WHERE vehicle_id = ${vehicleId}::uuid AND is_sold = false LIMIT 1`;
      return rows[0] ?? null;
    },

    async byVehicleSlug(slug: string): Promise<SearchRow | null> {
      const rows = await prisma.$queryRaw<SearchRow[]>`
        SELECT ${COLUMNS} FROM listing_search
        WHERE vehicle_slug = ${slug} AND is_sold = false LIMIT 1`;
      return rows[0] ?? null;
    },

    /**
     * Facet counts with standard semantics: each group is counted **as if its
     * own filter were not applied**, so unchecking a box can only ever add
     * results. One query per group rather than thirteen round trips per group.
     */
    async facetCounts(
      query: VehicleQuery,
      column: FacetColumn,
      options: { dealerSlug?: string } = {},
    ): Promise<{ value: string; count: number }[]> {
      const where = buildWhere(query, { ...options, ignore: FACET_TO_FILTER[column] });
      const rows = await prisma.$queryRaw<{ value: string | null; count: bigint }[]>`
        SELECT ${Prisma.raw(column)}::text AS value, count(*)::bigint AS count
        FROM listing_search ${where}
        GROUP BY 1`;
      return rows
        .filter((row): row is { value: string; count: bigint } => row.value !== null)
        .map((row) => ({ value: row.value, count: Number(row.count) }));
    },

    async priceRange(
      query: VehicleQuery,
      options: { dealerSlug?: string } = {},
    ): Promise<{ min: number; max: number }> {
      const where = buildWhere(query, { ...options, ignore: 'price' });
      const rows = await prisma.$queryRaw<{ min: bigint | null; max: bigint | null }[]>`
        SELECT min(price_paise) AS min, max(price_paise) AS max
        FROM listing_search ${where}`;
      return {
        min: Number(rows[0]?.min ?? 0n),
        max: Number(rows[0]?.max ?? 0n),
      };
    },

    /** Live totals for the header city dropdown and the homepage (§11.1). */
    async cityCounts(): Promise<{ city_slug: string; count: number }[]> {
      const rows = await prisma.$queryRaw<{ city_slug: string; count: bigint }[]>`
        SELECT city_slug, count(*)::bigint AS count FROM listing_search
        WHERE is_sold = false GROUP BY 1`;
      return rows.map((row) => ({ city_slug: row.city_slug, count: Number(row.count) }));
    },

    async bodyTypeCounts(citySlug?: string): Promise<{ body_type: string; count: number }[]> {
      const rows = await prisma.$queryRaw<{ body_type: string; count: bigint }[]>`
        SELECT body_type, count(*)::bigint AS count FROM listing_search
        WHERE is_sold = false
        ${citySlug ? Prisma.sql`AND city_slug = ${citySlug}` : Prisma.empty}
        GROUP BY 1`;
      return rows.map((row) => ({ body_type: row.body_type, count: Number(row.count) }));
    },

    async dealerStats(): Promise<
      { dealer_slug: string; count: number; from_price: bigint | null }[]
    > {
      const rows = await prisma.$queryRaw<
        { dealer_slug: string; count: bigint; from_price: bigint | null }[]
      >`SELECT dealer_slug, count(*)::bigint AS count, min(price_paise) AS from_price
          FROM listing_search WHERE is_sold = false GROUP BY 1`;
      return rows.map((row) => ({
        dealer_slug: row.dealer_slug,
        count: Number(row.count),
        from_price: row.from_price,
      }));
    },

    async totalCount(citySlug?: string): Promise<number> {
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM listing_search
        WHERE is_sold = false
        ${citySlug ? Prisma.sql`AND city_slug = ${citySlug}` : Prisma.empty}`;
      return Number(rows[0]?.count ?? 0n);
    },

    /** Same body type and city, price within ±25%, excluding this vehicle (A6). */
    async similar(row: SearchRow, limit: number): Promise<SearchRow[]> {
      const price = Number(row.price_paise);
      return prisma.$queryRaw<SearchRow[]>`
        SELECT ${COLUMNS},
          (CASE WHEN body_type = ${row.body_type} THEN 2 ELSE 0 END)
        + (CASE WHEN city_slug = ${row.city_slug} THEN 1 ELSE 0 END)
        + (CASE WHEN price_paise BETWEEN ${Math.round(price * 0.75)} AND ${Math.round(price * 1.25)}
                THEN 2 ELSE 0 END) AS score
        FROM listing_search
        WHERE vehicle_id <> ${row.vehicle_id}::uuid AND is_sold = false
        ORDER BY score DESC, abs(price_paise - ${price}) ASC
        LIMIT ${limit}`;
    },
  };
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;

export type FacetColumn =
  | 'fuel'
  | 'body_type'
  | 'transmission'
  | 'dealer_slug'
  | 'owner_number'
  | 'color_family'
  | 'rto_state';

const FACET_TO_FILTER: Record<FacetColumn, FilterGroup> = {
  fuel: 'fuel',
  body_type: 'bodyType',
  transmission: 'transmission',
  dealer_slug: 'dealer',
  owner_number: 'owners',
  color_family: 'color',
  rto_state: 'rtoState',
};

type FilterGroup =
  | 'fuel'
  | 'bodyType'
  | 'transmission'
  | 'dealer'
  | 'owners'
  | 'color'
  | 'rtoState'
  | 'price';

/**
 * `is_sold = false` unless a caller opts out.
 *
 * The default is the safe direction: every count, facet and price range in the
 * product means *available*, and there are a dozen of them against one caller
 * that wants sold rows. A default of "include" would need each of those dozen
 * to remember a flag, and the failure mode of forgetting is a number that
 * advertises cars nobody can buy.
 */
function buildWhere(
  query: VehicleQuery,
  options: { dealerSlug?: string; ignore?: FilterGroup; includeSold?: boolean },
): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  const skip = options.ignore;

  if (!options.includeSold) clauses.push(Prisma.sql`is_sold = false`);

  if (options.dealerSlug) {
    clauses.push(Prisma.sql`dealer_slug = ${options.dealerSlug}`);
  }
  if (query.city && query.city !== 'all') {
    clauses.push(Prisma.sql`city_slug = ${query.city}`);
  }
  if (query.q) {
    // websearch_to_tsquery first, trigram similarity as the fallback so
    // "fortunar" still finds Fortuners (§11.2).
    clauses.push(
      Prisma.sql`(search_doc @@ websearch_to_tsquery('simple', ${query.q})
        OR similarity(coalesce(make_name,'') || ' ' || coalesce(model_name,''), ${query.q}) > 0.3)`,
    );
  }
  if (query.make?.length) clauses.push(Prisma.sql`make_slug = ANY(${query.make}::text[])`);
  if (query.model?.length) clauses.push(Prisma.sql`model_slug = ANY(${query.model}::text[])`);
  if (query.variant?.length) clauses.push(Prisma.sql`variant_slug = ANY(${query.variant}::text[])`);

  if (skip !== 'price') {
    if (query.priceMin !== undefined) clauses.push(Prisma.sql`price_paise >= ${query.priceMin}`);
    if (query.priceMax !== undefined) clauses.push(Prisma.sql`price_paise <= ${query.priceMax}`);
  }
  if (query.yearMin !== undefined) clauses.push(Prisma.sql`year >= ${query.yearMin}`);
  if (query.yearMax !== undefined) clauses.push(Prisma.sql`year <= ${query.yearMax}`);
  if (query.kmMax !== undefined) clauses.push(Prisma.sql`km <= ${query.kmMax}`);

  if (skip !== 'fuel' && query.fuel?.length) {
    clauses.push(Prisma.sql`lower(fuel) = ANY(${query.fuel.map((f) => f.toLowerCase())}::text[])`);
  }
  if (skip !== 'transmission' && query.transmission?.length) {
    clauses.push(
      Prisma.sql`lower(transmission) = ANY(${query.transmission.map((t) => t.toLowerCase())}::text[])`,
    );
  }
  if (skip !== 'bodyType' && query.bodyType?.length) {
    clauses.push(
      Prisma.sql`lower(body_type) = ANY(${query.bodyType.map((b) => b.toLowerCase())}::text[])`,
    );
  }
  if (skip !== 'owners' && query.owners?.length) {
    clauses.push(Prisma.sql`owner_number = ANY(${query.owners}::int[])`);
  }
  if (skip !== 'color' && query.color?.length) {
    clauses.push(Prisma.sql`color_family = ANY(${query.color}::text[])`);
  }
  if (skip !== 'rtoState' && query.rtoState) {
    clauses.push(Prisma.sql`rto_state = ${query.rtoState.toUpperCase()}`);
  }
  if (skip !== 'dealer' && query.dealer?.length && !options.dealerSlug) {
    clauses.push(Prisma.sql`dealer_slug = ANY(${query.dealer}::text[])`);
  }
  if (query.rto) clauses.push(Prisma.sql`rto_code = ${query.rto.toUpperCase()}`);
  if (query.seats !== undefined) clauses.push(Prisma.sql`seats = ${query.seats}`);
  if (query.airbagsMin !== undefined) clauses.push(Prisma.sql`airbags >= ${query.airbagsMin}`);

  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

/**
 * Sold last, always — the chosen sort only orders within that split.
 *
 * It is the first key in every branch rather than a special case, because a
 * sold car outranking an available one on *any* sort would put a car nobody
 * can buy at the top of the page, and "cheapest first" is exactly the sort
 * where that would happen most.
 */
function orderBy(query: VehicleQuery): Prisma.Sql {
  switch (query.sort) {
    case 'price_asc':
      return Prisma.sql`ORDER BY is_sold ASC, price_paise ASC, approved_at DESC`;
    case 'price_desc':
      return Prisma.sql`ORDER BY is_sold ASC, price_paise DESC, approved_at DESC`;
    case 'year_desc':
      return Prisma.sql`ORDER BY is_sold ASC, year DESC, approved_at DESC`;
    case 'km_asc':
      return Prisma.sql`ORDER BY is_sold ASC, km ASC, approved_at DESC`;
    case 'newest':
      return Prisma.sql`ORDER BY is_sold ASC, approved_at DESC`;
    case 'relevance':
      // "Recommended": photographed, cheap-ish and recent, in that order.
      return Prisma.sql`ORDER BY is_sold ASC, (photo_count >= 6) DESC, approved_at DESC, price_paise ASC`;
    default:
      return Prisma.sql`ORDER BY is_sold ASC, approved_at DESC`;
  }
}
