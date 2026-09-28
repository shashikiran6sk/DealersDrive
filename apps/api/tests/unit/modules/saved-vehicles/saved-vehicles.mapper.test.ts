import type { ListingStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  savedAvailability,
  toSavedVehicle,
  type SavedRow,
} from '../../../../src/modules/saved-vehicles/saved-vehicles.mapper.js';

function row(
  status: ListingStatus,
  dealerStatus = 'ACTIVE',
  slug: string | null = 'car-1',
): SavedRow {
  return {
    id: 'saved-1',
    customerId: 'customer-1',
    listingId: 'listing-1',
    createdAt: new Date('2026-09-20T10:00:00Z'),
    listing: {
      id: 'listing-1',
      slug,
      status,
      vehicle: {
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        manufacturingYear: 2022,
        fuelType: 'PETROL',
        transmission: 'MANUAL',
        kilometersDriven: 30_000,
        pricePaise: 120_000_000n,
        registrationNumber: 'TN23AB1234',
        images: [{ mediaId: 'media-1' }],
        _count: { images: 3 },
      },
      dealer: {
        brandName: 'Sri Lakshmi Motors',
        slug: 'sri',
        city: 'Katpadi',
        district: 'Vellore',
        status: dealerStatus,
      },
    },
  } as unknown as SavedRow;
}

describe('savedAvailability (R74)', () => {
  it.each([
    ['ACTIVE', 'AVAILABLE'],
    ['RESERVED', 'RESERVED'],
    ['SOLD', 'SOLD'],
    ['WITHDRAWN', 'UNAVAILABLE'],
    ['PENDING_REVIEW', 'UNAVAILABLE'],
    ['REJECTED', 'UNAVAILABLE'],
  ] as const)('says a %s car is %s', (status, expected) => {
    expect(savedAvailability(row(status).listing)).toBe(expected);
  });

  it('says a car of a suspended dealership is no longer available, even when ACTIVE', () => {
    expect(savedAvailability(row('ACTIVE', 'SUSPENDED').listing)).toBe('UNAVAILABLE');
  });
});

describe('toSavedVehicle', () => {
  it('keeps the photograph while the car is on show', () => {
    expect(toSavedVehicle(row('RESERVED')).vehicle.image).not.toBeNull();
  });

  it('drops the photograph once the car has left, and keeps the rest of the card', () => {
    const saved = toSavedVehicle(row('SOLD'));
    expect(saved.vehicle.image).toBeNull();
    expect(saved.vehicle.title).toBe('2022 Hyundai Creta SX');
    expect(saved.savedAt).toBe('2026-09-20T10:00:00.000Z');
  });
});
