import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import {
  permissionsForAdminRole,
  permissionsForRole,
  type DealerPrincipal,
  type SessionResolver,
} from './session.port.js';

/**
 * The local development session (CLAUDE.md §5, §17).
 *
 * The identity is *server-configured* — `DEV_DEALER_SLUG` and
 * `DEV_ADMIN_EMAIL` — and re-read from the database on every request, so the
 * principal always carries a real dealer id, role and current status. That
 * last part matters: suspending the dealer from the admin console takes effect
 * on the very next request, exactly as a revoked session will.
 *
 * Nothing about the request influences who you are. There is no header, cookie
 * or body field a client could set to become another dealer, which is the
 * property that keeps tenant isolation intact while sign-in is bypassed.
 *
 * Swapping this for `CookieSessionResolver` is one line in `container.ts`.
 */
export function createDevSessionResolver(prisma: PrismaClient): SessionResolver {
  async function resolveDealer(): Promise<DealerPrincipal | null> {
    const dealer = await prisma.dealer.findUnique({
      where: { slug: env.DEV_DEALER_SLUG },
      include: {
        members: {
          where: { status: 'ACTIVE', role: 'OWNER' },
          take: 1,
          orderBy: { id: 'asc' },
        },
      },
    });

    const membership = dealer?.members[0];
    if (!dealer || !membership) return null;

    return {
      kind: 'DEALER',
      userId: membership.userId,
      dealerId: dealer.id,
      dealerSlug: dealer.slug,
      role: membership.role,
      dealerStatus: dealer.status,
      permissions: permissionsForRole(membership.role),
    };
  }

  return {
    resolveDealer,
    // The configured dealer always exists, so there is no pending state to
    // model here: `AUTH_MODE=dev` skips sign-up as well as sign-in.
    resolveSignedIn: resolveDealer,

    async resolveAdmin() {
      const user = await prisma.user.findFirst({
        where: { email: env.DEV_ADMIN_EMAIL, isPlatformAdmin: true },
      });

      if (!user?.adminRole) return null;

      return {
        kind: 'ADMIN',
        userId: user.id,
        email: user.email ?? env.DEV_ADMIN_EMAIL,
        adminRole: user.adminRole,
        permissions: permissionsForAdminRole(user.adminRole),
      };
    },
  };
}
