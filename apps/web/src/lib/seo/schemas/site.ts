import type { PublicConfig } from '@dealers-drive/contracts';

import type { JsonLdNode } from '../json-ld';
import {
  LOGO_PATH,
  LOGO_SIZE,
  NOT_A_PROFILE_NETWORKS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SUPPORT_CONTACT_TYPE,
  COUNTRY_CODE,
} from '../seo.constants';
import { absoluteUrl } from '../site';

export function organizationId(): string {
  return absoluteUrl('/#organization');
}

export function websiteId(): string {
  return absoluteUrl('/#website');
}

export type SiteIdentity = Pick<PublicConfig, 'social' | 'supportEmail' | 'supportPhone'>;

export function organizationSchema({
  social,
  supportEmail,
  supportPhone,
}: SiteIdentity): JsonLdNode {
  const profiles = social
    .filter((link) => !NOT_A_PROFILE_NETWORKS.has(link.network))
    .map((link) => link.href);
  const reachable = Boolean(supportEmail || supportPhone);

  return {
    '@type': 'Organization',
    '@id': organizationId(),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(LOGO_PATH),
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    },
    sameAs: profiles.length > 0 ? profiles : undefined,
    contactPoint: reachable
      ? {
          '@type': 'ContactPoint',
          contactType: SUPPORT_CONTACT_TYPE,
          email: supportEmail || undefined,
          telephone: supportPhone || undefined,
          areaServed: COUNTRY_CODE,
        }
      : undefined,
  };
}

export function websiteSchema(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': websiteId(),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description: SITE_DESCRIPTION,
    inLanguage: 'en-IN',
    publisher: { '@id': organizationId() },
  };
}
