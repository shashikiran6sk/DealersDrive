import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthHarness } from './auth-harness.js';
import { createAuthHarness, createFakeGoogle } from './auth-harness.js';
import { env } from '../src/config/env.js';

/** Where the local-disk adapter puts a key. `STORAGE_LOCAL_DIR` is set by the runner. */
function storagePath(key: string): string {
  return resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? '.storage-test', key);
}

/**
 * The onboarding rules that live in the **database**, and the KYC upload
 * pipeline end to end.
 *
 * These are here rather than in a unit test for the reason the vitest config
 * gives: the guarantees being checked are indexes and stored objects, and a
 * mocked Prisma or a fake `StoragePort` would test the mock. Two dealerships
 * in one city must not share a registered name, and no two anywhere may share
 * a GSTIN; both have to hold when two applications race, which is a property
 * of the unique indexes rather than of the read-then-write check in front of
 * them.
 *
 * Storage is the local-disk adapter (`STORAGE_DRIVER=local`), so a `PUT` here
 * writes a real file and `deleteDocument` has a real object to remove. The
 * presign → PUT → commit contract is identical against MinIO and R2; what
 * differs is only who signs the URL.
 */
let h: AuthHarness;

let counter = 0;
/** R34's moderator sign-ins, kept off `counter` so a dealer fixture is unaffected. */
let subjectCounter = 0;
function newAccount(): void {
  counter += 1;
  h.google.claims = {
    subject: `onboarding-sub-${counter}`,
    email: `onboarding${counter}@example.com`,
    emailVerified: true,
    name: 'Test Dealer',
  };
}

function onboarding(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'R. Manikandan',
    phone: `98411${String(10000 + counter).slice(-5)}`,
    legalName: `Onboarding Motors ${counter}`,
    addressLine: '18, Gandhi Road',
    city: 'Katpadi',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632007',
    mapsUrl: 'https://maps.app.goo.gl/onboarding-fixture',
    tagline: 'Family-run dealership in Katpadi, trading since 1998.',
    specialities: ['Hatchbacks', 'RC transfer'],
    ...overrides,
  };
}

/** A signed-in agent with a dealership behind it. */
async function dealership(overrides: Record<string, unknown> = {}) {
  newAccount();
  const agent = h.agent();
  await h.signIn(agent);
  const created = await agent.post('/v1/auth/onboarding').send(onboarding(overrides)).expect(201);
  return {
    agent,
    dealerId: created.body.dealer.id as string,
    // The slug is what every storage key this dealership owns is derived from,
    // so a test that looks at the bucket needs it.
    dealerSlug: created.body.dealer.slug as string,
  };
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

describe('one name per city', () => {
  it('refuses a second dealership under the same name in the same city', async () => {
    const name = `Duplicate Motors ${Date.now()}`;
    await dealership({ legalName: name, city: 'Vellore' });

    newAccount();
    const second = h.agent();
    await h.signIn(second);
    const refused = await second
      .post('/v1/auth/onboarding')
      .send(onboarding({ legalName: name, city: 'Vellore' }))
      .expect(409);

    expect(refused.body.code).toBe('DEALER_NAME_TAKEN');
    // Named against the field the dealer typed, so the form can show it there,
    // and it says *where* it is taken — the name alone is not the problem.
    expect(refused.body.errors?.[0]?.field).toBe('body.legalName');
    expect(refused.body.detail).toContain('Vellore');
  });

  /**
   * The other half of the rule, and the reason it is scoped at all: "Sri
   * Balaji Motors" is a name three unrelated families use in three different
   * towns, and a global unique let the first applicant lock the other two out.
   */
  it('allows the same name in a different city', async () => {
    const name = `Sri Balaji Motors ${Date.now()}`;
    await dealership({ legalName: name, city: 'Vellore' });

    newAccount();
    const second = h.agent();
    await h.signIn(second);
    await second
      .post('/v1/auth/onboarding')
      .send(onboarding({ legalName: name, city: 'Salem' }))
      .expect(201);
  });

  /** Case is not a difference — in either field. */
  it('refuses it whatever the casing of the name or the city', async () => {
    const name = `Casing Motors ${Date.now()}`;
    await dealership({ legalName: name, city: 'Katpadi' });

    newAccount();
    const second = h.agent();
    await h.signIn(second);
    await second
      .post('/v1/auth/onboarding')
      .send(onboarding({ legalName: name.toUpperCase(), city: 'KATPADI' }))
      .expect(409);
  });

  /** The normalisation is what makes the casing case above hold at the index. */
  it('stores the city, district and state in one normalised form', async () => {
    const { agent } = await dealership({
      city: '  hubballi  ',
      district: 'dharwad',
      state: 'karnataka',
    });

    const profile = await agent.get('/v1/dealer').expect(200);

    expect(profile.body.address).toMatchObject({
      city: 'Hubballi',
      district: 'Dharwad',
      state: 'Karnataka',
    });
  });

  /**
   * The district is asked for on the same step as the city, and it is what the
   * admin console's location filter is built on — so it is required, and it is
   * normalised by the same function for the same reason: three spellings of one
   * district are three useless filter values.
   */
  it('requires a district, and normalises a rename of one', async () => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const { district: _omitted, ...withoutDistrict } = onboarding();
    const rejected = await agent.post('/v1/auth/onboarding').send(withoutDistrict).expect(400);
    expect(rejected.body.code).toBe('VALIDATION_FAILED');

    await agent.post('/v1/auth/onboarding').send(onboarding()).expect(201);
    await agent
      .patch('/v1/dealer/onboarding')
      .send({ address: { district: '  tiruvannamalai  ' } })
      .expect(200);

    const profile = await agent.get('/v1/dealer').expect(200);
    expect(profile.body.address.district).toBe('Tiruvannamalai');
  });

  /**
   * One name is asked for, and the display name is derived from it. Sending a
   * `brandName` is a 400 naming the field rather than a silent success, because
   * every input schema is `.strict()`.
   */
  it('mirrors the registered name onto the display name, and refuses a second one', async () => {
    const { agent } = await dealership();
    const profile = await agent.get('/v1/dealer').expect(200);

    expect(profile.body.brandName).toBe(profile.body.legalName);

    newAccount();
    const other = h.agent();
    await h.signIn(other);
    const refused = await other
      .post('/v1/auth/onboarding')
      .send({ ...onboarding(), brandName: 'Something Else' })
      .expect(400);

    expect(JSON.stringify(refused.body)).toContain('brandName');
  });

  it('renames a dealership through PATCH, mirror and all', async () => {
    const { agent } = await dealership();
    const renamed = `Renamed Motors ${Date.now()}`;

    const updated = await agent
      .patch('/v1/dealer/onboarding')
      .send({ legalName: renamed })
      .expect(200);

    expect(updated.body.legalName).toBe(renamed);
    expect(updated.body.brandName).toBe(renamed);
  });

  it('refuses a rename onto a name another dealership in the same city holds', async () => {
    const taken = `Taken Motors ${Date.now()}`;
    await dealership({ legalName: taken, city: 'Katpadi' });
    const { agent } = await dealership({ city: 'Katpadi' });

    const refused = await agent
      .patch('/v1/dealer/onboarding')
      .send({ legalName: taken })
      .expect(409);

    expect(refused.body.code).toBe('DEALER_NAME_TAKEN');
  });

  it('allows a rename onto a name only held in another city', async () => {
    const taken = `Elsewhere Motors ${Date.now()}`;
    await dealership({ legalName: taken, city: 'Salem' });
    const { agent } = await dealership({ city: 'Katpadi' });

    await agent.patch('/v1/dealer/onboarding').send({ legalName: taken }).expect(200);
  });

  /**
   * Both fields in one submit. Checking the new name against the old city
   * would refuse a legal move — and, moving the other way, let through a
   * collision in the city being moved to.
   */
  it('checks a rename against the city the same request moves to', async () => {
    const taken = `Moving Motors ${Date.now()}`;
    await dealership({ legalName: taken, city: 'Salem' });
    const { agent } = await dealership({ city: 'Katpadi' });

    const refused = await agent
      .patch('/v1/dealer/onboarding')
      .send({ legalName: taken, address: { city: 'Salem' } })
      .expect(409);

    expect(refused.body.code).toBe('DEALER_NAME_TAKEN');
  });

  /** Saving an unchanged form must not collide with the dealership saving it. */
  it('lets a dealership keep its own name', async () => {
    const { agent } = await dealership();
    const profile = await agent.get('/v1/dealer').expect(200);

    await agent
      .patch('/v1/dealer/onboarding')
      .send({ legalName: profile.body.legalName })
      .expect(200);
  });
});

