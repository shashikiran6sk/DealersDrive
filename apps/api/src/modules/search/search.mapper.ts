import {
  BODY_TYPE_LABELS,
  FUEL_LABELS,
  INSURANCE_LABELS,
  NEGOTIABILITY_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_COLOR_LABELS,
  VEHICLE_FIELD_LABELS,
  formatDate,
  formatKm,
  formatRegistration,
  formatRupees,
  initialsOf,
  ownerLabel,
  vehicleSummary,
  vehicleTitle,
  type PublicVehicleDetail,
  type VehicleCardDto,
} from '@dealers-drive/contracts';

import { mediaUrl } from '../../platform/media/urls.js';
import type { CardRow, DetailRow } from './search.repository.js';
import {
  CARD_IMAGE_WIDTH,
  DETAIL_IMAGE_WIDTH,
  GALLERY_ALT,
  IMAGE_ALT,
  PUBLISHED,
  RTO_LABEL,
} from './search.messages.js';

type Spec = PublicVehicleDetail['specs'][number];

function spec(label: string, value: string | number | null | undefined): Spec[] {
  return value === null || value === undefined || value === ''
    ? []
    : [{ label, value: String(value) }];
}

function rtoOf(code: string | null): string | null {
  const match = code ? /^([A-Z]{2})(\d{2})$/.exec(code) : null;
  return match ? `${match[1]} ${match[2]}` : null;
}

export function specsOf(vehicle: DetailRow['vehicle']): Spec[] {
  return [
    ...spec(VEHICLE_FIELD_LABELS.make, vehicle.make),
    ...spec(VEHICLE_FIELD_LABELS.model, vehicle.model),
    ...spec(VEHICLE_FIELD_LABELS.variant, vehicle.variant),
    ...spec(VEHICLE_FIELD_LABELS.manufacturingYear, vehicle.manufacturingYear),
    ...spec(VEHICLE_FIELD_LABELS.registrationYear, vehicle.registrationYear),
    ...spec(RTO_LABEL, rtoOf(vehicle.rtoCode)),
    ...spec(VEHICLE_FIELD_LABELS.fuelType, vehicle.fuelType && FUEL_LABELS[vehicle.fuelType]),
    ...spec(
      VEHICLE_FIELD_LABELS.transmission,
      vehicle.transmission && TRANSMISSION_LABELS[vehicle.transmission],
    ),
    ...spec(VEHICLE_FIELD_LABELS.bodyType, vehicle.bodyType && BODY_TYPE_LABELS[vehicle.bodyType]),
    ...spec(
      VEHICLE_FIELD_LABELS.kilometersDriven,
      vehicle.kilometersDriven === null ? null : formatKm(vehicle.kilometersDriven),
    ),
    ...spec(VEHICLE_FIELD_LABELS.ownerCount, vehicle.ownerCount && ownerLabel(vehicle.ownerCount)),
    ...spec(VEHICLE_FIELD_LABELS.color, vehicle.color && VEHICLE_COLOR_LABELS[vehicle.color]),
    ...spec(
      VEHICLE_FIELD_LABELS.insuranceType,
      vehicle.insuranceType && INSURANCE_LABELS[vehicle.insuranceType],
    ),
    ...spec(
      VEHICLE_FIELD_LABELS.insuranceValidUntil,
      vehicle.insuranceValidUntil && formatDate(vehicle.insuranceValidUntil),
    ),
  ];
}

function locationOf(dealer: DetailRow['dealer']): string | null {
  const parts = [dealer.city, dealer.district].filter(
    (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

export function toPublicVehicleDetail(row: DetailRow): PublicVehicleDetail {
  const { vehicle, dealer } = row;
  const title = vehicleTitle(vehicle) || formatRegistration(vehicle.registrationNumber);
  const total = vehicle.images.length;
  const primaryIndex = Math.max(
    vehicle.images.findIndex((image) => image.isPrimary),
    0,
  );

  return {
    slug: row.slug ?? '',
    title,
    year: vehicle.manufacturingYear,
    priceLabel: vehicle.pricePaise === null ? null : formatRupees(vehicle.pricePaise),
    negotiabilityLabel: vehicle.negotiability ? NEGOTIABILITY_LABELS[vehicle.negotiability] : null,
    summary: vehicleSummary(vehicle),
    description: vehicle.description,
    specs: specsOf(vehicle),
    images: vehicle.images.map((image, index) => ({
      url: mediaUrl(image.mediaId, DETAIL_IMAGE_WIDTH),
      alt: GALLERY_ALT(title, index, total),
    })),
    primaryIndex,
    publishedLabel: row.publishedAt ? PUBLISHED(formatDate(row.publishedAt)) : null,
    dealer: {
      name: dealer.brandName,
      slug: dealer.slug,
      initials: initialsOf(dealer.brandName),
      isVerified: true,
      location: locationOf(dealer),
    },
  };
}

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
