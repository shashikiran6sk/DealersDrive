import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSubmittableVehicle, ensureCredits } from './fixtures.js';
import { createHarness, DEALER_A, DEALER_B, type Harness } from './harness.js';

/**
 * CLAUDE.md rule 6 — a car is publicly visible only when
 * `listing.status === 'APPROVED' AND dealer.status === 'ACTIVE'` — and rule 7 —
 * a dealer's phone number never appears in an ordinary public response.
 *
 * Rule 7 is tested by scanning the *whole* serialised response for the number
 * rather than by checking named fields. A leak that mattered would arrive in a
 * field nobody thought to assert on.
 */
describe('public visibility and contact privacy', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
    await ensureCredits(h, 4);
  });

  afterAll(async () => {
    await h.close();
  });

  /**
   * Every phone number in the database, digits only — dealer contact numbers,
   * landlines, and the owners' own login numbers. None of them belongs in a
   * public response, and a test that only knew about `contactPhone` would miss
   * the leak that actually happened.
   */
  async function allPhones(): Promise<string[]> {
    const [dealers, users] = await Promise.all([
      h.prisma.dealer.findMany({ select: { contactPhone: true, landline: true } }),
      h.prisma.user.findMany({ select: { phone: true } }),
    ]);

    return [
      ...dealers.flatMap((dealer) => [dealer.contactPhone, dealer.landline]),
      ...users.map((user) => user.phone),
    ]
      .filter((phone): phone is string => Boolean(phone))
      .map((phone) => phone.replace(/\D/g, ''))
      .filter((digits) => digits.length >= 10)
      .map((digits) => digits.slice(-10));
  }

  it('hides a listing that is still in review', async () => {
    const vehicleId = await createSubmittableVehicle(h, { pricePaise: 3_33_333_00 });
    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);
    await h.drain();

    const slug = (await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200)).body
      .slug as string;

    await h.agent().get(`/v1/vehicles/${slug}`).expect(404);
    await h.agent().post(`/v1/vehicles/${vehicleId}/reveal-contact`).send({}).expect(404);

    const search = await h.agent().get('/v1/vehicles?limit=48').expect(200);
    const ids = search.body.data.map((card: { id: string }) => card.id);
    expect(ids).not.toContain(vehicleId);

    // And a search for its exact price finds nothing.
    const priced = await h.agent().get('/v1/vehicles?priceMin=333333&priceMax=333333').expect(200);
    expect(priced.body.page.total).toBe(0);

    await h
      .agent()
      .post(`/v1/admin/listings/${submit.body.listingId}/reject`)
      .send({ reason: 'Cleaning up after the visibility assertions.' })
      .expect(200);
  });

  it('publishes on approval and still withholds the phone number', async () => {
    const vehicleId = await createSubmittableVehicle(h);
    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);

    await h
      .agent()
      .post(`/v1/admin/listings/${submit.body.listingId}/approve`)
      .send({})
      .expect(200);
    await h.drain();

    const slug = (await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200)).body
      .slug as string;

    const detail = await h.agent().get(`/v1/vehicles/${slug}`).expect(200);
    expect(detail.body.id).toBe(vehicleId);

    const phones = await allPhones();
    const responses = [
      JSON.stringify(detail.body),
      JSON.stringify((await h.agent().get('/v1/vehicles?limit=48').expect(200)).body),
      JSON.stringify((await h.agent().get('/v1/home').expect(200)).body),
      JSON.stringify((await h.agent().get('/v1/dealers?limit=24').expect(200)).body),
      JSON.stringify((await h.agent().get(`/v1/dealers/${DEALER_A}`).expect(200)).body),
      JSON.stringify((await h.agent().get(`/v1/vehicles/${vehicleId}/similar`).expect(200)).body),
    ];

    for (const body of responses) {
      for (const phone of phones) {
        expect(body).not.toContain(phone);
      }
    }
  });

  it('returns the number only from reveal-contact, and only for a live car', async () => {
    const live = await h.agent().get(`/v1/vehicles?dealer=${DEALER_A}&limit=1`).expect(200);
    const card = live.body.data[0];
    expect(card).toBeDefined();

    const dealer = await h.prisma.dealer.findUniqueOrThrow({
      where: { slug: DEALER_A },
      select: { contactPhone: true, brandName: true },
    });

    const reveal = await h
      .agent()
      .post(`/v1/vehicles/${card.id}/reveal-contact`)
      .send({ name: 'Test Buyer' })
      .expect(200);

    expect(reveal.body.phone).toBe(dealer.contactPhone);
    expect(reveal.body.dealer.brandName).toBe(dealer.brandName);
    expect(reveal.body.callHref).toContain('tel:');
    // Never cached: the response is the private half of the contract.
    expect(reveal.headers['cache-control']).toBe('no-store');

    // The reveal is a lead, so the dealer sees it in their own inbox.
    await h.drain();
    const inbox = await h.agent().get('/v1/dealer/enquiries?limit=20').expect(200);
    const fromReveal = inbox.body.data.filter(
      (row: { source: string }) => row.source === 'CALL_BUTTON',
    );
    expect(fromReveal.length).toBeGreaterThan(0);

    // An unknown vehicle is a 404, not a 400 that confirms the id's shape.
    await h
      .agent()
      .post('/v1/vehicles/2f9a6f1e-0000-4000-8000-000000000000/reveal-contact')
      .send({})
      .expect(404);
  });

  it("removes a suspended dealer's cars from the catalogue and restores them", async () => {
    const dealerB = await h.prisma.dealer.findUniqueOrThrow({
      where: { slug: DEALER_B },
      select: { id: true },
    });

    const before = await h.agent().get(`/v1/vehicles?dealer=${DEALER_B}&limit=48`).expect(200);
    const liveCount = before.body.page.total as number;
    expect(liveCount).toBeGreaterThan(0);

    const total = (await h.agent().get('/v1/vehicles?limit=1').expect(200)).body.page
      .total as number;

    await h
      .agent()
      .post(`/v1/admin/dealers/${dealerB.id}/suspend`)
      .send({ reason: 'Suspended by the visibility test.' })
      .expect(200);
    await h.drain();

    const suspended = await h.agent().get(`/v1/vehicles?dealer=${DEALER_B}&limit=48`).expect(200);
    expect(suspended.body.page.total).toBe(0);

    // Counts are derived from the catalogue, never stored: the sitewide total
    // has to have dropped by exactly this dealer's contribution.
    const totalWhileSuspended = (await h.agent().get('/v1/vehicles?limit=1').expect(200)).body.page
      .total as number;
    expect(totalWhileSuspended).toBe(total - liveCount);

    const profile = await h.agent().get(`/v1/dealers/${DEALER_B}`);
    if (profile.status === 200) expect(profile.body.carCount).toBe(0);

    await h
      .agent()
      .post(`/v1/admin/dealers/${dealerB.id}/reinstate`)
      .send({ note: 'Restoring after the visibility test.' })
      .expect(200);
    await h.drain();

    const restored = await h.agent().get(`/v1/vehicles?dealer=${DEALER_B}&limit=48`).expect(200);
    expect(restored.body.page.total).toBe(liveCount);
  });

  it('derives every count from the catalogue rather than storing it', async () => {
    const indexed = await h.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM listing_search`;
    const rows = Number(indexed[0]?.count ?? 0);

    const search = await h.agent().get('/v1/vehicles?limit=1').expect(200);
    expect(search.body.page.total).toBe(rows);

    // The home page is city-scoped, so its count must agree with the same
    // search restricted to that city — not with the sitewide number.
    const home = await h.agent().get('/v1/home').expect(200);
    const inCity = await h
      .agent()
      .get(`/v1/vehicles?city=${home.body.city.slug}&limit=1`)
      .expect(200);
    expect(home.body.activeCount).toBe(inCity.body.page.total);
    expect(home.body.activeCountLabel).toContain(String(home.body.activeCount));

    const facets = await h.agent().get('/v1/vehicles/facets').expect(200);
    const fuelTotal = facets.body.fuel.reduce(
      (sum: number, option: { count: number }) => sum + option.count,
      0,
    );
    expect(fuelTotal).toBe(rows);
  });

  it('404s an unknown slug rather than leaking whether it ever existed', async () => {
    const missing = await h.agent().get('/v1/vehicles/no-such-car-2019-abc').expect(404);
    expect(missing.headers['content-type']).toContain('application/problem+json');
    expect(JSON.stringify(missing.body)).not.toMatch(/prisma|select|stack/i);
  });
});
