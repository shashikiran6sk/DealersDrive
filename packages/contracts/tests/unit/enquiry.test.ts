import { describe, expect, it } from 'vitest';

import {
  CreateEnquiryInput,
  CustomerEnquiryQuery,
  CustomerEnquiryStatus,
  customerEnquiryStatus,
  DealerEnquiryQuery,
  UpdateEnquiryInput,
} from '../../src/enquiry.js';
import { ENQUIRY_STATUS_LABELS, ENQUIRY_STATUS_TONES, EnquiryStatus } from '../../src/enums.js';

/**
 * What a customer may say when they enquire (**R64**): which car, and
 * optionally a line of text. Nothing about who they are, and nothing about
 * which dealership — both are derived, so neither can be sent.
 */
describe('CreateEnquiryInput', () => {
  it('takes a car and a message', () => {
    expect(
      CreateEnquiryInput.parse({ listingSlug: ' car-1 ', message: '  Can I visit?  ' }),
    ).toEqual({ listingSlug: 'car-1', message: 'Can I visit?' });
  });

  it.each([{}, { message: '' }, { message: '  \n ' }])('treats %j as no message', (extra) => {
    expect(CreateEnquiryInput.parse({ listingSlug: 'car-1', ...extra }).message).toBeUndefined();
  });

  it.each(['customerPhone', 'customerName', 'dealerId', 'customerId', 'status'])(
    'refuses %s by name',
    (field) => {
      const result = CreateEnquiryInput.safeParse({ listingSlug: 'car-1', [field]: 'x' });
      expect(result.success).toBe(false);
    },
  );

  it('refuses a missing car and an essay', () => {
    expect(CreateEnquiryInput.safeParse({ listingSlug: ' ' }).success).toBe(false);
    expect(
      CreateEnquiryInput.safeParse({ listingSlug: 'car-1', message: 'x'.repeat(1001) }).success,
    ).toBe(false);
  });
});

describe('the dealership’s inbox (R66)', () => {
  it('lists every tab by default, twenty-five at a time', () => {
    expect(DealerEnquiryQuery.parse({})).toEqual({ limit: 25 });
    expect(DealerEnquiryQuery.parse({ status: 'SPAM', limit: '10' })).toEqual({
      status: 'SPAM',
      limit: 10,
    });
  });

  it.each([{ status: 'OPEN' }, { dealerId: 'x' }, { limit: '0' }, { limit: '101' }])(
    'refuses %j as a query',
    (query) => {
      expect(DealerEnquiryQuery.safeParse(query).success).toBe(false);
    },
  );

  it('moves an enquiry by status and nothing else', () => {
    expect(UpdateEnquiryInput.parse({ status: 'CONTACTED' })).toEqual({ status: 'CONTACTED' });
    expect(UpdateEnquiryInput.safeParse({ status: 'CONTACTED', message: 'x' }).success).toBe(false);
    expect(UpdateEnquiryInput.safeParse({}).success).toBe(false);
  });

  it('gives every status a label and a tone', () => {
    for (const status of EnquiryStatus.options) {
      expect(ENQUIRY_STATUS_LABELS[status]).toEqual(expect.any(String));
      expect(ENQUIRY_STATUS_TONES[status]).toEqual(expect.any(String));
    }
  });
});

describe('a customer’s own enquiries (R68)', () => {
  it.each([
    ['NEW', 'SENT'],
    ['CONTACTED', 'CONTACTED'],
    ['CLOSED', 'CLOSED'],
    ['SPAM', 'CLOSED'],
  ] as const)('shows %s to the customer as %s', (status, shown) => {
    expect(customerEnquiryStatus(status)).toBe(shown);
  });

  it('never has a spam state a customer could be shown', () => {
    expect(CustomerEnquiryStatus.options).toEqual(['SENT', 'CONTACTED', 'CLOSED']);
  });

  it('pages twenty at a time and refuses anything else in the query', () => {
    expect(CustomerEnquiryQuery.parse({})).toEqual({ limit: 20 });
    expect(CustomerEnquiryQuery.safeParse({ status: 'SPAM' }).success).toBe(false);
    expect(CustomerEnquiryQuery.safeParse({ customerId: 'x' }).success).toBe(false);
  });
});
