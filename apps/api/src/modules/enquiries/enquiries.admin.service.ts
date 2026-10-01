import {
  istDayStart,
  type AdminEnquiriesResponse,
  type AdminEnquiryDetail,
  type AdminEnquiryQuery,
  type DealerEnquiryCounts,
  type EnquiryStatus,
} from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { NotFoundError } from '../../platform/errors.js';
import { decodeKeysetCursor, encodeKeysetCursor } from '../../platform/pagination.js';
import {
  ADMIN_DETAIL_SELECT,
  ADMIN_ROW_SELECT,
  toAdminEnquiryDetail,
  toAdminEnquiryRow,
} from './enquiries.admin.mapper.js';
import { ADMIN_ENQUIRY_NOT_FOUND, ENQUIRY_HISTORY_LABELS } from './enquiries.messages.js';

export const MIN_PHONE_DIGITS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function enquirySearch(raw: string | undefined): Prisma.EnquiryWhereInput | null {
  const q = raw?.trim() ?? '';
  if (q === '') return null;
  const plate = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digits = q.replace(/\D/g, '');
  return {
    OR: [
      { customer: { fullName: { contains: q, mode: 'insensitive' } } },
      ...(digits.length >= MIN_PHONE_DIGITS ? [{ customer: { phone: { contains: digits } } }] : []),
      { dealer: { brandName: { contains: q, mode: 'insensitive' } } },
      { listing: { vehicle: { make: { contains: q, mode: 'insensitive' } } } },
      { listing: { vehicle: { model: { contains: q, mode: 'insensitive' } } } },
      ...(plate ? [{ listing: { vehicle: { registrationNumber: { contains: plate } } } }] : []),
    ],
  };
}

export function enquiryWindow(
  from: string | undefined,
  to: string | undefined,
): Prisma.EnquiryWhereInput | null {
  if (!from && !to) return null;
  return {
    createdAt: {
      ...(from ? { gte: istDayStart(from) } : {}),
      ...(to ? { lt: new Date(istDayStart(to).getTime() + DAY_MS) } : {}),
    },
  };
}

export function createAdminEnquiriesService({ prisma }: { prisma: PrismaClient }) {
  return {
    async list(query: AdminEnquiryQuery): Promise<AdminEnquiriesResponse> {
      const filters: Prisma.EnquiryWhereInput[] = [];
      if (query.dealer) filters.push({ dealer: { slug: query.dealer } });
      const window = enquiryWindow(query.from, query.to);
      if (window) filters.push(window);
      const search = enquirySearch(query.q);
      if (search) filters.push(search);
      const scope: Prisma.EnquiryWhereInput = { AND: filters };

      const cursor = query.cursor ? decodeKeysetCursor(query.cursor) : null;
      const where: Prisma.EnquiryWhereInput = {
        AND: [
          scope,
          ...(query.status ? [{ status: query.status }] : []),
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.at } },
                    { createdAt: cursor.at, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      };

      const [rows, grouped, dealer] = await Promise.all([
        prisma.enquiry.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          select: ADMIN_ROW_SELECT,
        }),
        prisma.enquiry.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
        query.dealer
          ? prisma.dealer.findUnique({ where: { slug: query.dealer }, select: { brandName: true } })
          : Promise.resolve(null),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const of = (status: EnquiryStatus) =>
        grouped.find((row) => row.status === status)?._count._all ?? 0;
      const counts: DealerEnquiryCounts = {
        ALL: grouped.reduce((sum, row) => sum + row._count._all, 0),
        NEW: of('NEW'),
        CONTACTED: of('CONTACTED'),
        CLOSED: of('CLOSED'),
        SPAM: of('SPAM'),
      };

      return {
        data: page.map(toAdminEnquiryRow),
        page: {
          nextCursor: hasMore && last ? encodeKeysetCursor(last.createdAt, last.id) : null,
          hasMore,
        },
        counts,
        dealer: query.dealer ? { slug: query.dealer, name: dealer?.brandName ?? null } : null,
      };
    },

    async detail(enquiryId: string): Promise<AdminEnquiryDetail> {
      const [row, history] = await Promise.all([
        prisma.enquiry.findUnique({ where: { id: enquiryId }, select: ADMIN_DETAIL_SELECT }),
        prisma.auditLog.findMany({
          where: {
            entityType: 'Enquiry',
            entityId: enquiryId,
            action: { in: Object.keys(ENQUIRY_HISTORY_LABELS) },
          },
          orderBy: { id: 'asc' },
          select: { action: true, actorType: true, before: true, after: true, createdAt: true },
        }),
      ]);
      if (!row) {
        throw new NotFoundError(ADMIN_ENQUIRY_NOT_FOUND, { code: 'ENQUIRY_NOT_FOUND' });
      }
      return toAdminEnquiryDetail(row, history);
    },
  };
}

export type AdminEnquiriesService = ReturnType<typeof createAdminEnquiriesService>;