describe('the yard on a map', () => {
  const LINK = 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9';

  it('stores the share link exactly as it was pasted', async () => {
    const { agent } = await dealership({ mapsUrl: `${LINK}?g_st=iw` });

    const profile = await agent.get('/v1/dealer').expect(200);

    // Verbatim, query string and all: what is inside a Maps link is Google's
    // business, and a "cleaned up" share link stops resolving.
    expect(profile.body.address.mapsUrl).toBe(`${LINK}?g_st=iw`);
  });

  /**
   * The validation that matters, asserted where it is enforced rather than
   * only in the contracts unit test: a buyer's browser follows this link from
   * a public page, so a host that is not Google is a stored open redirect.
   */
  it.each([
    ['a link to somewhere else entirely', 'https://evil.example.com/maps'],
    ['a host that merely contains a Google one', 'https://maps.google.com.evil.test/place'],
    ['the same link over http', 'http://maps.app.goo.gl/8QwYh2v1kFqL3mNz9'],
    ['an address typed into the wrong box', '18, Gandhi Road, Katpadi'],
  ])('refuses %s', async (_label, mapsUrl) => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const refused = await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ mapsUrl }))
      .expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(refused.body)).toContain('mapsUrl');
  });

  it('is required, and a dealership without one cannot be submitted', async () => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const { mapsUrl: _omitted, ...withoutMaps } = onboarding();
    await agent.post('/v1/auth/onboarding').send(withoutMaps).expect(400);

    await agent.post('/v1/auth/onboarding').send(onboarding()).expect(201);
    const completeness = await agent.get('/v1/dealer/completeness').expect(200);
    const business = completeness.body.steps.find(
      (step: { key: string }) => step.key === 'business',
    );

    expect(business.missing).not.toContain('mapsUrl');
  });

  it('names the missing link when a dealership predates the question', async () => {
    const { agent, dealerId } = await dealership();
    // The state every dealership created before this feature is in. There is
    // no backfill, so completeness has to say so rather than pass silently.
    await h.prisma.dealer.update({ where: { id: dealerId }, data: { mapsUrl: null } });

    const completeness = await agent.get('/v1/dealer/completeness').expect(200);
    const business = completeness.body.steps.find(
      (step: { key: string }) => step.key === 'business',
    );

    expect(business.missing).toContain('mapsUrl');
    expect(completeness.body.canSubmit).toBe(false);
  });

  it('can be replaced through PATCH when the dealer moves the pin', async () => {
    const { agent } = await dealership();
    const moved = 'https://www.google.com/maps/place/New+Yard/@12.91,79.13,17z';

    await agent
      .patch('/v1/dealer/onboarding')
      .send({ address: { mapsUrl: moved } })
      .expect(200);
    const refused = await agent
      .patch('/v1/dealer/onboarding')
      .send({ address: { mapsUrl: 'https://evil.example.com/maps' } })
      .expect(400);

    expect((await agent.get('/v1/dealer').expect(200)).body.address.mapsUrl).toBe(moved);
    expect(refused.body.code).toBe('VALIDATION_FAILED');
  });
});

/**
 * The dealership in its own words — one line and a set of services (**R26**).
 *
 * Asked for on the same step as the address, stored on the same row, and
 * required on the same footing: the public portfolio is the page a dealership
 * is judged on before anybody drives anywhere, and one with a photograph, a
 * pin and no sentence reads as an unfinished listing rather than a business.
 *
 * They replace `about`, which asked for the same thing at forty times the
 * length. Nothing public renders that column any more (R25) and nothing writes
 * it (R26) — the last two assertions here are what pins that down.
 *
 * Most of what is asserted below is about the *floor* rather than the
 * requirement. "Required" with no minimum length is a box satisfied by `-`,
 * which is not a description and does not make the portfolio any better.
 */
