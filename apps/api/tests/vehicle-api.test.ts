import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The dealer vehicle API end to end (**F063**, as revised by **R45/R46**).
 *
 * Every request goes through a real session, so the tenant rule under test is
 * the one a dealer meets: dealership B asking for dealership A's vehicle by id
 * gets the same 404 as an id that never existed.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let a: Dealership;
let b: Dealership;

let plate = 1000;
function nextPlate(): string {
  plate += 1;
  return `KA 05 MN ${String(plate)}`;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'vehicle-api');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
});

afterAll(async () => {
  await h.close();
});

async function draft(owner: Dealership = a): Promise<{ id: string; registrationNumber: string }> {
  const response = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: nextPlate() })
    .expect(201);
  return response.body;
}

describe('creating a draft', () => {
  it('starts from the registration number, stored canonically', async () => {
    const response = await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'ka-05-mn-1' })
      .expect(201);

    expect(response.body).toMatchObject({
      registrationNumber: 'KA05MN0001',
      registrationDisplay: 'KA 05 MN 0001',
      rtoCode: 'KA05',
      make: null,
      complete: false,
    });
    expect(response.headers['cache-control']).toBe('no-store');

    const audit = await h.prisma.auditLog.findFirst({
      where: { entityType: 'Vehicle', entityId: response.body.id, action: 'vehicle.created' },
    });
    expect(audit).toMatchObject({ actorType: 'DEALER', dealerId: a.dealerId, actorId: a.userId });
  });

  it('refuses the same plate twice in one dealership, naming the field', async () => {
    await a.agent.post('/v1/dealer/vehicles').send({ registrationNumber: 'KA05MN0002' });
    const refused = await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'KA 5 MN 2' })
      .expect(409);

    expect(refused.body.code).toBe('DUPLICATE_REGISTRATION');
    expect(refused.body.errors?.[0]?.field).toBe('body.registrationNumber');
  });

  it('lets another dealership draft the same plate', async () => {
    await a.agent.post('/v1/dealer/vehicles').send({ registrationNumber: 'KA05MN0003' });
    await b.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'KA05MN0003' })
      .expect(201);
  });

  it('refuses a malformed plate with the parser’s own words', async () => {
    const refused = await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'ZZ 01 AB 1234' })
      .expect(400);

    expect(JSON.stringify(refused.body.errors)).toContain('state code');
  });

  it.each(['dealerId', 'status', 'mediaId', 'imageUrl'])(
    'refuses a client-supplied %s on create',
    async (field) => {
      const refused = await a.agent
        .post('/v1/dealer/vehicles')
        .send({ registrationNumber: nextPlate(), [field]: 'x' })
        .expect(400);
      expect(JSON.stringify(refused.body)).toContain(field);
    },
  );

  it('needs a session', async () => {
    await h
      .agent()
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: nextPlate() })
      .expect(401);
  });
});

