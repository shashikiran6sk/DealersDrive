import type { AuditEntry, AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';

export async function invalidateDealerVerification(
  tx: Tx,
  audit: AuditService,
  dealer: { id: string; verificationStatus: string; verificationVersion: number },
  actor: Pick<AuditEntry, 'actorType' | 'actorId'>,
  reason: string,
): Promise<void> {
  if (dealer.verificationStatus !== 'VERIFIED') return;
  await tx.$queryRaw`SELECT "id" FROM "dealer_documents" WHERE "dealerId"=${dealer.id}::uuid ORDER BY "id" FOR UPDATE`;
  await tx.dealerDocument.updateMany({
    where: { dealerId: dealer.id, status: 'VERIFIED' },
    data: { status: 'UPLOADED', reviewedAt: null, reviewedBy: null },
  });
  await tx.dealer.update({
    where: { id: dealer.id },
    data: {
      verificationStatus: 'REVOKED',
      verificationVersion: { increment: 1 },
      verificationVerifiedAt: null,
    },
  });
  await audit.record(tx, {
    ...actor,
    dealerId: dealer.id,
    action: 'dealer.verification.decided',
    entityType: 'Dealer',
    entityId: dealer.id,
    before: { status: 'VERIFIED', version: dealer.verificationVersion },
    after: {
      status: 'REVOKED',
      version: dealer.verificationVersion + 1,
      reason,
      assessment: null,
      policyVersion: 'dd-business-verification-v1',
      documentReviewsInvalidated: true,
    },
  });
}
