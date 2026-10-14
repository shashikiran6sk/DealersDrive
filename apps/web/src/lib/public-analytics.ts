import type { BeforeSendEvent } from '@vercel/analytics';

export function isPublicAnalyticsPath(path: string): boolean {
  return /^\/(?:|cars\/?|dealers\/?|terms\/?|privacy\/?|contact\/?|car\/[^/]+\/?|dealers\/[^/]+\/?)$/.test(
    path,
  );
}

export function publicAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== 'pageview') return null;
  try {
    const url = new URL(event.url);
    if (!['http:', 'https:'].includes(url.protocol) || !isPublicAnalyticsPath(url.pathname))
      return null;
    url.search = '';
    url.hash = '';
    return { type: 'pageview', url: url.href };
  } catch {
    return null;
  }
}
