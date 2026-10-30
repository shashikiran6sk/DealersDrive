import { describe, expect, it } from 'vitest';
import {
  DealerContactInput,
  normaliseDealerContact,
  RevealContactInput,
} from '../../src/dealer-contact.js';
import { DealerSelfUpdateInput } from '../../src/dealer.js';

describe('customer contact numbers', () => {
  it.each([
    ['0416 224 8890', '+914162248890'],
    ['080-2286-2001', '+918022862001'],
    ['9840012345', '+919840012345'],
    ['+91 98400 12345', '+919840012345'],
    ['0091 4162248890', '+914162248890'],
    ['+91 (416) 2248890', '+914162248890'],
  ])('normalises %s for calling', (input, expected) => {
    expect(DealerContactInput.parse(input)).toBe(expected);
  });
  it.each([
    'hello',
    '2248890',
    '+1 9840012345',
    '+91+9840012345',
    '9840012345 ext 2',
    '0000000000',
    'tel:9840012345',
  ])('refuses %s', (input) => {
    expect(normaliseDealerContact(input)).toBeNull();
    expect(DealerContactInput.safeParse(input).success).toBe(false);
  });
  it('distinguishes omission from removal and keeps account identity locked', () => {
    expect(DealerSelfUpdateInput.parse({})).toEqual({});
    expect(DealerSelfUpdateInput.parse({ contact: { landline: '' } })).toEqual({
      contact: { landline: null },
    });
    expect(DealerSelfUpdateInput.safeParse({ contact: { phone: '9840012345' } }).success).toBe(
      false,
    );
    expect(
      DealerSelfUpdateInput.safeParse({ contact: { email: 'elsewhere@example.com' } }).success,
    ).toBe(false);
    expect(RevealContactInput.safeParse({ dealerId: 'injected' }).success).toBe(false);
  });
});
