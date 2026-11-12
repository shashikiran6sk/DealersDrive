import type { DealerVehicle, DealerVehiclePhotos } from '@dealers-drive/contracts';
import { STANDARD_PHOTO_SLOTS, PHOTO_SLOT_LABELS } from '@dealers-drive/contracts';

export const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';

export function vehicle(listing: Partial<DealerVehicle['listing']> = {}): DealerVehicle {
  return {
    id: VEHICLE_ID,
    title: '2023 Hyundai Creta SX(O)',
    registrationNumber: 'TN23AB1234',
    registrationDisplay: 'TN 23 AB 1234',
    rtoCode: 'TN23',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX(O)',
    manufacturingYear: 2023,
    registrationYear: 2023,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SUV',
    kilometersDriven: 22_400,
    ownerCount: 1,
    color: 'WHITE',
    insuranceType: 'LIVE',
    pricePaise: 145_000_000,
    priceLabel: '₹14,50,000',
    negotiability: 'FIXED',
    description: null,
    summary: 'Petrol · Automatic',
    issues: [],
    complete: true,
    listing: {
      id: '33333333-3333-4333-8333-333333333333',
      status: 'DRAFT',
      statusLabel: 'Draft',
      statusTone: 'neutral',
      reason: null,
      submittedAt: null,
      publishedAt: null,
      canEdit: true,
      canSubmit: true,
      canDelete: true,
      slug: null,
      reservedAt: null,
      soldAt: null,
      withdrawnAt: null,
      withdrawal: null,
      actions: [],
      reactivation: null,
      ...listing,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

export function photos(
  overrides: Partial<DealerVehiclePhotos> = {},
  uploaded = 0,
): DealerVehiclePhotos {
  return {
    enabled: true,
    plan: null,
    canEdit: true,
    photoshoot: { available: true, district: 'Vellore' },
    slots: STANDARD_PHOTO_SLOTS.map((slot, index) => ({
      slot,
      label: PHOTO_SLOT_LABELS[slot],
      photo:
        index < uploaded
          ? {
              mediaId: `00000000-0000-4000-8000-00000000000${String(index)}`,
              slot,
              slotLabel: PHOTO_SLOT_LABELS[slot],
              url: '/mock/car.jpg',
              fileName: null,
              bytes: 1000,
              uploadedAt: '2026-11-11T09:00:00.000Z',
            }
          : null,
    })),
    extras: [],
    extrasMax: 6,
    missing: STANDARD_PHOTO_SLOTS.slice(uploaded),
    ready: false,
    ...overrides,
  };
}
