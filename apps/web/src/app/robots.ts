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
/**
 * Read at request time, not at build time.
 *
 * This file answers with `Disallow: /` for every environment except
 * production, and `APP_ENV` is what tells it which one it is running in. A
 * statically generated robots.txt would freeze the *build machine's* value
 * into the image — and since CI has no APP_ENV, the production image would
 * ship `Disallow: /` and quietly de-index the marketplace (§20.1).
 */
export const dynamic = 'force-dynamic';

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
