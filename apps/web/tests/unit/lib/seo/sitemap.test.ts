import type { PublicLocations, PublicSitemapResponse } from '@dealers-drive/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSitemap, robotsTxt } from '@/lib/seo';

import { production } from './env';

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 3, state: 'Tamil Nadu' },
    { slug: 'kurnool', name: 'Kurnool', count: 1, state: 'Andhra Pradesh' },
  ],
  total: 4,
  cars: { total: 5, districts: { vellore: 5 } },
};

const PAGES: PublicSitemapResponse = {
  vehicles: [
    {
      slug: '2022-maruti-suzuki-brezza-zxi-mangalagiri-2419104e',
      lastModified: '2026-09-20T10:00:00.000Z',
    },
    { slug: 'no-date-car-0a1b2c3d', lastModified: null },
  ],
  dealers: [
    {
      slug: 'adoni-motor-traders-llp-adoni-kurnool-andhra-pradesh',
      lastModified: '2026-09-01T00:00:00.000Z',
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildSitemap', () => {
  it('lists the static pages, the district landing pages and every entity, at canonical URLs', () => {
    production();
    const urls = buildSitemap(PAGES, LOCATIONS).map((row) => row.url);

    expect(urls).toEqual([
      'https://www.dealers-drive.com/',
      'https://www.dealers-drive.com/cars',
      'https://www.dealers-drive.com/dealers',
      'https://www.dealers-drive.com/contact',
      'https://www.dealers-drive.com/cars?district=vellore',
      'https://www.dealers-drive.com/dealers?district=vellore',
      'https://www.dealers-drive.com/dealers?district=kurnool',
      'https://www.dealers-drive.com/dealers/adoni-motor-traders-llp-adoni-kurnool-andhra-pradesh',
      'https://www.dealers-drive.com/car/2022-maruti-suzuki-brezza-zxi-mangalagiri-2419104e',
      'https://www.dealers-drive.com/car/no-date-car-0a1b2c3d',
    ]);
  });

  it('leaves out the sign-in page, the consoles and every filter combination', () => {
    production();
    const urls = buildSitemap(PAGES, LOCATIONS).map((row) => row.url);

    for (const url of urls) {
      expect(url).not.toMatch(/\/login|\/dealer\/|\/admin|\/saved|\/enquiries|\/api\//);
      expect(url).not.toMatch(/[?&](q|sort|page|fuel|brand|city)=/);
    }
  });

  it('offers no car page for a district with no cars in it', () => {
    production();
    const urls = buildSitemap(PAGES, LOCATIONS).map((row) => row.url);
    expect(urls).not.toContain('https://www.dealers-drive.com/cars?district=kurnool');
  });

  /** A sitemap that says everything changed on every request teaches a crawler to ignore it. */
  it('dates an entity from its own rows, and a static page not at all', () => {
    production();
    const rows = buildSitemap(PAGES, LOCATIONS);

    expect(rows.find((row) => row.url.endsWith('/cars'))).not.toHaveProperty('lastModified');
    expect(rows.find((row) => row.url.includes('brezza'))?.lastModified).toBe(
      '2026-09-20T10:00:00.000Z',
    );
    expect(rows.find((row) => row.url.includes('no-date-car'))).not.toHaveProperty('lastModified');
  });
});

describe('robotsTxt', () => {
  it('lets production be crawled, keeps crawlers off the API and the OAuth hops, and names the sitemap', () => {
    production();
    expect(robotsTxt()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/v1/'] },
      sitemap: 'https://www.dealers-drive.com/sitemap.xml',
    });
  });

  /**
   * The login page, the consoles and the saved-cars page are deliberately not
   * disallowed: they carry `noindex`, and a crawler that is not allowed to fetch
   * a page never sees that it says so.
   */
  it('does not disallow a page whose noindex a crawler needs to see', () => {
    production();
    const disallowed = JSON.stringify(robotsTxt().rules);
    expect(disallowed).not.toMatch(/login|dealer|admin|saved/);
  });

  it('disallows everything outside production, and advertises no sitemap', () => {
    vi.stubEnv('APP_ENV', 'dev');
    vi.stubEnv('WEB_BASE_URL', 'https://dev.dealers-drive.com');
    expect(robotsTxt()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});
