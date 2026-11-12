import {
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  type AdminSubmittedPhotos,
  type DealerSubmissionPhoto,
  type DealerVehiclePhotos,
} from '@dealers-drive/contracts';

const SHADES = ['1f2937', '374151', '4b5563', '0f172a', '1e293b', '334155'];

function photo(index: number, slot: DealerSubmissionPhoto['slot']): DealerSubmissionPhoto {
  const shade = SHADES[index % SHADES.length] ?? '1f2937';
  return {
    mediaId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    slot,
    slotLabel: PHOTO_SLOT_LABELS[slot],
    url: `https://placehold.co/800x600/${shade}/e5e7eb.png?text=${encodeURIComponent(PHOTO_SLOT_LABELS[slot])}`,
    fileName: `IMG_20${String(index)}.jpg`,
    bytes: 2_400_000,
    uploadedAt: '2026-11-11T09:00:00.000Z',
  };
}

export function mockPhotos(
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
      photo: index < uploaded ? photo(index, slot) : null,
    })),
    extras: [],
    extrasMax: 6,
    missing: STANDARD_PHOTO_SLOTS.slice(uploaded),
    ready: uploaded === 10,
    ...overrides,
  };
}

export function mockSubmitted(overrides: Partial<AdminSubmittedPhotos> = {}): AdminSubmittedPhotos {
  return {
    plan: 'DEALER',
    planLabel: 'Dealer uploads the photographs',
    items: STANDARD_PHOTO_SLOTS.map((slot, index) => ({
      ...photo(index, slot),
      downloadName: `TN23AB1234-${String(index + 1).padStart(2, '0')}-${slot.toLowerCase().replaceAll('_', '-')}.jpg`,
      mimeType: 'image/jpeg',
    })),
    missing: [],
    ...overrides,
  };
}
