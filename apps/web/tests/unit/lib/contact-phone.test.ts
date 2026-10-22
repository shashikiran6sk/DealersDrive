import { describe, expect, it } from 'vitest';

import { phoneLabel, telHref } from '@/lib/contact-phone';

describe('phoneLabel', () => {
  it('groups a bare number for reading (BUG-107)', () => {
    expect(phoneLabel('+914162248890')).toBe('+91 41622 48890');
    expect(phoneLabel('9840012345')).toBe('+91 98400 12345');
  });

  it('leaves a number an operator formatted themselves exactly as typed', () => {
    expect(phoneLabel('+91 98400 12345')).toBe('+91 98400 12345');
    expect(phoneLabel('044-2345-6789')).toBe('044-2345-6789');
  });

  it('shows nothing for nothing', () => {
    expect(phoneLabel('')).toBe('');
  });
});

describe('telHref', () => {
  it('dials the digits without the spaces and dashes', () => {
    expect(telHref('+91 98400 12345')).toBe('tel:+919840012345');
    expect(telHref('044-2345-6789')).toBe('tel:04423456789');
  });
});
