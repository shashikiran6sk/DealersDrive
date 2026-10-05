import 'server-only';

import { cookies } from 'next/headers';

import { AUTH_HINT_COOKIE, AUTH_HINT_MAX_AGE_SECONDS, AUTH_HINT_VALUE } from './auth-hint';

export async function writeAuthHint(signedIn: boolean, expires?: Date): Promise<void> {
  (await cookies()).set(
    AUTH_HINT_COOKIE,
    signedIn ? AUTH_HINT_VALUE.signedIn : AUTH_HINT_VALUE.signedOut,
    {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      ...(signedIn && expires ? { expires } : { maxAge: AUTH_HINT_MAX_AGE_SECONDS }),
    },
  );
}
