import {
  effectiveStorefrontStatus,
  type PublicStorefrontDto,
  type StorefrontConfigDto,
  type StorefrontDomainDto,
} from '@dealers-drive/contracts';
import type { Prisma, StorefrontDomain } from '@prisma/client';
import { DOMAIN_CHECK_MAX_AGE_MS } from './storefront.visibility.js';

export const storefrontInclude = {
  domains: { orderBy: { createdAt: 'asc' } },
  dealer: {
    select: {
      id: true,
      status: true,
      brandName: true,
      legalName: true,
      contactPhone: true,
      mapsUrl: true,
      addressLine: true,
      city: true,
      state: true,
      pincode: true,
      logoMediaId: true,
      coverMediaId: true,
    },
  },
} satisfies Prisma.DealerStorefrontInclude;
export type StorefrontRow = Prisma.DealerStorefrontGetPayload<{
  include: typeof storefrontInclude;
}>;

export function domainDto(domain: StorefrontDomain): StorefrontDomainDto {
  const instructions: StorefrontDomainDto['instructions'] = [];
  if (domain.kind === 'CUSTOM' && domain.ownershipToken && domain.status !== 'REMOVED')
    instructions.push({
      type: 'TXT',
      name: `_dealers-drive.${domain.hostname}`,
      value: domain.ownershipToken,
    });
  if (domain.verificationName && domain.verificationValue)
    instructions.push({
      type: 'TXT',
      name: domain.verificationName,
      value: domain.verificationValue,
    });
  if (
    domain.routingName &&
    domain.routingValue &&
    (domain.routingType === 'CNAME' || domain.routingType === 'A')
  )
    instructions.push({
      type: domain.routingType,
      name: domain.routingName,
      value: domain.routingValue,
    });
  return {
    id: domain.id,
    hostname: domain.hostname,
    kind: domain.kind,
    status: domain.status,
    isPrimary: domain.isPrimary,
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    checkedAt: domain.checkedAt?.toISOString() ?? null,
    certificateReady: domain.certificateReady,
    instructions,
    lastError: domain.lastError,
  };
}

export function isDomainLive(domain: StorefrontDomain): boolean {
  return (
    domain.status === 'ACTIVE' &&
    domain.verifiedAt !== null &&
    domain.certificateReady &&
    (domain.kind === 'DEFAULT' ||
      (domain.ownershipVerifiedAt !== null &&
        domain.checkedAt !== null &&
        domain.checkedAt.getTime() > Date.now() - DOMAIN_CHECK_MAX_AGE_MS))
  );
}

export function configDto(row: StorefrontRow): StorefrontConfigDto {
  const primary = row.domains.find((domain) => domain.isPrimary && isDomainLive(domain));
  const status = effectiveStorefrontStatus(row.status, row.dealer.status);
  return {
    id: row.id,
    subdomain: row.subdomain,
    status,
    displayName: row.displayName,
    theme: row.theme,
    accentColor: row.accentColor,
    headline: row.headline,
    description: row.description,
    about: row.about,
    contactPhone: row.contactPhone,
    whatsappPhone: row.whatsappPhone,
    mapsUrl: row.mapsUrl,
    socialUrls: row.socialUrls,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    logoMediaId: row.logoMediaId,
    heroMediaId: row.heroMediaId,
    yardMediaIds: row.yardMediaIds,
    domains: row.domains.map(domainDto),
    publicUrl: status === 'ACTIVE' && primary ? `https://${primary.hostname}` : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function publicStorefrontDto(
  row: StorefrontRow,
  hostname: string,
  imageUrls: ReadonlyMap<string, string>,
): PublicStorefrontDto {
  const primary =
    row.domains.find((domain) => domain.isPrimary && isDomainLive(domain)) ??
    row.domains.find((domain) => domain.kind === 'DEFAULT');
  const logo = row.logoMediaId ?? row.dealer.logoMediaId;
  const hero = row.heroMediaId ?? row.dealer.coverMediaId;
  return {
    name: row.displayName,
    legalName: row.dealer.legalName,
    theme: row.theme,
    accentColor: row.accentColor,
    headline: row.headline || `Find your next car at ${row.displayName}`,
    description: row.description,
    about: row.about,
    address: [row.dealer.addressLine, row.dealer.city, row.dealer.state, row.dealer.pincode]
      .filter(Boolean)
      .join(', '),
    city: row.dealer.city,
    contactPhone: row.contactPhone ?? row.dealer.contactPhone,
    whatsappPhone: row.whatsappPhone,
    mapsUrl: row.mapsUrl ?? row.dealer.mapsUrl,
    socialUrls: row.socialUrls,
    logoUrl: logo ? (imageUrls.get(logo) ?? null) : null,
    heroUrl: hero ? (imageUrls.get(hero) ?? null) : null,
    yardUrls: row.yardMediaIds.flatMap((id) => (imageUrls.has(id) ? [imageUrls.get(id)!] : [])),
    primaryHostname: primary?.hostname ?? hostname,
    requestedHostname: hostname,
    seoTitle: row.seoTitle || row.displayName,
    seoDescription: row.seoDescription || row.description,
    isVerified: row.dealer.status === 'ACTIVE',
    updatedAt: row.updatedAt.toISOString(),
  };
}
