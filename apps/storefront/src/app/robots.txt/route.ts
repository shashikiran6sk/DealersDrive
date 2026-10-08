import { PublicStorefrontDto } from '@dealers-drive/contracts';

import { StorefrontApiError, storefrontRequest } from '@/lib/api';
import { primaryUrl } from '@/lib/hostname';

export async function GET() {
  try {
    const site = await storefrontRequest(PublicStorefrontDto, '/site');
    if (site.primaryHostname !== site.requestedHostname)
      return Response.redirect(primaryUrl(site.primaryHostname, '/robots.txt'), 308);
    const enabled = process.env.APP_ENV === 'production';
    return new Response(
      `User-agent: *\n${enabled ? 'Allow: /\nDisallow: /enquire/' : 'Disallow: /'}\n${enabled ? `Sitemap: ${primaryUrl(site.primaryHostname, '/sitemap.xml')}\n` : ''}`,
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (error) {
    const unknown = error instanceof StorefrontApiError && error.status === 404;
    return new Response(
      unknown ? 'User-agent: *\nDisallow: /\n' : 'Website temporarily unavailable.',
      {
        status: unknown ? 200 : 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'Retry-After': '60',
        },
      },
    );
  }
}
