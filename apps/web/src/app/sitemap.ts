import { PublicLocations, PublicSitemapResponse } from '@dealers-drive/contracts';
import type { MetadataRoute } from 'next';
import { connection } from 'next/server';

import { apiGetParsed } from '@/lib/api';
import { DEALERS_TAG, VEHICLES_TAG } from '@/lib/cache-tags';
import { getLandingPages, landingPagesEnabled } from '@/lib/landing';
import { logger } from '@/lib/logger';
import { buildSitemap } from '@/lib/seo';

const SITEMAP_REVALIDATE_SECONDS = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [pages, locations, landings] = await Promise.all([
    apiGetParsed(PublicSitemapResponse, '/v1/sitemap', {
      revalidate: SITEMAP_REVALIDATE_SECONDS,
      tags: [VEHICLES_TAG, DEALERS_TAG],
    }),
    apiGetParsed(PublicLocations, '/v1/locations', {
      revalidate: SITEMAP_REVALIDATE_SECONDS,
      tags: [DEALERS_TAG],
    }),
    landingPagesEnabled()
      .then((enabled) => (enabled ? getLandingPages() : null))
      .catch((error: unknown) => {
        logger.warn('sitemap.landing_pages_unavailable', { error });
        return null;
      }),
  ]);
  return buildSitemap(pages, locations, landings);
}
