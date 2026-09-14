import {
  distinctServices,
  formatLakh,
  initialsOf,
  type DealerCard,
  type DealerDirectoryQuery,
  type DealerDirectoryResponse,
  type DealerPublicProfile,
  type DealerSuggestion,
  type DealerSuggestQuery,
  type DealerSuggestResponse,
  type DistrictChip,
  type LocationChip,
  type PublicLocations,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import { NotFoundError } from '../../platform/errors.js';
import { embedUrlFor } from '../../platform/maps/maps-link.js';
import { mediaUrl } from '../../platform/media/urls.js';
import type { DealersRepository } from './dealers.repository.js';

export interface DealerInventoryStat {
  dealer_slug: string;
  count: number;
  from_price: bigint | null;
}

export interface DealerInventoryStats {
  dealerStats(): Promise<DealerInventoryStat[]>;
}

export const noInventoryYet: DealerInventoryStats = {
  dealerStats: () => Promise.resolve([]),
};

const CARD_COVER_WIDTH = 640;
const PORTFOLIO_COVER_WIDTH = 1600;

export interface DealersPublicDeps {
  repo: DealersRepository;
  stats: DealerInventoryStats;
}

export function createDealersPublicService({ repo, stats }: DealersPublicDeps) {
  return {
    async directory(query: DealerDirectoryQuery): Promise<DealerDirectoryResponse> {
      const [dealers, inventory] = await Promise.all([repo.listActive(), stats.dealerStats()]);

      const byDealer = new Map(inventory.map((row) => [row.dealer_slug, row]));

      const inDistrict =
        query.district && query.district !== 'all'
          ? dealers.filter((dealer) => dealer.districtSlug === query.district)
          : dealers;

      const cities = citySlugsIn(query.city);

      let filtered = inDistrict;
      if (cities.size > 0) {
        filtered = filtered.filter(
          (dealer) => dealer.citySlug !== null && cities.has(dealer.citySlug),
        );
      }
      if (query.q) {
        const needle = query.q.toLowerCase();
        filtered = filtered.filter((dealer) => dealer.brandName.toLowerCase().includes(needle));
      }

      const total = filtered.length;
      const start = (query.page - 1) * query.limit;
      const paged = filtered.slice(start, start + query.limit);

      const covers = await repo.readyMediaIds(
        paged.map((dealer) => dealer.coverMediaId).filter((id): id is string => id !== null),
      );

      const data: DealerCard[] = paged.map((dealer) => {
        const stat = byDealer.get(dealer.slug);
        const fromPrice =
          stat?.from_price === null || stat?.from_price === undefined
            ? null
            : Number(stat.from_price);
        const city = dealer.cityName ?? '';
        const state = dealer.state ?? '';

        return {
          slug: dealer.slug,
          brandName: dealer.brandName,
          initials: dealer.initials,
          city,
          state,
          yearsOperating: dealer.yearsOperating,
          yearsLabel: locationLabel(city, state, dealer.yearsOperating),
          tagline: dealer.tagline,
          services: distinctServices(dealer.specialities).slice(0, 3),
          carCount: stat?.count ?? 0,
          fromPricePaise: fromPrice,
          fromPriceLabel: fromPrice === null ? '—' : `from ${formatLakh(fromPrice)}`,
          isVerified: true,
          logoUrl: null,
          coverUrl:
            dealer.coverMediaId && covers.has(dealer.coverMediaId)
              ? mediaUrl(dealer.coverMediaId, CARD_COVER_WIDTH)
              : null,
        };
      });

      return {
        data,
        page: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
        countLabel: `${total} verified ${total === 1 ? 'dealership' : 'dealerships'}`,
        cities: chipsOf(inDistrict, cityChip),
        districts: chipsOf(dealers, districtChip),
      };
    },

    async suggest(query: DealerSuggestQuery): Promise<DealerSuggestResponse> {
      const [dealers, inventory] = await Promise.all([repo.listActive(), stats.dealerStats()]);
      const byDealer = new Map(inventory.map((row) => [row.dealer_slug, row]));

      const cities = citySlugsIn(query.city);
      const inScope = dealers.filter((dealer) => {
        if (query.district && query.district !== 'all' && dealer.districtSlug !== query.district) {
          return false;
        }
        if (cities.size > 0 && (dealer.citySlug === null || !cities.has(dealer.citySlug))) {
          return false;
        }
        return true;
      });

      const needle = query.search.trim().toLowerCase();

      const ranked = inScope
        .map((dealer) => ({ dealer, hit: matchDealer(dealer, needle) }))
        .filter(
          (row): row is { dealer: (typeof inScope)[number]; hit: SuggestHit } => row.hit !== null,
        )
        .sort(
          (a, b) =>
            a.hit.rank - b.hit.rank ||
            (byDealer.get(b.dealer.slug)?.count ?? 0) - (byDealer.get(a.dealer.slug)?.count ?? 0) ||
            a.dealer.brandName.localeCompare(b.dealer.brandName),
        );

      const data: DealerSuggestion[] = ranked.slice(0, query.limit).map(({ dealer, hit }) => {
        const carCount = byDealer.get(dealer.slug)?.count ?? 0;
        return {
          slug: dealer.slug,
          brandName: dealer.brandName,
          initials: dealer.initials,
          metaLabel: suggestMeta(carCount, dealer.cityName, dealer.districtName),
          matchedOn: hit.field,
          carCount,
          isVerified: true,
        };
      });

      const total = ranked.length;

      return {
        search: query.search,
        data,
        countLabel: `${total} matching ${total === 1 ? 'yard' : 'yards'}`,
      };
    },

    async locations(): Promise<PublicLocations> {
      const dealers = await repo.listActive();

      return {
        districts: chipsOf(dealers, districtChip),
        total: dealers.length,
      };
    },

    async profile(slug: string): Promise<DealerPublicProfile> {
      const dealer = await repo.findPublicBySlug(slug);
      if (!dealer) throw new NotFoundError('That dealership is not listed.');

      const [inventory, covers] = await Promise.all([
        stats.dealerStats(),
        repo.readyMediaIds(dealer.coverMediaId ? [dealer.coverMediaId] : []),
      ]);
      const carCount = inventory.find((row) => row.dealer_slug === slug)?.count ?? 0;

      const city = dealer.city ?? '';
      const state = dealer.state ?? '';
      const yearsOperating = dealer.establishedYear
        ? Math.max(1, new Date().getUTCFullYear() - dealer.establishedYear)
        : 1;

      const fullAddress = [dealer.addressLine, `${city} ${dealer.pincode ?? ''}`.trim(), state]
        .filter(Boolean)
        .join(', ');

      const hours = dealer.workingHours as { mon_sat?: string; sun?: string | null } | null;

      return {
        slug: dealer.slug,
        brandName: dealer.brandName,
        legalName: dealer.legalName,
        initials: initialsOf(dealer.brandName),
        isVerified: true,
        tagline: dealer.tagline,
        services: distinctServices(dealer.specialities),
        address: {
          line: dealer.addressLine,
          city,
          district: dealer.district,
          state,
          pincode: dealer.pincode,
          full: fullAddress,
          mapsUrl: directionsUrl(dealer.mapsUrl, dealer.lat, dealer.lng),
          geo:
            dealer.lat === null || dealer.lng === null
              ? null
              : { lat: dealer.lat, lng: dealer.lng },
          embedUrl: embedUrlFor({
            mapsUrl: dealer.mapsUrl,
            placeId: dealer.mapsPlaceId,
            coordinates:
              dealer.lat === null || dealer.lng === null
                ? null
                : { lat: dealer.lat, lng: dealer.lng },
            label: dealer.brandName,
          }),
        },
        stats: [
          { key: 'cars', label: 'Cars available', value: String(carCount) },
          { key: 'years', label: 'Years operating', value: String(yearsOperating) },
          { key: 'location', label: 'Location', value: city },
          {
            key: 'response',
            label: 'Response time',
            value: responseLabel(dealer.medianResponseMins),
          },
        ],
        contact: [
          { key: 'city', label: 'City', value: [city, state].filter(Boolean).join(', ') },
          ...(dealer.gstin
            ? [{ key: 'gstin', label: 'GSTIN', value: dealer.gstin, mono: true }]
            : []),
          ...(hours?.mon_sat
            ? [{ key: 'hours', label: 'Open', value: humanHours(hours.mon_sat) }]
            : []),
        ],
        logoUrl: null,
        coverUrl:
          dealer.coverMediaId && covers.has(dealer.coverMediaId)
            ? mediaUrl(dealer.coverMediaId, PORTFOLIO_COVER_WIDTH)
            : null,
        seo: {
          canonical: `${env.WEB_BASE_URL}/dealers/${dealer.slug}`,
          isIndexable: carCount > 0,
          title: city
            ? `${dealer.brandName} — used cars in ${city} | Dealers-Drive`
            : `${dealer.brandName} — used cars | Dealers-Drive`,
        },
      };
    },
  };
}

export type DealersPublicService = ReturnType<typeof createDealersPublicService>;

function directionsUrl(
  mapsUrl: string | null,
  lat: number | null,
  lng: number | null,
): string | null {
  if (!mapsUrl) return null;
  if (lat === null || lng === null) return mapsUrl;

  let path: string;
  try {
    path = new URL(mapsUrl).pathname;
  } catch {
    return mapsUrl;
  }

  if (!path.startsWith('/maps/embed')) return mapsUrl;
  return `https://www.google.com/maps/dir/?api=1&destination=${String(lat)},${String(lng)}`;
}

function citySlugsIn(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(',')
      .map((slug) => slug.trim())
      .filter((slug) => slug.length > 0 && slug !== 'all'),
  );
}

