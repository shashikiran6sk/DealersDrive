import { describe, expect, it } from 'vitest';

import {
  enquiryHistoryOf,
  toAdminEnquiryDetail,
  toAdminEnquiryRow,
  type AdminDetailSource,
  type AdminRowSource,
} from '../../../../src/modules/enquiries/enquiries.admin.mapper.js';
import {
  enquirySearch,
  enquiryWindow,
} from '../../../../src/modules/enquiries/enquiries.admin.service.js';

/**
 * R89 — the pure halves of admin oversight: how a row and a detail are
 * shaped, how the search reads a term, and how a day becomes a window.
 */
const AT = new Date('2026-09-26T09:02:00.000Z');

const ROW: AdminRowSource = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'NEW',
  message: null,
  createdAt: AT,
  customer: { id: '22222222-2222-4222-8222-222222222222', fullName: null, phone: null },
  dealer: {
    id: '33333333-3333-4333-8333-333333333333',
    brandName: 'Sri Lakshmi Motors',
    slug: 'sri',
  },
  listing: {
    id: '44444444-4444-4444-8444-444444444444',
    status: 'ACTIVE',
    vehicle: {
      manufacturingYear: null,
      make: null,
      model: null,
      variant: null,
      registrationNumber: 'TN09BX0001',
    },
  },
};

function detail(overrides: Partial<AdminDetailSource> = {}): AdminDetailSource {
  return {
    id: ROW.id,
    status: 'CLOSED',
    message: 'Hello',
    createdAt: AT,
    contactedAt: null,
    closedAt: AT,
    customer: { id: ROW.customer.id, fullName: '  ', phone: null, createdAt: AT },
    dealer: {
      id: ROW.dealer.id,
      brandName: 'Sri Lakshmi Motors',
      slug: 'sri',
      status: 'SUSPENDED',
      city: 'Vellore',
      district: 'Vellore',
      contactPhone: '+919840012345',
    },
    listing: {
      id: ROW.listing.id,
      status: 'ACTIVE',
      slug: 'a-car',
      dealer: { status: 'SUSPENDED' },
      vehicle: { ...ROW.listing.vehicle, images: [] },
    },
    ...overrides,
  };
}

describe('toAdminEnquiryRow', () => {
  it('falls back to the plate for a car with no make, and a placeholder for a nameless customer', () => {
    const row = toAdminEnquiryRow(ROW);
    expect(row.vehicle.title).toBe('TN 09 BX 0001');
    expect(row.customer).toEqual({ id: ROW.customer.id, name: 'Customer', phoneDisplay: null });
    expect(row.createdLabel).toBe('26 Sep 2026, 14:32');
    expect(row.messagePreview).toBeNull();
  });

  it('previews the first line that says something', () => {
    expect(
      toAdminEnquiryRow({ ...ROW, message: '\n  \n  Second line first  \nthird' }).messagePreview,
    ).toBe('Second line first');
    expect(toAdminEnquiryRow({ ...ROW, message: '   ' }).messagePreview).toBe('');
  });
});

describe('toAdminEnquiryDetail', () => {
  it('gives no public link while the dealership is suspended, and one place name for a repeated one', () => {
    const shaped = toAdminEnquiryDetail(detail(), []);
    expect(shaped.vehicle.publicHref).toBeNull();
    expect(shaped.dealer).toMatchObject({ location: 'Vellore', phoneDisplay: '+91 98400 12345' });
    expect(shaped.customer).toMatchObject({
      name: 'Customer',
      phoneVerified: false,
      phoneDisplay: null,
    });
    expect(shaped.customerStatusLabel).toBe('Closed');
    expect(shaped.contactedLabel).toBeNull();
  });

  it('has no location or phone for a dealership that has entered neither', () => {
    const shaped = toAdminEnquiryDetail(
      detail({
        dealer: { ...detail().dealer, city: null, district: ' ', contactPhone: null },
      }),
      [],
    );
    expect(shaped.dealer).toMatchObject({ location: null, phoneDisplay: null });
  });

  it('has no public link for a listing with no slug', () => {
    const live = detail();
    const shaped = toAdminEnquiryDetail(
      detail({ listing: { ...live.listing, slug: null, dealer: { status: 'ACTIVE' } } }),
      [],
    );
    expect(shaped.vehicle.publicHref).toBeNull();
  });
});

describe('enquiryHistoryOf', () => {
  it('reads statuses from the trail, and names what it does not recognise as it was recorded', () => {
    const history = enquiryHistoryOf([
      {
        action: 'enquiry.closed',
        actorType: 'DEALER',
        before: { status: 'NEW' },
        after: { status: 'CLOSED' },
        createdAt: AT,
      },
      {
        action: 'enquiry.archived',
        actorType: 'ROBOT',
        before: null,
        after: ['CLOSED'],
        createdAt: AT,
      },
      {
        action: 'enquiry.reopened',
        actorType: 'ADMIN',
        before: { status: 'BOGUS' },
        after: 'NEW',
        createdAt: AT,
      },
    ]);
    expect(
      history.map((entry) => [entry.label, entry.actor, entry.fromStatus, entry.toStatus]),
    ).toEqual([
      ['Closed', 'Dealer', 'NEW', 'CLOSED'],
      ['enquiry.archived', 'ROBOT', null, null],
      ['Reopened', 'Dealers-Drive', null, null],
    ]);
  });
});

describe('enquirySearch', () => {
  it('is nothing for a blank term', () => {
    expect(enquirySearch(undefined)).toBeNull();
    expect(enquirySearch('   ')).toBeNull();
  });

  it('adds the phone only from three digits, and the plate only when there is one', () => {
    expect(enquirySearch('Meera')?.OR).toHaveLength(5);
    expect(enquirySearch('98')?.OR).toHaveLength(5);
    expect(enquirySearch('984')?.OR).toHaveLength(6);
    expect(enquirySearch('—')?.OR).toHaveLength(4);
    expect(JSON.stringify(enquirySearch('984 00'))).toContain('"contains":"98400"');
  });
});

describe('enquiryWindow', () => {
  it('turns IST days into an instant range, the last day inclusive', () => {
    expect(enquiryWindow(undefined, undefined)).toBeNull();
    expect(enquiryWindow('2026-09-26', '2026-09-26')).toEqual({
      createdAt: {
        gte: new Date('2026-09-25T18:30:00.000Z'),
        lt: new Date('2026-09-26T18:30:00.000Z'),
      },
    });
  });
});
