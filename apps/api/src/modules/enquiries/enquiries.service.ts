import {
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUS_LABELS,
  formatLakh,
  formatPhone,
  initialsOf,
  timeAgo,
  toE164,
  type CreateEnquiryInput,
  type EnquiryCountsResponse,
  type EnquiryCreatedResponse,
  type EnquiryDto,
  type EnquiryListResponse,
  type EnquiryQuery,
  type RevealContactResponse,
  type UpdateEnquiryInput,
  type UpdateEnquiryResponse,
} from '@dealers-drive/contracts';
import type { EnquiryStatus, PrismaClient } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import { consumeRateLimit } from '../../middleware/rate-limit.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, NotFoundError, RateLimitError } from '../../platform/errors.js';
import type { DealersRepository } from '../dealers/dealers.repository.js';
import type { SearchRepository } from '../search/search.repository.js';
import { mediaUrl } from '../search/search.mapper.js';
import type { EnquiriesRepository, EnquiryWithVehicle } from './enquiries.repository.js';

export interface EnquiriesDeps {
  prisma: PrismaClient;
  repo: EnquiriesRepository;
  dealers: DealersRepository;
  search: SearchRepository;
  config: PlatformConfigService;
}

/**
 * The lead is the product; everything else is plumbing (ARCHITECTURE §1.4).
 */
