import {
  DEALER_PERMISSIONS,
  dealerPermissionsFor,
  type DealerPermission,
} from '@dealers-drive/contracts';
import type { AdminRole, DealerRole, DealerStatus } from '@prisma/client';
import type { Request } from 'express';

export interface DealerPrincipal {
  kind: 'DEALER';
  userId: string;
  dealerId: string;
  dealerSlug: string;
  role: DealerRole;
  dealerStatus: DealerStatus;
  permissions: readonly string[];
}

export interface PendingPrincipal {
  kind: 'PENDING';
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  permissions: readonly string[];
}

export interface AdminPrincipal {
  kind: 'ADMIN';
  userId: string;
  email: string;
  adminRole: AdminRole;
  permissions: readonly string[];
}

export interface CustomerPrincipal {
  kind: 'CUSTOMER';
  userId: string;
  fullName: string;
  phone: string;
  via: 'CUSTOMER' | 'DEALER';
  permissions: readonly string[];
}

export type Principal = DealerPrincipal | PendingPrincipal | AdminPrincipal | CustomerPrincipal;

export interface SessionResolver {
  resolveDealer(req: Request): Promise<DealerPrincipal | null>;
  resolveAdmin(req: Request): Promise<AdminPrincipal | null>;
  resolveSignedIn(req: Request): Promise<DealerPrincipal | PendingPrincipal | null>;
}

export const PERMISSIONS = DEALER_PERMISSIONS;

export const ADMIN_PERMISSIONS = {
  'admin:dealer:approve': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:document:review': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:listing:moderate': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:media:upload': ['MODERATOR', 'SUPER_ADMIN'],
  'admin:credit:grant': ['SUPER_ADMIN'],
  'admin:payment:read': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:payment:refund': ['SUPER_ADMIN'],
  'admin:config:write': ['SUPER_ADMIN'],
  'admin:access:manage': ['SUPER_ADMIN'],
  'admin:audit:read': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:metrics:read': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:enquiry:read': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
  'admin:support:manage': ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly AdminRole[]>;

export type { DealerPermission };
export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

export function permissionsForRole(role: DealerRole): string[] {
  return dealerPermissionsFor(role);
}

export function permissionsForAdminRole(role: AdminRole): string[] {
  return Object.entries(ADMIN_PERMISSIONS)
    .filter(([, roles]) => roles.some((candidate) => candidate === role))
    .map(([permission]) => permission);
}
