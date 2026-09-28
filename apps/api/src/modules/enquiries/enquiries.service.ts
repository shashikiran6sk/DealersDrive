import {
  formatRegistration,
  vehicleTitle,
  type CreateEnquiryInput,
  type EnquiryReceipt,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { CustomerPrincipal } from '../auth/auth.facade.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import { PUBLIC_LISTING_WHERE } from '../search/search.facade.js';
import {
  ALREADY_SUBMITTED,
  LISTING_NOT_AVAILABLE,
  LISTING_NOT_FOUND,
  OWN_LISTING,
} from './enquiries.messages.js';

export interface EnquiriesDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

export const DUPLICATE_WINDOW_HOURS = 24;

export function createEnquiriesService({ prisma, audit }: EnquiriesDeps) {
  return {
    async create(customer: CustomerPrincipal, input: CreateEnquiryInput): Promise<EnquiryReceipt> {
      const listing = await prisma.listing.findUnique({
        where: { slug: input.listingSlug },
        select: { id: true },
      });
      if (!listing) throw new NotFoundError(LISTING_NOT_FOUND, { code: 'LISTING_NOT_FOUND' });

      return withTransaction(prisma, async (tx) => {
        const available = await tx.listing.findFirst({
          where: { ...PUBLIC_LISTING_WHERE, id: listing.id },
          select: {
            id: true,
            dealerId: true,
            dealer: { select: { brandName: true } },
            vehicle: {
              select: {
                manufacturingYear: true,
                make: true,
                model: true,
                variant: true,
                registrationNumber: true,
              },
            },
          },
        });
        if (!available) {
          throw new ConflictError('LISTING_NOT_AVAILABLE', LISTING_NOT_AVAILABLE);
        }

        const ownDealership = await tx.dealerMember.findFirst({
          where: { userId: customer.userId, dealerId: available.dealerId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (ownDealership) throw new DomainError('ENQUIRY_OWN_LISTING', OWN_LISTING);

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`enquiry:${customer.userId}:${available.id}`}))`;

        const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3_600_000);
        const recent = await tx.enquiry.findFirst({
          where: {
            customerId: customer.userId,
            listingId: available.id,
            createdAt: { gte: since },
          },
          select: { id: true },
        });
        if (recent) {
          throw new ConflictError('ENQUIRY_ALREADY_SUBMITTED_RECENTLY', ALREADY_SUBMITTED);
        }

        const enquiry = await tx.enquiry.create({
          data: {
            customerId: customer.userId,
            dealerId: available.dealerId,
            listingId: available.id,
            message: input.message ?? null,
          },
        });

        await audit.record(tx, {
          actorType: 'CUSTOMER',
          actorId: customer.userId,
          dealerId: available.dealerId,
          action: 'enquiry.created',
          entityType: 'Enquiry',
          entityId: enquiry.id,
          after: { listingId: available.id, hasMessage: enquiry.message !== null },
        });

        logger.info(
          {
            event: 'enquiry.created',
            enquiryId: enquiry.id,
            dealerId: available.dealerId,
            via: customer.via,
          },
          'enquiry created',
        );

        return {
          id: enquiry.id,
          status: enquiry.status,
          createdAt: enquiry.createdAt.toISOString(),
          dealerName: available.dealer.brandName,
          vehicleTitle:
            vehicleTitle(available.vehicle) ||
            formatRegistration(available.vehicle.registrationNumber),
        };
      });
    },
  };
}

export type EnquiriesService = ReturnType<typeof createEnquiriesService>;
