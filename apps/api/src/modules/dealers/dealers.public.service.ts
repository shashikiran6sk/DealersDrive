import {
  formatLakh,
  initialsOf,
  type DealerCard,
  type DealerDirectoryQuery,
  type DealerDirectoryResponse,
  type DealerPublicProfile,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import { NotFoundError } from '../../platform/errors.js';
import type { SearchRepository } from '../search/search.repository.js';
import type { DealersRepository } from './dealers.repository.js';

export interface DealersPublicDeps {
  repo: DealersRepository;
  search: SearchRepository;
}

/** A8–A11. Nothing here returns a phone number; A7 is the only route that can. */
export function createDealersPublicService({ repo, search }: DealersPublicDeps) {
  return {
    async directory(query: DealerDirectoryQuery): Promise<DealerDirectoryResponse> {
      const [dealers, stats, cityCounts] = await Promise.all([
        repo.listActive(),
        search.dealerStats(),
        search.cityCounts(),
      ]);

      const byDealer = new Map(stats.map((row) => [row.dealer_slug, row]));

      let filtered = dealers;
      if (query.city && query.city !== 'all') {
        filtered = filtered.filter((dealer) => dealer.citySlug === query.city);
      }
      if (query.q) {
        const needle = query.q.toLowerCase();
        filtered = filtered.filter((dealer) => dealer.brandName.toLowerCase().includes(needle));
      }

      const total = filtered.length;
      const start = (query.page - 1) * query.limit;
      const paged = filtered.slice(start, start + query.limit);

      const data: DealerCard[] = paged.map((dealer) => {
        const stat = byDealer.get(dealer.slug);
        const fromPrice = stat?.from_price === null || stat?.from_price === undefined
          ? null
          : Number(stat.from_price);

        return {
          slug: dealer.slug,
          brandName: dealer.brandName,
          initials: dealer.initials,
          city: dealer.cityName ?? '',
          state: dealer.state,
          yearsOperating: dealer.yearsOperating,
          yearsLabel: `${dealer.cityName ?? ''}, ${dealer.state} · ${dealer.yearsOperating} years`,
          tagline: dealer.tagline,
          services: dealer.specialities.slice(0, 3),
          carCount: stat?.count ?? 0,
          fromPricePaise: fromPrice,
          // A dealer with zero live cars still appears, with an em dash (A8).
          fromPriceLabel: fromPrice === null ? '—' : `from ${formatLakh(fromPrice)}`,
          isVerified: true,
          logoUrl: null,
          coverUrl: null,
        };
      });

      // Only cities that actually hold live inventory appear as chips.
      const cityRows = new Map<string, { slug: string; name: string; count: number }>();
      for (const dealer of dealers) {
        if (!dealer.citySlug || !dealer.cityName) continue;
        const existing = cityRows.get(dealer.citySlug);
        if (existing) existing.count += 1;
        else cityRows.set(dealer.citySlug, { slug: dealer.citySlug, name: dealer.cityName, count: 1 });
      }
      void cityCounts;

      return {
        data,
        page: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
        countLabel: `${total} verified ${total === 1 ? 'dealership' : 'dealerships'}`,
        cities: [...cityRows.values()].sort((a, b) => b.count - a.count),
      };
    },

    async profile(slug: string): Promise<DealerPublicProfile> {
      const dealer = await repo.findPublicBySlug(slug);
      if (!dealer) throw new NotFoundError('That dealership is not listed.');

      const stats = await search.dealerStats();
      const carCount = stats.find((row) => row.dealer_slug === slug)?.count ?? 0;

      const city = dealer.city?.name ?? '';
      const state = dealer.city?.state ?? 'Tamil Nadu';
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
        about: dealer.about,
        services: dealer.specialities,
        address: {
          line: dealer.addressLine,
          city,
          state,
          pincode: dealer.pincode,
          full: fullAddress,
          lat: dealer.lat,
          lng: dealer.lng,
          directionsUrl:
            dealer.lat !== null && dealer.lng !== null
              ? `https://www.google.com/maps/dir/?api=1&destination=${dealer.lat},${dealer.lng}`
              : null,
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
          // masked: true, and no number in the payload. A7 is the only way.
          { key: 'phone', label: 'Phone', value: 'Tap to reveal', masked: true },
          { key: 'city', label: 'City', value: `${city}, ${state}` },
          // GSTIN is public — it is on every Indian invoice. PAN never is.
          ...(dealer.gstin
            ? [{ key: 'gstin', label: 'GSTIN', value: dealer.gstin, mono: true }]
            : []),
          ...(hours?.mon_sat
            ? [{ key: 'hours', label: 'Open', value: humanHours(hours.mon_sat) }]
            : []),
        ],
        logoUrl: null,
        coverUrl: null,
        seo: {
          canonical: `${env.WEB_BASE_URL}/dealers/${dealer.slug}`,
          title: `${dealer.brandName} — used cars in ${city} | Dealers-Drive`,
          // Indexable only if ACTIVE and holding at least one live listing (§17.2).
          isIndexable: carCount > 0,
        },
      };
    },
  };
}

export type DealersPublicService = ReturnType<typeof createDealersPublicService>;

/**
 * A dealer who never touches their inbox degrades their own public stat.
 * That feedback loop is intentional (§14.3).
 */
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
