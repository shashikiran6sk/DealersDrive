import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

import { isAllowlistedAdmin } from './admin-allowlist.js';
import { hasGrantedSeat, isSeatSuspended } from './roles.js';
import { readSessionToken } from './session.cookie.js';
import type { SessionService } from './session.service.js';
import {
  permissionsForAdminRole,
  permissionsForRole,
  type AdminPrincipal,
  type DealerPrincipal,
  type PendingPrincipal,
  type SessionResolver,
} from './session.port.js';

export function createCookieSessionResolver(
  prisma: PrismaClient,
  sessions: SessionService,
): SessionResolver {
  async function signedIn(req: Request): Promise<DealerPrincipal | PendingPrincipal | null> {
    const session = await sessions.resolve(readSessionToken(req), 'DEALER');
    if (!session || session.user.status !== 'ACTIVE') return null;

    if (isSeatSuspended(session.user.roles, 'DEALER')) return null;

    const membership = await prisma.dealerMember.findFirst({
      where: { userId: session.userId, status: 'ACTIVE' },
      include: { dealer: true },
      orderBy: { id: 'asc' },
    });

    if (!membership) {
      return {
        kind: 'PENDING',
        userId: session.userId,
        email: session.user.email,
        fullName: session.user.fullName,
        phone: session.user.phone,
        phoneVerified: session.user.phoneVerifiedAt !== null,
        permissions: [],
      };
    }

    if (membership.dealer.status === 'SUSPENDED') return null;

    return {
      kind: 'DEALER',
      userId: session.userId,
      dealerId: membership.dealerId,
      dealerSlug: membership.dealer.slug,
      role: membership.role,
      dealerStatus: membership.dealer.status,
      permissions: permissionsForRole(membership.role),
    };
  }

  return {
    resolveSignedIn: signedIn,

    async resolveDealer(req) {
      const principal = await signedIn(req);
      return principal?.kind === 'DEALER' ? principal : null;
    },

    async resolveAdmin(req): Promise<AdminPrincipal | null> {
      const session = await sessions.resolve(readSessionToken(req), 'ADMIN');
      const user = session?.user;

      if (!user?.isPlatformAdmin || !user.adminRole || user.status !== 'ACTIVE') return null;
      if (isSeatSuspended(user.roles, 'ADMIN')) return null;

      if (!isAllowlistedAdmin(user.email) && !hasGrantedSeat(user.roles, 'ADMIN')) return null;

      return {
        kind: 'ADMIN',
        userId: user.id,
        email: user.email ?? '',
        adminRole: user.adminRole,
        permissions: permissionsForAdminRole(user.adminRole),
      };
    },
  };
}
