import type request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { resolveOnboardingLocation } from '../src/modules/service-locations/service-locations.facade.js';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';

const DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kancheepuram',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Kanyakumari',
  'Namakkal',
  'Perambalur',
  'Pudukottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thiruvallur',
  'Thiruvarur',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvannamalai',
  'The Nilgiris',
  'Vellore',
  'Viluppuram',
  'Virudhunagar',
];
let h: AuthHarness;
let admin: request.Agent;
let counter = 0;
beforeAll(async () => {
  h = await createAuthHarness();
  h.google.claims = {
    subject: 'service-location-admin',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
  };
  admin = h.agent();
  await h.signInAdmin(admin);
});
async function restore() {
  await h.prisma.serviceState.updateMany({ data: { onboardingEnabled: false, active: true } });
  await h.prisma.serviceState.update({ where: { id: 'IN-TN' }, data: { onboardingEnabled: true } });
  await h.prisma.serviceDistrict.updateMany({
    where: { stateId: 'IN-TN' },
    data: { active: true, onboardingEnabled: true, photographyAvailable: true },
  });
}
beforeEach(restore);
afterAll(async () => {
  if (h) {
    await restore();
    await h.close();
  }
});

async function signup(state = 'Tamil Nadu', district = 'Vellore') {
  counter += 1;
  h.google.claims = {
    subject: `location-dealer-${counter}`,
    email: `location-dealer-${counter}@example.test`,
    emailVerified: true,
  };
  const agent = h.agent();
  await h.signIn(agent);
  const phone = `95501${String(counter).padStart(5, '0')}`;
  await h.proveNumber(agent, phone);
  const response = await agent.post('/v1/auth/onboarding').send({
    fullName: 'Location QA Representative',
    phone,
    legalName: `Location QA ${counter}`,
    addressLine: 'Synthetic test street',
    city: 'Test town',
    state,
    district,
    pincode: '632001',
    mapsUrl: 'https://maps.app.goo.gl/location-qa',
    tagline: 'Synthetic location test dealership',
    specialities: ['Finance'],
  });
  return { agent, response };
}
async function configured() {
  const response = await admin.get('/v1/admin/service-locations').expect(200);
  return response.body.data as {
    id: string;
    version: number;
    districts: { id: string; version: number }[];
  }[];
}
async function disable(kind: 'state' | 'district', id: string) {
  const states = await configured();
  const item =
    kind === 'state'
      ? states.find((x) => x.id === id)
      : states.flatMap((x) => x.districts).find((x) => x.id === id);
  return admin
    .put(`/v1/admin/service-locations/${kind}/${id}`)
    .send({ expectedVersion: item?.version, active: true, onboardingEnabled: false })
    .expect(200);
}