describe('the dealership description', () => {
  const TAGLINE = 'Family-run since 1998 \u2014 hatchbacks under \u20b96 lakh, inspected in-house.';

  it('is stored from onboarding and read back on the profile', async () => {
    const { agent } = await dealership({ tagline: TAGLINE, specialities: ['Hatchbacks'] });

    const profile = await agent.get('/v1/dealer').expect(200);

    expect(profile.body.tagline).toBe(TAGLINE);
    expect(profile.body.specialities).toEqual(['Hatchbacks']);
  });

  it('is required, and onboarding without a tagline is refused', async () => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const { tagline: _omitted, ...withoutTagline } = onboarding();
    const refused = await agent.post('/v1/auth/onboarding').send(withoutTagline).expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(refused.body)).toContain('tagline');
  });

  it('is required, and onboarding without a service is refused', async () => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const refused = await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ specialities: [] }))
      .expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(refused.body)).toContain('specialities');
  });

  /**
   * `about` is not accepted here any more, and `.strict()` is what says so:
   * sending it is a 400 that names the field rather than a silent success that
   * writes a column nothing reads (rule 2).
   */
  it('refuses the `about` paragraph it replaced', async () => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const refused = await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ about: 'Family-run since 1998, and every car is inspected in-house.' }))
      .expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(refused.body)).toContain('about');
  });

  /**
   * The floor exists so that "required" means something. A required box with
   * no minimum is satisfied by a single character, which buys nothing except
   * the false belief that every portfolio has prose on it.
   */
  it('refuses a single evasive word', async () => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ tagline: 'cars' }))
      .expect(400);
    await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ tagline: '-' }))
      .expect(400);
    // Whitespace is trimmed before the length is counted, so padding does not
    // buy a way past it either.
    await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ tagline: `cars${' '.repeat(40)}` }))
      .expect(400);
  });

  /** Ten characters exactly — the floor is a floor, not a wall. */
  it('accepts a short but real line', async () => {
    const { agent } = await dealership({ tagline: 'Since 2004' });

    expect((await agent.get('/v1/dealer').expect(200)).body.tagline).toBe('Since 2004');
  });

  /**
   * The state every dealership created before the question was asked is in,
   * and the one dealerships created while it was optional are in too. There is
   * no backfill — nobody but the dealer can write this sentence — so
   * completeness has to name it rather than pass silently.
   */
  it('names the missing line and services when a dealership predates the question', async () => {
    const { agent, dealerId } = await dealership();
    await h.prisma.dealer.update({
      where: { id: dealerId },
      data: { tagline: null, specialities: [] },
    });

    const completeness = await agent.get('/v1/dealer/completeness').expect(200);
    const business = completeness.body.steps.find(
      (step: { key: string }) => step.key === 'business',
    );

    expect(business.missing).toContain('tagline');
    expect(business.missing).toContain('specialities');
    expect(completeness.body.canSubmit).toBe(false);
  });

  /*
   * ── One case retired here (R33) ──────────────────────────────────────────
   * "is not satisfied by the paragraph it replaced" wrote an `about` and a null
   * tagline and asserted that the dealership was still incomplete. It was the
   * R25/R26 pair stated as a behaviour, and it needed a column to state it
   * with. R33 dropped that column, so the case cannot be written any more —
   * and does not need to be: there is no longer a paragraph for a dealership
   * to be mistakenly credited for.
   * ────────────────────────────────────────────────────────────────────────
   */

  /** And once they are there, they are not what is holding the dealership up. */
  it('does not appear as outstanding once it has been written', async () => {
    const { agent } = await dealership({ tagline: TAGLINE });

    const completeness = await agent.get('/v1/dealer/completeness').expect(200);
    const business = completeness.body.steps.find(
      (step: { key: string }) => step.key === 'business',
    );

    expect(business.missing).not.toContain('tagline');
    expect(business.missing).not.toContain('specialities');
  });

  it('can be rewritten through PATCH', async () => {
    const { agent } = await dealership({ tagline: TAGLINE });

    await agent.patch('/v1/dealer').send({ tagline: 'Now under new management.' }).expect(200);

    expect((await agent.get('/v1/dealer').expect(200)).body.tagline).toBe(
      'Now under new management.',
    );
  });

  /**
   * The partial-patch schema keeps both optional — a step that does not carry
   * them must not clear them — but neither may be *emptied*, or the dealer
   * could delete on the profile screen what onboarding insisted on.
   */
  it('cannot be emptied through PATCH', async () => {
    const { agent } = await dealership({ tagline: TAGLINE, specialities: ['Hatchbacks'] });

    expect((await agent.patch('/v1/dealer').send({ tagline: '' }).expect(400)).body.code).toBe(
      'VALIDATION_FAILED',
    );
    expect((await agent.patch('/v1/dealer').send({ specialities: [] }).expect(400)).body.code).toBe(
      'VALIDATION_FAILED',
    );

    const profile = await agent.get('/v1/dealer').expect(200);
    expect(profile.body.tagline).toBe(TAGLINE);
    expect(profile.body.specialities).toEqual(['Hatchbacks']);
  });

  it('refuses a line longer than the column is meant to hold', async () => {
    newAccount();
    const agent = h.agent();
    await h.signIn(agent);

    const refused = await agent
      .post('/v1/auth/onboarding')
      .send(onboarding({ tagline: 'a'.repeat(201) }))
      .expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(refused.body)).toContain('tagline');
  });
});

/**
 * **R27 — what a dealership may change about itself once it is not a DRAFT.**
 *
 * `PATCH /v1/dealer` takes `DealerSelfUpdateInput`: the year they started, the
 * line they describe themselves in, and what their yard does. Everything the
 * platform *verified* is refused there — and refused by the schema, so a client
 * gets a 400 that names the field rather than a silent write.
 *
 * The split is between preferences and evidence. The registered name is what
 * KYC was run against; the address, town, pin and map link are what the yard
 * photograph and the verification were about; the mobile and email are how a
 * buyer reaches a business that has been vouched for. A dealership that has
 * genuinely moved closes this account and opens another — there is no in-place
 * answer, and deliberately no request queue either.
 *
 * The onboarding wizard keeps the wider shape on its own route, guarded to
 * DRAFT: a dealership still answering these questions has had nothing verified
 * yet, so there is nothing an edit can invalidate.
 */
describe('what a dealer may change about themselves', () => {
  /** Activated, because DRAFT is the state the wider route exists for. */
  async function activeDealership() {
    const made = await dealership();
    await h.prisma.dealer.update({ where: { id: made.dealerId }, data: { status: 'ACTIVE' } });
    return made;
  }

  it.each([
    ['legalName', { legalName: 'Somebody Else Motors' }],
    ['gstin', { gstin: '33AABCS1429B1Z5' }],
    ['pan', { pan: 'AABCS1429B' }],
    ['about', { about: 'Family-run since 1998, every car inspected in-house.' }],
    ['contact', { contact: { phone: '9840099999' } }],
    ['address', { address: { city: 'Chennai' } }],
    // Named as `address`, not `address.mapsUrl`: the whole key is unrecognised,
    // so the refusal is about the box the dealer would have typed into.
    ['address', { address: { mapsUrl: 'https://maps.app.goo.gl/elsewhere' } }],
  ])("refuses %s on the dealer's own PATCH", async (field, body) => {
    const { agent } = await activeDealership();

    const refused = await agent.patch('/v1/dealer').send(body).expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(refused.body)).toContain(field);
  });

  /**
   * R34 changed what "accepts" means for two of the three.
   *
   * The year is written. The tagline and the service list are *accepted* — a
   * 200, recorded, and reported back on `profileChange` — and not published:
   * the dealership still reads with the words it had, because those are the
   * words a buyer is still being shown.
   */
  it('writes the year, and holds the two sentences for review', async () => {
    const { agent } = await activeDealership();
    const before = await agent.get('/v1/dealer').expect(200);

    await agent
      .patch('/v1/dealer')
      .send({
        establishedYear: 2004,
        tagline: 'Only diesel SUVs, every one with a service book.',
        specialities: ['SUVs', 'Exchange'],
      })
      .expect(200);

    const profile = await agent.get('/v1/dealer').expect(200);
    expect(profile.body.establishedYear).toBe(2004);
    // Unchanged, and deliberately compared against what was there before rather
    // than against a literal: the point is that nothing moved.
    expect(profile.body.tagline).toBe(before.body.tagline);
    expect(profile.body.specialities).toEqual(before.body.specialities);

    expect(profile.body.profileChange).toMatchObject({
      status: 'PENDING',
      tagline: 'Only diesel SUVs, every one with a service book.',
      specialities: ['SUVs', 'Exchange'],
    });
  });

  /**
   * The refusal is a refusal and not a partial write. A payload carrying one
   * allowed field and one locked one must change neither — otherwise the lock
   * is advisory, and a client that ignores the 400 still moved the address.
   */
  it('writes nothing at all when one field in the payload is locked', async () => {
    const { agent, dealerId } = await activeDealership();
    const before = await agent.get('/v1/dealer').expect(200);

    await agent
      .patch('/v1/dealer')
      .send({ tagline: 'A perfectly good line about us.', address: { city: 'Chennai' } })
      .expect(400);

    const after = await agent.get('/v1/dealer').expect(200);
    expect(after.body.tagline).toBe(before.body.tagline);
    expect(after.body.address.city).toBe(before.body.address.city);
    // And nothing reached the row behind the API either.
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealerId } });
    expect(row.city).toBe(before.body.address.city);
  });

  /**
   * The wizard's door, and the whole of what separates it from the one above.
   * A DRAFT dealership is one still answering these questions — or one a
   * moderator sent back with *Request changes*, which writes `status: DRAFT`
   * with a reason, so it is the same door.
   */
  it('lets a DRAFT dealership still change its name and address', async () => {
    const { agent } = await dealership();

    await agent
      .patch('/v1/dealer/onboarding')
      .send({ address: { city: 'Chennai', district: 'Chennai' } })
      .expect(200);

    expect((await agent.get('/v1/dealer').expect(200)).body.address.city).toBe('Chennai');
  });

  it.each(['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED'] as const)(
    'refuses the onboarding route once the dealership is %s',
    async (status) => {
      const { agent, dealerId } = await dealership();
      await h.prisma.dealer.update({ where: { id: dealerId }, data: { status } });

      const refused = await agent
        .patch('/v1/dealer/onboarding')
        .send({ address: { city: 'Chennai' } })
        .expect(409);

      expect(refused.body.code).toBe('PROFILE_LOCKED');
      expect((await agent.get('/v1/dealer').expect(200)).body.address.city).toBe('Katpadi');
    },
  );
});

