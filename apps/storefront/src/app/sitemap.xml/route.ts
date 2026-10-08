import { PublicStorefrontDto, StorefrontSitemapResponse } from '@dealers-drive/contracts';

import { StorefrontApiError, storefrontRequest } from '@/lib/api';
import { primaryUrl } from '@/lib/hostname';
import { sitemapIndexXml } from '@/lib/sitemaps';

export async function GET() {
  try {
    const site = await storefrontRequest(PublicStorefrontDto, '/site');
    if (site.primaryHostname !== site.requestedHostname)
      return Response.redirect(primaryUrl(site.primaryHostname, '/sitemap.xml'), 308);
    if (process.env.APP_ENV !== 'production') return new Response('', { status: 404 });
    const inventory = await storefrontRequest(StorefrontSitemapResponse, '/sitemap');
    const urls = Array.from({ length: inventory.page.totalPages }, (_, index) =>
      primaryUrl(site.primaryHostname, `/sitemaps/${index + 1}.xml`),
    );
    return new Response(sitemapIndexXml(urls), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return new Response('', {
      status: error instanceof StorefrontApiError && error.status === 404 ? 404 : 503,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
    });
  }
}
