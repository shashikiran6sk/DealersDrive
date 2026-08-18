import { describe, expect, it } from 'vitest';

import {
  CreateEnquiryInput,
  DealerDirectoryQuery,
  HomeQuery,
  RevealContactInput,
  SimilarQuery,
  VehicleBatchInput,
  VehicleQuery,
} from '../../src/public.js';

/**
 * The A2 query grammar and the public form inputs — everything an anonymous
 * caller can send.
 *
 * Two things here do real work rather than describing a shape.
 *
 * **The CSV transforms.** A URL cannot carry an array, so `?make=maruti,kia`
 * arrives as one string and leaves as two slugs. The pipe after the transform
 * is what stops `?make=<script>` becoming a two-element array containing a
 * script tag — the regex runs on the split parts, not on the raw string.
 *
 * **`.strict()`.** `?lmit=5` is a 400 naming the key, never a silent fallback
 * to page one (§9.2). Silent ignoring is how a frontend typo survives for
 * months, which is the whole argument for the rule.
 */

describe('VehicleQuery defaults', () => {
  it('fills in sort, page and limit for a bare request', () => {
    expect(VehicleQuery.parse({})).toEqual({ sort: 'relevance', page: 1, limit: 24 });
  });

  it('defaults to relevance, which is the "Recommended" ordering', () => {
    expect(VehicleQuery.parse({}).sort).toBe('relevance');
  });

  it('coerces the page and limit a URL carries as strings', () => {
    expect(VehicleQuery.parse({ page: '3', limit: '12' })).toMatchObject({ page: 3, limit: 12 });
  });
});

