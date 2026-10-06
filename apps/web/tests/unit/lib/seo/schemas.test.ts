import { afterEach, describe, expect, it, vi } from 'vitest';

import { itemListSchema, organizationSchema, websiteSchema } from '@/lib/seo';

import { production } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('organizationSchema', () => {
  it('names the marketplace, its logo, and nothing it cannot back', () => {
    production();
    const node = organizationSchema({ social: [], supportEmail: '', supportPhone: '' });

    expect(node).toEqual({
      '@type': 'Organization',
      '@id': 'https://www.dealers-drive.com/#organization',
      name: 'Dealers-Drive',
      url: 'https://www.dealers-drive.com/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.dealers-drive.com/brand/dealers-drive-light.png',
        width: 2048,
        height: 2048,
      },
      sameAs: undefined,
      contactPoint: undefined,
    });
    expect(JSON.stringify(node)).not.toMatch(/aggregateRating|review|address|legalName/);
  });

  /**
   * The footer prints the support contacts and the social links, so they are on
   * every public page; the structured data says what the footer says. A
   * WhatsApp link is a way to message somebody, not a profile, so it is no
   * `sameAs`.
   */
  it('carries the configured social profiles and support contacts the footer shows', () => {
    production();
    const node = organizationSchema({
      social: [
        { network: 'instagram', label: 'Instagram', href: 'https://instagram.com/dealersdrive' },
        { network: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/919800000000' },
      ],
      supportEmail: 'help@dealers-drive.com',
      supportPhone: '',
    });

    expect(node.sameAs).toEqual(['https://instagram.com/dealersdrive']);
    expect(node.contactPoint).toEqual({
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'help@dealers-drive.com',
      telephone: undefined,
      areaServed: 'IN',
    });
  });
});

describe('websiteSchema', () => {
  it('establishes the site name and URL, published by the organisation', () => {
    production();
    expect(websiteSchema()).toMatchObject({
      '@type': 'WebSite',
      '@id': 'https://www.dealers-drive.com/#website',
      name: 'Dealers-Drive',
      url: 'https://www.dealers-drive.com/',
      publisher: { '@id': 'https://www.dealers-drive.com/#organization' },
    });
  });
});

describe('itemListSchema', () => {
  it('numbers the entries from where the page starts, at canonical URLs', () => {
    production();
    expect(
      itemListSchema('Used cars', [{ name: 'A car', path: '/car/a' }], 24).itemListElement,
    ).toEqual([
      {
        '@type': 'ListItem',
        position: 25,
        name: 'A car',
        url: 'https://www.dealers-drive.com/car/a',
      },
    ]);
  });
});
