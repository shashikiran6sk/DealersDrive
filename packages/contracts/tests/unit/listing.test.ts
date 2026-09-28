import { describe, expect, it } from 'vitest';

import { ListingStatus, WithdrawalReason } from '../../src/enums.js';
import {
  LISTING_LIFECYCLE_FROM,
  ListingLifecycleAction,
  PUBLIC_AVAILABILITY_LABELS,
  PublicAvailability,
  isListingAvailable,
  isListingPubliclyVisible,
  publicAvailabilityOf,
  WithdrawListingInput,
  displayStatusOf,
  lifecycleActionsOf,
  withdrawalReasonLabel,
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

  it('shows ACTIVE and RESERVED on the marketplace, and lets a buyer act only on ACTIVE (R71)', () => {
    expect(ListingStatus.options.filter(isListingPubliclyVisible)).toEqual(['ACTIVE', 'RESERVED']);
    expect(ListingStatus.options.filter(isListingAvailable)).toEqual(['ACTIVE']);
  });

  it('tells a buyer how every status stands, never naming an internal one', () => {
    expect(
      Object.fromEntries(ListingStatus.options.map((s) => [s, publicAvailabilityOf(s)])),
    ).toEqual({
      DRAFT: 'UNAVAILABLE',
      PENDING_REVIEW: 'UNAVAILABLE',
      CHANGES_REQUESTED: 'UNAVAILABLE',
      ACTIVE: 'AVAILABLE',
      RESERVED: 'RESERVED',
      REJECTED: 'UNAVAILABLE',
      SOLD: 'SOLD',
      WITHDRAWN: 'UNAVAILABLE',
    });
    expect(PublicAvailability.options.map((a) => PUBLIC_AVAILABILITY_LABELS[a])).toEqual([
      'Available',
      'Reserved',
      'Sold',
      'No longer available',
    ]);
  });

  it('labels every status for a dealer, with the badge the design gives it', () => {
    expect(ListingStatus.options.map(listingStatusLabel)).toEqual([
      'Draft',
      'Pending review',
      'Changes requested',
      'Active',
      'Reserved',
      'Rejected',
      'Sold',
      'Withdrawn',
    ]);
    expect(listingStatusTone('ACTIVE')).toBe('ok');
    expect(listingStatusTone('PENDING_REVIEW')).toBe('warn');
    expect(listingStatusTone('REJECTED')).toBe('err');
    expect(displayStatusOf('PENDING_REVIEW')).toBe('PENDING');
    expect(displayStatusOf('SOLD')).toBe('SOLD');
    expect(listingStatusTone('RESERVED')).toBe('warn');
    expect(listingStatusTone('WITHDRAWN')).toBe('neutral');
  });
});

describe('the lifecycle a dealership drives once a listing has been live (R69)', () => {
  it('offers exactly the moves the product names, for each status', () => {
    const offered = Object.fromEntries(
      ListingStatus.options.map((status) => [status, lifecycleActionsOf(status)]),
    );
    expect(offered).toEqual({
      DRAFT: [],
      PENDING_REVIEW: [],
      CHANGES_REQUESTED: [],
      ACTIVE: ['reserve', 'markSold', 'withdraw'],
      RESERVED: ['reactivate', 'markSold', 'withdraw'],
      REJECTED: [],
      SOLD: [],
      WITHDRAWN: ['relist'],
    });
  });

  it('has no way back from SOLD', () => {
    expect(lifecycleActionsOf('SOLD')).toEqual([]);
    for (const action of ListingLifecycleAction.options) {
      expect(LISTING_LIFECYCLE_FROM[action]).not.toContain('SOLD');
    }
  });

  it('labels every withdrawal reason in sentence case', () => {
    for (const reason of WithdrawalReason.options) {
      const label = withdrawalReasonLabel(reason);
      expect(label).toBeTruthy();
      expect(label).not.toContain('_');
    }
  });

  it('takes a withdrawal reason and an optional note, and nothing else', () => {
    expect(WithdrawListingInput.parse({ reason: 'VEHICLE_ISSUE' })).toEqual({
      reason: 'VEHICLE_ISSUE',
    });
    expect(
      WithdrawListingInput.parse({ reason: 'OTHER', note: '  Waiting on the RC transfer. ' }),
    ).toEqual({ reason: 'OTHER', note: 'Waiting on the RC transfer.' });
    expect(WithdrawListingInput.safeParse({}).success).toBe(false);
    expect(WithdrawListingInput.safeParse({ reason: 'BORED' }).success).toBe(false);
    expect(WithdrawListingInput.safeParse({ reason: 'OTHER', note: 'x'.repeat(501) }).success).toBe(
      false,
    );
    expect(WithdrawListingInput.safeParse({ reason: 'OTHER', status: 'ACTIVE' }).success).toBe(
      false,
    );
  });
});