export function createEnquiriesService({
  prisma,
  repo,
  dealers,
  search,
  config,
}: EnquiriesDeps) {
  return {
    /**
     * A15. No account, no modal, and a honeypot: a non-empty `website` gets a
     * normal 201 with a fabricated reference while nothing is written.
     */
    async create(input: CreateEnquiryInput, meta: { ip: string; userAgent?: string }) {
      if (input.website && input.website.trim().length > 0) {
        return {
          status: 201 as const,
          body: {
            reference: `DD-EN-${40000 + Math.floor(Math.random() * 9999)}`,
            createdAt: new Date().toISOString(),
            dealer: { slug: '', brandName: '', responseTimeLabel: '' },
            vehicle: null,
            isDuplicate: false,
          } satisfies EnquiryCreatedResponse,
        };
      }

      const phone = toE164(input.phone);
      const searchRow = input.vehicleId ? await search.byVehicleId(input.vehicleId) : null;

      if (input.vehicleId && !searchRow) {
        throw new NotFoundError('That car is no longer listed.');
      }

      const dealerSlug = searchRow?.dealer_slug ?? input.dealerSlug;
      if (!dealerSlug) throw new NotFoundError('That dealership is not listed.');

      const dealer = await dealers.findPublicBySlug(dealerSlug);
      if (!dealer) throw new NotFoundError('That dealership is not listed.');

      const existing = await repo.findRecentDuplicate(
        phone,
        input.vehicleId ?? null,
        dealer.id,
      );
      if (existing) {
        // The same reference, and no second notification to the dealer.
        return {
          status: 200 as const,
          body: toCreatedResponse(
            existing,
            dealer.brandName,
            dealer.slug,
            dealer.medianResponseMins,
            searchRow,
            true,
          ),
        };
      }

      const enquiry = await withTransaction(prisma, async (tx) => {
        const reference = await repo.nextReference(tx);
        const created = await repo.create(tx, {
          reference,
          dealerId: dealer.id,
          vehicleId: input.vehicleId ?? null,
          listingId: searchRow?.listing_id ?? null,
          name: input.name,
          phone,
          email: input.email && input.email.length > 0 ? input.email : null,
          message: input.message ?? null,
          source: input.source,
          status: 'NEW',
          ip: meta.ip,
          userAgent: meta.userAgent ?? null,
        });

        await enqueueOutbox(tx, {
          type: 'EnquiryCreated',
          aggregateType: 'Enquiry',
          aggregateId: created.id,
          dealerId: dealer.id,
          actor: { type: 'SYSTEM' },
          traceId: getContext()?.traceId ?? 'seed',
          payload: { enquiryId: created.id },
        });

        return created;
      });

      return {
        status: 201 as const,
        body: toCreatedResponse(
          enquiry,
          dealer.brandName,
          dealer.slug,
          dealer.medianResponseMins,
          searchRow,
          false,
        ),
      };
    },

    /**
     * A7. Writes **two** rows in one transaction: a `PhoneReveal` for rate
     * limiting and abuse analysis, and an `Enquiry` with `source=CALL_BUTTON`,
     * because the dealer's inbox must show the tap as a lead (§14.4).
     */
    async revealContact(
      vehicleId: string,
      input: { name?: string | null },
      meta: { ip: string; userAgent?: string },
    ): Promise<RevealContactResponse> {
      const row = await search.byVehicleId(vehicleId);
      if (!row) throw new NotFoundError('That car is no longer listed.');

      const [hourlyCap, dailyCap] = await Promise.all([
        config.number('reveal.hourlyCapPerIp'),
        config.number('reveal.dailyCapPerIp'),
      ]);

      const hourly = consumeRateLimit(`reveal-hour:${meta.ip}`, hourlyCap, 3600);
      if (!hourly.allowed) {
        throw new RateLimitError(
          'Too many numbers revealed from this network in the last hour.',
          hourly.retryAfterSeconds,
        );
      }

      const today = await repo.revealsToday(meta.ip);
      if (today >= dailyCap) {
        throw new RateLimitError(
          'Daily limit reached for revealing dealer numbers.',
          3600,
          { code: 'RATE_LIMITED' },
        );
      }

      const dealer = await dealers.findPublicBySlug(row.dealer_slug);
      if (!dealer?.contactPhone) throw new NotFoundError('That dealership is not listed.');
      const phone = dealer.contactPhone;

      await withTransaction(prisma, async (tx) => {
        await repo.recordReveal(tx, {
          dealerId: dealer.id,
          vehicleId,
          ip: meta.ip,
          ...(meta.userAgent === undefined ? {} : { userAgent: meta.userAgent }),
        });

        // Deduplicated per (ip-derived phone, vehicle) within 24h, so tapping
        // Call three times produces one lead, not three.
        const placeholder = `+91${meta.ip.replace(/\D/g, '').padStart(10, '9').slice(-10)}`;
        const duplicate = await repo.findRecentDuplicate(placeholder, vehicleId, dealer.id, tx);
        if (duplicate) return;

        const reference = await repo.nextReference(tx);
        const created = await repo.create(tx, {
          reference,
          dealerId: dealer.id,
          vehicleId,
          listingId: row.listing_id,
          name: input.name?.trim() || 'Caller',
          phone: placeholder,
          message: null,
          source: 'CALL_BUTTON',
          status: 'NEW',
          ip: meta.ip,
          userAgent: meta.userAgent ?? null,
        });

        await enqueueOutbox(tx, {
          type: 'PhoneRevealed',
          aggregateType: 'Enquiry',
          aggregateId: created.id,
          dealerId: dealer.id,
          actor: { type: 'SYSTEM' },
          traceId: getContext()?.traceId ?? 'reveal',
          payload: { enquiryId: created.id, vehicleId },
        });
      });

      const digits = phone.replace(/\D/g, '');
      return {
        phone,
        phoneDisplay: formatPhone(phone),
        dealer: { slug: dealer.slug, brandName: dealer.brandName },
        callHref: `tel:${phone}`,
        whatsappHref: `https://wa.me/${digits}`,
        revealsRemainingToday: Math.max(0, dailyCap - today - 1),
      };
    },

    // ─────────── C15–C17 dealer inbox ─────────────────────────────────────

    async listForDealer(dealerId: string, query: EnquiryQuery): Promise<EnquiryListResponse> {
      const rows = await repo.listForDealer(dealerId, {
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { cursor: decodeCursor(query.cursor) } : {}),
        limit: query.limit,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      return {
        data: page.map(toEnquiryDto),
        page: {
          nextCursor: hasMore && last ? encodeCursor(last.createdAt) : null,
          hasMore,
        },
      };
    },

    async countsForDealer(dealerId: string): Promise<EnquiryCountsResponse> {
      const counts = await repo.countsForDealer(dealerId);
      const order: EnquiryStatus[] = ['NEW', 'CONTACTED', 'CLOSED', 'SPAM'];
      return {
        tabs: order.map((status) => ({
          status,
          label: ENQUIRY_STATUS_LABELS[status],
          count: counts[status],
        })),
        total: order.reduce((sum, status) => sum + counts[status], 0),
      };
    },

    /**
     * The only mutation. `CLOSED → NEW` is not a legal move, and `contactedAt`
     * is stamped on the first NEW → CONTACTED and never overwritten — it feeds
     * the public response-time stat (§14.3).
     */
    async updateForDealer(
      dealerId: string,
      enquiryId: string,
      input: UpdateEnquiryInput,
    ): Promise<UpdateEnquiryResponse> {
      const existing = await repo.findForDealer(dealerId, enquiryId);
      // 404, not 403: a dealer must not learn that another dealer's lead exists.
      if (!existing) throw new NotFoundError('That enquiry does not exist.');

      assertEnquiryTransition(existing.status, input.status);

      const now = new Date();
      const updated = await repo.updateForDealer(dealerId, enquiryId, {
        status: input.status,
        ...(input.status === 'CONTACTED' && existing.contactedAt === null
          ? { contactedAt: now }
          : {}),
        ...(input.status === 'CLOSED'
          ? { closedAt: now, closeReason: input.closeReason ?? 'OTHER' }
          : {}),
        ...(input.status === 'SPAM' ? { markedSpamAt: now } : {}),
        ...(input.note ? { note: input.note } : {}),
      });

      if (!updated) throw new NotFoundError('That enquiry does not exist.');

      const counts = await repo.countsForDealer(dealerId);
      return {
        id: updated.id,
        status: updated.status,
        contactedAt: updated.contactedAt?.toISOString() ?? null,
        counts,
      };
    },

    async recentForDealer(dealerId: string, limit: number) {
      return repo.recentForDealer(dealerId, limit);
    },
  };
}

export type EnquiriesService = ReturnType<typeof createEnquiriesService>;

const LEGAL_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ['CONTACTED', 'SPAM', 'CLOSED'],
  CONTACTED: ['CLOSED', 'SPAM'],
  CLOSED: ['CONTACTED'],
  SPAM: ['CONTACTED', 'NEW'],
};

