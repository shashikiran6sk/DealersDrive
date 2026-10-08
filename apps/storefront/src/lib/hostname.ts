import { StorefrontHostname } from '@dealers-drive/contracts';

export function requestHostname(
  raw: string | null,
  developmentHostname?: string,
  production = true,
): string {
  if (!raw) throw new Error('Missing request hostname.');
  const hostname = raw.toLowerCase().replace(/:\d+$/, '');
  if (!production && ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && developmentHostname)
    return StorefrontHostname.parse(developmentHostname);
  return StorefrontHostname.parse(hostname);
}

export function primaryUrl(hostname: string, pathname: string, search = ''): string {
  const url = new URL(`https://${StorefrontHostname.parse(hostname)}`);
  url.pathname = pathname;
  url.search = search;
  return url.toString();
}
