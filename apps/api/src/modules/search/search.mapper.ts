import {
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  formatKm,
  formatRegistration,
  formatRupees,
  initialsOf,
  vehicleTitle,
  type VehicleCardDto,
} from '@dealers-drive/contracts';

import { mediaUrl } from '../../platform/media/urls.js';
import type { CardRow } from './search.repository.js';
import { CARD_IMAGE_WIDTH, IMAGE_ALT } from './search.messages.js';

export function metaLabelOf(vehicle: CardRow['vehicle'], town: string | null): string {
  return [
    vehicle.kilometersDriven === null ? null : formatKm(vehicle.kilometersDriven),
    vehicle.fuelType ? FUEL_LABELS[vehicle.fuelType] : null,
    vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : null,
    town,
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
}

export function toVehicleCard(row: CardRow): VehicleCardDto {
  const { vehicle, dealer } = row;
  const title = vehicleTitle(vehicle) || formatRegistration(vehicle.registrationNumber);
  const primary = vehicle.images[0];

  return {
    slug: row.slug ?? '',
    title,
    year: vehicle.manufacturingYear,
    priceLabel: vehicle.pricePaise === null ? null : formatRupees(vehicle.pricePaise),
    metaLabel: metaLabelOf(vehicle, dealer.city),
    image: primary
      ? { url: mediaUrl(primary.mediaId, CARD_IMAGE_WIDTH), alt: IMAGE_ALT(title) }
      : null,
    imageCount: vehicle._count.images,
    dealer: {
      name: dealer.brandName,
      slug: dealer.slug,
      initials: initialsOf(dealer.brandName),
      isVerified: true,
    },
  };
}
