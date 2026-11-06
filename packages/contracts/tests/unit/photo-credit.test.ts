import { describe, expect, it } from 'vitest';

import {
  CommitVehicleImageInput,
  PHOTO_CREDIT_LABELS,
  PhotoCredit,
  ReplaceVehicleImageInput,
  SetVehicleImageCreditInput,
} from '../../src/moderation.js';
import { summarisePhotoCredit } from '../../src/public.js';

const MEDIA = '3f1d2c4b-5a69-4f70-8e9d-0a1b2c3d4e5f';

describe('PhotoCredit', () => {
  it('names the two photographers and labels both', () => {
    expect(PhotoCredit.options).toEqual(['DEALERS_DRIVE', 'DEALER']);
    expect(PHOTO_CREDIT_LABELS).toEqual({ DEALERS_DRIVE: 'Dealers-Drive', DEALER: 'Dealer' });
  });

  it('requires a credit to attach an image, and refuses anything else', () => {
    expect(CommitVehicleImageInput.parse({ credit: 'DEALER' })).toEqual({ credit: 'DEALER' });
    expect(CommitVehicleImageInput.safeParse({}).success).toBe(false);
    expect(CommitVehicleImageInput.safeParse({ credit: 'STUDIO' }).success).toBe(false);
    expect(CommitVehicleImageInput.safeParse({ credit: 'DEALER', extra: 1 }).success).toBe(false);
  });

  it('lets a replacement keep the old credit by leaving it out', () => {
    expect(ReplaceVehicleImageInput.parse({ replacementMediaId: MEDIA })).toEqual({
      replacementMediaId: MEDIA,
    });
    expect(
      ReplaceVehicleImageInput.parse({ replacementMediaId: MEDIA, credit: 'DEALERS_DRIVE' }),
    ).toEqual({ replacementMediaId: MEDIA, credit: 'DEALERS_DRIVE' });
  });

  it('requires the credit when correcting one', () => {
    expect(SetVehicleImageCreditInput.safeParse({}).success).toBe(false);
    expect(SetVehicleImageCreditInput.parse({ credit: 'DEALER' })).toEqual({ credit: 'DEALER' });
  });
});

describe('summarisePhotoCredit', () => {
  it('claims nobody for a car without photographs', () => {
    expect(summarisePhotoCredit([])).toBeNull();
  });

  it('names the one photographer when every photograph agrees', () => {
    expect(summarisePhotoCredit(['DEALERS_DRIVE', 'DEALERS_DRIVE'])).toBe('DEALERS_DRIVE');
    expect(summarisePhotoCredit(['DEALER'])).toBe('DEALER');
  });

  it('says mixed when both took some', () => {
    expect(summarisePhotoCredit(['DEALERS_DRIVE', 'DEALER', 'DEALERS_DRIVE'])).toBe('MIXED');
  });

  it('claims nobody while any photograph is unrecorded', () => {
    expect(summarisePhotoCredit(['DEALERS_DRIVE', null])).toBeNull();
    expect(summarisePhotoCredit([null])).toBeNull();
  });
});
