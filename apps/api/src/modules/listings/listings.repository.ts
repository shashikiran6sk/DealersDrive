import type { Listing } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

export async function createDraftListing(
  tx: Tx,
  vehicle: { id: string; dealerId: string },
): Promise<Listing> {
  return tx.listing.create({ data: { vehicleId: vehicle.id, dealerId: vehicle.dealerId } });
}

export async function lockListingForVehicle(tx: Tx, vehicleId: string): Promise<Listing | null> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "listings" WHERE "vehicleId" = ${vehicleId}::uuid FOR UPDATE`;
  const row = locked[0];
  if (!row) return null;
  return tx.listing.findUnique({ where: { id: row.id } });
}

export async function lockListing(tx: Tx, listingId: string): Promise<Listing | null> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "listings" WHERE "id" = ${listingId}::uuid FOR UPDATE`;
  if (locked.length === 0) return null;
  return tx.listing.findUnique({ where: { id: listingId } });
}
