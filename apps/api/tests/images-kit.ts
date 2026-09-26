import type { PrismaClient } from '@prisma/client';

import { env } from '../src/config/env.js';

/**
 * Vehicle images attached straight to the database, for tests about what
 * happens to a gallery rather than how a file gets into one. The upload path
 * itself is `vehicle-images.test.ts`.
 */
export async function seedImages(
  prisma: PrismaClient,
  vehicle: { vehicleId: string; dealerId: string },
  count: number,
): Promise<string[]> {
  const moderator = await prisma.user.findFirstOrThrow({
    where: { email: env.adminAllowlist[0] ?? '' },
  });
  const existing = await prisma.vehicleMedia.count({ where: { vehicleId: vehicle.vehicleId } });
  const media = await prisma.media.createManyAndReturn({
    data: Array.from({ length: count }, (_, index) => ({
      dealerId: vehicle.dealerId,
      ownerType: 'VEHICLE' as const,
      storageKey: `vehicles/${vehicle.vehicleId}/seed-${String(existing + index)}-${crypto.randomUUID()}/original.jpg`,
      mimeType: 'image/jpeg',
      bytes: 1,
      uploadedByAdmin: true,
      status: 'READY' as const,
    })),
  });
  await prisma.vehicleMedia.createMany({
    data: media.map((row, index) => ({
      vehicleId: vehicle.vehicleId,
      mediaId: row.id,
      position: existing + index,
      isPrimary: existing === 0 && index === 0,
      addedBy: moderator.id,
    })),
  });
  return media.map((row) => row.id);
}
