import 'server-only';

import type { AdminOverview, AuthSession } from '@dealers-drive/contracts';
import { cookies } from 'next/headers';

import { ApiError, apiGet, SESSION_COOKIE } from './api';

export async function hasSession(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function currentSession(): Promise<AuthSession | null> {
  try {
    return await apiGet<AuthSession>('/v1/auth/me', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export const ADMIN_CONSOLE_FORBIDDEN = 'ADMIN_CONSOLE_FORBIDDEN';

export function isConsoleRefusal(error: unknown): boolean {
  return error instanceof ApiError && error.code === ADMIN_CONSOLE_FORBIDDEN;
}

export async function currentAdmin(): Promise<AdminOverview | null> {
  try {
    return await apiGet<AdminOverview>('/v1/admin/metrics/overview', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    if (isConsoleRefusal(error)) return null;
    throw error;
  }
}

export function destinationFor(session: AuthSession): string {
  return session.next === 'ONBOARDING' ? '/dealer/onboarding' : '/dealer';
}
