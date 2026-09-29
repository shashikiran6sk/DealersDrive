import { PublicLocations, PublicSitemapResponse } from '@dealers-drive/contracts';
import type { MetadataRoute } from 'next';
import { connection } from 'next/server';

import { apiGetParsed } from '@/lib/api';
import { DEALERS_TAG, VEHICLES_TAG } from '@/lib/cache-tags';
import { buildSitemap } from '@/lib/seo';

const SITEMAP_REVALIDATE_SECONDS = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [pages, locations] = await Promise.all([
    apiGetParsed(PublicSitemapResponse, '/v1/sitemap', {
      revalidate: SITEMAP_REVALIDATE_SECONDS,
      tags: [VEHICLES_TAG, DEALERS_TAG],
    }),
    apiGetParsed(PublicLocations, '/v1/locations', {
      revalidate: SITEMAP_REVALIDATE_SECONDS,
      tags: [DEALERS_TAG],
    }),
  ]);
  return buildSitemap(pages, locations);
}
