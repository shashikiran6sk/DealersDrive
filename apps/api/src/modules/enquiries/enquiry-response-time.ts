import type { PrismaClient } from '@prisma/client';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';

export const RESPONSE_WINDOW_DAYS = 90;
export const RESPONSE_MINIMUM_SAMPLES = 5;

export async function lockDealerResponseTime(tx: Tx, dealerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dealer-response:${dealerId}`}))`;
}

export async function refreshDealerResponseTime(
  tx: Tx,
  dealerId: string,
  now = new Date(),
): Promise<void> {
  const from = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * 86_400_000);
  await tx.$executeRaw`
    UPDATE "dealers" SET "medianResponseMins" = (
      SELECT CASE WHEN COUNT(*) >= ${RESPONSE_MINIMUM_SAMPLES}
        THEN CEIL(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM ("contactedAt" - "createdAt")) / 60.0
        ))::integer ELSE NULL END
      FROM "enquiries" WHERE "dealerId" = ${dealerId}::uuid
        AND "createdAt" >= ${from} AND "createdAt" <= ${now}
        AND "contactedAt" >= "createdAt" AND "contactedAt" <= ${now}
        AND "status" <> 'SPAM'
    ) WHERE "id" = ${dealerId}::uuid`;
}

export async function refreshAllDealerResponseTimes(prisma: PrismaClient): Promise<void> {
  const dealers = await prisma.dealer.findMany({ select: { id: true } });
  for (const dealer of dealers) {
    await withTransaction(prisma, async (tx) => {
      await lockDealerResponseTime(tx, dealer.id);
      await refreshDealerResponseTime(tx, dealer.id);
    });
  }
}
