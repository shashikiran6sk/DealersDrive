import {
  DEALER_ROLE_LABELS,
  type DealerWorkspacesResponse,
  type SelectWorkspaceInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import { NotFoundError, UnauthorizedError } from '../../platform/errors.js';
import { WORKSPACE_NOT_FOUND } from './auth.messages.js';
import {
  activeMemberships,
  chooseWorkspace,
  isEnterable,
  type MembershipWithDealer,
} from './membership.js';
import type { SessionService } from './session.service.js';

export interface WorkspaceDeps {
  prisma: PrismaClient;
  sessions: SessionService;
  audit: AuditService;
}

function toResponse(
  memberships: readonly MembershipWithDealer[],
  current: MembershipWithDealer | null,
): DealerWorkspacesResponse {
  return {
    data: memberships.map((membership) => ({
      membershipId: membership.id,
      dealer: {
        id: membership.dealer.id,
        slug: membership.dealer.slug,
        brandName: membership.dealer.brandName,
        status: membership.dealer.status,
      },
      role: membership.role,
      roleLabel: DEALER_ROLE_LABELS[membership.role],
      enterable: isEnterable(membership),
      current: membership.id === current?.id,
    })),
  };
}

export function createWorkspaceService({ prisma, sessions, audit }: WorkspaceDeps) {
  async function sessionFor(token: string | undefined, userId: string) {
    const session = await sessions.resolvePerson(token);
    if (!session || session.userId !== userId) throw new UnauthorizedError();
    return session;
  }

  return {
    async list(token: string | undefined, userId: string): Promise<DealerWorkspacesResponse> {
      const session = await sessionFor(token, userId);
      const memberships = await activeMemberships(prisma, userId);
      return toResponse(memberships, chooseWorkspace(memberships, session.activeDealerId));
    },

    async select(
      token: string | undefined,
      userId: string,
      input: SelectWorkspaceInput,
    ): Promise<DealerWorkspacesResponse> {
      const session = await sessionFor(token, userId);
      const memberships = await activeMemberships(prisma, userId);
      const chosen = memberships.find(
        (membership) => membership.id === input.membershipId && isEnterable(membership),
      );
      if (!chosen) throw new NotFoundError(WORKSPACE_NOT_FOUND, { code: 'WORKSPACE_NOT_FOUND' });

      if (session.activeDealerId !== chosen.dealerId) {
        await sessions.setActiveDealer(session.id, chosen.dealerId);
        await audit.recordDetached({
          actorType: 'DEALER',
          actorId: userId,
          dealerId: chosen.dealerId,
          action: 'auth.workspace.selected',
          entityType: 'DealerMember',
          entityId: chosen.id,
          after: { role: chosen.role },
        });
      }

      return toResponse(memberships, chosen);
    },
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