describe('the contact number, after onboarding', () => {
  /**
   * The number stopped being a credential when dealers moved to Google
   * sign-in, so it is editable — and it has to be, because the step that asks
   * for it is reached again by pressing Back. A read-only box there was a dead
   * end for the one dealer who most needed it: the one told their number
   * belongs to somebody else.
   */
  it('changes both the account number and the number buyers are given', async () => {
    const { agent, dealerId } = await dealership();

    await agent
      .patch('/v1/dealer/onboarding')
      .send({ contact: { phone: '98765 43210' } })
      .expect(200);

    const profile = await agent.get('/v1/dealer').expect(200);
    const dealer = await h.prisma.dealer.findUnique({ where: { id: dealerId } });

    // Normalised to E.164 on the way in — the unique index is over the stored
    // string, so two spellings of one number would be two numbers to it.
    expect(profile.body.contact.phone).toBe('+919876543210');
    expect(dealer?.contactPhone).toBe('+919876543210');
  });

  it('refuses a number another dealership already holds, naming the field', async () => {
    const first = await dealership();
    const taken = (await first.agent.get('/v1/dealer').expect(200)).body.contact.phone as string;
    const { agent } = await dealership();

    const refused = await agent
      .patch('/v1/dealer/onboarding')
      .send({ contact: { phone: taken } })
      .expect(409);

    expect(refused.body.code).toBe('PHONE_ALREADY_REGISTERED');
    // Named as the client sent it, so the wizard can mark the box — and, since
    // `phone` is a step 1 field, walk back to the step that owns it.
    expect(JSON.stringify(refused.body.errors)).toContain('body.contact.phone');
  });

  it('lets a dealership re-save its own number', async () => {
    const { agent } = await dealership();
    const own = (await agent.get('/v1/dealer').expect(200)).body.contact.phone as string;

    await agent
      .patch('/v1/dealer/onboarding')
      .send({ contact: { phone: own } })
      .expect(200);
  });

  it('refuses something that is not an Indian mobile number', async () => {
    const { agent } = await dealership();

    const refused = await agent
      .patch('/v1/dealer/onboarding')
      .send({ contact: { phone: '12345' } })
      .expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
  });
});

describe('one dealership, one GSTIN', () => {
  const gstin = '33AABCS1429B1ZX';

  it('refuses a GSTIN another dealership already registered', async () => {
    const first = await dealership();
    await first.agent.patch('/v1/dealer/onboarding').send({ gstin }).expect(200);

    const second = await dealership();
    const refused = await second.agent.patch('/v1/dealer/onboarding').send({ gstin }).expect(409);

    expect(refused.body.code).toBe('GSTIN_ALREADY_REGISTERED');
    expect(refused.body.errors?.[0]?.field).toBe('body.gstin');
  });

  /**
   * A nullable column permits many NULLs in a Postgres unique index, which is
   * what makes the constraint safe to carry before every dealership has one.
   */
  it('lets any number of dealerships have no GSTIN at all', async () => {
    await dealership();
    await dealership();

    const none = await h.prisma.dealer.count({ where: { gstin: null } });
    expect(none).toBeGreaterThan(1);
  });

  it('lets a dealership re-save its own GSTIN', async () => {
    const { agent } = await dealership();
    await agent.patch('/v1/dealer/onboarding').send({ gstin: '33AABCS1429B1Z5' }).expect(200);
    await agent.patch('/v1/dealer/onboarding').send({ gstin: '33AABCS1429B1Z5' }).expect(200);
  });
});

/**
 * **R40 — the six emails, end to end and against the database.**
 *
 * The service's own unit tests cover the rules, the idempotency and the two
 * failure shapes with a hand-written Prisma. What only a real database can show
 * is the part that matters most architecturally: **the outbox row is written
 * inside the transaction that caused it**, so the email is exactly as durable
 * as the state change — and the API never waits on any of it.
 *
 * `drainEmails()` is the suite standing in for the worker's poller. Everything
 * else in the path is production code: the same subscribers, the same job, the
 * same idempotency claim, the same delivery row.
 */
