import type { Metadata } from 'next';

export type SeoRoute =
  | { kind: 'dealers'; city?: string | undefined; hasQuery: boolean }
  | { kind: 'resolved'; canonical: string; isIndexable: boolean };

export interface SeoPolicy {
  robots: NonNullable<Metadata['robots']>;
  canonical: string;
}

const INDEX: SeoPolicy['robots'] = { index: true, follow: true };
const NOINDEX_FOLLOW: SeoPolicy['robots'] = { index: false, follow: true };

export function indexPolicy(route: SeoRoute): SeoPolicy {
  switch (route.kind) {
    case 'dealers': {
      const canonical = route.city ? `/dealers?city=${route.city}` : '/dealers';
      return { robots: route.hasQuery ? NOINDEX_FOLLOW : INDEX, canonical };
    }

    case 'resolved':
      return {
        robots: route.isIndexable ? INDEX : NOINDEX_FOLLOW,
        canonical: route.canonical,
      };
  }
}

export function seoMetadata(route: SeoRoute): Pick<Metadata, 'robots' | 'alternates'> {
  const policy = indexPolicy(route);
  return {
    robots: policy.robots,
    ...(policy.canonical ? { alternates: { canonical: policy.canonical } } : {}),
  };
}
