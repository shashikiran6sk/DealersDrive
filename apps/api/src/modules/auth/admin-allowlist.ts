import { env } from '../../config/env.js';

export function isAllowlistedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.adminAllowlist.includes(email.trim().toLowerCase());
}
