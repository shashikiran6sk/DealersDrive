import { describe, expect, it } from 'vitest';

import {
  DealerPhotoPresignInput,
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  VehiclePhotoSlot,
  isStandardPhotoSlot,
  photoShortfall,
  submittedPhotoDownloadName,
  submittedPhotosArchiveName,
  vehicleFileBase,
} from '../../src/index.js';

describe('the Dealers-Drive photo standard', () => {
  it('is ten shots, every slot but UNSORTED and EXTRA, each labelled', () => {
    expect(STANDARD_PHOTO_SLOTS).toHaveLength(10);
    expect(STANDARD_PHOTO_SLOTS).not.toContain('EXTRA');
    for (const slot of VehiclePhotoSlot.options) expect(PHOTO_SLOT_LABELS[slot]).toBeTruthy();
  });

  it('follows the confirmed guide: two front three-quarters, seats before the dashboard', () => {
    expect(STANDARD_PHOTO_SLOTS).toEqual([
      'FRONT_THREE_QUARTER_RIGHT',
      'FRONT',
      'FRONT_THREE_QUARTER_LEFT',
      'LEFT_SIDE',
      'REAR',
      'RIGHT_SIDE',
      'FRONT_SEATS',
      'REAR_SEATS',
      'DASHBOARD',
      'ODOMETER',
    ]);
  });

  it('names files for the car as the dealer listed it, in shooting order', () => {
    const base = vehicleFileBase({
      manufacturingYear: 2016,
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      registrationNumber: 'TN23AB1234',
    });
    expect(base).toBe('2016-hyundai-creta-sx-o');
    expect(submittedPhotoDownloadName(base, 0, 'FRONT_THREE_QUARTER_RIGHT', 'image/jpeg')).toBe(
      '2016-hyundai-creta-sx-o-01-front-three-quarter-driver-side.jpg',
    );
    expect(submittedPhotoDownloadName(base, 9, 'ODOMETER', 'image/png')).toBe(
      '2016-hyundai-creta-sx-o-10-odometer.png',
    );
    expect(submittedPhotosArchiveName(base)).toBe('2016-hyundai-creta-sx-o.zip');
  });

  it('falls back to the registration for a car with no name yet', () => {
    expect(
      vehicleFileBase({
        manufacturingYear: 2016,
        make: null,
        model: null,
        variant: null,
        registrationNumber: 'TN23AB1234',
      }),
    ).toBe('tn23ab1234');
  });

  it('takes a slot and a file, never a path or a vehicle', () => {
    const upload = { slot: 'FRONT', fileName: 'a.jpg', mimeType: 'image/jpeg', bytes: 10 };
    expect(DealerPhotoPresignInput.safeParse(upload).success).toBe(true);
    expect(DealerPhotoPresignInput.safeParse({ ...upload, key: 'x' }).success).toBe(false);
    expect(DealerPhotoPresignInput.safeParse({ ...upload, mimeType: 'image/gif' }).success).toBe(
      false,
    );
  });
});

describe('photoShortfall', () => {
  it('asks for every missing shot while the photos are uploaded shot by shot', () => {
    expect(photoShortfall(['FRONT', 'EXTRA'])).toEqual({
      missing: STANDARD_PHOTO_SLOTS.filter((slot) => slot !== 'FRONT'),
      needed: 9,
    });
    expect(photoShortfall([...STANDARD_PHOTO_SLOTS])).toEqual({ missing: [], needed: 0 });
  });

  it('counts ten photographs in total once any was uploaded all at once', () => {
    const unsorted = (count: number) => Array.from({ length: count }, () => 'UNSORTED' as const);
    expect(photoShortfall(unsorted(7)).needed).toBe(3);
    expect(photoShortfall([...unsorted(8), 'FRONT', 'REAR'])).toEqual({ missing: [], needed: 0 });
    expect(photoShortfall([...unsorted(9), 'EXTRA']).needed).toBe(1);
  });

  it('never treats an unsorted or extra photo as one of the ten shots', () => {
    expect(isStandardPhotoSlot('UNSORTED')).toBe(false);
    expect(isStandardPhotoSlot('EXTRA')).toBe(false);
    expect(STANDARD_PHOTO_SLOTS).toHaveLength(10);
    expect(STANDARD_PHOTO_SLOTS).not.toContain('UNSORTED');
  });
});