describe('saving wizard steps', () => {
  it('saves a step, normalises text and reports what is still missing', async () => {
    const { id } = await draft();
    const saved = await a.agent
      .patch(`/v1/dealer/vehicles/${id}`)
      .send({
        make: '  Hyundai ',
        model: 'Creta',
        variant: 'SX(O)',
        manufacturingYear: 2023,
        fuelType: 'PETROL',
        transmission: 'AUTOMATIC',
        bodyType: 'SUV',
      })
      .expect(200);

    expect(saved.body).toMatchObject({
      title: '2023 Hyundai Creta SX(O)',
      make: 'Hyundai',
      complete: false,
    });
    expect(saved.body.issues.map((issue: { field: string }) => issue.field)).toEqual([
      'kilometersDriven',
      'ownerCount',
      'color',
      'insuranceType',
      'pricePaise',
    ]);
  });

  it('becomes complete once every required field is in', async () => {
    const { id } = await draft();
    const saved = await a.agent
      .patch(`/v1/dealer/vehicles/${id}`)
      .send({
        make: 'Tata',
        model: 'Nexon',
        manufacturingYear: 2022,
        registrationYear: 2022,
        fuelType: 'DIESEL',
        transmission: 'MANUAL',
        bodyType: 'SUV',
        kilometersDriven: 18_000,
        ownerCount: 1,
        color: 'RED',
        insuranceType: 'COMPREHENSIVE',
        insuranceValidUntil: '2027-06-30',
        pricePaise: 98_500_000,
        negotiability: 'SLIGHTLY',
        description: 'Single owner, full service history.',
      })
      .expect(200);

    expect(saved.body).toMatchObject({
      complete: true,
      issues: [],
      pricePaise: 98_500_000,
      priceLabel: '₹9,85,000',
      insuranceValidUntil: '2027-06-30',
      summary: 'Diesel · Manual · 18,000 km',
    });
  });

  it('adopts the spelling already in use for a make', async () => {
    const first = await draft();
    await a.agent.patch(`/v1/dealer/vehicles/${first.id}`).send({ make: 'Maruti Suzuki' });

    const second = await draft(b);
    const saved = await b.agent
      .patch(`/v1/dealer/vehicles/${second.id}`)
      .send({ make: 'MARUTI SUZUKI' })
      .expect(200);
    expect(saved.body.make).toBe('Maruti Suzuki');

    const suggestions = await b.agent
      .get('/v1/dealer/vehicles/suggestions?field=make&q=maru')
      .expect(200);
    expect(suggestions.body).toEqual({ field: 'make', values: ['Maruti Suzuki'] });
  });

  it('clears an optional field with null', async () => {
    const { id } = await draft();
    await a.agent.patch(`/v1/dealer/vehicles/${id}`).send({ variant: 'LX' });
    const cleared = await a.agent
      .patch(`/v1/dealer/vehicles/${id}`)
      .send({ variant: null })
      .expect(200);
    expect(cleared.body.variant).toBeNull();
  });

  it('refuses out-of-range values before they reach the database', async () => {
    const { id } = await draft();
    const refused = await a.agent
      .patch(`/v1/dealer/vehicles/${id}`)
      .send({ kilometersDriven: -5, pricePaise: 100 })
      .expect(400);
    const fields = refused.body.errors.map((error: { field: string }) => error.field);
    expect(fields).toEqual(expect.arrayContaining(['body.kilometersDriven', 'body.pricePaise']));
  });

  it.each(['status', 'dealerId', 'mediaId', 'storageKey', 'publishedAt', 'verified'])(
    'refuses a client-supplied %s by name',
    async (field) => {
      const { id } = await draft();
      const refused = await a.agent
        .patch(`/v1/dealer/vehicles/${id}`)
        .send({ make: 'Tata', [field]: 'ACTIVE' })
        .expect(400);
      expect(JSON.stringify(refused.body)).toContain(field);
    },
  );

  it('re-checks for a duplicate when the plate changes', async () => {
    const taken = await draft();
    const other = await draft();
    const refused = await a.agent
      .patch(`/v1/dealer/vehicles/${other.id}`)
      .send({ registrationNumber: taken.registrationNumber })
      .expect(409);
    expect(refused.body.code).toBe('DUPLICATE_REGISTRATION');

    await a.agent
      .patch(`/v1/dealer/vehicles/${other.id}`)
      .send({ registrationNumber: other.registrationNumber, color: 'SILVER' })
      .expect(200);
  });
});