describe('service locations: real sessions, routing, PostgreSQL and dealer admission', () => {
  it('publishes only Tamil Nadu and all 38 districts, with no internal aliases', async () => {
    const response = await h.agent().get('/v1/service-locations').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.map((x: { name: string }) => x.name)).toEqual(['Tamil Nadu']);
    expect(response.body.data[0].districts.map((x: { name: string }) => x.name).sort()).toEqual(
      [...DISTRICTS].sort(),
    );
    expect(response.body.data[0]).not.toHaveProperty('aliases');
    expect((await configured()).length).toBe(36);
  });
  it.each(DISTRICTS)(
    'persists canonical identifiers for new onboarding in %s',
    async (district) => {
      const { response } = await signup('Tamil Nadu', district);
      expect(response.status).toBe(201);
      const row = await h.prisma.dealer.findUniqueOrThrow({
        where: { id: response.body.dealer.id as string },
      });
      expect(row).toMatchObject({
        state: 'Tamil Nadu',
        district,
        serviceStateId: 'IN-TN',
        locationReviewRequired: false,
        city: 'Test Town',
      });
      expect(row.serviceDistrictId).toBeTruthy();
    },
  );
  it.each([
    ['Karnataka', 'Vellore'],
    ['Tamil Nadu', 'Bengaluru'],
    ['Forged state', 'Vellore'],
  ])('rejects disabled or forged mapping %s / %s at the API', async (state, district) => {
    const { response } = await signup(state, district);
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('LOCATION_UNAVAILABLE');
  });
  it('canonicalizes reviewed aliases and whitespace without inventing ambiguous matches', async () => {
    await h.prisma.$transaction(async (tx) => {
      expect(await resolveOnboardingLocation(tx, ' TN ', '  kanniyakumari  ')).toMatchObject({
        state: 'Tamil Nadu',
        district: 'Kanyakumari',
      });
      await expect(resolveOnboardingLocation(tx, 'Tamil Nadu', 'Vellor')).rejects.toMatchObject({
        code: 'LOCATION_UNAVAILABLE',
      });
    });
  });
  it('district disable blocks new admission but preserves an existing dealership and unrelated edits', async () => {
    const made = await signup();
    expect(made.response.status).toBe(201);
    await disable('district', 'IN-TN-VELLORE');
    const next = await signup();
    expect(next.response.status).toBe(422);
    await made.agent
      .patch('/v1/dealer/onboarding')
      .send({
        address: { line: 'Updated synthetic street', district: 'Vellore', state: 'Tamil Nadu' },
      })
      .expect(200);
    const row = await h.prisma.dealer.findUniqueOrThrow({
      where: { id: made.response.body.dealer.id as string },
    });
    expect(row.serviceDistrictId).toBe('IN-TN-VELLORE');
    expect(row.status).toBe('DRAFT');
  });
  it('state disable removes it from onboarding and rejects a forged request', async () => {
    await disable('state', 'IN-TN');
    expect((await h.agent().get('/v1/service-locations')).body.data).toEqual([]);
    expect((await signup()).response.status).toBe(422);
  });
  it('enables future states without activating districts or photography implicitly', async () => {
    const state = (await configured()).find((x) => x.id === 'IN-KA');
    await admin
      .put('/v1/admin/service-locations/state/IN-KA')
      .send({ expectedVersion: state?.version, active: true, onboardingEnabled: true })
      .expect(200);
    const added = await admin
      .post('/v1/admin/service-locations/districts')
      .send({
        stateId: 'IN-KA',
        name: 'Location QA District',
        sourceUrl: 'https://district.nic.in/',
        sourceReviewed: true,
      })
      .expect(201);
    const district = added.body.data
      .find((x: { id: string }) => x.id === 'IN-KA')
      .districts.find((x: { name: string }) => x.name === 'Location QA District');
    expect(district).toMatchObject({ onboardingEnabled: false, photographyAvailable: false });
    expect((await signup('Karnataka', 'Location QA District')).response.status).toBe(422);
    await admin
      .put(`/v1/admin/service-locations/district/${district.id}`)
      .send({
        expectedVersion: district.version,
        active: true,
        onboardingEnabled: true,
        photographyAvailable: false,
      })
      .expect(200);
    expect((await signup('Karnataka', 'Location QA District')).response.status).toBe(201);
    const history = await admin.get('/v1/admin/service-locations/history').expect(200);
    expect(
      history.body.data.some(
        (x: { action: string }) => x.action === 'service_location.district_added',
      ),
    ).toBe(true);
    expect(history.body.data[0]).not.toHaveProperty('ip');
  });
  it('rejects duplicate district names and unreviewed or non-government master data', async () => {
    await admin
      .post('/v1/admin/service-locations/districts')
      .send({
        stateId: 'IN-TN',
        name: 'vELLORE',
        sourceUrl: 'https://vellore.nic.in/',
        sourceReviewed: true,
      })
      .expect(409);
    for (const source of [
      'not a url',
      'https://',
      '',
      'https://example.test/',
      'http://vellore.nic.in/',
      'https://vellore.nic.in.evil.test/',
    ]) {
      await admin
        .post('/v1/admin/service-locations/districts')
        .send({ stateId: 'IN-TN', name: 'Invalid QA', sourceUrl: source, sourceReviewed: true })
        .expect(400);
    }
    await admin
      .post('/v1/admin/service-locations/districts')
      .send({
        stateId: 'IN-TN',
        name: 'Invalid QA',
        sourceUrl: 'https://vellore.nic.in/',
        sourceReviewed: false,
      })
      .expect(400);
  });
  it('refuses unauthenticated and unauthorized configuration mutation', async () => {
    await h
      .agent()
      .put('/v1/admin/service-locations/state/IN-TN')
      .send({ expectedVersion: 1, active: true, onboardingEnabled: false })
      .expect(401);
    const made = await signup();
    await made.agent
      .put('/v1/admin/service-locations/state/IN-TN')
      .send({ expectedVersion: 1, active: true, onboardingEnabled: false })
      .expect(401);
  });
  it('accepts only one of two concurrent admin changes and records one atomic audit', async () => {
    const before = (await configured()).find((x) => x.id === 'IN-TN');
    const count = await h.prisma.auditLog.count({
      where: { entityType: 'ServiceState', entityId: 'IN-TN' },
    });
    const changes = await Promise.all(
      [false, true].map((onboardingEnabled) =>
        admin
          .put('/v1/admin/service-locations/state/IN-TN')
          .send({ expectedVersion: before?.version, active: true, onboardingEnabled }),
      ),
    );
    expect(changes.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(
      await h.prisma.auditLog.count({ where: { entityType: 'ServiceState', entityId: 'IN-TN' } }),
    ).toBe(count + 1);
  });
  it('supports inactive master values without admitting them and reports missing or stale settings', async () => {
    const state = (await configured()).find((item) => item.id === 'IN-TN');
    await admin
      .put('/v1/admin/service-locations/state/IN-TN')
      .send({ expectedVersion: state?.version, active: false, onboardingEnabled: true })
      .expect(200);
    expect((await signup()).response.status).toBe(422);
    await admin
      .put('/v1/admin/service-locations/state/IN-TN')
      .send({ expectedVersion: state?.version, active: true, onboardingEnabled: true })
      .expect(409);
    await admin
      .put('/v1/admin/service-locations/state/missing')
      .send({ expectedVersion: 1, active: true, onboardingEnabled: true })
      .expect(404);
    await admin
      .put('/v1/admin/service-locations/state/IN-TN')
      .send({
        expectedVersion: 1,
        active: true,
        onboardingEnabled: true,
        photographyAvailable: true,
      })
      .expect(422);
    await admin
      .post('/v1/admin/service-locations/districts')
      .send({
        stateId: 'missing',
        name: 'Unknown QA',
        sourceUrl: 'https://district.nic.in/',
        sourceReviewed: true,
      })
      .expect(404);
  });
  it('refuses a canonical district alias already configured under its government display name', async () => {
    await admin
      .post('/v1/admin/service-locations/districts')
      .send({
        stateId: 'IN-TN',
        name: 'Kanniyakumari',
        sourceUrl: 'https://kanniyakumari.nic.in/',
        sourceReviewed: true,
      })
      .expect(409);
  });
  it('rejects a console moderator who lacks configuration permission', async () => {
    const email = 'location-moderator@example.test';
    await admin.post('/v1/admin/members').send({ email, role: 'MODERATOR' }).expect(201);
    h.google.claims = { subject: 'location-moderator', email, emailVerified: true };
    const moderator = h.agent();
    await h.signInAdmin(moderator);
    const state = (await configured()).find((item) => item.id === 'IN-TN');
    await moderator
      .put('/v1/admin/service-locations/state/IN-TN')
      .send({ expectedVersion: state?.version, active: true, onboardingEnabled: false })
      .expect(403);
    await moderator
      .post('/v1/admin/service-locations/districts')
      .send({
        stateId: 'IN-TN',
        name: 'Forged QA',
        sourceUrl: 'https://vellore.nic.in/',
        sourceReviewed: true,
      })
      .expect(403);
  });
  it('holds admission locks until commit before a concurrent disable takes effect', async () => {
    let release: () => void = () => undefined;
    let admitted: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      admitted = resolve;
    });
    const admission = h.prisma.$transaction(async (tx) => {
      const location = await resolveOnboardingLocation(tx, 'Tamil Nadu', 'Vellore');
      admitted();
      await gate;
      return location;
    });
    await ready;
    let changed = false;
    const mutation = disable('district', 'IN-TN-VELLORE').then(() => {
      changed = true;
    });
    try {
      const deadline = Date.now() + 3000;
      let waiting = false;
      while (Date.now() < deadline && !waiting) {
        const rows = await h.prisma.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE '%UPDATE%service_districts%') AS waiting`;
        waiting = rows[0]?.waiting ?? false;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      expect(changed).toBe(false);
    } finally {
      release();
    }
    expect(await admission).toMatchObject({ serviceDistrictId: 'IN-TN-VELLORE' });
    await mutation;
    await h.prisma.$transaction(async (tx) => {
      await expect(resolveOnboardingLocation(tx, 'Tamil Nadu', 'Vellore')).rejects.toMatchObject({
        code: 'LOCATION_UNAVAILABLE',
      });
    });
  });
  it('enforces district/state relationships in PostgreSQL independently of frontend selection', async () => {
    const made = await signup();
    await expect(
      h.prisma.dealer.update({
        where: { id: made.response.body.dealer.id as string },
        data: { serviceStateId: 'IN-KA', serviceDistrictId: 'IN-TN-VELLORE' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
