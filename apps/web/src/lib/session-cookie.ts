import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE, ADMIN_SESSION_COOKIE } from './api';
import { writeAuthHint } from './auth-hint-cookie';

export interface RelayedCookie {
  value: string;
  expires?: Date;
  domain?: string;
  path: string;
  secure: boolean;
}

export function parseSessionCookie(
  setCookies: readonly string[],
  cookieName = SESSION_COOKIE,
): RelayedCookie | null {
  const header = setCookies.find((entry) => entry.startsWith(`${cookieName}=`));
  if (!header) return null;

  const [pair = '', ...attributes] = header.split(';').map((part) => part.trim());
  const value = pair.slice(cookieName.length + 1);
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

export async function relaySessionCookie(
  setCookies: readonly string[],
  admin = false,
): Promise<boolean> {
  const cookieName = admin ? ADMIN_SESSION_COOKIE : SESSION_COOKIE;
  const relayed = parseSessionCookie(setCookies, cookieName);
  if (!relayed) return false;

  (await cookies()).set(cookieName, relayed.value, {
    httpOnly: true,
    sameSite: 'lax',
    path: relayed.path,
    secure: relayed.secure,
    ...(relayed.expires ? { expires: relayed.expires } : {}),
    ...(relayed.domain ? { domain: relayed.domain } : {}),
  });
  if (!admin) await writeAuthHint(true, relayed.expires);
  return true;
}
