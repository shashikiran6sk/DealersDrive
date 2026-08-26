import {
  BODY_TYPE_LABELS,
  emiPaise,
  formatKm,
  formatLakh,
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  type BodyType,
  type FuelType,
  type Transmission,
  type VehicleCard,
} from '@dealers-drive/contracts';

import { mediaUrl, srcsetFor } from '../../platform/media/urls.js';
import type { SearchRow } from './search.repository.js';

/**
 * `listing_search` row -> the card every public surface renders.
 *
 * Every displayed string is produced here, once. The API returns
 * `pricePaise` **and** `priceLabel` so the homepage, the results grid, the
 * detail page and the saved list cannot disagree about Lakh rounding
 * (API-SPEC §0.4).
 */
export function toVehicleCard(row: SearchRow): VehicleCard {
  const price = Number(row.price_paise);
  const emi = emiPaise(price);
  const title = row.title;

  return {
    id: row.vehicle_id,
    slug: row.vehicle_slug,
    year: row.year,
    title,
    pricePaise: price,
    priceLabel: formatLakh(price),
    emiPaise: emi,
    emiLabel: `₹${Math.round(emi / 100).toLocaleString('en-IN')}/mo`,
    kmDriven: row.km,
    kmLabel: formatKm(row.km),
    fuel: row.fuel as FuelType,
    fuelLabel: FUEL_LABELS[row.fuel as FuelType] ?? row.fuel,
    transmission: row.transmission as Transmission,
    transmissionLabel: TRANSMISSION_LABELS[row.transmission as Transmission] ?? row.transmission,
    bodyType: row.body_type as BodyType,
    city: { slug: row.city_slug, name: row.city_name },
    dealer: {
      slug: row.dealer_slug,
      brandName: row.dealer_name,
      initials: row.dealer_initials,
      // Every dealer in the catalogue is ACTIVE with verified documents —
      // that is what being in `listing_search` at all means (§11.1).
      isVerified: true,
    },
    primaryImage: row.primary_media_id
      ? {
          url: mediaUrl(row.primary_media_id, 640),
          srcset: srcsetFor(row.primary_media_id),
          blurhash: row.primary_blurhash,
          alt: `${row.year} ${title} — ${row.dealer_name}, ${row.city_name}`,
        }
      : null,
    photoCount: row.photo_count,
    isSold: row.is_sold,
    soldLabel: row.is_sold ? soldLabel(row.sold_at) : null,
  };
}

/**
 * "Sold" on its own once the sale stops being news. A card that says
 * "Sold this week" is the dealer's best advertisement; one that says it eight
 * months later is just a stale grid slot.
 */
function soldLabel(soldAt: Date | null): string {
  if (!soldAt) return 'Sold';
  const days = Math.floor((Date.now() - soldAt.getTime()) / 86_400_000);
  if (days <= 0) return 'Sold today';
  if (days === 1) return 'Sold yesterday';
  if (days < 7) return `Sold ${days} days ago`;
  if (days < 14) return 'Sold this week';
  if (days < 60) return `Sold ${Math.round(days / 7)} weeks ago`;
  return 'Sold';
}

export function bodyTypeLabel(value: string): string {
  return BODY_TYPE_LABELS[value as BodyType] ?? value;
}

/** "18 cars available" / "1 car available" — used on four screens. */
export function carCountLabel(count: number, suffix = 'available'): string {
  return `${count.toLocaleString('en-IN')} ${count === 1 ? 'car' : 'cars'} ${suffix}`.trim();
}
