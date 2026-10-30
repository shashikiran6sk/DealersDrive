import type { CursorPage } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import { decodeKeysetCursor, encodeKeysetCursor } from '../../platform/pagination.js';

import { CALL_LEAD_SELECT, type CallLeadRow } from './call-leads.mapper.js';

export const CALL_LEAD_REPEAT_WINDOW_HOURS = 24;

export async function recordCallLead(
  tx: Tx,
  lead: { customerId: string; dealerId: string; listingId: string },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO "call_leads" ("id", "customerId", "dealerId", "listingId")
    VALUES (gen_random_uuid(), ${lead.customerId}::uuid, ${lead.dealerId}::uuid, ${lead.listingId}::uuid)
    ON CONFLICT ("customerId", "listingId") DO UPDATE
      SET "lastRevealedAt" = CURRENT_TIMESTAMP,
          "revealCount" = "call_leads"."revealCount" + 1,
          "dealerId" = EXCLUDED."dealerId"
      WHERE "call_leads"."lastRevealedAt"
        < CURRENT_TIMESTAMP - make_interval(hours => ${CALL_LEAD_REPEAT_WINDOW_HOURS})`;
}

export async function callLeadPage(
  prisma: PrismaClient,
  scope: Prisma.CallLeadWhereInput,
  query: { cursor?: string; limit: number },
): Promise<{ rows: CallLeadRow[]; page: CursorPage }> {
  const cursor = query.cursor ? decodeKeysetCursor(query.cursor) : null;
  const rows = await prisma.callLead.findMany({
    where: {
      AND: [
        scope,
        ...(cursor
          ? [
              {
                OR: [
                  { lastRevealedAt: { lt: cursor.at } },
                  { lastRevealedAt: cursor.at, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ lastRevealedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    select: CALL_LEAD_SELECT,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    page: {
      nextCursor: hasMore && last ? encodeKeysetCursor(last.lastRevealedAt, last.id) : null,
      hasMore,
    },
  };
}
