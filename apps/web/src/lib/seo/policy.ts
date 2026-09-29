import type { Metadata } from 'next';

import { DISTRICT_PARAM, PAGE_PARAM } from './seo.constants';
import { indexingEnabled } from './site';

export interface DirectoryView {
  district?: string | undefined;
  page?: number | undefined;
  narrowed: boolean;
  empty: boolean;
}

export type SeoRoute =
  | ({ kind: 'cars' } & DirectoryView)
  | ({ kind: 'dealers' } & DirectoryView)
  | { kind: 'resolved'; canonical: string; isIndexable: boolean }
  | { kind: 'noindex' }
  | { kind: 'private' };

export type SeoRobots = { index: boolean; follow: boolean };

export interface SeoPolicy {
  robots: SeoRobots;
  canonical: string | null;
}

const INDEX: SeoRobots = { index: true, follow: true };
const NOINDEX_FOLLOW: SeoRobots = { index: false, follow: true };
const NOINDEX_NOFOLLOW: SeoRobots = { index: false, follow: false };

const DIRECTORY_PATH = { cars: '/cars', dealers: '/dealers' } as const;

const LANDING_KEYS: ReadonlySet<string> = new Set([DISTRICT_PARAM, PAGE_PARAM]);

function isSet(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' && value.length > 0;
}

export function directoryView(
  params: Readonly<Record<string, unknown>>,
  empty: boolean,
): DirectoryView {
  const district = params[DISTRICT_PARAM];
  const page = Number(params[PAGE_PARAM] ?? 1);
  return {
    district: typeof district === 'string' && district.length > 0 ? district : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    narrowed: Object.entries(params).some(([key, value]) => !LANDING_KEYS.has(key) && isSet(value)),
    empty,
  };
}

export function isIndexableView(view: DirectoryView): boolean {
  return !view.narrowed && !view.empty;
}

export function directoryPath(base: string, district?: string, page = 1): string {
  const search = new URLSearchParams();
  if (district) search.set(DISTRICT_PARAM, district);
  if (page > 1) search.set(PAGE_PARAM, String(page));
  const encoded = search.toString();
  return encoded ? `${base}?${encoded}` : base;
}

function directoryPolicy(base: string, view: DirectoryView): SeoPolicy {
  if (view.narrowed || view.empty) {
    return { robots: NOINDEX_FOLLOW, canonical: directoryPath(base, view.district) };
  }
  return { robots: INDEX, canonical: directoryPath(base, view.district, view.page ?? 1) };
}

export function indexPolicy(route: SeoRoute): SeoPolicy {
  switch (route.kind) {
    case 'cars':
    case 'dealers':
      return directoryPolicy(DIRECTORY_PATH[route.kind], route);

    case 'resolved':
      return {
        robots: route.isIndexable ? INDEX : NOINDEX_FOLLOW,
        canonical: route.canonical,
      };

    case 'noindex':
      return { robots: NOINDEX_FOLLOW, canonical: null };

    case 'private':
      return { robots: NOINDEX_NOFOLLOW, canonical: null };
  }
}

export function robotsFor(robots: SeoRobots): NonNullable<Metadata['robots']> {
  if (!indexingEnabled()) return NOINDEX_NOFOLLOW;
  return robots.index ? { ...robots, 'max-image-preview': 'large' } : robots;
}

export function seoMetadata(route: SeoRoute): Pick<Metadata, 'robots' | 'alternates'> {
  const policy = indexPolicy(route);
  return {
    robots: robotsFor(policy.robots),
    ...(policy.canonical ? { alternates: { canonical: policy.canonical } } : {}),
  };
}