function chipsOf<T, C extends LocationChip>(rows: readonly T[], chip: (row: T) => C | null): C[] {
  const chips = new Map<string, C>();

  for (const row of rows) {
    const made = chip(row);
    if (!made) continue;
    const existing = chips.get(made.slug);
    if (existing) existing.count += 1;
    else chips.set(made.slug, made);
  }

  return [...chips.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function cityChip(row: { citySlug: string | null; cityName: string | null }): LocationChip | null {
  return row.citySlug && row.cityName ? { slug: row.citySlug, name: row.cityName, count: 1 } : null;
}

function districtChip(row: {
  districtSlug: string | null;
  districtName: string | null;
  state: string | null;
}): DistrictChip | null {
  return row.districtSlug && row.districtName
    ? { slug: row.districtSlug, name: row.districtName, count: 1, state: row.state }
    : null;
}

function locationLabel(city: string, state: string, years: number): string {
  const place = [city, state].filter(Boolean).join(', ');
  const age = `${years} ${years === 1 ? 'year' : 'years'}`;
  return place ? `${place} · ${age}` : age;
}

function responseLabel(medianMins: number | null): string {
  if (medianMins === null) return 'New dealer';
  if (medianMins < 60) return '< 1 hr';
  if (medianMins < 120) return '< 2 hrs';
  if (medianMins < 60 * 24) return `< ${Math.ceil(medianMins / 60)} hrs`;
  return '> 1 day';
}

function humanHours(range: string): string {
  const [from, to] = range.split('-');
  return `Mon–Sat, ${clock(from)} – ${clock(to)}`;
}

function clock(value: string | undefined): string {
  if (!value) return '';
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return minuteText === '00' ? `${display}${suffix}` : `${display}:${minuteText}${suffix}`;
}

interface SuggestHit {
  field: DealerSuggestion['matchedOn'];
  rank: number;
}

const RANK_NAME_PREFIX = 0;
const RANK_NAME_WORD = 1;
const RANK_NAME_ANYWHERE = 2;
const RANK_PLACE = 3;

function matchDealer(
  dealer: { brandName: string; cityName: string | null; districtName: string | null },
  needle: string,
): SuggestHit | null {
  const name = dealer.brandName.toLowerCase();

  if (name.startsWith(needle)) return { field: 'brandName', rank: RANK_NAME_PREFIX };
  if (startsAWord(name, needle)) return { field: 'brandName', rank: RANK_NAME_WORD };
  if (name.includes(needle)) return { field: 'brandName', rank: RANK_NAME_ANYWHERE };

  if (dealer.cityName?.toLowerCase().includes(needle)) {
    return { field: 'city', rank: RANK_PLACE };
  }
  if (dealer.districtName?.toLowerCase().includes(needle)) {
    return { field: 'district', rank: RANK_PLACE };
  }
  return null;
}

function startsAWord(haystack: string, needle: string): boolean {
  let at = haystack.indexOf(needle);
  while (at > 0) {
    if (/[^a-z0-9]/.test(haystack[at - 1] ?? '')) return true;
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
}

function suggestMeta(
  carCount: number,
  cityName: string | null,
  districtName: string | null,
): string {
  const place = [cityName, districtName === cityName ? null : districtName]
    .filter((part): part is string => Boolean(part))
    .join(', ');

  return [carCount > 0 ? `${String(carCount)} cars in yard` : null, place || null]
    .filter((part): part is string => part !== null)
    .join(' · ');
}
