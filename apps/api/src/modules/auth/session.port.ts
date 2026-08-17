import type { AdminRole, DealerRole, DealerStatus } from '@prisma/client';
import type { Request } from 'express';

/**
 * Who is making this request.
 *
 * The only thing the current build bypasses is the *identity verification
 * mechanism* — the OTP round-trip (CLAUDE.md §5). Everything downstream still
 * behaves exactly as it will in production: `dealerId` is a property of the
 * resolved principal, never a field a client can send, and every permission
 * check runs unchanged.
 */
export interface DealerPrincipal {
  kind: 'DEALER';
  userId: string;
  dealerId: string;
  dealerSlug: string;
  role: DealerRole;
  dealerStatus: DealerStatus;
  permissions: readonly string[];
}

export interface AdminPrincipal {
  kind: 'ADMIN';
  userId: string;
  email: string;
  adminRole: AdminRole;
  permissions: readonly string[];
}

export type Principal = DealerPrincipal | AdminPrincipal;

/**
 * The seam production auth replaces. `DevSessionResolver` reads a
 * server-configured identity; `CookieSessionResolver` will read the
 * `dd_session` cookie, look up the `sessions` row and hydrate the same shape.
 *
 * Note what the signature does *not* offer: no way to pass an identity in.
 * The request is available only so a cookie can be read from it.
 */
export interface SessionResolver {
  resolveDealer(req: Request): Promise<DealerPrincipal | null>;
  resolveAdmin(req: Request): Promise<AdminPrincipal | null>;
}

/** ARCHITECTURE §8.3, verbatim. */
export const PERMISSIONS = {
  'vehicle:read': ['OWNER', 'MANAGER', 'SALES'],
  'vehicle:write': ['OWNER', 'MANAGER'],
  'vehicle:delete': ['OWNER', 'MANAGER'],
  'listing:submit': ['OWNER', 'MANAGER'],
  'listing:renew': ['OWNER', 'MANAGER'],
  'enquiry:read': ['OWNER', 'MANAGER', 'SALES'],
  'enquiry:update': ['OWNER', 'MANAGER', 'SALES'],
  'photo:request': ['OWNER', 'MANAGER'],
  'dealer:update': ['OWNER'],
  'document:upload': ['OWNER'],
  'billing:read': ['OWNER', 'MANAGER'],
  'billing:purchase': ['OWNER'],
  'member:manage': ['OWNER'],
} as const satisfies Record<string, readonly DealerRole[]>;

export const ADMIN_PERMISSIONS = {
  'admin:dealer:approve': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:document:review': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:listing:moderate': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:media:upload': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:credit:grant': ['SUPER_ADMIN'],
  'admin:payment:read': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:payment:refund': ['SUPER_ADMIN'],
  'admin:config:write': ['SUPER_ADMIN'],
  'admin:audit:read': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:metrics:read': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly AdminRole[]>;

export type DealerPermission = keyof typeof PERMISSIONS;
export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

export function permissionsForRole(role: DealerRole): string[] {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => (roles as readonly string[]).includes(role))
    .map(([permission]) => permission);
}

export function permissionsForAdminRole(role: AdminRole): string[] {
  return Object.entries(ADMIN_PERMISSIONS)
    .filter(([, roles]) => (roles as readonly string[]).includes(role))
    .map(([permission]) => permission);
}
