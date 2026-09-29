import type { DealerPublicProfile } from '@dealers-drive/contracts';

import type { JsonLdNode } from '../json-ld';
import { COUNTRY_CODE } from '../seo.constants';
import { absoluteUrl } from '../site';

const TAX_ID_ROW = 'gstin';

export function dealerPath(slug: string): string {
  return `/dealers/${encodeURIComponent(slug)}`;
}

export function dealerId(slug: string): string {
  return absoluteUrl(`${dealerPath(slug)}#dealer`);
}

function postalAddressOf(address: DealerPublicProfile['address']): JsonLdNode {
  return {
    '@type': 'PostalAddress',
    streetAddress: address.line ?? undefined,
    addressLocality: address.city || undefined,
    addressRegion: address.state || undefined,
    postalCode: address.pincode ?? undefined,
    addressCountry: COUNTRY_CODE,
  };
}

export function dealerSchema(dealer: DealerPublicProfile): JsonLdNode {
  return {
    '@type': 'AutoDealer',
    '@id': dealerId(dealer.slug),
    name: dealer.brandName,
    legalName: dealer.legalName,
    url: absoluteUrl(dealerPath(dealer.slug)),
    description: dealer.tagline ?? undefined,
    image: dealer.coverUrl ?? undefined,
    address: postalAddressOf(dealer.address),
    hasMap: dealer.address.mapsUrl ?? undefined,
    taxID: dealer.contact.find((row) => row.key === TAX_ID_ROW)?.value,
  };
}
