import { serverConfig } from '@/lib/config';

import { DEFAULT_ORIGIN, LOCAL_HOSTS, PREVIEW_HOST_SUFFIXES } from './seo.constants';

export function siteUrl(): string {
  try {
    return new URL(serverConfig().webBaseUrl).origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${siteUrl()}/`).toString();
}

export function isPublicOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (LOCAL_HOSTS.has(url.hostname)) return false;
  return !PREVIEW_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

export function indexingEnabled(): boolean {
  return serverConfig().appEnv === 'production' && isPublicOrigin(siteUrl());
}
