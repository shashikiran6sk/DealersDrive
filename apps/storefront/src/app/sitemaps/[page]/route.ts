import { PublicStorefrontDto, StorefrontSitemapResponse } from '@dealers-drive/contracts';

import { StorefrontApiError, storefrontRequest } from '@/lib/api';
import { primaryUrl } from '@/lib/hostname';
import { sitemapXml } from '@/lib/sitemaps';

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!/^[1-9]\d{0,3}\.xml$/.test(page) || Number(page.replace('.xml', '')) > 1000)
    return new Response('', { status: 404 });
  try {
    const site = await storefrontRequest(PublicStorefrontDto, '/site');
    if (site.primaryHostname !== site.requestedHostname)
      return Response.redirect(primaryUrl(site.primaryHostname, `/sitemaps/${page}`), 308);
    if (process.env.APP_ENV !== 'production') return new Response('', { status: 404 });
    const inventory = await storefrontRequest(
      StorefrontSitemapResponse,
      `/sitemap?page=${page.replace('.xml', '')}`,
    );
    if (inventory.page.page > inventory.page.totalPages) return new Response('', { status: 404 });
    const staticEntries =
      inventory.page.page === 1
        ? ['/', '/cars', '/about', '/contact'].map((path) => ({
            url: primaryUrl(site.primaryHostname, path),
            lastModified: site.updatedAt,
          }))
        : [];
    return new Response(
      sitemapXml([
        ...staticEntries,
        ...inventory.entries.map((entry) => ({
          url: primaryUrl(site.primaryHostname, `/car/${encodeURIComponent(entry.slug)}`),
          lastModified: entry.lastModified,
        })),
      ]),
      {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (error) {
    return new Response('', {
      status: error instanceof StorefrontApiError && error.status === 404 ? 404 : 503,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
    });
  }
}
