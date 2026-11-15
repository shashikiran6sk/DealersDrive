import {
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  submittedPhotoDownloadName,
  type AdminSubmittedPhotos,
  type DealerSubmissionPhoto,
  type DealerVehiclePhotos,
} from '@dealers-drive/contracts';

function sampleUrl(slot: DealerSubmissionPhoto['slot']): string {
  const shot = STANDARD_PHOTO_SLOTS.findIndex((standard) => standard === slot);
  const number = String(shot < 0 ? 1 : shot + 1).padStart(2, '0');
  return `/photo-guide/shot-${number}-result.webp`;
}

function photo(index: number, slot: DealerSubmissionPhoto['slot']): DealerSubmissionPhoto {
  return {
    mediaId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    slot,
    slotLabel: PHOTO_SLOT_LABELS[slot],
    url: sampleUrl(slot),
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
    unsorted: [],
    unsortedMax: 16,
    missing: STANDARD_PHOTO_SLOTS.slice(uploaded),
    ready: uploaded === 10,
    ...overrides,
  };
}

export function mockSubmitted(overrides: Partial<AdminSubmittedPhotos> = {}): AdminSubmittedPhotos {
  return {
    plan: 'DEALER',
    planLabel: 'Dealer uploads the photographs',
    archiveName: '2016-hyundai-creta-sx.zip',
    items: STANDARD_PHOTO_SLOTS.map((slot, index) => ({
      ...photo(index, slot),
      downloadName: submittedPhotoDownloadName('2016-hyundai-creta-sx', index, slot, 'image/jpeg'),
      mimeType: 'image/jpeg',
    })),
    missing: [],
    ...overrides,
  };
}

export function mockUnsorted(count: number): DealerSubmissionPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    ...photo(index, 'UNSORTED'),
    fileName: `IMG_2026111${String(5 + Math.floor(index / 10))}_10${String(index).padStart(2, '0')}12.jpg`,
  }));
}
