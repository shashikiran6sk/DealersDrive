import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type DealerStatus } from '@prisma/client';

import { dealerSlug } from '@dealers-drive/contracts';

import { env } from '../../src/config/env.js';
import { assertLocalDatabase } from './dev-guard.js';

/**
 * A Sales team and the dealerships it is onboarding (**R112**), in a **local**
 * database, so the Sales workspace and the admin review queue have something
 * to look at.
 *
 *     pnpm db:seed:dev:sales
 *
 * ── Who is here ─────────────────────────────────────────────────────────────
 * Two Sales representatives and one Operations reviewer, as Admin Members with
 * no credential of any kind: they are entered by Google sign-in like anybody
 * else, or by a dev session. The addresses are on `dealers-drive.test`, a
 * reserved name that can never receive mail.
 *
 * The first representative carries three assisted dealerships — a draft, one
 * in review, and an approved one — and the second carries one draft, which is
 * what proves a representative only sees their own.
 *
 * ── What is not here ────────────────────────────────────────────────────────
 * No documents. A document row is an object in the private bucket, and seeding
 * a row whose object does not exist is a reviewer clicking "view" on a 404.
 * The in-review dealership is therefore complete in every field except that,
 * and the approved one is approved because this seed says so.
 *
 * The approved one also has a listing draft the representative prepared
 * (**R114**), so the Sales listings section and its edit wizard have a row.
 *
 * ── Re-running it ───────────────────────────────────────────────────────────
 * Members upsert on the email, dealerships on the GSTIN, like `dev-dealers.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const now = new Date();

interface SeedMember {
  email: string;
  fullName: string;
  role: 'SALES_REP' | 'MODERATOR';
}

interface SeedAssisted {
  assistant: string;
  status: DealerStatus;
  legalName: string;
  brandName: string;
  contactName: string;
  phone: string;
  email: string;
  gstin: string;
  pan: string;
  city: string;
  district: string;
  addressLine: string;
  pincode: string;
}

const MEMBERS: SeedMember[] = [
  { email: 'arun.sales@dealers-drive.test', fullName: 'Arun (Field Sales)', role: 'SALES_REP' },
  { email: 'kavya.sales@dealers-drive.test', fullName: 'Kavya (Field Sales)', role: 'SALES_REP' },
  { email: 'priya.ops@dealers-drive.test', fullName: 'Priya (Operations)', role: 'MODERATOR' },
];

const ASSISTED: SeedAssisted[] = [
  {
    assistant: 'arun.sales@dealers-drive.test',
    status: 'DRAFT',
    legalName: 'Sri Murugan Cars',
    brandName: 'Sri Murugan Cars',
    contactName: 'S. Murugan',
    phone: '+919662200001',
    email: 'murugan.cars@dealers-drive.test',
    gstin: '33AAACS1429P1Z1',
    pan: 'AAACS1429P',
    city: 'Katpadi',
    district: 'Vellore',
    addressLine: '12, Gandhi Road',
    pincode: '632007',
  },
  {
    assistant: 'arun.sales@dealers-drive.test',
    status: 'PENDING_APPROVAL',
    legalName: 'Vellore Motor Point',
    brandName: 'Motor Point',
    contactName: 'K. Senthil',
    phone: '+919662200002',
    email: 'motorpoint@dealers-drive.test',
    gstin: '33AAACV2210Q1Z2',
    pan: 'AAACV2210Q',
    city: 'Vellore',
    district: 'Vellore',
    addressLine: '4, Officers Line',
    pincode: '632001',
  },
  {
    assistant: 'arun.sales@dealers-drive.test',
    status: 'ACTIVE',
    legalName: 'Kaveri Auto Hub',
    brandName: 'Kaveri Auto Hub',
    contactName: 'R. Kaveri',
    phone: '+919662200003',
    email: 'kaveri.auto@dealers-drive.test',
    gstin: '33AAACK3321R1Z3',
    pan: 'AAACK3321R',
    city: 'Arcot',
    district: 'Ranipet',
    addressLine: '88, Bazaar Street',
    pincode: '632503',
  },
  {
    assistant: 'kavya.sales@dealers-drive.test',
    status: 'DRAFT',
    legalName: 'Anna Nagar Wheels',
    brandName: 'Anna Nagar Wheels',
    contactName: 'P. Anand',
    phone: '+919662200004',
    email: 'annanagar.wheels@dealers-drive.test',
    gstin: '33AAACA4432S1Z4',
    pan: 'AAACA4432S',
    city: 'Chennai',
    district: 'Chennai',
    addressLine: '2nd Avenue, Anna Nagar',
    pincode: '600040',
  },
];

async function upsertMember(seed: SeedMember): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: { fullName: seed.fullName, adminRole: seed.role, isPlatformAdmin: true },
    create: {
      email: seed.email,
      fullName: seed.fullName,
      emailVerifiedAt: now,
      adminRole: seed.role,
      isPlatformAdmin: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: 'ADMIN' } },
    update: {},
    create: { userId: user.id, role: 'ADMIN' },
  });
  const member = await prisma.adminMember.upsert({
    where: { userId: user.id },
    update: { role: seed.role, status: 'ACTIVE' },
    create: {
      userId: user.id,
      role: seed.role,
      status: 'ACTIVE',
      source: 'INVITED',
      activatedAt: now,
    },
  });
  return member.id;
}

async function seedAssisted(seed: SeedAssisted, memberId: string): Promise<void> {
  const state = 'Tamil Nadu';
  const fields = {
    brandName: seed.brandName,
    legalName: seed.legalName,
    gstin: seed.gstin,
    pan: seed.pan,
    status: seed.status,
    approvedAt: seed.status === 'ACTIVE' ? now : null,
    city: seed.city,
    district: seed.district,
    state,
    addressLine: seed.addressLine,
    pincode: seed.pincode,
    contactName: seed.contactName,
    contactPhone: seed.phone,
    contactPhoneVerifiedAt: now,
    contactEmail: seed.email,
    specialities: [],
    onboardingSource: 'ASSISTED' as const,
    assistedByMemberId: memberId,
    assistedConsentAt: now,
  };
  const slug = dealerSlug({
    legalName: seed.legalName,
    city: seed.city,
    district: seed.district,
    state,
  });
  await prisma.dealer.upsert({
    where: { gstin: seed.gstin },
    update: { slug, ...fields },
    create: { slug, ...fields },
  });
}

async function seedDraftListing(gstin: string, memberId: string): Promise<void> {
  const dealer = await prisma.dealer.findUniqueOrThrow({ where: { gstin }, select: { id: true } });
  const registrationNumber = 'TN73SR4321';
  const existing = await prisma.vehicle.findFirst({
    where: { dealerId: dealer.id, registrationNumber, releasedAt: null },
    select: { id: true },
  });
  if (existing) return;
  const vehicle = await prisma.vehicle.create({
    data: {
      dealerId: dealer.id,
      registrationNumber,
      rtoCode: 'TN73',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      manufacturingYear: 2021,
      registrationYear: 2021,
      createdByMemberId: memberId,
    },
  });
  await prisma.listing.create({ data: { vehicleId: vehicle.id, dealerId: dealer.id } });
}

async function main(): Promise<void> {
  assertLocalDatabase('Sales members and assisted dealerships');

  const members = new Map<string, string>();
  for (const seed of MEMBERS) {
    members.set(seed.email, await upsertMember(seed));
  }
  for (const seed of ASSISTED) {
    const memberId = members.get(seed.assistant);
    if (!memberId) throw new Error(`No seeded member ${seed.assistant}`);
    await seedAssisted(seed, memberId);
  }
  const arun = members.get('arun.sales@dealers-drive.test');
  if (arun) await seedDraftListing('33AAACK3321R1Z3', arun);

  console.log(
    `seeded ${String(MEMBERS.length)} admin members and ${String(ASSISTED.length)} assisted dealerships`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
