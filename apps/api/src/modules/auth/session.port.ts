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

/**
 * A verified human with no dealership yet.
 *
 * This is the state between "Google says this is really them" and "they have
 * told us about their business" — the only state in which `POST /v1/auth/
 * onboarding` may be called, and one that carries no permissions at all, so a
 * half-finished sign-up can reach nothing a dealer can reach.
 */
export interface PendingPrincipal {
  kind: 'PENDING';
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  /** Always empty. Present so `requirePermission` reads one shape, not two. */
  permissions: readonly string[];
}

export interface AdminPrincipal {
  kind: 'ADMIN';
  userId: string;
  email: string;
  adminRole: AdminRole;
  permissions: readonly string[];
}

export type Principal = DealerPrincipal | PendingPrincipal | AdminPrincipal;

/**
 * The seam that decides identity. `CookieSessionResolver` reads the
 * `dd_session` cookie, looks up the `sessions` row and hydrates these shapes;
 * `DevSessionResolver` reads a server-configured identity instead, for a
 * developer with no Google credentials (`AUTH_MODE=dev`).
 *
 * Note what the signature does *not* offer: no way to pass an identity in.
 * The request is available only so a cookie can be read from it.
 */
export interface SessionResolver {
  resolveDealer(req: Request): Promise<DealerPrincipal | null>;
  resolveAdmin(req: Request): Promise<AdminPrincipal | null>;
  /**
   * Anyone holding a valid dealer-scope session, whether or not they have a
   * dealership. `resolveDealer` is this, narrowed — which is why a route that
   * needs a tenant can never accidentally be satisfied by a pending account.
   */
  resolveSignedIn(req: Request): Promise<DealerPrincipal | PendingPrincipal | null>;
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
