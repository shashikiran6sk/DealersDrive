import { randomUUID } from 'node:crypto';

import type { DealerRole, PrismaClient } from '@prisma/client';

import type { Harness } from './harness.js';

/**
 * Arrangement helpers.
 *
 * These build *state* directly through Prisma where going through the API would
 * only re-test something another file already covers — a submittable vehicle
 * needs six processed photos, and the upload pipeline is not what a credit test
 * is asking about. Everything that is the subject of a test still goes through
 * HTTP.
 */

/** Catalogue ids the seed guarantees, resolved once per file. */
export interface CatalogueIds {
  makeId: string;
  modelId: string;
  variantId: string;
  rtoCode: string;
  colorId: string;
  cityId: string;
}

export async function catalogueIds(prisma: PrismaClient): Promise<CatalogueIds> {
  // The model is chosen by *having a variant* rather than by name: variant is a
  // mandatory field now, and a model whose variants had not been seeded would
  // fail every fixture with a 400 that named the wrong problem.
  const [variant, color, city, rto] = await Promise.all([
    prisma.variant.findFirstOrThrow({
      include: { model: true },
      orderBy: { name: 'asc' },
    }),
    prisma.color.findFirstOrThrow({ orderBy: { name: 'asc' } }),
    prisma.city.findFirstOrThrow({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.rto.findFirstOrThrow({ orderBy: { code: 'asc' } }),
  ]);

  return {
    makeId: variant.model.makeId,
    modelId: variant.modelId,
    variantId: variant.id,
    rtoCode: rto.code,
    colorId: color.id,
    cityId: city.id,
  };
}

/**
 * A DRAFT vehicle that passes every completeness check, created through the API
 * so that `dealerId` still comes from the session (rule 1) rather than being
 * written past the service by the fixture.
 *
 * Returns the vehicle id. The caller submits it.
 */
export async function createSubmittableVehicle(
  h: Harness,
  options: { pricePaise?: number; year?: number } = {},
): Promise<string> {
  const ids = await catalogueIds(h.prisma);

  const created = await h
    .agent()
    .post('/v1/dealer/vehicles')
    .send({
      makeId: ids.makeId,
      modelId: ids.modelId,
      variantId: ids.variantId,
      year: options.year ?? 2021,
      fuel: 'PETROL',
      transmission: 'MANUAL',
      bodyType: 'HATCHBACK',
    })
    .expect(201);

  const vehicleId = created.body.id as string;

  await h
    .agent()
    .patch(`/v1/dealer/vehicles/${vehicleId}`)
    .send({
      kmDriven: 42_000,
      ownerNumber: 1,
      colorId: ids.colorId,
      cityId: ids.cityId,
      // The four fields that joined the mandatory Details list. Without them
      // `completeness.canSubmit` is false and every submit-based test fails on
      // VEHICLE_INCOMPLETE rather than on what it is actually asking about.
      rtoCode: ids.rtoCode,
      insuranceType: 'COMPREHENSIVE',
      insuranceValidTill: '2027-03-01T00:00:00.000Z',
      regNumberMasked: 'TN09BX1234',
      pricePaise: options.pricePaise ?? 4_50_000_00,
      // Completeness wants at least 100 characters of description, and a test
      // that trips that check by accident is a test that fails for the wrong
      // reason.
      description:
        'A single-owner hatchback with full service history, four new tyres and a clean insurance record. ' +
        'Driven mainly within the city, non-accidental, and available for inspection at the showroom any day.',
      features: ['Power steering', 'Air conditioning'],
    })
    .expect(200);

  await attachReadyPhotos(h.prisma, vehicleId, await dealerIdOf(h));

  return vehicleId;
}

/** The acting dealer's id, read back from the API rather than assumed. */
export async function dealerIdOf(h: Harness): Promise<string> {
  const me = await h.agent().get('/v1/dealer').expect(200);
  return me.body.id as string;
}

/**
 * Processed photos, inserted as already-`READY` rows.
 *
 * Nothing reads the bytes in this suite, so the storage keys are plausible but
 * empty — the pipeline that would write them has its own coverage.
 */
export async function attachReadyPhotos(
  prisma: PrismaClient,
  vehicleId: string,
  dealerId: string,
  count = 6,
): Promise<string[]> {
  const ids: string[] = [];

  for (let position = 0; position < count; position += 1) {
    const mediaId = randomUUID();
    await prisma.media.create({
      data: {
        id: mediaId,
        dealerId,
        ownerType: 'VEHICLE',
        storageKey: `vehicles/${vehicleId}/${mediaId}/1600.webp`,
        mimeType: 'image/webp',
        bytes: 180_000,
        width: 1600,
        height: 1200,
        blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
        variants: { '1600': `vehicles/${vehicleId}/${mediaId}/1600.webp` },
        fileName: `photo-${position + 1}.webp`,
        status: 'READY',
      },
    });
    await prisma.vehicleMedia.create({ data: { vehicleId, mediaId, position } });
    ids.push(mediaId);
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { primaryMediaId: ids[0] ?? null },
  });

  return ids;
}

/**
 * A second seat at an existing dealership.
 *
 * The seed only creates owners, and an owner holds every permission — so the
 * §8.3 table can only be tested from a seat that is missing one.
 */
export async function ensureMember(
  prisma: PrismaClient,
  dealerSlug: string,
  role: DealerRole,
): Promise<string> {
  const dealer = await prisma.dealer.findUniqueOrThrow({ where: { slug: dealerSlug } });

  const existing = await prisma.dealerMember.findFirst({
    where: { dealerId: dealer.id, role, status: 'ACTIVE' },
  });
  if (existing) return existing.userId;

  // A phone that no seeded dealer could own, so it can never be mistaken for
  // real contact data in a leak assertion.
  const phone = `+9155${String(Date.now()).slice(-8)}`;
  const user = await prisma.user.create({
    data: {
      fullName: `${role} seat`,
      phone,
      email: `${role.toLowerCase()}.${dealer.slug}@example.invalid`,
      phoneVerifiedAt: new Date(),
    },
  });

  await prisma.dealerMember.create({
    data: { dealerId: dealer.id, userId: user.id, role, permissions: [] },
  });

  return user.id;
}

/** Buys credits through the mocked provider until the balance clears `atLeast`. */
export async function ensureCredits(h: Harness, atLeast: number): Promise<number> {
  let summary = await h.agent().get('/v1/dealer/billing/summary').expect(200);

  while ((summary.body.creditBalance as number) < atLeast) {
    const packs = await h.agent().get('/v1/dealer/billing/packs').expect(200);
    const pack = packs.body.data[0];
    await h.agent().post('/v1/dealer/billing/orders').send({ packId: pack.id }).expect(201);
    summary = await h.agent().get('/v1/dealer/billing/summary').expect(200);
  }

  return summary.body.creditBalance as number;
}

/** The dealer's newest ledger row — the authoritative balance lives here. */
export async function newestLedgerRow(h: Harness): Promise<{
  delta: number;
  reason: string;
  balanceAfter: number;
  listingId: string | null;
}> {
  const ledger = await h.agent().get('/v1/dealer/billing/ledger?limit=1').expect(200);
  return ledger.body.data[0];
}

export async function ledgerRows(
  h: Harness,
  limit = 20,
): Promise<{ delta: number; reason: string; balanceAfter: number; listingId: string | null }[]> {
  const ledger = await h.agent().get(`/v1/dealer/billing/ledger?limit=${limit}`).expect(200);
  return ledger.body.data;
}
