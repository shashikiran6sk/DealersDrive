import type { PrismaClient } from '@prisma/client';

export async function seedLocation(prisma: PrismaClient, state: string, district: string) {
  const selected = await prisma.serviceDistrict.findFirst({
    where: {
      aliases: { has: district.trim().toLowerCase() },
      state: { aliases: { has: state.trim().toLowerCase() } },
    },
    include: { state: true },
  });
  return selected
    ? {
        state: selected.state.name,
        district: selected.name,
        serviceStateId: selected.stateId,
        serviceDistrictId: selected.id,
        locationReviewRequired: false,
      }
    : {
        state,
        district,
        serviceStateId: null,
        serviceDistrictId: null,
        locationReviewRequired: true,
      };
}
