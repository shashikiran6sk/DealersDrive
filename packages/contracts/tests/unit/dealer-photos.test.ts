import { describe, expect, it } from 'vitest';

import {
  DealerPhotoPresignInput,
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  VehiclePhotoSlot,
  submittedPhotoDownloadName,
} from '../../src/index.js';

describe('the Dealers-Drive photo standard', () => {
  it('is ten shots, every slot but EXTRA, each labelled', () => {
    expect(STANDARD_PHOTO_SLOTS).toHaveLength(10);
    expect(STANDARD_PHOTO_SLOTS).not.toContain('EXTRA');
    for (const slot of VehiclePhotoSlot.options) expect(PHOTO_SLOT_LABELS[slot]).toBeTruthy();
  });

  it('names downloads as an ordered StudioCar batch', () => {
    expect(submittedPhotoDownloadName('TN23AB1234', 0, 'FRONT_THREE_QUARTER', 'image/jpeg')).toBe(
      'TN23AB1234-01-front-three-quarter.jpg',
    );
    expect(submittedPhotoDownloadName('TN23AB1234', 9, 'ODOMETER', 'image/png')).toBe(
      'TN23AB1234-10-odometer-reading.png',
    );
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
