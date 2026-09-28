import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE } from './api';

export interface RelayedCookie {
  value: string;
  expires?: Date;
  domain?: string;
  path: string;
  secure: boolean;
}

export function parseSessionCookie(setCookies: readonly string[]): RelayedCookie | null {
  const header = setCookies.find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  if (!header) return null;

  const [pair = '', ...attributes] = header.split(';').map((part) => part.trim());
  const value = pair.slice(SESSION_COOKIE.length + 1);
  if (!value) return null;

  const relayed: RelayedCookie = { value, path: '/', secure: false };
  for (const attribute of attributes) {
    const [rawName = '', ...rest] = attribute.split('=');
    const name = rawName.toLowerCase();
    const attributeValue = rest.join('=');
    if (name === 'expires') {
      const expires = new Date(attributeValue);
      if (!Number.isNaN(expires.getTime())) relayed.expires = expires;
    }
    if (name === 'domain' && attributeValue) relayed.domain = attributeValue;
    if (name === 'path' && attributeValue) relayed.path = attributeValue;
    if (name === 'secure') relayed.secure = true;
  }
  return relayed;
}

export async function relaySessionCookie(setCookies: readonly string[]): Promise<boolean> {
  const relayed = parseSessionCookie(setCookies);
  if (!relayed) return false;

  (await cookies()).set(SESSION_COOKIE, relayed.value, {
    httpOnly: true,
    sameSite: 'lax',
    path: relayed.path,
    secure: relayed.secure,
    ...(relayed.expires ? { expires: relayed.expires } : {}),
    ...(relayed.domain ? { domain: relayed.domain } : {}),
  });
  return true;
}