describe('VehicleQuery bounds', () => {
  /** A page cap and a limit cap together bound the worst query a scraper can ask for. */
  it('caps the limit at 48', () => {
    expect(VehicleQuery.safeParse({ limit: 48 }).success).toBe(true);
    expect(VehicleQuery.safeParse({ limit: 49 }).success).toBe(false);
  });

  it('caps the page at 40', () => {
    expect(VehicleQuery.safeParse({ page: 40 }).success).toBe(true);
    expect(VehicleQuery.safeParse({ page: 41 }).success).toBe(false);
  });

  it('refuses page zero and negative pages', () => {
    expect(VehicleQuery.safeParse({ page: 0 }).success).toBe(false);
    expect(VehicleQuery.safeParse({ page: -1 }).success).toBe(false);
  });

  it('refuses a fractional page', () => {
    expect(VehicleQuery.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it('bounds the year to something a car could have been made in', () => {
    expect(VehicleQuery.safeParse({ yearMin: 1949 }).success).toBe(false);
    expect(VehicleQuery.safeParse({ yearMin: 1950 }).success).toBe(true);
    expect(VehicleQuery.safeParse({ yearMax: 2101 }).success).toBe(false);
  });

  it('refuses a negative price or odometer reading', () => {
    expect(VehicleQuery.safeParse({ priceMin: -1 }).success).toBe(false);
    expect(VehicleQuery.safeParse({ kmMax: -1 }).success).toBe(false);
  });

  it('accepts zero as a lower bound, which is a real filter', () => {
    expect(VehicleQuery.parse({ priceMin: 0 })).toMatchObject({ priceMin: 0 });
  });

  it('bounds seats to what a passenger vehicle has', () => {
    expect(VehicleQuery.safeParse({ seats: 1 }).success).toBe(false);
    expect(VehicleQuery.safeParse({ seats: 7 }).success).toBe(true);
    expect(VehicleQuery.safeParse({ seats: 11 }).success).toBe(false);
  });

  it('bounds the airbag count', () => {
    expect(VehicleQuery.safeParse({ airbagsMin: 0 }).success).toBe(true);
    expect(VehicleQuery.safeParse({ airbagsMin: 13 }).success).toBe(false);
  });

  it('caps free text, so a query string cannot carry a payload', () => {
    expect(VehicleQuery.safeParse({ q: 'x'.repeat(120) }).success).toBe(true);
    expect(VehicleQuery.safeParse({ q: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('the CSV multi-selects', () => {
  it('splits a comma-separated list into slugs', () => {
    expect(VehicleQuery.parse({ make: 'maruti-suzuki,hyundai' }).make).toEqual([
      'maruti-suzuki',
      'hyundai',
    ]);
  });

  it('reads a single value as a one-element list', () => {
    expect(VehicleQuery.parse({ model: 'swift' }).model).toEqual(['swift']);
  });

  it('trims the spaces a hand-written URL picks up', () => {
    expect(VehicleQuery.parse({ make: 'maruti-suzuki , hyundai' }).make).toEqual([
      'maruti-suzuki',
      'hyundai',
    ]);
  });

  it('drops the empty entry a trailing comma leaves', () => {
    expect(VehicleQuery.parse({ make: 'hyundai,' }).make).toEqual(['hyundai']);
  });

  it('refuses a list that is empty after splitting', () => {
    expect(VehicleQuery.safeParse({ make: ',' }).success).toBe(false);
    expect(VehicleQuery.safeParse({ make: '' }).success).toBe(false);
  });

  it('caps a list at 20 entries', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `make-${i}`).join(',');
    const twentyOne = Array.from({ length: 21 }, (_, i) => `make-${i}`).join(',');

    expect(VehicleQuery.safeParse({ make: twenty }).success).toBe(true);
    expect(VehicleQuery.safeParse({ make: twentyOne }).success).toBe(false);
  });

  /**
   * The regex runs on the *split parts*, so a payload cannot ride in as one
   * element of an otherwise valid list.
   */
  it('validates each part, so a hostile entry fails the whole filter', () => {
    expect(VehicleQuery.safeParse({ make: 'hyundai,<script>' }).success).toBe(false);
    expect(VehicleQuery.safeParse({ make: "hyundai,'; DROP TABLE" }).success).toBe(false);
  });

  it('refuses an upper-cased slug, because slugs are lower-case', () => {
    expect(VehicleQuery.safeParse({ make: 'Hyundai' }).success).toBe(false);
  });

  it('accepts lower-case words with underscores for the enum-backed facets', () => {
    expect(VehicleQuery.parse({ fuel: 'petrol,diesel' }).fuel).toEqual(['petrol', 'diesel']);
    expect(VehicleQuery.parse({ bodyType: 'body_type' }).bodyType).toEqual(['body_type']);
  });

  it('refuses a hyphen where the facet grammar expects a word', () => {
    expect(VehicleQuery.safeParse({ fuel: 'petrol-diesel' }).success).toBe(false);
  });

  /** Owner counts are single digits, and the transform hands back numbers. */
  it('parses the owner filter into numbers, not strings', () => {
    expect(VehicleQuery.parse({ owners: '1,2' }).owners).toEqual([1, 2]);
  });

  it('refuses a zeroth owner or a two-digit one', () => {
    expect(VehicleQuery.safeParse({ owners: '0' }).success).toBe(false);
    expect(VehicleQuery.safeParse({ owners: '10' }).success).toBe(false);
  });

  it('caps the owner list at nine', () => {
    expect(VehicleQuery.safeParse({ owners: '1,2,3,4,5,6,7,8,9' }).success).toBe(true);
  });
});

describe('the remaining VehicleQuery fields', () => {
  it('accepts a two-letter RTO state in either case', () => {
    expect(VehicleQuery.parse({ rtoState: 'TN' }).rtoState).toBe('TN');
    expect(VehicleQuery.parse({ rtoState: 'tn' }).rtoState).toBe('tn');
  });

  it('refuses an RTO state that is not two letters', () => {
    expect(VehicleQuery.safeParse({ rtoState: 'TNX' }).success).toBe(false);
    expect(VehicleQuery.safeParse({ rtoState: '12' }).success).toBe(false);
  });

  it('accepts an RTO code with or without its hyphen', () => {
    expect(VehicleQuery.safeParse({ rto: 'TN-23' }).success).toBe(true);
    expect(VehicleQuery.safeParse({ rto: 'TN23' }).success).toBe(true);
  });

  it('refuses a malformed RTO code', () => {
    expect(VehicleQuery.safeParse({ rto: 'TN-234' }).success).toBe(false);
    expect(VehicleQuery.safeParse({ rto: '23-TN' }).success).toBe(false);
  });

  it('accepts a city slug and refuses anything else', () => {
    expect(VehicleQuery.safeParse({ city: 'vellore' }).success).toBe(true);
    expect(VehicleQuery.safeParse({ city: 'Vellore' }).success).toBe(false);
    expect(VehicleQuery.safeParse({ city: 'vellore/../' }).success).toBe(false);
  });

  it.each(['relevance', 'price_asc', 'price_desc', 'year_desc', 'km_asc', 'newest'])(
    'accepts sort=%s',
    (sort) => {
      expect(VehicleQuery.safeParse({ sort }).success).toBe(true);
    },
  );

  it('refuses a sort it cannot order by', () => {
    expect(VehicleQuery.safeParse({ sort: 'chaos' }).success).toBe(false);
  });
});

describe('strictness', () => {
  /** §9.2, the reason this rule exists at all. */
  it('rejects a typo’d parameter rather than ignoring it', () => {
    const result = VehicleQuery.safeParse({ lmit: 5 });

    expect(result.success).toBe(false);
  });

  it('names the surplus key, so the caller can find their typo', () => {
    const result = VehicleQuery.safeParse({ limit: 5, lmit: 9 });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('lmit');
  });

  it.each([
    ['HomeQuery', HomeQuery],
    ['SimilarQuery', SimilarQuery],
    ['DealerDirectoryQuery', DealerDirectoryQuery],
    ['VehicleBatchInput', VehicleBatchInput],
    ['RevealContactInput', RevealContactInput],
  ])('%s rejects an unknown field too', (_name, schema) => {
    expect(schema.safeParse({ nope: 1 }).success).toBe(false);
  });
});

describe('VehicleBatchInput', () => {
  /** Saved cars, read in bulk. The cap bounds the query the server then runs. */
  it('accepts a list of uuids', () => {
    const id = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

    expect(VehicleBatchInput.parse({ ids: [id] })).toEqual({ ids: [id] });
  });

  it('refuses an id that is not a uuid', () => {
    expect(VehicleBatchInput.safeParse({ ids: ['not-a-uuid'] }).success).toBe(false);
  });

  it('caps the batch at 100', () => {
    const id = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

    expect(VehicleBatchInput.safeParse({ ids: Array(100).fill(id) }).success).toBe(true);
    expect(VehicleBatchInput.safeParse({ ids: Array(101).fill(id) }).success).toBe(false);
  });

  it('accepts an empty list rather than erroring on a cleared saved-cars page', () => {
    expect(VehicleBatchInput.safeParse({ ids: [] }).success).toBe(true);
  });
});

describe('CreateEnquiryInput', () => {
  const valid = {
    vehicleId: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Ravi Kumar',
    phone: '9840012345',
    source: 'LISTING_PAGE' as const,
  };

  it('accepts a well-formed enquiry about a vehicle', () => {
    expect(CreateEnquiryInput.safeParse(valid).success).toBe(true);
  });

  /**
   * Exactly one of the two, not both and not neither: a lead has to route
   * somewhere, and a lead naming both a car and a dealership is ambiguous
   * about which dealer it belongs to.
   */
  it('requires exactly one of vehicleId and dealerSlug', () => {
    expect(CreateEnquiryInput.safeParse({ ...valid, dealerSlug: 'sri-lakshmi-motors' }).success)
      .toBe(false);

    const { vehicleId: _omitted, ...withoutVehicle } = valid;
    expect(CreateEnquiryInput.safeParse(withoutVehicle).success).toBe(false);
  });

  it('accepts a dealership enquiry with no vehicle', () => {
    const { vehicleId: _omitted, ...rest } = valid;

    expect(
      CreateEnquiryInput.safeParse({ ...rest, dealerSlug: 'sri-lakshmi-motors' }).success,
    ).toBe(true);
  });

  it('points the error at vehicleId, so the form can show it somewhere', () => {
    const result = CreateEnquiryInput.safeParse({ ...valid, dealerSlug: 'x' });

    expect(result.error?.issues[0]?.path).toEqual(['vehicleId']);
  });

  it.each(['9840012345', '+919840012345', '+91 9840012345', '91-9840012345'])(
    'accepts %s as an Indian mobile number',
    (phone) => {
      expect(CreateEnquiryInput.safeParse({ ...valid, phone }).success).toBe(true);
    },
  );

  /** Indian mobile numbers start 6–9; a landline or a short number is a typo. */
  it.each(['5840012345', '984001234', '98400123456', 'not-a-number'])(
    'refuses %s',
    (phone) => {
      expect(CreateEnquiryInput.safeParse({ ...valid, phone }).success).toBe(false);
    },
  );

  it('explains what a valid number looks like rather than just failing', () => {
    const result = CreateEnquiryInput.safeParse({ ...valid, phone: '123' });

    expect(result.error?.issues[0]?.message).toContain('10-digit Indian mobile number');
  });

  it('requires a name long enough to be one', () => {
    expect(CreateEnquiryInput.safeParse({ ...valid, name: 'R' }).success).toBe(false);
    expect(CreateEnquiryInput.safeParse({ ...valid, name: 'x'.repeat(81) }).success).toBe(false);
  });

  it('accepts an empty email, because the field is optional on the form', () => {
    expect(CreateEnquiryInput.safeParse({ ...valid, email: '' }).success).toBe(true);
  });

  it('refuses a malformed email when one is given', () => {
    expect(CreateEnquiryInput.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('caps the message, so a lead cannot carry a payload', () => {
    expect(CreateEnquiryInput.safeParse({ ...valid, message: 'x'.repeat(1001) }).success).toBe(
      false,
    );
  });

  /**
   * The honeypot. A bot fills every field it finds, so a non-empty `website`
   * is the signal — the field is accepted here and acted on server-side, which
   * is what lets the response stay an ordinary 201 rather than telling the bot
   * it was caught.
   */
  it('accepts the honeypot field rather than rejecting a bot outright', () => {
    expect(CreateEnquiryInput.safeParse({ ...valid, website: 'http://spam.example' }).success).toBe(
      true,
    );
  });

  it('accepts a null captcha token, which is what an unsolved widget sends', () => {
    expect(CreateEnquiryInput.safeParse({ ...valid, captchaToken: null }).success).toBe(true);
  });

  it('requires a source, so a lead can be attributed', () => {
    const { source: _omitted, ...withoutSource } = valid;

    expect(CreateEnquiryInput.safeParse(withoutSource).success).toBe(false);
  });
});
