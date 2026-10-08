import { describe, expect, it } from 'vitest';

import { dealerPermissionsFor } from '../../src/dealer-access.js';

import {
  AddStorefrontDomainInput,
  CreateStorefrontInput,
  SetPublicationInput,
  SetStorefrontEnabledInput,
  StorefrontAccent,
  StorefrontBrandingInput,
  StorefrontHostname,
  StorefrontSlug,
  StorefrontSocialUrl,
  StorefrontStatus,
  StorefrontTheme,
  STOREFRONT_RESERVED_SLUGS,
  STOREFRONT_TRANSITIONS,
  canTransitionStorefront,
  effectiveStorefrontStatus,
} from '../../src/storefront.js';

describe('storefront identity', () => {
  it('normalizes safe names and domains', () => {
    expect(StorefrontSlug.parse('  ABC-Motors ')).toBe('abc-motors');
    expect(StorefrontHostname.parse('  WWW.ABCMotors.COM ')).toBe('www.abcmotors.com');
  });
  it.each(STOREFRONT_RESERVED_SLUGS)('reserves %s', (name) => {
    expect(StorefrontSlug.safeParse(name).success).toBe(false);
  });
  it.each(['a', '-motors', 'motors-', 'abc--motors', 'abc.motors', 'a'.repeat(64), 'a/b', 'ab c'])(
    'rejects slug %s',
    (name) => {
      expect(StorefrontSlug.safeParse(name).success).toBe(false);
    },
  );
  it.each([
    'http://abc.com',
    'abc.com:443',
    '*.abc.com',
    'abc.com/',
    'user@abc.com',
    '127.0.0.1',
    '[::1]',
    'abc.local',
    'abc.internal',
    'abc.test',
    'xn--abc.com',
    'www.xn--abc.com',
    'abc.com.',
    'abc..com',
    'a'.repeat(64) + '.com',
    'a'.repeat(254),
  ])('rejects host %s', (host) => {
    expect(StorefrontHostname.safeParse(host).success).toBe(false);
  });
  it('rejects identity overrides and unbounded input', () => {
    expect(
      CreateStorefrontInput.safeParse({
        subdomain: 'abc-motors',
        theme: 'LIGHT',
        dealerId: 'other',
      }).success,
    ).toBe(false);
    expect(
      AddStorefrontDomainInput.safeParse({ hostname: 'www.abc.com', verified: true }).success,
    ).toBe(false);
    expect(SetStorefrontEnabledInput.safeParse({ enabled: true, status: 'ACTIVE' }).success).toBe(
      false,
    );
    expect(
      SetPublicationInput.safeParse({ marketplacePublished: false, storefrontPublished: true })
        .success,
    ).toBe(true);
    expect(StorefrontTheme.safeParse('CUSTOM').success).toBe(false);
  });
});

describe('branding boundaries', () => {
  it('accepts bounded plain text and controlled branding', () => {
    expect(
      StorefrontBrandingInput.parse({
        displayName: ' ABC Motors ',
        headline: 'Find your next car',
        about: 'Welcome\nto our yard.',
        accentColor: '#ABCDEF',
        theme: 'DARK',
        contactPhone: '9840012345',
        whatsappPhone: null,
        mapsUrl: null,
        socialUrls: ['https://www.instagram.com/abc'],
        yardMediaIds: [],
      }),
    ).toMatchObject({
      displayName: 'ABC Motors',
      accentColor: '#abcdef',
      contactPhone: '+919840012345',
    });
    expect(StorefrontAccent.parse('#155E75')).toBe('#155e75');
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'https://127.0.0.1/',
    'https://instagram.com.evil.com/',
    'https://user:pass@instagram.com',
    'http://instagram.com/x',
    'https://instagram.com:444/x',
  ])('rejects unsafe social URL %s', (url) => {
    expect(StorefrontSocialUrl.safeParse(url).success).toBe(false);
  });
  it('rejects mass assignment, HTML and oversized values', () => {
    for (const body of [
      { status: 'ACTIVE' },
      { dealerId: 'x' },
      { displayName: '<script>' },
      { headline: 'a'.repeat(141) },
      { about: 'a'.repeat(3001) },
      { logoMediaId: 'https://evil.com/x' },
      { socialUrls: Array(6).fill('https://instagram.com/a') },
      {
        yardMediaIds: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000001',
        ],
      },
    ]) {
      expect(StorefrontBrandingInput.safeParse(body).success).toBe(false);
    }
  });
});

describe('explicit lifecycle', () => {
  it('grants website management and domains only to owners', () => {
    expect(dealerPermissionsFor('OWNER')).toEqual(
      expect.arrayContaining(['storefront:read', 'storefront:manage', 'storefront:domain']),
    );
    expect(dealerPermissionsFor('MANAGER')).toContain('storefront:read');
    for (const role of ['MANAGER', 'STAFF'] as const) {
      expect(dealerPermissionsFor(role)).not.toContain('storefront:manage');
      expect(dealerPermissionsFor(role)).not.toContain('storefront:domain');
    }
    expect(dealerPermissionsFor('STAFF')).not.toContain('storefront:read');
  });
  it('validates every state pair, including safe retries', () => {
    for (const from of StorefrontStatus.options) {
      for (const to of StorefrontStatus.options) {
        expect(canTransitionStorefront(from, to)).toBe(
          from === to || STOREFRONT_TRANSITIONS[from].includes(to),
        );
      }
    }
    expect(canTransitionStorefront('DRAFT', 'ACTIVE')).toBe(false);
    expect(canTransitionStorefront('SUSPENDED', 'ACTIVE')).toBe(false);
  });
  it.each(['SUSPENDED', 'CLOSED', 'DRAFT', 'PENDING_APPROVAL'])(
    'fails closed for dealer %s',
    (dealer) => {
      expect(effectiveStorefrontStatus('ACTIVE', dealer)).toBe('SUSPENDED');
    },
  );
  it('keeps eligible dealer state', () => {
    expect(effectiveStorefrontStatus('DISABLED', 'ACTIVE')).toBe('DISABLED');
  });
});
