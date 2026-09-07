import {
  formatLakh,
  initialsOf,
  type DealerCard,
  type DealerDirectoryQuery,
  type DealerDirectoryResponse,
  type DealerPublicProfile,
  type LocationChip,
  type PublicLocations,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import { NotFoundError } from '../../platform/errors.js';
import { mediaUrl } from '../../platform/media/urls.js';
import type { DealersRepository } from './dealers.repository.js';

/**
 * One dealership's live inventory, as the directory needs to count it.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline read this straight off `search.dealerStats()`, which groups
 * `listing_search` — the read model **F064** creates and **F076** queries.
 * Neither exists yet, so this feature declares the shape it needs and takes it
 * as a dependency rather than reaching for a module that is not there.
 *
 * `noInventoryYet` below is the implementation until F076: no listings exist,
 * so every dealership genuinely has none, and the honest answer is zero. The
 * directory already renders that case — a dealership with no live cars appears
 * with an em dash rather than being hidden (A8) — so nothing here is a
 * placeholder waiting to be redesigned. F076 replaces one function.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface DealerInventoryStat {
  dealer_slug: string;
  count: number;
  from_price: bigint | null;
}

export interface DealerInventoryStats {
  dealerStats(): Promise<DealerInventoryStat[]>;
}

/** No listings exist before F064. Zero is the truth, not a stub. */
export const noInventoryYet: DealerInventoryStats = {
  dealerStats: () => Promise.resolve([]),
};

/**
 * The widths the two public surfaces ask for.
 *
 * `DirectoryCard`'s cover is a 104px band across a ~290px card, so 640 is one
 * retina step above what it needs and the smallest rendition that does not
 * soften on a phone. The portfolio's is a 170px band across the full 1280px
 * column, which is the one place a yard photograph is looked *at* rather than
 * glanced past.
 */
const CARD_COVER_WIDTH = 640;
const PORTFOLIO_COVER_WIDTH = 1600;

export interface DealersPublicDeps {
  repo: DealersRepository;
  stats: DealerInventoryStats;
}

/** A8–A9. Nothing here returns a phone number; A7 is the only route that can. */
export function createDealersPublicService({ repo, stats }: DealersPublicDeps) {
  return {
    /**
     * A8 — the grid, its city chips and its count.
     *
     * Filtering, searching and paging happen in this process rather than in the
     * query, which is the baseline's shape and is deliberate at this size: the
     * directory is every ACTIVE dealership on the platform, the city chips need
     * a count over the *unfiltered* set, and one ordered read serves all three.
     * The day that stops being true is the day the chips need their own query,
     * not the day this gets a `WHERE` clause bolted onto it.
     */
    async directory(query: DealerDirectoryQuery): Promise<DealerDirectoryResponse> {
      const [dealers, inventory] = await Promise.all([repo.listActive(), stats.dealerStats()]);

      const byDealer = new Map(inventory.map((row) => [row.dealer_slug, row]));

      // The district first: it is the wider filter, and the city chips are
      // counted over what it leaves.
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

      // Asked for the page, not for the directory: 24 ids rather than every
      // ACTIVE dealership's, and one query rather than one per card.
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
          services: dealer.specialities.slice(0, 3),
          carCount: stat?.count ?? 0,
          fromPricePaise: fromPrice,
          // A dealer with zero live cars still appears, with an em dash (A8).
          fromPriceLabel: fromPrice === null ? '—' : `from ${formatLakh(fromPrice)}`,
          isVerified: true,
          /*
           * No logo yet: nothing in the product writes `logoMediaId`, so there
           * is no image to address. `DirectoryCard` renders the initials tile,
           * which is the design's answer for a dealership without one rather
           * than a gap waiting on a feature.
           */
          logoUrl: null,
          /*
           * The yard photograph, addressed by media id and width — never by
           * storage key, so this URL survives the bucket being reorganised
           * (`platform/media/urls.ts`).
           *
           * Null unless the row is READY. A `coverMediaId` pointing at a
           * PENDING or ORPHAN upload would render as a broken image, and the
           * `ImageSlot` it replaces is the more honest answer.
           */
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
        /*
         * The chips, over the **district** and not over the page — so choosing
         * one cannot empty the row it was chosen from, and a district's towns
         * stay visible while its dealerships are being filtered by name.
         *
         * Narrowed by the district and by nothing else. Narrowing them by the
         * cities already chosen would delete the chips a buyer needs in order
         * to change their mind.
         */
        cities: chipsOf(inDistrict, (dealer) => [dealer.citySlug, dealer.cityName]),
        /*
         * The districts, over every ACTIVE dealership. Never narrowed: this is
         * what the header offers, and a selector that dropped the options you
         * did not pick is one you cannot get back out of.
         */
        districts: chipsOf(dealers, (dealer) => [dealer.districtSlug, dealer.districtName]),
      };
    },

    /**
     * A12 — the districts the platform trades in, for the header's selector.
     *
     * Its own read rather than a slice of the directory's, because the header
     * is in the public layout: it renders on the home page and on the
     * catalogue, neither of which has any reason to fetch a page of
     * dealerships.
     */
    async locations(): Promise<PublicLocations> {
      const dealers = await repo.listActive();

      return {
        districts: chipsOf(dealers, (dealer) => [dealer.districtSlug, dealer.districtName]),
        total: dealers.length,
      };
    },

    /** A9 — the dealership's own page. `findPublicBySlug` refuses anything but ACTIVE. */
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
        about: dealer.about,
        services: dealer.specialities,
        address: {
          line: dealer.addressLine,
          city,
          district: dealer.district,
          state,
          pincode: dealer.pincode,
          full: fullAddress,
          // R6. The link the dealer pasted, and nothing composed from the
          // address — see the note on the field in `contracts/public.ts`.
          mapsUrl: dealer.mapsUrl,
          // The pin the link resolved to, when it resolved to one. Both halves
          // have to be present: a row with a latitude and no longitude is not a
          // place, and centring a map on half a coordinate puts it in the sea.
          geo:
            dealer.lat === null || dealer.lng === null
              ? null
              : { lat: dealer.lat, lng: dealer.lng },
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
          { key: 'city', label: 'City', value: [city, state].filter(Boolean).join(', ') },
          // GSTIN is public — it is on every Indian invoice. PAN never is.
          ...(dealer.gstin
            ? [{ key: 'gstin', label: 'GSTIN', value: dealer.gstin, mono: true }]
            : []),
          ...(hours?.mon_sat
            ? [{ key: 'hours', label: 'Open', value: humanHours(hours.mon_sat) }]
            : []),
        ],
        // As above: no logo is written anywhere yet, and the cover is a URL only
        // once its bytes are actually servable.
        logoUrl: null,
        coverUrl:
          dealer.coverMediaId && covers.has(dealer.coverMediaId)
            ? mediaUrl(dealer.coverMediaId, PORTFOLIO_COVER_WIDTH)
            : null,
        seo: {
          canonical: `${env.WEB_BASE_URL}/dealers/${dealer.slug}`,
          // Indexable only if ACTIVE and holding at least one live listing
          // (§17.2). Every dealership is therefore noindex until F064 — which
          // is right: a portfolio with nothing in it is a page Google should
          // not be sent to, and this is the condition that says so.
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

/**
 * `?city=vellore,katpadi` — the chips a buyer has toggled on.
 *
 * `all` is accepted as "no filter" rather than as a town, because that is what
 * the baseline's single-select chip sent when it was cleared and a link that
 * still says it should not return an empty page.
 */
function citySlugsIn(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(',')
      .map((slug) => slug.trim())
      .filter((slug) => slug.length > 0 && slug !== 'all'),
  );
}

/**
 * Counts one place per dealership, busiest first, dropping the rows that never
 * answered the question.
 *
 * One function for the city chips and the district selector because they are
 * the same computation over a different column — and they were the same
 * fourteen lines twice before this, which is how the two come to disagree about
 * whether an unnamed locality is a chip.
 */
function chipsOf<T>(
  rows: readonly T[],
  place: (row: T) => [slug: string | null, name: string | null],
): LocationChip[] {
  const chips = new Map<string, LocationChip>();

  for (const row of rows) {
    const [slug, name] = place(row);
    if (!slug || !name) continue;
    const existing = chips.get(slug);
    if (existing) existing.count += 1;
    else chips.set(slug, { slug, name, count: 1 });
  }

  // Busiest first, then alphabetically — otherwise two districts of the same
  // size swap places between requests and the row appears to shuffle itself.
  return [...chips.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * "Vellore, Tamil Nadu · 7 years", and gracefully less when a dealership
 * predates one of the fields. The baseline built this inline and produced
 * ", Tamil Nadu · 1 years" for a row with no city — a string a buyer sees.
 */
function locationLabel(city: string, state: string, years: number): string {
  const place = [city, state].filter(Boolean).join(', ');
  const age = `${years} ${years === 1 ? 'year' : 'years'}`;
  return place ? `${place} · ${age}` : age;
}

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
