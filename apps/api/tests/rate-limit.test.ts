import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The limits are the one thing the rest of the suite turns off, so they get
 * their own file that turns them back on.
 *
 * `env` is read once at import time, so the flag has to be set *before* the
 * container's module graph loads — hence the dynamic imports below. That is also
 * why this lives in its own file: vitest gives each file a fresh module
 * registry, so flipping the flag here cannot leak into the others.
 */
process.env.RATE_LIMIT_ENABLED = 'true';

const { createHarness, DEALER_A } = await import('./harness.js');
const { resetRateLimits } = await import('../src/middleware/rate-limit.js');
type Harness = Awaited<ReturnType<typeof createHarness>>;

describe('rate limits', () => {
  let h: Harness;
  let liveVehicleId: string;

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
    resetRateLimits();

    const search = await h.agent().get(`/v1/vehicles?dealer=${DEALER_A}&limit=1`).expect(200);
    liveVehicleId = search.body.data[0].id;
  });

  afterAll(async () => {
    resetRateLimits();
    await h.close();
  });

  it('caps enquiries per network and says when to come back', async () => {
    // A15: five an hour from one network. Distinct numbers, so this is the limit
    // biting rather than the duplicate-lead check.
    const statuses: number[] = [];
    let limited: Awaited<ReturnType<ReturnType<Harness['agent']>['post']>> | null = null;

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await h
        .agent()
        .post('/v1/enquiries')
        .send({
          vehicleId: liveVehicleId,
          name: `Buyer ${attempt}`,
          phone: `98700000${String(attempt).padStart(2, '0')}`,
          message: 'Please share the service history and the insurance expiry date.',
          source: 'LISTING_PAGE',
        });

      statuses.push(response.status);
      if (response.status === 429) limited ??= response;
    }

    expect(statuses.filter((status) => status < 400)).toHaveLength(5);
    expect(limited).not.toBeNull();
    expect(limited?.body.code).toBe('RATE_LIMITED');
    expect(limited?.headers['content-type']).toContain('application/problem+json');
    // Not a bare 429: the caller is told how long to wait.
    expect(Number(limited?.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited?.body.detail).toMatch(/network/i);
  });

  it('caps phone reveals per network, because each one costs money', async () => {
    resetRateLimits();

    const hourlyCap = await h.prisma.platformConfig
      .findUniqueOrThrow({ where: { key: 'reveal.hourlyCapPerIp' } })
      .then((row) => Number(row.value));

    let limited = false;
    for (let attempt = 0; attempt <= hourlyCap; attempt += 1) {
      const response = await h
        .agent()
        .post(`/v1/vehicles/${liveVehicleId}/reveal-contact`)
        .send({ name: 'Repeat Caller' });
      if (response.status === 429) {
        limited = true;
        expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
        break;
      }
      expect(response.status).toBe(200);
    }

    expect(limited).toBe(true);
  });

  it('caps credit orders per dealer rather than per network', async () => {
    resetRateLimits();

    const packs = await h.agent().get('/v1/dealer/billing/packs').expect(200);
    const packId = packs.body.data[0].id as string;

    // C19 allows ten an hour. The key is the dealer, not the IP: two dealers
    // sharing a showroom's connection must not throttle each other.
    let limited = false;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await h.agent().post('/v1/dealer/billing/orders').send({ packId });
      if (response.status === 429) {
        limited = true;
        break;
      }
      expect(response.status).toBe(201);
    }
    expect(limited).toBe(true);

    // The other dealer, on the same address, is unaffected.
    h.actAs('velavan-cars');
    await h.agent().post('/v1/dealer/billing/orders').send({ packId }).expect(201);
    h.actAs(DEALER_A);
  });

  it('leaves public reads generously limited', async () => {
    resetRateLimits();

    // A2 allows 120 a minute; a buyer paging through results must never meet it.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await h.agent().get('/v1/vehicles?limit=1').expect(200);
    }
  });
});
