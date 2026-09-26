import type { AdminListingQuery, AdminListingsResponse } from '@dealers-drive/contracts';

import { decodeCursor, encodeCursor } from '../../platform/pagination.js';
import { toAdminListingRow } from './moderation.mapper.js';
import { sortKeyOf, type ModerationRepository } from './moderation.repository.js';

export interface ModerationDeps {
  repo: ModerationRepository;
}

export function createModerationService({ repo }: ModerationDeps) {
  return {
    async listings(query: AdminListingQuery): Promise<AdminListingsResponse> {
      const status = query.status ?? 'PENDING_REVIEW';
      const [rows, counts] = await Promise.all([
        repo.queue({
          status,
          ...(query.q ? { q: query.q } : {}),
          ...(query.cursor ? { after: decodeCursor(query.cursor) } : {}),
          take: query.limit + 1,
        }),
        repo.statusCounts(),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const now = new Date();

      return {
        status,
        data: page.map((row) => toAdminListingRow(row, now)),
        page: { nextCursor: hasMore && last ? encodeCursor(sortKeyOf(last)) : null, hasMore },
        counts: Object.fromEntries(counts.map((row) => [row.status, row.count])),
      };
    },
  };
}

export type ModerationService = ReturnType<typeof createModerationService>;
