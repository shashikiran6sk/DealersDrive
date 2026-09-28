import { describe, expect, it } from 'vitest';

import { CreateEnquiryInput } from '../../src/enquiry.js';

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
