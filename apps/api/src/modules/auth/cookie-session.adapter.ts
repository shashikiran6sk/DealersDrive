import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

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

/**
 * The production session resolver: cookie → `sessions` row → principal.
 *
 * Two properties are worth naming, because the rest of the security model rests
 * on them.
 *
 * **The principal is rebuilt from the database on every request.** Nothing is
 * cached in the token. Suspending a dealership, changing a member's role or
 * revoking a session takes effect on the very next call, with no window in
 * which a stale claim is still honoured.
 *
 * **The request is read for exactly one thing — the cookie.** There is no
 * header, body field or query parameter that can influence who the caller is,
 * which is the property that keeps tenant isolation intact no matter what a
 * route handler does afterwards.
 */
export function createCookieSessionResolver(
  prisma: PrismaClient,
  sessions: SessionService,
): SessionResolver {
  async function signedIn(req: Request): Promise<DealerPrincipal | PendingPrincipal | null> {
    const session = await sessions.resolve(readSessionToken(req), 'DEALER');
    if (!session || session.user.status !== 'ACTIVE') return null;

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
        permissions: [],
      };
    }

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

    /**
     * A separate scope, not a separate check: an admin session is a different
     * row with `scope = 'ADMIN'`, so a dealer's cookie cannot reach an admin
     * route even if that same human is also a platform admin.
     */
    async resolveAdmin(req): Promise<AdminPrincipal | null> {
      const session = await sessions.resolve(readSessionToken(req), 'ADMIN');
      const user = session?.user;

      if (!user?.isPlatformAdmin || !user.adminRole || user.status !== 'ACTIVE') return null;

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
