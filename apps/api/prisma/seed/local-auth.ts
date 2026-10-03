import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '../../src/config/env.js';
import { DEALERS } from './data.js';
import { assertLocalDatabase } from './dev-guard.js';

assertLocalDatabase('local authentication accounts');
if (env.APP_ENV !== 'local')
  throw new Error('Local accounts may only be seeded with APP_ENV=local.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const seed = DEALERS[0]!;
const now = new Date();
try {
  const owner = await prisma.user.upsert({
    where: { email: seed.email },
    update: {},
    create: {
      fullName: seed.ownerName,
      email: seed.email,
      phone: seed.phone,
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: owner.id, role: 'DEALER' } },
    update: {},
    create: { userId: owner.id, role: 'DEALER' },
  });
  const dealer = await prisma.dealer.upsert({
    where: { gstin: seed.gstin },
    update: {},
    create: {
      slug: seed.slug,
      brandName: seed.brandName,
      legalName: seed.legalName,
      tagline: seed.tagline,
      gstin: seed.gstin,
      pan: seed.pan,
      status: 'ACTIVE',
      approvedAt: now,
      city: seed.city,
      district: seed.district,
      state: seed.state,
      addressLine: seed.addressLine,
      pincode: seed.pincode,
      lat: seed.lat,
      lng: seed.lng,
      contactPhone: seed.phone,
      contactEmail: seed.email,
      landline: seed.landline,
      establishedYear: seed.establishedYear,
      specialities: [],
    },
  });
  await prisma.dealerMember.upsert({
    where: { dealerId_userId: { dealerId: dealer.id, userId: owner.id } },
    update: {},
    create: { dealerId: dealer.id, userId: owner.id, role: 'OWNER', permissions: [] },
  });
  const email = env.adminAllowlist[0];
  if (email) {
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        fullName: 'Dealers-Drive Operations',
        email,
        isPlatformAdmin: true,
        adminRole: 'SUPER_ADMIN',
        emailVerifiedAt: now,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: admin.id, role: 'ADMIN' } },
      update: {},
      create: { userId: admin.id, role: 'ADMIN' },
    });
  }
  console.log(`Local dealer ready: ${dealer.slug}`);
} finally {
  await prisma.$disconnect();
}
