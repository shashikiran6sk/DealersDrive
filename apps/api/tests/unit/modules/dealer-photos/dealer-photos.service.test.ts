import { STANDARD_PHOTO_SLOTS } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import {
  inShootingOrder,
  missingSlots,
  slotOfKey,
  submissionPhotoKey,
  submittedPhotosArchiveKey,
} from '../../../../src/modules/dealer-photos/dealer-photos.service.js';

const VEHICLE = '11111111-1111-4111-8111-111111111111';
const MEDIA = '22222222-2222-4222-8222-222222222222';

describe('submitted photograph keys', () => {
  it('carries the slot in a key the server chose, and reads it back', () => {
    const key = submissionPhotoKey(VEHICLE, MEDIA, 'FRONT_THREE_QUARTER_LEFT', 'image/jpeg');
    expect(key).toBe(`vehicles/${VEHICLE}/submitted/${MEDIA}/front_three_quarter_left.jpg`);
    expect(slotOfKey(key)).toBe('FRONT_THREE_QUARTER_LEFT');
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

describe('shooting order', () => {
  it('sorts by the guide’s order, extras last in the order they came', () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 10, 15, 9, minute));
    const ordered = inShootingOrder([
      { slot: 'EXTRA' as const, createdAt: at(1) },
      { slot: 'ODOMETER' as const, createdAt: at(2) },
      { slot: 'EXTRA' as const, createdAt: at(0) },
      { slot: 'FRONT_THREE_QUARTER_RIGHT' as const, createdAt: at(3) },
    ]);
    expect(ordered.map((row) => `${row.slot}@${String(row.createdAt.getUTCMinutes())}`)).toEqual([
      'FRONT_THREE_QUARTER_RIGHT@3',
      'ODOMETER@2',
      'EXTRA@0',
      'EXTRA@1',
    ]);
  });

  it('keys an archive by what is in it, so a changed set is a new archive', () => {
    const listing = '33333333-3333-4333-8333-333333333333';
    const one = submittedPhotosArchiveKey(listing, ['a:x.jpg']);
    expect(one).toMatch(new RegExp(`^archives/submitted-photos/${listing}/[0-9a-f]{24}\\.zip$`));
    expect(submittedPhotosArchiveKey(listing, ['a:x.jpg'])).toBe(one);
    expect(submittedPhotosArchiveKey(listing, ['a:x.jpg', 'b:y.jpg'])).not.toBe(one);
  });
});
