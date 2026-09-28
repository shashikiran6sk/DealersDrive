import { describe, expect, it } from 'vitest';

import { identifierOf } from '../../../../src/features/auth/phone-verification/utils.js';

/**
 * The number the widget sends the SMS to (**R58**).
 *
 * The browser hands MSG91 an identifier and the API later compares MSG91's
 * answer with the number the form claims — so the two must be the same
 * handset for every spelling the form accepts. When `IndianMobile` began
 * accepting the trunk-prefixed `098400 12345`, the old digit-gluing here
 * would have sent that code to `9109840012345`.
 */
describe('identifierOf', () => {
  it.each([
    '9840012345',
    '98400 12345',
    '+91 98400 12345',
    '919840012345',
    '09840012345',
    '0919840012345',
    '0091 98400 12345',
    '(984) 001-2345',
  ])('sends %j to 919840012345', (phone) => {
    expect(identifierOf(phone)).toBe('919840012345');
  });
});
