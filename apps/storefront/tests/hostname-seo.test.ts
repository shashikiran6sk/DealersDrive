import { afterEach, describe, expect, it, vi } from 'vitest';

import { CAR, SITE } from '../../../packages/storefront-ui/tests/fixtures.js';
import { primaryUrl, requestHostname } from '../src/lib/hostname.js';
import {
  businessData,
  serializeStructuredData,
  siteMetadata,
  vehicleData,
} from '../src/lib/seo.js';
import { sitemapIndexXml, sitemapXml, xmlEscape } from '../src/lib/sitemaps.js';

afterEach(() => {
  vi.unstubAllEnvs();
});
describe('host and redirect boundaries', () => {
  it('normalizes actual host syntax and permits local override only outside production', () => {
    expect(requestHostname('ALPHA.EXAMPLE.COM:443')).toBe('alpha.example.com');
    expect(requestHostname('localhost:3002', 'alpha.example.com', false)).toBe('alpha.example.com');
    expect(requestHostname('[::1]:3002', 'alpha.example.com', false)).toBe('alpha.example.com');
    expect(() => requestHostname('localhost:3002', 'alpha.example.com', true)).toThrow();
    for (const host of [
      null,
      'alpha.example.com,evil.com',
      'alpha.example.com@evil.com',
      'https://alpha.example.com',
      'xn--evil.com',
      '127.0.0.1',
    ])
      expect(() => requestHostname(host)).toThrow();
  });
  it('never turns path or query input into an open redirect', () => {
    for (const path of ['/', '/cars', '//evil.com/path', '/%2f%2fevil.com', '/https://evil.com'])
      expect(
        new URL(primaryUrl('alpha.example.com', path, '?q=hello&next=https://evil.com')).origin,
      ).toBe('https://alpha.example.com');
    expect(() => primaryUrl('https://evil.com', '/')).toThrow();
    expect(primaryUrl('alpha.example.com', '/cars', '?q=hello')).toBe(
      'https://alpha.example.com/cars?q=hello',
    );
  });
});
describe('tenant SEO and factual structured data', () => {
  it('uses this tenant’s primary host and noindexes every non-production environment', () => {
    vi.stubEnv('APP_ENV', 'production');
    const meta = siteMetadata(SITE, '/cars', 'Our cars');
    expect(meta.alternates?.canonical).toBe('https://alpha.example.com/cars');
    expect(meta.title).toBe('Our cars');
    expect(meta.robots).toMatchObject({ index: true });
    vi.stubEnv('APP_ENV', 'preview');
    expect(
      siteMetadata({ ...SITE, name: 'Beta Motors', primaryHostname: 'beta.example.com' }).robots,
    ).toMatchObject({ index: false });
    expect(siteMetadata({ ...SITE, seoDescription: '', heroUrl: null }).description).toContain(
      'Alpha Motors',
    );
  });
  it('does not invent inspection, ratings or warranty facts', () => {
    const data = vehicleData(SITE, CAR);
    expect(data).toMatchObject({
      '@type': 'Car',
      name: CAR.title,
      offers: { price: '850000.00', priceCurrency: 'INR', seller: { name: SITE.name } },
    });
    for (const key of ['aggregateRating', 'review', 'warranty', 'inspection'])
      expect(data).not.toHaveProperty(key);
    expect(businessData(SITE)).toMatchObject({
      '@type': 'AutoDealer',
      legalName: SITE.legalName,
      url: 'https://alpha.example.com/',
    });
    expect(
      vehicleData(SITE, { ...CAR, facts: { ...CAR.facts, pricePaise: null }, images: [] }),
    ).not.toHaveProperty('offers');
  });
  it('escapes structured data and XML without changing canonical origins', () => {
    expect(serializeStructuredData({ title: '</script><script>alert(1)</script>' })).not.toContain(
      '<',
    );
    expect(xmlEscape('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&apos;');
    expect(
      sitemapXml([{ url: 'https://alpha.example.com/cars?q=a&b=c', lastModified: SITE.updatedAt }]),
    ).toContain('q=a&amp;b=c');
    expect(sitemapIndexXml(['https://alpha.example.com/sitemaps/1.xml'])).toContain(
      '<sitemap><loc>https://alpha.example.com/sitemaps/1.xml</loc>',
    );
  });
});
