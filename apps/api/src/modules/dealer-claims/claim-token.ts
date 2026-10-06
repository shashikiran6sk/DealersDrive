import { createHash, randomBytes } from 'node:crypto';

export const CLAIM_LINK_TTL_MS = 72 * 60 * 60 * 1000;

export const RESEND_COOLDOWN_MS = 60 * 1000;

export function mintClaimToken(): string {
  return randomBytes(32).toString('base64url');
}

export function claimTokenHash(token: string): string {
  return createHash('sha256').update(`dealer-claim:${token}`).digest('hex');
}

export function claimUrl(webBaseUrl: string, token: string): string {
  return `${webBaseUrl}/claim/${token}`;
}
