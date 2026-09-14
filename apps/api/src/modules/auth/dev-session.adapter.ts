import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import {
  permissionsForAdminRole,
  permissionsForRole,
  type DealerPrincipal,
  type SessionResolver,
} from './session.port.js';

export function createDevSessionResolver(prisma: PrismaClient): SessionResolver {
  async function resolveDealer(): Promise<DealerPrincipal | null> {
    const dealer = await prisma.dealer.findUnique({
      where: { slug: env.DEV_DEALER_SLUG },
      include: {
        members: {
          where: {
            status: 'ACTIVE',
            role: 'OWNER',
            user: {
              status: 'ACTIVE',
              roles: { none: { role: 'DEALER', status: 'SUSPENDED' } },
            },
          },
          take: 1,
          orderBy: { id: 'asc' },
        },
      },
    });

    const membership = dealer?.members[0];
    if (!dealer || dealer.status === 'SUSPENDED' || !membership) return null;

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
    resolveSignedIn: resolveDealer,

    async resolveAdmin() {
      const email = env.adminAllowlist[0];
      if (!email) return null;

      const user = await prisma.user.findFirst({
        where: {
          email,
          isPlatformAdmin: true,
          roles: { none: { role: 'ADMIN', status: 'SUSPENDED' } },
        },
      });

      if (!user?.adminRole) return null;

      return {
        kind: 'ADMIN',
        userId: user.id,
        email: user.email ?? email,
        adminRole: user.adminRole,
        permissions: permissionsForAdminRole(user.adminRole),
      };
    },
  };
}
