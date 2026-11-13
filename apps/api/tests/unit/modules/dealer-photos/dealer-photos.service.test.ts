import { STANDARD_PHOTO_SLOTS } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import {
  missingSlots,
  slotOfKey,
  submissionPhotoKey,
} from '../../../../src/modules/dealer-photos/dealer-photos.service.js';

const VEHICLE = '11111111-1111-4111-8111-111111111111';
const MEDIA = '22222222-2222-4222-8222-222222222222';

describe('submitted photograph keys', () => {
  it('carries the slot in a key the server chose, and reads it back', () => {
    const key = submissionPhotoKey(VEHICLE, MEDIA, 'REAR_THREE_QUARTER', 'image/jpeg');
    expect(key).toBe(`vehicles/${VEHICLE}/submitted/${MEDIA}/rear_three_quarter.jpg`);
    expect(slotOfKey(key)).toBe('REAR_THREE_QUARTER');
  });

  it('reads no slot from a key that is not a submission', () => {
    expect(slotOfKey(`vehicles/${VEHICLE}/${MEDIA}/original.jpg`)).toBeNull();
    expect(slotOfKey(`vehicles/${VEHICLE}/submitted/${MEDIA}/sunroof.jpg`)).toBeNull();
  });
});

describe('what is missing', () => {
  it('lists every standard slot without a photograph, in walk-round order, ignoring extras', () => {
    expect(missingSlots([])).toEqual(STANDARD_PHOTO_SLOTS);
    expect(missingSlots([{ slot: 'FRONT' }, { slot: 'EXTRA' }])).toEqual(
      STANDARD_PHOTO_SLOTS.filter((slot) => slot !== 'FRONT'),
    );
  });
});
