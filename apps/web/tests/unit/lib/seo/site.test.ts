import { afterEach, describe, expect, it, vi } from 'vitest';

import { absoluteUrl, indexingEnabled, isPublicOrigin, siteUrl } from '@/lib/seo';

import { production, PRODUCTION_ORIGIN } from './env';

/**
 * One origin, read from `WEB_BASE_URL` and nowhere else. Every canonical, every
 * sitemap URL, every Open Graph URL and every `@id` is built through
 * `absoluteUrl`, so these are the tests that stop a second spelling of the
 * domain appearing anywhere.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('siteUrl', () => {
  it('is the origin of WEB_BASE_URL, with no path and no trailing slash', () => {
    vi.stubEnv('WEB_BASE_URL', 'https://www.dealers-drive.com/');
    expect(siteUrl()).toBe('https://www.dealers-drive.com');

    vi.stubEnv('WEB_BASE_URL', 'https://www.dealers-drive.com/some/path');
    expect(siteUrl()).toBe('https://www.dealers-drive.com');
  });

  it('falls back to the local origin when the variable is unset or unreadable', () => {
    vi.stubEnv('WEB_BASE_URL', undefined);
    expect(siteUrl()).toBe('http://localhost:3000');

    vi.stubEnv('WEB_BASE_URL', 'not a url');
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});

describe('absoluteUrl', () => {
  it('joins a path onto the one origin', () => {
    vi.stubEnv('WEB_BASE_URL', PRODUCTION_ORIGIN);

    expect(absoluteUrl('/')).toBe('https://www.dealers-drive.com/');
    expect(absoluteUrl('/cars')).toBe('https://www.dealers-drive.com/cars');
    expect(absoluteUrl('/cars?district=vellore')).toBe(
      'https://www.dealers-drive.com/cars?district=vellore',
    );
  });
});

describe('indexing', () => {
  it('is on in production, at a public https origin', () => {
    production();
    expect(indexingEnabled()).toBe(true);
  });

  it.each(['local', 'development'])('is off in %s, whatever the origin', (appEnv) => {
    vi.stubEnv('APP_ENV', appEnv);
    vi.stubEnv('WEB_BASE_URL', PRODUCTION_ORIGIN);
    expect(indexingEnabled()).toBe(false);
  });

  /**
   * A production build pointed at the wrong origin must not publish canonicals
   * to it. Refusing to be indexed is the loud failure; canonicalising the site
   * to localhost is the quiet one that takes months to notice.
   */
  it.each([
    'http://www.dealers-drive.com',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://dealers-drive-git-main.vercel.app',
  ])('is off in production when the origin is %s', (origin) => {
    production(origin);
    expect(indexingEnabled()).toBe(false);
  });

  it('knows a public origin from a development one', () => {
    expect(isPublicOrigin('https://www.dealers-drive.com')).toBe(true);
    expect(isPublicOrigin('https://preview-123.vercel.app')).toBe(false);
    expect(isPublicOrigin('garbage')).toBe(false);
  });
});
