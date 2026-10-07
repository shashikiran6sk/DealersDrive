import {
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_STATUS_TONES,
  formatDateTime,
  type AdminNotificationRow,
  type AdminNotificationsQuery,
  type AdminNotificationsResponse,
  type NotificationStatus,
} from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { decodeKeysetCursor, encodeKeysetCursor } from '../../platform/pagination.js';

const ROW_SELECT = {
  id: true,
  template: true,
  channel: true,
  recipient: true,
  subject: true,
  status: true,
  attempts: true,
  lastError: true,
  createdAt: true,
  sentAt: true,
  dealer: { select: { id: true, brandName: true, legalName: true } },
} satisfies Prisma.NotificationDeliverySelect;

type Row = Prisma.NotificationDeliveryGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: Row): AdminNotificationRow {
  return {
    id: row.id,
    template: row.template,
    channel: row.channel,
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    statusLabel: NOTIFICATION_STATUS_LABELS[row.status],
    statusTone: NOTIFICATION_STATUS_TONES[row.status],
    attempts: row.attempts,
    lastError: row.lastError,
    dealer: row.dealer
      ? { id: row.dealer.id, name: row.dealer.brandName || row.dealer.legalName }
      : null,
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDateTime(row.createdAt),
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}

function searchOf(q: string | undefined): Prisma.NotificationDeliveryWhereInput {
  if (!q) return {};
  return {
    OR: [
      { recipient: { contains: q, mode: 'insensitive' } },
      { template: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
    ],
  };
}

export function createAdminNotificationsService({ prisma }: { prisma: PrismaClient }) {
  return {
    async list(query: AdminNotificationsQuery): Promise<AdminNotificationsResponse> {
      const scope = searchOf(query.q);
      const cursor = query.cursor ? decodeKeysetCursor(query.cursor) : null;
      const where: Prisma.NotificationDeliveryWhereInput = {
        AND: [
          scope,
          ...(query.status ? [{ status: query.status }] : []),
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.at } },
                    ...(cursor.id ? [{ createdAt: cursor.at, id: { lt: cursor.id } }] : []),
                  ],
                },
              ]
            : []),
        ],
      };

      const [rows, grouped] = await Promise.all([
        prisma.notificationDelivery.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          select: ROW_SELECT,
        }),
        prisma.notificationDelivery.groupBy({
          by: ['status'],
          where: scope,
          _count: { _all: true },
        }),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const of = (status: NotificationStatus) =>
        grouped.find((row) => row.status === status)?._count._all ?? 0;

      return {
        data: page.map(toRow),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.createdAt, last.id) : null,
          hasMore,
        },
        counts: {
          ALL: of('PENDING') + of('SENT') + of('FAILED'),
          PENDING: of('PENDING'),
          SENT: of('SENT'),
          FAILED: of('FAILED'),
        },
      };
    },
  };
}

export type AdminNotificationsService = ReturnType<typeof createAdminNotificationsService>;
