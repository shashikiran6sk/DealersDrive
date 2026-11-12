import type { Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

const photoInclude = { media: true } satisfies Prisma.VehicleSubmissionPhotoInclude;

export type SubmissionPhotoRow = Prisma.VehicleSubmissionPhotoGetPayload<{
  include: typeof photoInclude;
}>;

type Db = PrismaClient | Tx;

export function submissionPhotosOf(db: Db, vehicleId: string): Promise<SubmissionPhotoRow[]> {
  return db.vehicleSubmissionPhoto.findMany({
    where: { vehicleId },
    include: photoInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export interface PhotoshootCoverage {
  available: boolean;
  district: string | null;
}

export async function photoshootCoverage(db: Db, dealerId: string): Promise<PhotoshootCoverage> {
  const dealer = await db.dealer.findUnique({
    where: { id: dealerId },
    select: {
      district: true,
      serviceDistrict: { select: { name: true, active: true, photographyAvailable: true } },
    },
  });
  const district = dealer?.serviceDistrict;
  return {
    available: Boolean(district?.active && district.photographyAvailable),
    district: district?.name ?? dealer?.district ?? null,
  };
}
