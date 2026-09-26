import type { Listing, PrismaClient } from '@prisma/client';

import { createDraftListing } from '../src/modules/listings/listings.repository.js';
import { transition, type ListingEvent } from '../src/modules/listings/listing.state.js';
import { createAuditService } from '../src/platform/audit/audit.service.js';
import { withTransaction } from '../src/platform/db/tenant-tx.js';

/**
 * Vehicles and listings written straight to the database, for the suites that
 * test the lifecycle rather than the HTTP surface in front of it.
 */
let plates = 0;

export function createListingsTestKit(prisma: PrismaClient) {
  const audit = createAuditService(prisma);
  let dealerId: string | null = null;

  async function dealer(): Promise<string> {
    if (dealerId) return dealerId;
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = await prisma.dealer.create({
      data: {
        slug: `lifecycle-${stamp}`,
        brandName: `Lifecycle ${stamp}`,
        legalName: `Lifecycle ${stamp}`,
        city: 'Vellore',
        status: 'ACTIVE',
      },
    });
    dealerId = row.id;
    return row.id;
  }

  return {
    async vehicleWithListing() {
      plates += 1;
      const owner = await dealer();
      return withTransaction(prisma, async (tx) => {
        const vehicle = await tx.vehicle.create({
          data: {
            dealerId: owner,
            registrationNumber: `TN22LC${String(1000 + plates)}`,
            rtoCode: 'TN22',
          },
        });
        const listing = await createDraftListing(tx, vehicle);
        return { vehicle, listing };
      });
    },

    async move(
      listing: Listing,
      event: ListingEvent,
      actor: 'DEALER' | 'ADMIN',
      reason?: string,
    ): Promise<Listing> {
      return withTransaction(prisma, (tx) =>
        transition(
          tx,
          audit,
          listing,
          event,
          { type: actor, id: '00000000-0000-4000-8000-000000000001' },
          { reason: reason ?? null },
        ),
      );
    },
  };
}
