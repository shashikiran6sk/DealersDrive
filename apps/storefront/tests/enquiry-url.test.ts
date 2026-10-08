import { describe, expect, it } from 'vitest';

import { verifiedEnquiryUrl } from '../src/lib/enquiry-url.js';

const ticket = 'eyJ0ZXN0IjoidGVzdCJ9.signature0123456789';
describe('central enquiry redirect boundary', () => {
  it('accepts only the configured central flow and a valid intent', () => {
    const raw = `https://dealers-drive.com/website-enquiry?ticket=${ticket}`;
    expect(verifiedEnquiryUrl(raw, 'https://dealers-drive.com')).toBe(raw);
    for (const url of [
      `https://evil.com/website-enquiry?ticket=${ticket}`,
      `https://dealers-drive.com/other?ticket=${ticket}`,
      `https://user@dealers-drive.com/website-enquiry?ticket=${ticket}`,
      `https://dealers-drive.com/website-enquiry?ticket=${ticket}&next=https://evil.com`,
      'https://dealers-drive.com/website-enquiry?ticket=invalid',
      `https://dealers-drive.com/website-enquiry?ticket=${ticket}#evil`,
    ])
      expect(() => verifiedEnquiryUrl(url, 'https://dealers-drive.com')).toThrow();
  });
});
