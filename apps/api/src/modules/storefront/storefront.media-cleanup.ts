import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

import type { StoragePort } from '../../platform/storage/storage.port.js';
import { logger } from '../../platform/telemetry/logger.js';

export function createStorefrontMediaCleanup(prisma: PrismaClient, storage: StoragePort) {
  return async function cleanup(): Promise<void> {
    const candidates = await prisma.$queryRaw<{ id: string; dealerId: string | null }[]>`
      SELECT m."id", m."dealerId" FROM "media" m
      WHERE m."storageKey" LIKE 'storefront/%' AND m."createdAt" < now() - interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM "dealer_storefronts" s WHERE s."dealerId"=m."dealerId"
          AND (s."logoMediaId"=m."id" OR s."heroMediaId"=m."id" OR m."id"=ANY(s."yardMediaIds")))
      ORDER BY m."createdAt", m."id" LIMIT 100`;
    for (const candidate of candidates) {
      if (!candidate.dealerId) continue;
      const dealerId = candidate.dealerId;
      try {
        const keys = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storefront:${dealerId}`}))`;
          const media = await tx.media.findUnique({ where: { id: candidate.id } });
          if (
            !media ||
            !media.storageKey.startsWith(`storefront/${candidate.dealerId}/${candidate.id}/`)
          )
            return [];
          const references = await tx.dealerStorefront.count({
            where: {
              dealerId,
              OR: [
                { logoMediaId: candidate.id },
                { heroMediaId: candidate.id },
                { yardMediaIds: { has: candidate.id } },
              ],
            },
          });
          if (references) return [];
          await tx.media.update({ where: { id: media.id }, data: { status: 'ORPHAN' } });
          const variants = z.record(z.string(), z.string()).safeParse(media.variants);
          const prefix = `storefront/${candidate.dealerId}/${candidate.id}/`;
          return [
            ...new Set([
              media.storageKey,
              ...(variants.success ? Object.values(variants.data) : []),
              ...[320, 640, 1024, 1600].map((width) => `${prefix}${width}.webp`),
            ]),
          ].filter((key) => key.startsWith(prefix));
        });
        for (const key of keys) await storage.delete(key);
        if (keys.length)
          await prisma.media.deleteMany({ where: { id: candidate.id, status: 'ORPHAN' } });
      } catch {
        logger.warn(
          { event: 'storefront.media.cleanup_failed' },
          'branding orphan cleanup failed; retained for retry',
        );
      }
    }
  };
}
