import type { MetadataRoute } from 'next';

import { DISALLOWED_PATHS, SITEMAP_PATH } from './seo.constants';
import { absoluteUrl, indexingEnabled } from './site';

export function robotsTxt(): MetadataRoute.Robots {
  if (!indexingEnabled()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...DISALLOWED_PATHS] },
    sitemap: absoluteUrl(SITEMAP_PATH),
  };
}
