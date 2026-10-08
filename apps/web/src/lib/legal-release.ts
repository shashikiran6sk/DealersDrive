import 'server-only';
import { legalReleaseReady } from '@dealers-drive/contracts';
import { serverConfig } from './config';
export function legalPagesVisible(): boolean {
  const production =
    serverConfig().appEnv === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && !process.env.APP_ENV);
  return legalReleaseReady() || !production;
}
export function legalEnforcementEnabled(): boolean {
  const enabled = process.env.LEGAL_ENFORCEMENT_ENABLED === 'true';
  if (enabled && !legalPagesVisible()) {
    throw new Error('Legal publication is blocked pending factual completion and legal approval.');
  }
  return enabled;
}
