import type {
  PublicLocations,
  PublicSitemapResponse,
  SitemapEntry,
} from '@dealers-drive/contracts';
import type { MetadataRoute } from 'next';

import { directoryPath } from './policy';
import { dealerPath } from './schemas/dealer';
import { vehiclePath } from './schemas/vehicle';
import { absoluteUrl } from './site';

export const STATIC_SITEMAP_PATHS: readonly string[] = ['/', '/cars', '/dealers', '/contact'];

type SitemapRow = MetadataRoute.Sitemap[number];

function entry(path: string, lastModified?: string | null): SitemapRow {
  return { url: absoluteUrl(path), ...(lastModified ? { lastModified } : {}) };
}

function districtRows(locations: PublicLocations): SitemapRow[] {
  return locations.districts.flatMap((district) => [
    ...((locations.cars.districts[district.slug] ?? 0) > 0
      ? [entry(directoryPath('/cars', district.slug))]
      : []),
    entry(directoryPath('/dealers', district.slug)),
  ]);
}

function entityRows(entries: readonly SitemapEntry[], pathOf: (slug: string) => string) {
  return entries
    .filter((row) => row.slug.length > 0)
    .map((row) => entry(pathOf(row.slug), row.lastModified));
}

export function buildSitemap(
  pages: PublicSitemapResponse,
  locations: PublicLocations,
): MetadataRoute.Sitemap {
  return [
    ...STATIC_SITEMAP_PATHS.map((path) => entry(path)),
    ...districtRows(locations),
    ...entityRows(pages.dealers, dealerPath),
    ...entityRows(pages.vehicles, vehiclePath),
  ];
}