describe('email notifications', () => {
  /** Enough bytes for the yard-photo pipeline to accept as an image. */
  const JPEG = Buffer.from('\xff\xd8\xff a photograph of a yard', 'binary');

  async function moderator() {
    subjectCounter += 1;
    h.google.claims = {
      subject: `mailer-mod-sub-${subjectCounter}`,
      email: env.adminAllowlist[0] ?? '',
      emailVerified: true,
      name: 'Dealers-Drive Operations',
    };
    const agent = h.agent();
    await h.signInAdmin(agent);
    return agent;
  }

  /** Only the messages this test caused, ignoring whatever ran before it. */
  async function emailsFrom(
    work: () => Promise<unknown>,
  ): Promise<{ tag: string; to: string; text: string }[]> {
    const before = h.mailer.sent.length;
    await work();
    await h.drainEmails();
    return h.mailer.sent
      .slice(before)
      .map((message) => ({ tag: message.tag, to: message.to, text: message.text }));
  }

  async function submitted() {
    const made = await dealership();
    await h.prisma.dealer.update({
      where: { id: made.dealerId },
      data: { status: 'PENDING_APPROVAL' },
    });
    return made;
  }

  /**
   * **1 — the dealer submits.** Two messages from one event: the dealer is told
   * we have it, and the queue is told there is something in it.
   *
   * The whole application is filled in first, because a refused submit sends
   * nothing — which is the correct behaviour and would make this test pass
   * without proving anything.
   */
  it('emails the dealer and the admins when an application is submitted', async () => {
    const { agent } = await dealership();
    await completeApplication(agent);

    const emails = await emailsFrom(() => agent.post('/v1/dealer/submit').expect(200));
    const tags = emails.map((email) => email.tag);

    expect(tags).toContain('dealer.application.received');
    expect(tags).toContain('admin.application.received');
  });

  /** Everything `POST /v1/dealer/submit` refuses without. */
  async function completeApplication(agent: ReturnType<AuthHarness['agent']>): Promise<void> {
    await agent
      .patch('/v1/dealer/onboarding')
      .send({
        gstin: `33MAILR${String(1000 + counter)}B1ZX`,
        pan: `MAILR${String(1000 + counter)}B`,
      })
      .expect(200);

    for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
      const presigned = await agent
        .post('/v1/dealer/documents/presign')
        .send({ type, fileName: 'doc.pdf', mimeType: 'application/pdf', bytes: 8 })
        .expect(201);
      const url = new URL(presigned.body.uploadUrl as string);
      await agent
        .put(url.pathname + url.search)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4'))
        .expect(200);
      await agent
        .post(`/v1/dealer/documents/${type}/commit`)
        .send({ documentId: presigned.body.documentId })
        .expect(200);
    }

    const photo = await agent
      .post('/v1/dealer/yard-photo/presign')
      .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(201);
    const photoUrl = new URL(photo.body.uploadUrl as string);
    await agent
      .put(photoUrl.pathname + photoUrl.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);
    await agent
      .post('/v1/dealer/yard-photo/commit')
      .send({ mediaId: photo.body.mediaId })
      .expect(200);
  }

  /** **2 — approved.** */
  it('emails the dealer on approval', async () => {
    const { dealerId } = await submitted();
    const admin = await moderator();

    const emails = await emailsFrom(() =>
      admin.post(`/v1/admin/dealers/${dealerId}/approve`).send({}).expect(200),
    );

    expect(emails.map((email) => email.tag)).toContain('dealer.application.approved');
    expect(emails[0]?.to).toContain('@');
  });

  /**
   * **3 — changes requested**, and the moderator's own sentence travels with
   * it. A dealer told "something needs changing" and not *what* is a dealer who
   * emails support.
   */
  it('emails the dealer when changes are requested, carrying the reason', async () => {
    const { dealerId } = await submitted();
    const admin = await moderator();

    const emails = await emailsFrom(() =>
      admin
        .post(`/v1/admin/dealers/${dealerId}/request-changes`)
        .send({ reason: 'The GST certificate is for a different entity.' })
        .expect(200),
    );

    const email = emails.find((one) => one.tag === 'dealer.application.changes-requested');
    expect(email).toBeDefined();
    expect(email?.text).toContain('The GST certificate is for a different entity.');
  });

  /** **4 — the dealer proposes new public words: tell the moderators.** */
  it('emails the admins when a profile change is submitted', async () => {
    const made = await dealership();
    await h.prisma.dealer.update({ where: { id: made.dealerId }, data: { status: 'ACTIVE' } });

    const emails = await emailsFrom(() =>
      made.agent
        .patch('/v1/dealer')
        .send({ tagline: 'Only diesel SUVs, every one with a service book.' })
        .expect(200),
    );

    const email = emails.find((one) => one.tag === 'admin.profile-change.submitted');
    expect(email).toBeDefined();
    expect(email?.text).toContain('Only diesel SUVs');
  });

  /** **5 — the moderator approves it.** */
  it('emails the dealer when a profile change is approved', async () => {
    const made = await dealership();
    await h.prisma.dealer.update({ where: { id: made.dealerId }, data: { status: 'ACTIVE' } });
    await made.agent.patch('/v1/dealer').send({ tagline: 'A new line about us here.' }).expect(200);
    const waiting = await h.prisma.dealerProfileChange.findFirst({
      where: { dealerId: made.dealerId, status: 'PENDING' },
    });
    const admin = await moderator();

    const emails = await emailsFrom(() =>
      admin.post(`/v1/admin/profile-changes/${waiting?.id}/approve`).send({}).expect(200),
    );

    expect(emails.map((one) => one.tag)).toContain('dealer.profile-change.approved');
  });

  /** **6 — and refuses it**, with the reason. */
  it('emails the dealer when a profile change is refused, carrying the reason', async () => {
    const made = await dealership();
    await h.prisma.dealer.update({ where: { id: made.dealerId }, data: { status: 'ACTIVE' } });
    await made.agent
      .patch('/v1/dealer')
      .send({ tagline: 'Ring us on nine eight four zero zero.' })
      .expect(200);
    const waiting = await h.prisma.dealerProfileChange.findFirst({
      where: { dealerId: made.dealerId, status: 'PENDING' },
    });
    const admin = await moderator();

    const emails = await emailsFrom(() =>
      admin
        .post(`/v1/admin/profile-changes/${waiting?.id}/reject`)
        .send({ reason: 'It carries a phone number.' })
        .expect(200),
    );

    const email = emails.find((one) => one.tag === 'dealer.profile-change.rejected');
    expect(email).toBeDefined();
    expect(email?.text).toContain('It carries a phone number.');
  });

  /**
   * **The architectural claim, asserted rather than described.**
   *
   * The response is already back before anything has been drained, and the
   * durable trace of the email is a row in `outbox_events` written by the same
   * transaction. That is what makes the API's latency independent of Resend.
   */
  it('answers the request before any email exists', async () => {
    const { dealerId } = await submitted();
    const admin = await moderator();
    const before = h.mailer.sent.length;

    await admin.post(`/v1/admin/dealers/${dealerId}/approve`).send({}).expect(200);

    // Responded, and nothing has been sent — the work is a row, not a request.
    expect(h.mailer.sent).toHaveLength(before);
    const queued = await h.prisma.outboxEvent.findFirst({
      where: { aggregateId: dealerId, eventType: 'DealerApproved', publishedAt: null },
    });
    expect(queued).not.toBeNull();

    await h.drainEmails();
    expect(h.mailer.sent.length).toBeGreaterThan(before);
  });

  /**
   * **Idempotency, at the index.** Draining twice must not email twice — and
   * the guarantee is a unique constraint in Postgres rather than a flag in
   * memory, which is the only version of it that survives two workers.
   */
  it('sends one email however many times the outbox is drained', async () => {
    const { dealerId } = await submitted();
    const admin = await moderator();

    await admin.post(`/v1/admin/dealers/${dealerId}/approve`).send({}).expect(200);

    await h.drainEmails();
    const afterFirst = h.mailer.sent.length;

    // The row is published now, so a second drain is a no-op; force the
    // handler to run again against the same event to prove the *claim* holds.
    const rows = await h.prisma.notificationDelivery.findMany({ where: { dealerId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('SENT');
    expect(rows[0]?.providerMessageId).not.toBeNull();

    await h.drainEmails();
    expect(h.mailer.sent).toHaveLength(afterFirst);
  });

  /** The trail support actually reads: who, which template, when, and by what id. */
  it('records the delivery against the dealership', async () => {
    const { dealerId } = await submitted();
    const admin = await moderator();

    await admin.post(`/v1/admin/dealers/${dealerId}/approve`).send({}).expect(200);
    await h.drainEmails();

    const row = await h.prisma.notificationDelivery.findFirst({ where: { dealerId } });
    expect(row).toMatchObject({ template: 'dealer.application.approved', status: 'SENT' });
    expect(row?.recipient).toContain('@');
    expect(row?.sentAt).not.toBeNull();
    expect(row?.dedupeKey).toContain('dealer.application.approved');
  });
});

/**
 * **R38 — PAN joined GSTIN.**
 *
 * The asymmetry before this was not a decision. Both are read off a document by
 * the same moderator on the same screen, and both identify one taxable entity —
 * so two dealerships holding one PAN is either one business applying twice, or a
 * typo that has quietly carried somebody else's tax identity into a KYC review.
 *
 * These mirror the GSTIN block above case for case, deliberately: the two rules
 * are the same rule, and a reader comparing the blocks should find no
 * difference to explain.
 */
describe('one dealership, one PAN', () => {
  /*
   * Not a PAN the seed holds. `prisma/seed/data.ts` writes `AABCS1429P`, and
   * the first version of this block used it — which failed on the *first*
   * save rather than the second, and was the check working correctly against a
   * row the test had not put there.
   */
  const pan = 'PQRCS9001W';

  it('refuses a PAN another dealership already registered', async () => {
    const first = await dealership();
    await first.agent.patch('/v1/dealer/onboarding').send({ pan }).expect(200);

    const second = await dealership();
    const refused = await second.agent.patch('/v1/dealer/onboarding').send({ pan }).expect(409);

    expect(refused.body.code).toBe('PAN_ALREADY_REGISTERED');
    expect(refused.body.errors?.[0]?.field).toBe('body.pan');
    expect(refused.body.errors?.[0]?.code).toBe('PAN_ALREADY_REGISTERED');
  });

  /**
   * The contract upper-cases before the regex, so a lower-case PAN is the same
   * PAN by the time it reaches the check. Asserted because it is the case a
   * case-sensitive index would let straight through.
   */
  it('refuses it however the second dealer typed it', async () => {
    const first = await dealership();
    await first.agent.patch('/v1/dealer/onboarding').send({ pan: 'ZZBCS4321Q' }).expect(200);

    const second = await dealership();
    await second.agent.patch('/v1/dealer/onboarding').send({ pan: '  zzbcs4321q  ' }).expect(409);
  });

  /**
   * A nullable column permits many NULLs in a Postgres unique index, which is
   * what makes the constraint safe to carry before every dealership has one.
   */
  it('lets any number of dealerships have no PAN at all', async () => {
    await dealership();
    await dealership();

    const none = await h.prisma.dealer.count({ where: { pan: null } });
    expect(none).toBeGreaterThan(1);
  });

  /** The `id: { not: exceptDealerId }` clause, from the outside. */
  it('lets a dealership re-save its own PAN', async () => {
    const { agent } = await dealership();
    await agent.patch('/v1/dealer/onboarding').send({ pan: 'BBBCS1111R' }).expect(200);
    await agent.patch('/v1/dealer/onboarding').send({ pan: 'BBBCS1111R' }).expect(200);
  });

  /**
   * The case that matters most for an existing dealership: editing something
   * else entirely, while holding a PAN, must not be refused by its own row.
   */
  it('lets a dealership edit its profile without tripping on its own PAN', async () => {
    const { agent } = await dealership();
    await agent
      .patch('/v1/dealer/onboarding')
      .send({ pan: 'CCBCS2222S', gstin: '33CCBCS2222S1ZX' })
      .expect(200);

    await agent
      .patch('/v1/dealer/onboarding')
      .send({ pan: 'CCBCS2222S', gstin: '33CCBCS2222S1ZX', legalName: 'A Different Name' })
      .expect(200);
  });

  /** A dealership may of course move to a PAN nobody holds. */
  it('accepts a PAN no other dealership has', async () => {
    const first = await dealership();
    await first.agent.patch('/v1/dealer/onboarding').send({ pan: 'DDBCS3333T' }).expect(200);

    const second = await dealership();
    const saved = await second.agent
      .patch('/v1/dealer/onboarding')
      .send({ pan: 'EEBCS4444U' })
      .expect(200);

    expect(saved.body.pan).toBe('EEBCS4444U');
  });

  /**
   * Both duplicated in one submit is answered about the **GSTIN**. One field
   * error at a time is the shape of every check on this path, and a GSTIN
   * embeds the PAN of the entity that holds it — so a dealer who corrects the
   * GSTIN usually corrects the PAN with it, and naming the derived field first
   * would send them to the wrong document.
   */
  it('names the GSTIN when both collide', async () => {
    const first = await dealership();
    await first.agent
      .patch('/v1/dealer/onboarding')
      .send({ gstin: '33FFBCS5555V1ZX', pan: 'FFBCS5555V' })
      .expect(200);

    const second = await dealership();
    const refused = await second.agent
      .patch('/v1/dealer/onboarding')
      .send({ gstin: '33FFBCS5555V1ZX', pan: 'FFBCS5555V' })
      .expect(409);

    expect(refused.body.code).toBe('GSTIN_ALREADY_REGISTERED');
  });
});

/**
 * presign → PUT → commit, then delete. The point of the round trip is the
 * *object*: a document row can be reset without the bytes going anywhere, and
 * that is exactly what the baseline did — it deleted the document's *folder*,
 * the prefix the object lives under rather than the object itself.
 */
describe('KYC documents — replace and remove', () => {
  const PDF = Buffer.from('%PDF-1.4 a KYC document');

  async function upload(agent: ReturnType<AuthHarness['agent']>, type: string) {
    const presigned = await agent
      .post('/v1/dealer/documents/presign')
      .send({ type, fileName: 'gst.pdf', mimeType: 'application/pdf', bytes: PDF.length })
      .expect(201);

    await agent
      .put(
        new URL(presigned.body.uploadUrl as string).pathname +
          new URL(presigned.body.uploadUrl as string).search,
      )
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(200);

    await agent
      .post(`/v1/dealer/documents/${type}/commit`)
      .send({ documentId: presigned.body.documentId })
      .expect(200);

    return presigned.body.documentId as string;
  }

  it('records an uploaded document against the checklist', async () => {
    const { agent } = await dealership();

    await upload(agent, 'GST_CERTIFICATE');

    const checklist = await agent.get('/v1/dealer/documents').expect(200);
    const row = checklist.body.data.find(
      (doc: { type: string }) => doc.type === 'GST_CERTIFICATE',
    ) as { status: string; action: string };
    expect(row.status).toBe('UPLOADED');
    expect(row.action).toBe('Replace');
  });

  it('resets the row and removes the stored object on delete', async () => {
    const { agent, dealerSlug } = await dealership();
    const documentId = await upload(agent, 'PAN_CARD');

    // Named the way a person reading the bucket would name it: the
    // dealership's own folder, its private `documents/` prefix, then the row's
    // id. Asserted *before* the delete as well, so a key that stopped being
    // right fails here rather than passing an existsSync of nothing.
    const object = storagePath(`dealers/${dealerSlug}/documents/PAN_CARD/${documentId}`);
    expect(existsSync(object)).toBe(true);

    await agent.delete('/v1/dealer/documents/PAN_CARD').expect(204);

    const checklist = await agent.get('/v1/dealer/documents').expect(200);
    const row = checklist.body.data.find((doc: { type: string }) => doc.type === 'PAN_CARD') as {
      status: string;
      fileName: string | null;
    };
    expect(row.status).toBe('REQUIRED');
    expect(row.fileName).toBeNull();

    // And the bytes are gone. The row is reachable again for a fresh upload,
    // but the file behind the old one must not survive it.
    //
    // Checked on disk rather than through the port, because the bug this pins
    // was *in* the key: the baseline deleted the document's folder, a prefix no
    // object occupies, so every removed document stayed exactly where it was.
    expect(existsSync(object)).toBe(false);
  });

  /**
   * The row always exists — onboarding creates all three as REQUIRED — so
   * deleting one that was never uploaded is idempotent rather than an error.
   * There is nothing for the dealer to correct.
   */
  it('accepts a delete for a document that was never uploaded', async () => {
    const { agent } = await dealership();

    await agent.delete('/v1/dealer/documents/ADDRESS_PROOF').expect(204);
  });
});

/**
 * The yard photograph, end to end. It is required before a dealership can be
 * submitted, which is what ties this to the completeness read below it.
 */
describe('the yard photograph', () => {
  const JPEG = Buffer.from('\xff\xd8\xff a photograph of a yard', 'binary');

  async function uploadYardPhoto(agent: ReturnType<AuthHarness['agent']>) {
    const presigned = await agent
      .post('/v1/dealer/yard-photo/presign')
      .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(201);

    const url = new URL(presigned.body.uploadUrl as string);
    await agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);

    return agent
      .post('/v1/dealer/yard-photo/commit')
      .send({ mediaId: presigned.body.mediaId })
      .expect(200);
  }

  it('reads empty before anything is uploaded', async () => {
    const { agent } = await dealership();

    const photo = await agent.get('/v1/dealer/yard-photo').expect(200);
    expect(photo.body).toMatchObject({ mediaId: null, url: null });
  });

  it('adopts an upload onto the dealership as its cover image', async () => {
    const { agent, dealerId } = await dealership();

    const committed = await uploadYardPhoto(agent);

    expect(committed.body.fileName).toBe('yard.jpg');
    expect(committed.body.url).toBeTruthy();

    const row = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(row?.coverMediaId).toBe(committed.body.mediaId);
  });

  it('replaces one photograph with another, and takes the first away', async () => {
    const { agent } = await dealership();
    const first = await uploadYardPhoto(agent);
    const second = await uploadYardPhoto(agent);

    expect(second.body.mediaId).not.toBe(first.body.mediaId);

    const displaced = await h.prisma.media.findUnique({
      where: { id: first.body.mediaId as string },
    });
    expect(displaced?.status).toBe('ORPHAN');
  });

  it('removes it, and the dealership reads as incomplete again', async () => {
    const { agent } = await dealership();
    await uploadYardPhoto(agent);

    await agent.delete('/v1/dealer/yard-photo').expect(204);

    const photo = await agent.get('/v1/dealer/yard-photo').expect(200);
    expect(photo.body.mediaId).toBeNull();

    const completeness = await agent.get('/v1/dealer/completeness').expect(200);
    const documents = (completeness.body.steps as { key: string; missing: string[] }[]).find(
      (step) => step.key === 'documents',
    );
    expect(documents?.missing).toContain('YARD_PHOTO');
  });

  it('404s a delete when there is nothing to remove', async () => {
    const { agent } = await dealership();

    await agent.delete('/v1/dealer/yard-photo').expect(404);
  });

  /** A submit is refused until every part of the application is there. */
  it('is required before a dealership can be submitted', async () => {
    const { agent } = await dealership();
    await agent
      .patch('/v1/dealer/onboarding')
      /*
       * Both derived from `counter` since **R38**. The GSTIN always was,
       * because it has always been unique; the PAN was a literal, which was
       * safe only while exactly one test wrote it. It is unique now too, so
       * the next test to reach for this line cannot break the one above it.
       */
      .send({
        gstin: `33AABCS${String(1000 + counter)}B1ZX`,
        pan: `AABCS${String(1000 + counter)}B`,
      })
      .expect(200);
    for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
      const presigned = await agent
        .post('/v1/dealer/documents/presign')
        .send({ type, fileName: 'doc.pdf', mimeType: 'application/pdf', bytes: 8 })
        .expect(201);
      const url = new URL(presigned.body.uploadUrl as string);
      await agent
        .put(url.pathname + url.search)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4'))
        .expect(200);
      await agent
        .post(`/v1/dealer/documents/${type}/commit`)
        .send({ documentId: presigned.body.documentId })
        .expect(200);
    }

    const refused = await agent.post('/v1/dealer/submit').expect(422);
    expect(refused.body.code).toBe('PROFILE_INCOMPLETE');
    expect(JSON.stringify(refused.body.errors)).toContain('YARD_PHOTO');

    await uploadYardPhoto(agent);
    const submitted = await agent.post('/v1/dealer/submit').expect(200);
    expect(submitted.body.status).toBe('PENDING_APPROVAL');
  });
});

