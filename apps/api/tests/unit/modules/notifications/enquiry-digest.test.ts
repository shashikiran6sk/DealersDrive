import { describe, expect, it } from 'vitest';

import {
  ENQUIRY_DIGEST_PERMISSION,
  enquiryDigestJob,
  previousIstDay,
} from '../../../../src/modules/notifications/notifications.service.js';

describe('previousIstDay', () => {
  it.each([
    ['2026-10-28T03:01:00.000Z', '2026-10-27'],
    ['2026-10-27T18:30:00.000Z', '2026-10-27'],
    ['2026-10-27T18:29:59.000Z', '2026-10-26'],
    ['2026-01-01T00:00:00.000Z', '2025-12-31'],
  ])('at %s is %s, the whole day before in India', (now, day) => {
    expect(previousIstDay(new Date(now))).toBe(day);
  });
});

describe('enquiryDigestJob', () => {
  it('is an admin email keyed by the day, so a retry cannot send it twice', () => {
    expect(enquiryDigestJob('2026-10-27')).toEqual({
      template: 'admin.enquiry.digest',
      dealerId: null,
      audience: 'admin',
      subjectId: '2026-10-27',
      permission: ENQUIRY_DIGEST_PERMISSION,
    });
  });
});
