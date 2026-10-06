import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

import { isAdmitted, permissionsForMember } from './admin-member.js';
import { findWorkspaceMembership } from './membership.js';
import { isSeatSuspended } from './roles.js';
import { readSessionToken } from './session.cookie.js';
import type { SessionService } from './session.service.js';
import {
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
    const session = await sessions.resolvePerson(readSessionToken(req));
    if (!session || session.user.status !== 'ACTIVE') return null;

    if (isSeatSuspended(session.user.roles, 'DEALER')) return null;

    const { membership, suspended } = await findWorkspaceMembership(
      prisma,
      session.userId,
      session.activeDealerId,
    );
    if (suspended) return null;

    if (!membership) {
      if (session.scope !== 'DEALER') return null;
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

    return {
      kind: 'DEALER',
      sessionId: session.id,
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
      if (!user) return null;

      const member = user.adminMember;
      if (!member || !isAdmitted({ email: user.email, status: user.status, member })) return null;

      return {
        kind: 'ADMIN',
        userId: user.id,
        memberId: member.id,
        email: user.email ?? '',
        adminRole: member.role,
        permissions: permissionsForMember(member.role),
      };
    },
  };
}