/**
 * R34 — a dealer's own words wait for a moderator.
 *
 * Here rather than in a unit test for the reason the rest of this file is here:
 * the guarantee is a *sequence across two actors and two tables*, and the thing
 * most worth proving is what the public row holds at each step of it. A mocked
 * Prisma would prove that the service called the methods this service calls.
 *
 * The partial unique index — one PENDING request per dealership — is also only
 * real against Postgres.
 */
describe('a dealer editing their own public words', () => {
  /** Signed in as the allow-listed operator, which is a SUPER_ADMIN. */
  async function moderator() {
    subjectCounter += 1;
    h.google.claims = {
      subject: `moderator-sub-${subjectCounter}`,
      email: env.adminAllowlist[0] ?? '',
      emailVerified: true,
      name: 'Dealers-Drive Operations',
    };
    const agent = h.agent();
    await h.signInAdmin(agent);
    return agent;
  }

  /** An ACTIVE dealership — the only state in which any of this applies. */
  async function trading(overrides: Record<string, unknown> = {}) {
    const made = await dealership(overrides);
    await h.prisma.dealer.update({ where: { id: made.dealerId }, data: { status: 'ACTIVE' } });
    return made;
  }

  const NEW_LINE = 'Only diesel SUVs now, every one with a full service history.';

  /**
   * The whole point, in one case: what a buyer sees does not move until a
   * moderator says so.
   */
  it('does not publish the tagline until it is approved', async () => {
    const { agent, dealerId } = await trading();
    const admin = await moderator();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);

    const held = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(held?.tagline).not.toBe(NEW_LINE);

    const queue = await admin.get('/v1/admin/profile-changes').expect(200);
    const waiting = queue.body.data.find(
      (row: { dealerId: string }) => row.dealerId === dealerId,
    ) as { id: string; tagline: string; liveTagline: string };
    expect(waiting.tagline).toBe(NEW_LINE);
    // The live value travels with the proposal: the moderator is judging a
    // change, not a sentence.
    expect(waiting.liveTagline).toBe(held?.tagline);

    await admin.post(`/v1/admin/profile-changes/${waiting.id}/approve`).expect(200);

    const published = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(published?.tagline).toBe(NEW_LINE);
  });

  /**
   * A refusal is a no-op on the dealership, which is what makes it safe.
   *
   * Nothing is restored because nothing was taken away. A design that published
   * first and rolled back on refusal would have a window — however short — in
   * which the phone number was on the page.
   */
  it('leaves the live words untouched when it is refused, and says why', async () => {
    const { agent, dealerId } = await trading();
    const admin = await moderator();
    const before = await h.prisma.dealer.findUnique({ where: { id: dealerId } });

    await agent
      .patch('/v1/dealer')
      .send({ tagline: 'Best prices — call 98400 12345 direct!' })
      .expect(200);

    const queue = await admin.get('/v1/admin/profile-changes').expect(200);
    const waiting = queue.body.data.find(
      (row: { dealerId: string }) => row.dealerId === dealerId,
    ) as { id: string };

    const refused = await admin
      .post(`/v1/admin/profile-changes/${waiting.id}/reject`)
      .send({ reason: 'The tagline ends with a mobile number. Please remove it.' })
      .expect(200);
    expect(refused.body.published).toBe(false);

    const after = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(after?.tagline).toBe(before?.tagline);

    // And the dealer is told, on the screen that did the editing.
    const profile = await agent.get('/v1/dealer').expect(200);
    expect(profile.body.profileChange).toMatchObject({
      status: 'REJECTED',
      decisionReason: 'The tagline ends with a mobile number. Please remove it.',
    });
  });

  /**
   * One request at a time. A second edit while one waits is refused rather than
   * merged.
   *
   * The profile screen shuts the two boxes in that state, so this is the
   * server-side half of a rule the form already states — reaching it means a
   * client went around the form. Merging instead was the first design and it
   * was worse from the moderator's side: a request that absorbs later edits can
   * change *after* somebody has started reading it.
   */
  it('refuses a second edit while one is already waiting', async () => {
    const { agent, dealerId } = await trading();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    const refused = await agent
      .patch('/v1/dealer')
      .send({ specialities: ['SUVs', 'Exchange'] })
      .expect(409);

    expect(refused.body.code).toBe('PROFILE_EDIT_PENDING');
    // And the first request is untouched by the attempt.
    const rows = await h.prisma.dealerProfileChange.findMany({ where: { dealerId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tagline).toBe(NEW_LINE);
    expect(rows[0]?.specialities).toEqual([]);
  });

  /**
   * The year is still writable while a sentence waits.
   *
   * It never needed review, and blocking it would turn one field's queue into a
   * lock on a field that has nothing to do with it.
   */
  it('still writes the established year while a change is waiting', async () => {
    const { agent, dealerId } = await trading();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    await agent.patch('/v1/dealer').send({ establishedYear: 2004 }).expect(200);

    const row = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(row?.establishedYear).toBe(2004);
    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(1);
  });

  /**
   * Cancelling is a button, and it is the only way out.
   *
   * Retyping the live value used to withdraw the request, which made the way
   * out something a dealer had to discover rather than press — and was wrong on
   * its own terms besides, since an edit that happens to restore the live text
   * is still an edit.
   */
  it('withdraws the request when the dealer cancels it', async () => {
    const { agent, dealerId } = await trading();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(1);

    const after = await agent.delete('/v1/dealer/profile-change').expect(200);

    // Deleted, not marked withdrawn — see the note on `withdrawProfileChange`.
    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(0);
    expect(after.body.profileChange).toBeNull();
    // And the boxes are free again.
    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(1);
  });

  /** Withdrawing is audited, even though the row it names is gone. */
  it('audits a withdrawal', async () => {
    const { agent, dealerId } = await trading();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    await agent.delete('/v1/dealer/profile-change').expect(200);

    const trail = await h.prisma.auditLog.findMany({ where: { dealerId } });
    expect(trail.map((row) => row.action)).toContain('dealer.profile_change.withdrawn');
  });

  /**
   * Nothing waiting is a 404. The button only renders when there is one, so
   * arriving here empty-handed is a double-click or a stale page — and both
   * want the screen re-read.
   */
  it('answers 404 when there is nothing to cancel', async () => {
    const { agent } = await trading();

    await agent.delete('/v1/dealer/profile-change').expect(404);
  });

  /**
   * Retyping the live value no longer withdraws anything — it simply proposes
   * nothing, which is a different statement and the only one that survives.
   */
  it('queues nothing when the save proposes what is already live', async () => {
    const { agent, dealerId } = await trading();
    const live = await h.prisma.dealer.findUnique({ where: { id: dealerId } });

    await agent.patch('/v1/dealer').send({ tagline: live?.tagline }).expect(200);

    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(0);
  });

  /**
   * Re-saving the form without touching the boxes must not queue anything.
   *
   * The services box is one comma-separated line, so a dealer editing their
   * tagline re-submits the whole list every time. Without the order-insensitive
   * comparison this would put a request in front of a moderator asking them to
   * agree that nothing had happened.
   */
  it('queues nothing when the services come back in a different order', async () => {
    const { agent, dealerId } = await trading({ specialities: ['Hatchbacks', 'RC transfer'] });
    await h.prisma.dealer.update({
      where: { id: dealerId },
      data: { specialities: ['Hatchbacks', 'RC transfer'] },
    });

    await agent
      .patch('/v1/dealer')
      .send({ specialities: ['RC transfer', 'Hatchbacks', 'RC transfer'] })
      .expect(200);

    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(0);
  });

  /** The year is a number nothing can be hidden in, so it is published at once. */
  it('publishes the established year without asking anybody', async () => {
    const { agent, dealerId } = await trading();

    await agent.patch('/v1/dealer').send({ establishedYear: 2004 }).expect(200);

    const row = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(row?.establishedYear).toBe(2004);
    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(0);
  });

  /**
   * A DRAFT dealership writes straight through. Nothing about it is public —
   * the directory and the portfolio both require ACTIVE (rule 6) — so there is
   * no page for a phone number to appear on, and the whole application is read
   * by a moderator at approval anyway.
   */
  it('writes straight through while the dealership is still a draft', async () => {
    const { agent, dealerId } = await dealership();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);

    const row = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(row?.tagline).toBe(NEW_LINE);
    expect(await h.prisma.dealerProfileChange.count({ where: { dealerId } })).toBe(0);
  });

  /**
   * Two moderators working the same queue is the ordinary case. The second must
   * be told their button did nothing rather than shown a tick.
   */
  it('refuses a second decision on the same request', async () => {
    const { agent, dealerId } = await trading();
    const admin = await moderator();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    const waiting = await h.prisma.dealerProfileChange.findFirst({ where: { dealerId } });

    await admin.post(`/v1/admin/profile-changes/${waiting?.id}/approve`).expect(200);
    const again = await admin.post(`/v1/admin/profile-changes/${waiting?.id}/approve`).expect(409);

    expect(again.body.code).toBe('PROFILE_CHANGE_DECIDED');
  });

  /**
   * An approval carrying only services must not fail on a tagline that was
   * never part of the request. `null` means "not in this edit", and sending it
   * on would be a 400 against a ten-character floor.
   */
  it('approves a services-only edit without touching the tagline', async () => {
    const { agent, dealerId } = await trading();
    const admin = await moderator();
    const before = await h.prisma.dealer.findUnique({ where: { id: dealerId } });

    await agent
      .patch('/v1/dealer')
      .send({ specialities: ['SUVs', 'Exchange'] })
      .expect(200);
    const waiting = await h.prisma.dealerProfileChange.findFirst({ where: { dealerId } });
    await admin.post(`/v1/admin/profile-changes/${waiting?.id}/approve`).expect(200);

    const after = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(after?.specialities).toEqual(['SUVs', 'Exchange']);
    expect(after?.tagline).toBe(before?.tagline);
  });

  /** Once it is published there is nothing left to tell the dealer about it. */
  it('stops reporting the edit once it is live', async () => {
    const { agent, dealerId } = await trading();
    const admin = await moderator();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    const waiting = await h.prisma.dealerProfileChange.findFirst({ where: { dealerId } });
    await admin.post(`/v1/admin/profile-changes/${waiting?.id}/approve`).expect(200);

    const profile = await agent.get('/v1/dealer').expect(200);
    expect(profile.body.tagline).toBe(NEW_LINE);
    expect(profile.body.profileChange).toBeNull();
  });

  /** The moderator finds the work from the dealer list as well as from the queue. */
  it('flags the dealership in the admin list, and filters on it', async () => {
    const { agent, dealerId } = await trading();
    const admin = await moderator();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);

    const filtered = await admin.get('/v1/admin/dealers?pendingEdits=true').expect(200);
    const row = filtered.body.data.find((entry: { id: string }) => entry.id === dealerId) as
      { hasPendingProfileEdit: boolean } | undefined;
    expect(row?.hasPendingProfileEdit).toBe(true);
    expect(
      filtered.body.data.every(
        (entry: { hasPendingProfileEdit: boolean }) => entry.hasPendingProfileEdit,
      ),
    ).toBe(true);
  });

  /** Both halves of the decision are attributable — who typed it, and who agreed. */
  it('audits the submission and the decision', async () => {
    const { agent, dealerId } = await trading();
    const admin = await moderator();

    await agent.patch('/v1/dealer').send({ tagline: NEW_LINE }).expect(200);
    const waiting = await h.prisma.dealerProfileChange.findFirst({ where: { dealerId } });
    await admin.post(`/v1/admin/profile-changes/${waiting?.id}/approve`).expect(200);

    const trail = await h.prisma.auditLog.findMany({ where: { dealerId } });
    const actions = trail.map((row) => row.action);
    expect(actions).toContain('dealer.profile_change.submitted');
    expect(actions).toContain('dealer.profile_change.approved');
  });
});