export function assertEnquiryTransition(from: EnquiryStatus, to: EnquiryStatus): void {
  if (from === to) return;
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(
      'INVALID_TRANSITION',
      `An enquiry cannot move from ${ENQUIRY_STATUS_LABELS[from]} to ${ENQUIRY_STATUS_LABELS[to]}.`,
    );
  }
}

export function toEnquiryDto(enquiry: EnquiryWithVehicle): EnquiryDto {
  const title = enquiry.vehicle
    ? [
        enquiry.vehicle.year,
        enquiry.vehicle.make.name,
        enquiry.vehicle.model.name,
        enquiry.vehicle.variant?.name,
      ]
        .filter(Boolean)
        .join(' ')
    : null;

  const actions: string[] = ['CONTACT'];
  if (enquiry.email) actions.push('EMAIL');
  if (enquiry.status === 'NEW') actions.push('MARK_CONTACTED', 'CLOSE', 'SPAM');
  if (enquiry.status === 'CONTACTED') actions.push('CLOSE', 'SPAM');
  if (enquiry.status === 'CLOSED' || enquiry.status === 'SPAM') actions.push('REOPEN');

  return {
    id: enquiry.id,
    reference: enquiry.reference,
    name: enquiry.name,
    initials: initialsOf(enquiry.name),
    phone: enquiry.phone,
    phoneDisplay: formatPhone(enquiry.phone),
    callHref: `tel:${enquiry.phone}`,
    email: enquiry.email,
    emailHref: enquiry.email ? `mailto:${enquiry.email}` : null,
    message: enquiry.message,
    vehicle:
      enquiry.vehicle && title && enquiry.vehicle.slug
        ? { id: enquiry.vehicle.id, title, href: `/car/${enquiry.vehicle.slug}` }
        : null,
    source: enquiry.source,
    sourceLabel: ENQUIRY_SOURCE_LABELS[enquiry.source],
    status: enquiry.status,
    createdAt: enquiry.createdAt.toISOString(),
    timeAgoLabel: timeAgo(enquiry.createdAt),
    actions,
  };
}

function toCreatedResponse(
  enquiry: EnquiryWithVehicle,
  brandName: string,
  slug: string,
  medianMins: number | null,
  searchRow: { price_paise: bigint; city_name: string; title: string; primary_media_id: string | null; vehicle_slug: string } | null,
  isDuplicate: boolean,
): EnquiryCreatedResponse {
  return {
    reference: enquiry.reference,
    createdAt: enquiry.createdAt.toISOString(),
    dealer: {
      slug,
      brandName,
      responseTimeLabel: responseTimeLabel(medianMins),
    },
    vehicle:
      enquiry.vehicle && searchRow
        ? {
            id: enquiry.vehicle.id,
            slug: searchRow.vehicle_slug,
            title: `${enquiry.vehicle.year} ${searchRow.title}`,
            priceLabel: formatLakh(searchRow.price_paise),
            city: searchRow.city_name,
            thumbnailUrl: searchRow.primary_media_id
              ? mediaUrl(searchRow.primary_media_id, 320)
              : null,
          }
        : null,
    isDuplicate,
  };
}

/** "within 2 hours", "within an hour" — never "within 1 hours". */
function responseTimeLabel(medianMins: number | null): string {
  if (medianMins === null) return 'usually responds within a day';
  if (medianMins < 90) return 'typically responds within an hour';
  const hours = Math.round(medianMins / 60);
  if (hours >= 24) return 'typically responds within a day';
  return `typically responds within ${hours} hours`;
}

export function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64url');
}

/** The ledger paginates on its append sequence, not on a timestamp. */
export function encodeSeqCursor(seq: bigint): string {
  return Buffer.from(String(seq)).toString('base64url');
}

export function decodeSeqCursor(cursor: string): string {
  const value = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!/^\d+$/.test(value)) {
    throw new ConflictError('MALFORMED_CURSOR', 'That page cursor is not valid.');
  }
  return value;
}

export function decodeCursor(cursor: string): Date {
  const value = new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (Number.isNaN(value.getTime())) {
    throw new ConflictError('MALFORMED_CURSOR', 'That page cursor is not valid.');
  }
  return value;
}
