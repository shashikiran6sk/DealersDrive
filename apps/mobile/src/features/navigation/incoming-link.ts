import {
  DealerDirectoryQuery,
  PublicVehicleQuery,
  VehicleSlugParam,
} from '@dealers-drive/contracts/public';

const FALLBACK = '/';
const STATIC_ROUTES: Readonly<Record<string, string>> = {
  '/': '/',
  '/cars': '/cars',
  '/dealers': '/dealers',
  '/saved': '/(tabs)/saved',
  '/profile': '/(tabs)/profile',
  '/account': '/account',
  '/account-deletion': '/account-deletion',
  '/support': '/support',
  '/terms': '/policy/terms',
  '/privacy': '/policy/privacy',
};

export function incomingLink(path: string, webOrigin: string): string {
  try {
    if (
      path.length > 4096 ||
      path.includes('\\') ||
      [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    )
      return FALLBACK;
    const custom = path.startsWith('dealersdrive://');
    const source = custom ? path.slice('dealersdrive://'.length) : path;
    if (source.startsWith('//')) return FALLBACK;
    const internal = custom || source.startsWith('/') || !source.includes(':');
    const url = internal
      ? new URL(source.startsWith('/') ? source : `/${source}`, webOrigin)
      : new URL(source);
    if (url.username || url.password || url.hash) return FALLBACK;
    if (!internal && (url.protocol !== 'https:' || url.origin !== new URL(webOrigin).origin))
      return FALLBACK;
    let route = url.pathname;
    route = route.replace(/\/$/, '') || '/';
    if (route.includes('%') || route.includes('//') || /\/\.{1,2}(?:\/|$)/.test(path))
      return FALLBACK;
    const entries = new Map<string, string>();
    for (const [key, value] of url.searchParams) {
      if (entries.has(key)) return FALLBACK;
      entries.set(key, value);
    }
    if (route === '/cars' || route === '/dealers') {
      const schema = route === '/cars' ? PublicVehicleQuery : DealerDirectoryQuery;
      if (!schema.safeParse(Object.fromEntries(entries)).success) return FALLBACK;
      const normalizedQuery = new URLSearchParams(Object.fromEntries(entries)).toString();
      return `${route}${normalizedQuery ? `?${normalizedQuery}` : ''}`;
    }
    if (url.search) return FALLBACK;
    const destination = STATIC_ROUTES[route];
    if (destination) return destination;
    const detail = /^\/(car|dealers)\/([^/]+)$/.exec(route);
    if (detail && VehicleSlugParam.safeParse({ slug: detail[2] }).success) return route;
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}
