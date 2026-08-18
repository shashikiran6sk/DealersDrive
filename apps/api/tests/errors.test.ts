import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSubmittableVehicle, ensureCredits, ensureMember } from './fixtures.js';
import { createHarness, DEALER_A, type Harness } from './harness.js';

/**
 * CLAUDE.md §26 — validation errors, authorization errors and documented API
 * errors — against §23's single error contract: RFC 9457 Problem Details,
 * `application/problem+json`, a machine-readable `code`, and never a stack trace
 * or an internal detail.
 */
function assertProblem(response: Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain('application/problem+json');

  const body = response.body as Record<string, unknown>;
  expect(body.status).toBe(status);
  expect(body.code).toBe(code);
  expect(body.title).toBeTruthy();
  expect(body.type).toMatch(/^https?:\/\//);
  // The trace id is what turns a support ticket into a log query.
  expect(body.traceId).toBeTruthy();

  // Nothing about the inside of the server: no stack, no SQL, no file paths.
  expect(body).not.toHaveProperty('stack');
  const serialised = JSON.stringify(body);
  expect(serialised).not.toMatch(/at .+\(.+:\d+:\d+\)/);
  expect(serialised).not.toMatch(/node_modules|prisma\.|SELECT |INSERT INTO/i);
}

describe('the error contract', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
    await ensureCredits(h, 2);
  });

  afterAll(async () => {
    await h.close();
  });

  describe('validation (rule 2)', () => {
    it('rejects an unknown query parameter rather than ignoring it', async () => {
      const response = await h.agent().get('/v1/vehicles?fuel=petrol&colour=red');
      assertProblem(response, 400, 'VALIDATION_FAILED');

      // Named, so the frontend bug is findable rather than invisible.
      const fields = (response.body.errors as { field: string }[]).map((e) => e.field);
      expect(fields).toContain('query.colour');
    });

    it('rejects an unknown body field rather than dropping it', async () => {
      const response = await h
        .agent()
        .post('/v1/dealer/vehicles')
        .send({
          makeId: '2f9a6f1e-0000-4000-8000-000000000000',
          modelId: '2f9a6f1e-0000-4000-8000-000000000001',
          year: 2020,
          fuel: 'PETROL',
          transmission: 'MANUAL',
          bodyType: 'HATCHBACK',
          isFeatured: true,
        });

      assertProblem(response, 400, 'VALIDATION_FAILED');
      expect((response.body.errors as { field: string }[]).map((e) => e.field)).toContain(
        'body.isFeatured',
      );
    });

    it('reports every invalid field at once, not just the first', async () => {
      const response = await h
        .agent()
        .post('/v1/dealer/vehicles')
        .send({ makeId: 'not-a-uuid', modelId: 'also-not', year: 1200, fuel: 'COAL' });

      assertProblem(response, 400, 'VALIDATION_FAILED');
      const fields = (response.body.errors as { field: string }[]).map((e) => e.field);
      expect(new Set(fields).size).toBeGreaterThan(2);
      for (const error of response.body.errors as { code: string; message: string }[]) {
        expect(error.code).toMatch(/^[A-Z_]+$/);
        expect(error.message).toBeTruthy();
      }
    });

    it('rejects a fractional price (rule 3: money is integer paise)', async () => {
      const vehicleId = await createSubmittableVehicle(h);
      const response = await h
        .agent()
        .patch(`/v1/dealer/vehicles/${vehicleId}`)
        .send({ pricePaise: 450000.5 });

      assertProblem(response, 400, 'VALIDATION_FAILED');
      expect((response.body.errors as { field: string }[])[0]?.field).toBe('body.pricePaise');
    });

    it('rejects a malformed body before any handler runs', async () => {
      const response = await h
        .agent()
        .patch('/v1/dealer')
        .set('content-type', 'application/json')
        .send('{"brandName":');

      assertProblem(response, 400, 'MALFORMED_BODY');
    });

    it('rejects an id that is not a uuid without touching the database', async () => {
      const response = await h.agent().get('/v1/dealer/vehicles/12345');
      assertProblem(response, 400, 'VALIDATION_FAILED');
    });

    it('rejects an enquiry that names both a vehicle and a dealer', async () => {
      const response = await h.agent().post('/v1/enquiries').send({
        vehicleId: '2f9a6f1e-0000-4000-8000-000000000000',
        dealerSlug: DEALER_A,
        name: 'Ambiguous Buyer',
        phone: '9876543210',
        source: 'LISTING_PAGE',
      });

      assertProblem(response, 400, 'VALIDATION_FAILED');
    });

    it('rejects a phone number that is not an Indian mobile', async () => {
      const response = await h.agent().post('/v1/enquiries').send({
        dealerSlug: DEALER_A,
        name: 'Bad Number',
        phone: '12345',
        source: 'DEALER_PAGE',
      });

      assertProblem(response, 400, 'VALIDATION_FAILED');
      expect(JSON.stringify(response.body)).toContain('10-digit');
    });
  });

  describe('authorization', () => {
    it('401s a dealer route when no dealer resolves', async () => {
      h.actAs('no-such-dealership');
      const response = await h.agent().get('/v1/dealer/vehicles');
      assertProblem(response, 401, 'NOT_AUTHENTICATED');
      h.actAs(DEALER_A);
    });

    it('403s a permission the seat does not hold (§8.3)', async () => {
      await ensureMember(h.prisma, DEALER_A, 'SALES');
      h.actAs(DEALER_A, 'SALES');

      // SALES may read the inventory and work the inbox…
      await h.agent().get('/v1/dealer/vehicles').expect(200);
      await h.agent().get('/v1/dealer/enquiries').expect(200);

      // …and may not create, publish or spend.
      assertProblem(await h.agent().post('/v1/dealer/vehicles').send({}), 403, 'FORBIDDEN');
      assertProblem(
        await h.agent().post('/v1/dealer/billing/orders').send({ packId: DEALER_A }),
        403,
        'FORBIDDEN',
      );
      assertProblem(await h.agent().patch('/v1/dealer').send({ brandName: 'Nope' }), 403, 'FORBIDDEN');

      h.actAs(DEALER_A);
    });

    it('403s a manager buying credits but allows them to read the balance', async () => {
      await ensureMember(h.prisma, DEALER_A, 'MANAGER');
      h.actAs(DEALER_A, 'MANAGER');

      await h.agent().get('/v1/dealer/billing/summary').expect(200);
      assertProblem(
        await h.agent().post('/v1/dealer/billing/orders').send({ packId: DEALER_A }),
        403,
        'FORBIDDEN',
      );

      h.actAs(DEALER_A);
    });

    it('403s publishing while the dealership is not active', async () => {
      const dealer = await h.agent().get('/v1/dealer').expect(200);
      const vehicleId = await createSubmittableVehicle(h);

      await h
        .agent()
        .post(`/v1/admin/dealers/${dealer.body.id}/suspend`)
        .send({ reason: 'Suspended to assert the publish guard.' })
        .expect(200);

      // The principal is rebuilt from the database on every request, so the
      // suspension binds on the very next call — no session to wait out.
      const response = await h.agent().post(`/v1/dealer/vehicles/${vehicleId}/submit`).send({});
      assertProblem(response, 403, 'DEALER_NOT_ACTIVE');

      await h
        .agent()
        .post(`/v1/admin/dealers/${dealer.body.id}/reinstate`)
        .send({ note: 'Restoring after the publish-guard assertion.' })
        .expect(200);
      await h.drain();

      await h.agent().post(`/v1/dealer/vehicles/${vehicleId}/submit`).send({}).expect(201);
    });
  });

  describe('documented API errors', () => {
    it('404s an unknown route in the same problem shape', async () => {
      const response = await h.agent().get('/v1/not-a-real-endpoint');
      assertProblem(response, 404, 'NOT_FOUND');
    });

    it('404s an unknown dealer profile rather than describing the lookup', async () => {
      assertProblem(await h.agent().get('/v1/dealers/no-such-dealership'), 404, 'NOT_FOUND');
    });

    it('deduplicates a repeated enquiry instead of erroring', async () => {
      const live = await h.agent().get(`/v1/vehicles?dealer=${DEALER_A}&limit=1`).expect(200);
      const vehicleId = live.body.data[0].id as string;

      const payload = {
        vehicleId,
        name: 'Repeat Buyer',
        phone: '9812345678',
        message: 'Asking twice because the first tap did not seem to register.',
        source: 'LISTING_PAGE' as const,
      };

      const first = await h.agent().post('/v1/enquiries').send(payload);
      const second = await h.agent().post('/v1/enquiries').send(payload);

      // Tapping twice must not produce two leads, and must not look like a
      // failure to the buyer either.
      expect([200, 201]).toContain(second.status);
      expect(second.body.isDuplicate).toBe(true);
      expect(second.body.reference).toBe(first.body.reference);
    });

    it('accepts a honeypot submission without writing anything', async () => {
      const before = await h.prisma.enquiry.count();

      const response = await h.agent().post('/v1/enquiries').send({
        dealerSlug: DEALER_A,
        name: 'Spam Bot',
        phone: '9812345679',
        source: 'DEALER_PAGE',
        website: 'http://spam.example',
      });

      // A bot is told nothing: a normal success, and no lead.
      expect([200, 201]).toContain(response.status);
      expect(await h.prisma.enquiry.count()).toBe(before);
    });

    it('404s a media id that belongs to nobody', async () => {
      assertProblem(
        await h.agent().delete('/v1/dealer/media/2f9a6f1e-0000-4000-8000-000000000000'),
        404,
        'NOT_FOUND',
      );
    });

    it('404s a listing the moderator invented', async () => {
      assertProblem(
        await h
          .agent()
          .post('/v1/admin/listings/2f9a6f1e-0000-4000-8000-000000000000/approve')
          .send({}),
        404,
        'NOT_FOUND',
      );
    });

    it('rejects a moderation note that is too short to be useful', async () => {
      const vehicleId = await createSubmittableVehicle(h);
      const submit = await h
        .agent()
        .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
        .send({})
        .expect(201);

      assertProblem(
        await h
          .agent()
          .post(`/v1/admin/listings/${submit.body.listingId}/reject`)
          .send({ reason: 'no' }),
        400,
        'VALIDATION_FAILED',
      );
    });
  });
});
