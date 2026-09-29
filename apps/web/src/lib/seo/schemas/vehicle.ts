import type { PublicAvailability, PublicVehicleDetail } from '@dealers-drive/contracts';

import type { JsonLdNode } from '../json-ld';
import { CURRENCY, KILOMETRE_UNIT } from '../seo.constants';
import { absoluteUrl } from '../site';
import { dealerId } from './dealer';

const AVAILABILITY: Record<PublicAvailability, string> = {
  AVAILABLE: 'https://schema.org/InStock',
  RESERVED: 'https://schema.org/Reserved',
  SOLD: 'https://schema.org/SoldOut',
  UNAVAILABLE: 'https://schema.org/OutOfStock',
};

const USED_CONDITION = 'https://schema.org/UsedCondition';

export function vehiclePath(slug: string): string {
  return `/car/${encodeURIComponent(slug)}`;
}

export function vehicleId(slug: string): string {
  return absoluteUrl(`${vehiclePath(slug)}#vehicle`);
}

export function rupeesOf(paise: number): number {
  return Math.round(paise / 100);
}

function inPrimaryOrder(vehicle: PublicVehicleDetail): string[] {
  const primary = vehicle.images[vehicle.primaryIndex];
  const rest = vehicle.images.filter((_, index) => index !== vehicle.primaryIndex);
  return (primary ? [primary, ...rest] : rest).map((image) => image.url);
}

function offerOf(vehicle: PublicVehicleDetail, url: string): JsonLdNode | undefined {
  const { pricePaise } = vehicle.facts;
  if (pricePaise === null) return undefined;
  return {
    '@type': 'Offer',
    url,
    price: rupeesOf(pricePaise),
    priceCurrency: CURRENCY,
    availability: AVAILABILITY[vehicle.availability],
    itemCondition: USED_CONDITION,
    seller: {
      '@type': 'AutoDealer',
      '@id': dealerId(vehicle.dealer.slug),
      name: vehicle.dealer.name,
      url: absoluteUrl(`/dealers/${encodeURIComponent(vehicle.dealer.slug)}`),
    },
  };
}

export function vehicleSchema(vehicle: PublicVehicleDetail): JsonLdNode {
  const url = absoluteUrl(vehiclePath(vehicle.slug));
  const { facts } = vehicle;
  const images = inPrimaryOrder(vehicle);

  return {
    '@type': 'Car',
    '@id': vehicleId(vehicle.slug),
    name: vehicle.title,
    url,
    description: vehicle.description ?? undefined,
    image: images.length > 0 ? images : undefined,
    brand: facts.make ? { '@type': 'Brand', name: facts.make } : undefined,
    model: facts.model ?? undefined,
    vehicleConfiguration: facts.variant ?? undefined,
    vehicleModelDate: vehicle.year === null ? undefined : String(vehicle.year),
    bodyType: facts.bodyType ?? undefined,
    fuelType: facts.fuelType ?? undefined,
    vehicleTransmission: facts.transmission ?? undefined,
    color: facts.color ?? undefined,
    mileageFromOdometer:
      facts.kilometersDriven === null
        ? undefined
        : { '@type': 'QuantitativeValue', value: facts.kilometersDriven, unitCode: KILOMETRE_UNIT },
    numberOfPreviousOwners: facts.ownerCount ?? undefined,
    itemCondition: USED_CONDITION,
    offers: offerOf(vehicle, url),
  };
}
