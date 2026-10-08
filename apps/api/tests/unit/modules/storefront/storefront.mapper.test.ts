import type { StorefrontDomain } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  configDto,
  domainDto,
  isDomainLive,
  publicStorefrontDto,
  type StorefrontRow,
} from '../../../../src/modules/storefront/storefront.mapper.js';

function domain(overrides: Partial<StorefrontDomain> = {}): StorefrontDomain {
  return {
    id: 'domain',
    storefrontId: 'site',
    hostname: 'alpha.example.com',
    kind: 'CUSTOM',
    status: 'ACTIVE',
    isPrimary: true,
    ownershipToken: 'proof',
    ownershipVerifiedAt: new Date(),
    verifiedAt: new Date(),
    checkedAt: new Date(),
    certificateReady: true,
    verificationName: '_vercel.example.com',
    verificationValue: 'provider-proof',
    routingType: 'CNAME',
    routingName: 'alpha.example.com',
    routingValue: 'provider.example.net',
    lastError: null,
    removedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
function site(overrides: Partial<StorefrontRow> = {}): StorefrontRow {
  return {
    id: 'site',
    dealerId: 'dealer',
    subdomain: 'alpha',
    status: 'ACTIVE',
    theme: 'LIGHT',
    displayName: 'Alpha Motors',
    accentColor: '#155e75',
    headline: '',
    description: '',
    about: '',
    contactPhone: null,
    whatsappPhone: null,
    mapsUrl: null,
    socialUrls: [],
    seoTitle: '',
    seoDescription: '',
    logoMediaId: null,
    heroMediaId: null,
    yardMediaIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    domains: [domain()],
    dealer: {
      id: 'dealer',
      status: 'ACTIVE',
      brandName: 'Alpha Motors',
      legalName: 'Alpha Limited',
      contactPhone: '+919840012345',
      mapsUrl: 'https://maps.google.com/maps?q=Vellore',
      addressLine: 'Synthetic yard',
      city: 'Vellore',
      state: 'Tamil Nadu',
      pincode: null,
      logoMediaId: 'dealer-logo',
      coverMediaId: 'dealer-cover',
    },
    ...overrides,
  };
}

describe('public domain and branding DTO boundaries', () => {
  it('returns ownership and provider-specific DNS instructions only in authenticated config', () => {
    expect(domainDto(domain()).instructions).toEqual([
      { type: 'TXT', name: '_dealers-drive.alpha.example.com', value: 'proof' },
      { type: 'TXT', name: '_vercel.example.com', value: 'provider-proof' },
      { type: 'CNAME', name: 'alpha.example.com', value: 'provider.example.net' },
    ]);
    expect(domainDto(domain({ routingType: 'A' })).instructions[2]?.type).toBe('A');
    expect(
      domainDto(
        domain({
          kind: 'DEFAULT',
          ownershipToken: null,
          verificationName: null,
          verificationValue: null,
          routingType: null,
          routingName: null,
          routingValue: null,
          verifiedAt: null,
          checkedAt: null,
        }),
      ).instructions,
    ).toEqual([]);
    expect(
      domainDto(
        domain({
          status: 'REMOVED',
          verificationName: null,
          verificationValue: null,
          routingType: 'AAAA',
        }),
      ).instructions,
    ).toEqual([]);
  });
  it('requires current ownership, routing and certificate state for custom domains', () => {
    expect(isDomainLive(domain())).toBe(true);
    for (const change of [
      { status: 'PENDING' },
      { status: 'FAILED' },
      { verifiedAt: null },
      { ownershipVerifiedAt: null },
      { certificateReady: false },
      { checkedAt: null },
      { checkedAt: new Date(0) },
    ] as const)
      expect(isDomainLive(domain(change))).toBe(false);
    expect(
      isDomainLive(domain({ kind: 'DEFAULT', ownershipVerifiedAt: null, checkedAt: null })),
    ).toBe(true);
  });
  it('never advertises a live URL for disabled, suspended or unverified sites', () => {
    expect(configDto(site()).publicUrl).toBe('https://alpha.example.com');
    expect(configDto(site({ status: 'DISABLED' })).publicUrl).toBeNull();
    expect(configDto(site({ dealer: { ...site().dealer, status: 'SUSPENDED' } })).status).toBe(
      'SUSPENDED',
    );
    expect(configDto(site({ domains: [domain({ status: 'FAILED' })] })).publicUrl).toBeNull();
  });
  it('reuses authoritative address/contact and drops removed or private media', () => {
    const fallback = publicStorefrontDto(
      site(),
      'alpha.example.com',
      new Map([
        ['dealer-logo', '/public/logo'],
        ['dealer-cover', '/public/cover'],
      ]),
    );
    expect(fallback).toMatchObject({
      legalName: 'Alpha Limited',
      contactPhone: '+919840012345',
      logoUrl: '/public/logo',
      heroUrl: '/public/cover',
      address: 'Synthetic yard, Vellore, Tamil Nadu',
    });
    expect(fallback).not.toHaveProperty('dealerId');
    const configured = site({
      headline: 'Our cars',
      seoTitle: 'Our title',
      seoDescription: 'Our description',
      contactPhone: '+919840012346',
      mapsUrl: 'https://maps.google.com/maps?q=Chennai',
      logoMediaId: 'removed',
      heroMediaId: 'removed',
      yardMediaIds: ['ready', 'removed'],
    });
    const dto = publicStorefrontDto(
      configured,
      'alias.example.com',
      new Map([['ready', '/public/ready']]),
    );
    expect(dto).toMatchObject({
      headline: 'Our cars',
      seoTitle: 'Our title',
      seoDescription: 'Our description',
      contactPhone: '+919840012346',
      logoUrl: null,
      heroUrl: null,
      yardUrls: ['/public/ready'],
      primaryHostname: 'alpha.example.com',
    });
    expect(
      publicStorefrontDto(
        site({ domains: [domain({ kind: 'DEFAULT', status: 'PENDING', isPrimary: false })] }),
        'alpha.example.com',
        new Map(),
      ).primaryHostname,
    ).toBe('alpha.example.com');
    expect(
      publicStorefrontDto(
        site({ domains: [], dealer: { ...site().dealer, logoMediaId: null, coverMediaId: null } }),
        'unknown.example.com',
        new Map(),
      ),
    ).toMatchObject({ primaryHostname: 'unknown.example.com', logoUrl: null, heroUrl: null });
  });
});
