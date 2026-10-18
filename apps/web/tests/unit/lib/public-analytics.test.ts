import { describe, expect, it } from 'vitest';
import { publicAnalyticsEvent } from '@/lib/public-analytics';

describe('public analytics privacy boundary', () => {
  it.each([
    '/login?returnTo=%2Fdata-rights',
    '/dealer/onboarding',
    '/agreements',
    '/data-rights?enquiry=private-id',
    '/support-requests/private-ticket',
    '/admin/dealers/private-id',
    '/sales/dealers/private-id',
    '/v1/auth/google/callback?code=secret',
  ])('suppresses private route %s', (path) => {
    expect(
      publicAnalyticsEvent({ type: 'pageview', url: `https://example.test${path}` }),
    ).toBeNull();
  });
  it.each([
    '/',
    '/cars',
    '/dealers',
    '/car/public-vehicle',
    '/dealers/public-business',
    '/terms',
    '/privacy',
    '/contact',
  ])('keeps public traffic while discarding query/fragment on %s', (path) => {
    expect(
      publicAnalyticsEvent({
        type: 'pageview',
        url: `https://example.test${path}?phone=private#token`,
      }),
    ).toEqual({ type: 'pageview', url: `https://example.test${path}` });
  });
  it('suppresses custom event payloads and malformed URLs', () => {
    expect(
      publicAnalyticsEvent({
        type: 'event',
        url: 'https://example.test',
      }),
    ).toBeNull();
    expect(publicAnalyticsEvent({ type: 'pageview', url: 'invalid' })).toBeNull();
  });
});