describe('one dealership cannot reach another’s vehicle', () => {
  it('reads it as absent', async () => {
    const { id } = await draft(a);
    const refused = await b.agent.get(`/v1/dealer/vehicles/${id}`).expect(404);
    expect(refused.body.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('cannot change it', async () => {
    const { id } = await draft(a);
    await b.agent.patch(`/v1/dealer/vehicles/${id}`).send({ make: 'Hijacked' }).expect(404);

    const own = await a.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(own.body.make).toBeNull();
  });

  it('cannot delete it', async () => {
    const { id } = await draft(a);
    await b.agent.delete(`/v1/dealer/vehicles/${id}`).expect(404);
    await a.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
  });

  it('answers an unknown id exactly the same way', async () => {
    const refused = await b.agent
      .get('/v1/dealer/vehicles/00000000-0000-4000-8000-000000000000')
      .expect(404);
    expect(refused.body.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('is not reachable from the admin session either', async () => {
    const admin = await fixtures.moderator();
    const { id } = await draft(a);
    await admin.get(`/v1/dealer/vehicles/${id}`).expect(401);
  });
});

describe('seats', () => {
  /** R92: STAFF prepare drafts; throwing one away is a manager's call. */
  it('lets STAFF read, create and edit drafts, but not delete them', async () => {
    const staff = await fixtures.dealership();
    const { id } = await draft(staff);
    await h.prisma.dealerMember.updateMany({
      where: { dealerId: staff.dealerId },
      data: { role: 'STAFF' },
    });

    await staff.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    await staff.agent.patch(`/v1/dealer/vehicles/${id}`).send({ make: 'Tata' }).expect(200);
    await staff.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: nextPlate() })
      .expect(201);
    await staff.agent.delete(`/v1/dealer/vehicles/${id}`).expect(403);
  });
});

describe('discarding a draft', () => {
  it('deletes it, releases the plate and records what it held', async () => {
    const { id, registrationNumber } = await draft();
    await a.agent.delete(`/v1/dealer/vehicles/${id}`).expect(204);
    await a.agent.get(`/v1/dealer/vehicles/${id}`).expect(404);

    await a.agent.post('/v1/dealer/vehicles').send({ registrationNumber }).expect(201);
    const audit = await h.prisma.auditLog.findFirst({
      where: { entityId: id, action: 'vehicle.deleted' },
    });
    expect(audit?.before).toEqual({ registrationNumber });
  });
});

describe('the listing decides what a dealer may still change (F064)', () => {
  it('creates every vehicle with a DRAFT listing the dealer can edit and delete', async () => {
    const created = await a.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: nextPlate() })
      .expect(201);

    expect(created.body.listing).toMatchObject({
      status: 'DRAFT',
      statusLabel: 'Draft',
      statusTone: 'neutral',
      canEdit: true,
      canSubmit: false,
      canDelete: true,
      reason: null,
    });
  });

  it('refuses an edit and a delete while the car is with the review team', async () => {
    const { id } = await draft();
    await h.prisma.listing.update({ where: { vehicleId: id }, data: { status: 'PENDING_REVIEW' } });

    const edit = await a.agent
      .patch(`/v1/dealer/vehicles/${id}`)
      .send({ make: 'Tata' })
      .expect(409);
    expect(edit.body.code).toBe('VEHICLE_NOT_EDITABLE');
    expect(edit.body.listingStatus).toBe('PENDING_REVIEW');
    const remove = await a.agent.delete(`/v1/dealer/vehicles/${id}`).expect(409);
    expect(remove.body.code).toBe('VEHICLE_NOT_DELETABLE');

    const read = await a.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(read.body.listing).toMatchObject({
      status: 'PENDING_REVIEW',
      statusLabel: 'Pending review',
      canEdit: false,
      canDelete: false,
    });
  });

  it('opens editing again when changes are requested, and shows the reason', async () => {
    const { id } = await draft();
    await h.prisma.listing.update({
      where: { vehicleId: id },
      data: { status: 'CHANGES_REQUESTED', decisionReason: 'The variant is wrong.' },
    });

    await a.agent.patch(`/v1/dealer/vehicles/${id}`).send({ variant: 'SX' }).expect(200);
    const read = await a.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(read.body.listing).toMatchObject({
      status: 'CHANGES_REQUESTED',
      reason: 'The variant is wrong.',
      canEdit: true,
      canDelete: false,
    });
  });

  it.each(['listing', 'status'])('will not let a dealer post a %s block', async (field) => {
    const { id } = await draft();
    await a.agent
      .patch(`/v1/dealer/vehicles/${id}`)
      .send({ [field]: { status: 'ACTIVE' } })
      .expect(400);
    const read = await a.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(read.body.listing.status).toBe('DRAFT');
  });
});
