import type { MetadataRoute } from 'next';

import { serverConfig } from '@/lib/config';

/**
 * ARCHITECTURE §17.2 — `/dealer/*`, `/admin/*` and `/api/*` are disallowed here
 * *and* carry `noindex`. Belt and braces: robots.txt stops the crawl, the meta
 * tag stops indexing anything that gets linked in from elsewhere.
 *
 * Non-production environments disallow everything. A preview deployment
 * outranking production is a real and very annoying way to lose traffic.
 */
export default function robots(): MetadataRoute.Robots {
  const { webBaseUrl, appEnv } = serverConfig();

  if (appEnv !== 'production') {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dealer/', '/admin/', '/api/', '/saved', '/enquiry-sent'],
      },
    ],
    sitemap: `${webBaseUrl}/sitemap.xml`,
  };
}
