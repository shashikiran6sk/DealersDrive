import {
  ADMIN_PERMISSIONS as ADMIN_PERMISSION_TABLE,
  DEALER_PERMISSIONS,
  adminPermissionsFor,
  dealerPermissionsFor,
  type AdminPermission,
  type DealerPermission,
} from '@dealers-drive/contracts';
import type { AdminRole, DealerRole, DealerStatus } from '@prisma/client';
import type { Request } from 'express';

export interface DealerPrincipal {
  kind: 'DEALER';
  sessionId?: string;
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
  memberId?: string;
  email: string;
  adminRole: AdminRole;
  permissions: readonly string[];
}

export interface CustomerPrincipal {
  kind: 'CUSTOMER';
  sessionId?: string;
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

export const ADMIN_PERMISSIONS = ADMIN_PERMISSION_TABLE;

export type { DealerPermission };
export type { AdminPermission };

export function permissionsForRole(role: DealerRole): string[] {
  return dealerPermissionsFor(role);
}

export function permissionsForAdminRole(role: AdminRole): string[] {
  return adminPermissionsFor(role);
}
