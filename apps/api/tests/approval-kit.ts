import { ListingCheckKey } from '@dealers-drive/contracts';
import type request from 'supertest';

import type { AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE, type Dealership } from './marketplace-fixtures.js';

export interface Published {
  listingId: string;
  vehicleId: string;
  mediaIds: string[];
  slug: string;
}

/**
 * A listing taken the whole way through the real API — created, completed,
 * submitted, verified, photographed and approved — for tests about what the
 * public sees afterwards.
 */
export function createApprovalKit(h: AuthHarness, admin: request.Agent) {
  async function submitted(
    owner: Dealership,
    registrationNumber: string,
    details: Record<string, unknown> = {},
  ): Promise<{ listingId: string; vehicleId: string }> {
    const created = await owner.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber })
      .expect(201);
    const vehicleId = created.body.id as string;
    await owner.agent
      .patch(`/v1/dealer/vehicles/${vehicleId}`)
      .send({ ...COMPLETE_VEHICLE, ...details })
      .expect(200);
    const done = await owner.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);
    return { listingId: done.body.listing.id as string, vehicleId };
  }

  async function published(
    owner: Dealership,
    registrationNumber: string,
    details: Record<string, unknown> = {},
  ): Promise<Published> {
    const { listingId, vehicleId } = await submitted(owner, registrationNumber, details);
    for (const key of ListingCheckKey.options) {
      await admin
        .put(`/v1/admin/listings/${listingId}/checks/${key}`)
        .send({ checked: true })
        .expect(200);
    }
    const mediaIds = await seedImages(h.prisma, { vehicleId, dealerId: owner.dealerId }, 6);
    await admin.post(`/v1/admin/listings/${listingId}/approve`).expect(200);
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    return { listingId, vehicleId, mediaIds, slug: listing.slug ?? '' };
  }

  return { submitted, published };
}
