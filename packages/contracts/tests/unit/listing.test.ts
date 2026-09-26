import { describe, expect, it } from 'vitest';

import { ListingStatus } from '../../src/enums.js';
import {
  LISTING_PUBLIC_STATUS,
  displayStatusOf,
  isListingDeletable,
  isListingEditable,
  isListingSubmittable,
  listingStatusLabel,
  listingStatusTone,
} from '../../src/listing.js';

describe('what a listing status means', () => {
  it('lets a dealer edit and submit only a draft or a listing sent back to them', () => {
    const editable = ListingStatus.options.filter(isListingEditable);
    expect(editable).toEqual(['DRAFT', 'CHANGES_REQUESTED']);
    expect(ListingStatus.options.filter(isListingSubmittable)).toEqual(editable);
  });

  it('lets a dealer throw away only a draft that was never submitted', () => {
    expect(ListingStatus.options.filter(isListingDeletable)).toEqual(['DRAFT']);
  });

  it('makes only ACTIVE public', () => {
    expect(LISTING_PUBLIC_STATUS).toBe('ACTIVE');
  });

  it('labels every status for a dealer, with the badge the design gives it', () => {
    expect(ListingStatus.options.map(listingStatusLabel)).toEqual([
      'Draft',
      'Pending review',
      'Changes requested',
      'Active',
      'Rejected',
      'Sold',
      'Removed',
    ]);
    expect(listingStatusTone('ACTIVE')).toBe('ok');
    expect(listingStatusTone('PENDING_REVIEW')).toBe('warn');
    expect(listingStatusTone('REJECTED')).toBe('err');
    expect(displayStatusOf('PENDING_REVIEW')).toBe('PENDING');
    expect(displayStatusOf('SOLD')).toBe('SOLD');
  });
});
