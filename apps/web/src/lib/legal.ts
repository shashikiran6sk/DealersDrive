import 'server-only';

import {
  LegalStatus,
  legalV1Enabled,
  legalV1Ready,
  type LegalScope,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiError, apiGetParsed, SESSION_COOKIE } from './api';
import { serverConfig } from './config';

export function legalPagesVisible(): boolean {
  return serverConfig().appEnv !== 'production' || legalV1Ready();
}

export function legalGateEnabled(): boolean {
  return legalV1Enabled(
    serverConfig().appEnv === 'production',
    process.env.LEGAL_V1_PREVIEW === 'true',
  );
}

export async function legalStatus(scope: LegalScope): Promise<LegalStatus | null> {
  if (!legalGateEnabled() || !(await cookies()).get(SESSION_COOKIE)?.value) return null;
  try {
    return await apiGetParsed(LegalStatus, `/v1/legal/status?scope=${scope}`, {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function requireCustomerLegal(returnTo: string): Promise<void> {
  const status = await legalStatus('CUSTOMER');
  if (status?.enabled && !status.accepted)
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}
