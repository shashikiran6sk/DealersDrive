import type { PrismaClient } from '@prisma/client';
import { type ProgressivePlanInput, ProgressiveState } from '@dealers-drive/contracts';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../platform/errors.js';
import {
  isAdmitted,
  isSeatSuspended,
  permissionsForMember,
  type AdminPrincipal,
} from '../auth/auth.facade.js';
import type { Tx } from '../../platform/db/prisma.js';
import { progressiveIdentityHash } from '../dealers/dealers.facade.js';

export function createProgressiveReviewService({
  prisma,
  audit,
}: {
  prisma: PrismaClient;
  audit: AuditService;
}) {
  return {
    async decide(admin: AdminPrincipal, dealerId: string, input: ProgressivePlanInput) {
      return withTransaction(prisma, async (tx) => {
        if (!admin.permissions.includes('admin:dealer:approve'))
          throw new ForbiddenError(
            'Only authorized reviewers can set the applicable verification plan.',
          );
        await assertProgressiveReviewer(tx, admin);
        await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id"=${dealerId}::uuid FOR UPDATE`;
        const dealer = await tx.dealer.findUnique({
          where: { id: dealerId },
          include: { members: { where: { status: 'ACTIVE' } }, assistedBy: true },
        });
        if (!dealer?.progressiveRegisteredAt || !dealer.progressiveConsentVersion)
          throw new NotFoundError('This is not a progressive application.');
        if (dealer.status !== 'DRAFT' && dealer.status !== 'PENDING_APPROVAL')
          throw new ConflictError(
            'PROGRESSIVE_LOCKED',
            'An activated business is not silently reclassified. Use a controlled correction/reverification process.',
          );
        if (
          dealer.assistedBy?.userId === admin.userId ||
          dealer.members.some((m) => m.userId === admin.userId)
        )
          throw new ForbiddenError('Another reviewer must decide this application.');
        if (dealer.progressiveVersion !== input.expectedVersion)
          throw new ConflictError(
            'PROGRESSIVE_CHANGED',
            'Application changed. Reload before recording the plan.',
          );
        const now = new Date();
        await tx.dealer.update({
          where: { id: dealerId },
          data: {
            progressivePlan: {
              plan: input.plan,
              identityHash: progressiveIdentityHash(dealer),
              reviewerId: admin.userId,
              reviewedAt: now.toISOString(),
            },
            progressiveVersion: { increment: 1 },
          },
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.progressive.plan_reviewed',
          entityType: 'Dealer',
          entityId: dealerId,
          before: { version: dealer.progressiveVersion },
          after: {
            version: dealer.progressiveVersion + 1,
            classification: input.plan.classification,
            requiredDocuments: input.plan.requiredDocuments,
            gstRequirement: input.plan.gstRequirement,
            reviewedAt: now.toISOString(),
          },
        });
        return ProgressiveState.parse({
          dealerId,
          stage: dealer.status === 'PENDING_APPROVAL' ? 'ACTIVATE' : 'VERIFY',
          registeredAt: dealer.progressiveRegisteredAt.toISOString(),
          consentVersion: dealer.progressiveConsentVersion,
          version: dealer.progressiveVersion + 1,
          classificationReviewed: true,
          requiredDocuments: input.plan.requiredDocuments,
          canSubmit: false,
          canActivate: false,
        });
      });
    },
  };
}

export async function assertProgressiveReviewer(tx: Tx, admin: AdminPrincipal) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${admin.userId}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "admin_members" WHERE "userId"=${admin.userId}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "user_roles" WHERE "userId"=${admin.userId}::uuid AND "role"='ADMIN' FOR SHARE`;
  const actor = await tx.user.findUnique({
    where: { id: admin.userId },
    include: { roles: true, adminMember: true },
  });
  if (
    !actor ||
    !isAdmitted({ email: actor.email, status: actor.status, member: actor.adminMember }) ||
    isSeatSuspended(actor.roles, 'ADMIN') ||
    !actor.adminMember ||
    !permissionsForMember(actor.adminMember.role).includes('admin:dealer:approve')
  )
    throw new ForbiddenError('Your review access is no longer available.');
}
