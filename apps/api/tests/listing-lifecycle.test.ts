import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { canTransition, transition } from '../src/modules/listings/listing.state.js';
import { createSubmittableVehicle, ensureCredits } from './fixtures.js';
import { createHarness, DEALER_A, type Harness } from './harness.js';

/**
 * CLAUDE.md rule 5: a listing's status changes only through
 * `transition(listing, event, actor)`.
 *
 * The unit block below pins the table itself. The HTTP block proves the table is
 * actually the gate — that a second moderator, a dealer forging a status, and a
 * repeated approval all meet it rather than going round it.
 */
describe('listing state machine', () => {
  it('allows a dealer to resubmit only from a returned state', () => {
    expect(transition({ status: 'REJECTED' }, 'RESUBMIT', 'DEALER')).toBe('PENDING_REVIEW');
    expect(transition({ status: 'CHANGES_REQUESTED' }, 'RESUBMIT', 'DEALER')).toBe(
      'PENDING_REVIEW',
    );
    expect(canTransition({ status: 'APPROVED' }, 'RESUBMIT', 'DEALER')).toBe(false);
    expect(canTransition({ status: 'PENDING_REVIEW' }, 'RESUBMIT', 'DEALER')).toBe(false);
  });

  it('reserves moderation for admins', () => {
    for (const event of ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'TAKEDOWN'] as const) {
      expect(canTransition({ status: 'PENDING_REVIEW' }, event, 'DEALER')).toBe(false);
      expect(canTransition({ status: 'PENDING_REVIEW' }, event, 'SYSTEM')).toBe(false);
    }
    expect(transition({ status: 'PENDING_REVIEW' }, 'APPROVE', 'ADMIN')).toBe('APPROVED');
  });

  it('reserves expiry for the sweep, not for a person', () => {
    expect(transition({ status: 'APPROVED' }, 'EXPIRE', 'SYSTEM')).toBe('EXPIRED');
    expect(canTransition({ status: 'APPROVED' }, 'EXPIRE', 'ADMIN')).toBe(false);
    expect(canTransition({ status: 'APPROVED' }, 'EXPIRE', 'DEALER')).toBe(false);
  });

  it('refuses to moderate a listing that is already decided', () => {
    for (const status of ['APPROVED', 'REJECTED', 'REMOVED', 'SOLD', 'EXPIRED'] as const) {
      expect(canTransition({ status }, 'APPROVE', 'ADMIN')).toBe(false);
    }
  });

  it('allows renewal only from expiry, and sale only from a published state', () => {
    expect(transition({ status: 'EXPIRED' }, 'RENEW', 'DEALER')).toBe('PENDING_REVIEW');
    expect(canTransition({ status: 'REJECTED' }, 'RENEW', 'DEALER')).toBe(false);

    expect(transition({ status: 'APPROVED' }, 'MARK_SOLD', 'DEALER')).toBe('SOLD');
    expect(transition({ status: 'EXPIRED' }, 'MARK_SOLD', 'DEALER')).toBe('SOLD');
    expect(canTransition({ status: 'PENDING_REVIEW' }, 'MARK_SOLD', 'DEALER')).toBe(false);
  });

  it('names the transition in the error, not the internals', () => {
    expect(() => transition({ status: 'APPROVED' }, 'APPROVE', 'ADMIN')).toThrow(
      /approved and cannot be approved/i,
    );
  });
});

describe('listing lifecycle over HTTP', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
    await ensureCredits(h, 6);
  });

  afterAll(async () => {
    await h.close();
  });

  it('reports the dealer-facing status through displayStatus, never a raw listing status', async () => {
    const vehicleId = await createSubmittableVehicle(h);

    const draft = await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(draft.body.displayStatus).toBe('DRAFT');

    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);
    expect(submit.body.displayStatus).toBe('PENDING');

    const pending = await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(pending.body.displayStatus).toBe('PENDING');
    expect(pending.body.statusLabel).toBeTruthy();

    await h
      .agent()
      .post(`/v1/admin/listings/${submit.body.listingId}/approve`)
      .send({})
      .expect(200);

    const live = await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(live.body.displayStatus).toBe('ACTIVE');
  });

  it('refuses a second submit while one is in review', async () => {
    const vehicleId = await createSubmittableVehicle(h);
    await h.agent().post(`/v1/dealer/vehicles/${vehicleId}/submit`).send({}).expect(201);

    const again = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(409);

    expect(again.body.code).toBe('ALREADY_SUBMITTED');
  });

  it('refuses a second moderation decision on the same listing', async () => {
    const vehicleId = await createSubmittableVehicle(h);
    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);
    const listingId = submit.body.listingId as string;

    await h.agent().post(`/v1/admin/listings/${listingId}/approve`).send({}).expect(200);

    // Two moderators opening the same card is expected; the second one is told,
    // not silently allowed to double-approve.
    const second = await h
      .agent()
      .post(`/v1/admin/listings/${listingId}/approve`)
      .send({})
      .expect(409);
    expect(second.body.code).toBe('INVALID_TRANSITION');

    const reject = await h
      .agent()
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason: 'Changed my mind after publishing it.' })
      .expect(409);
    expect(reject.body.code).toBe('INVALID_TRANSITION');
  });

  it('refuses a dealer-supplied status outright', async () => {
    const vehicleId = await createSubmittableVehicle(h);

    // Rule 2 and rule 5 together: `status` is in no dealer-writable schema, and
    // the schema is `.strict()`, so this is a 400 rather than a quiet no-op.
    const forged = await h
      .agent()
      .patch(`/v1/dealer/vehicles/${vehicleId}`)
      .send({ status: 'APPROVED' })
      .expect(400);
    expect(forged.body.code).toBe('VALIDATION_FAILED');

    const unchanged = await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(unchanged.body.displayStatus).toBe('DRAFT');
  });

  it('blocks submission before the vehicle is complete', async () => {
    const created = await h
      .agent()
      .post('/v1/dealer/vehicles')
      .send({
        makeId: (await h.prisma.model.findFirstOrThrow({ orderBy: { name: 'asc' } })).makeId,
        modelId: (await h.prisma.model.findFirstOrThrow({ orderBy: { name: 'asc' } })).id,
        year: 2020,
        fuel: 'DIESEL',
        transmission: 'AUTOMATIC',
        bodyType: 'SUV',
      })
      .expect(201);

    const refused = await h
      .agent()
      .post(`/v1/dealer/vehicles/${created.body.id}/submit`)
      .send({})
      .expect(422);

    // Photos are checked first: it is the blocker a dealer can act on without
    // reading a list.
    expect(refused.body.code).toBe('TOO_FEW_PHOTOS');
    expect(refused.body.errors?.[0]?.field).toBe('photos');

    const state = await h.agent().get(`/v1/dealer/vehicles/${created.body.id}`).expect(200);
    expect(state.body.completeness.canSubmit).toBe(false);
    expect(state.body.completeness.blockers.length).toBeGreaterThan(1);
  });

  it('takes a published listing down and out of the catalogue', async () => {
    const vehicleId = await createSubmittableVehicle(h);
    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);
    const listingId = submit.body.listingId as string;

    await h.agent().post(`/v1/admin/listings/${listingId}/approve`).send({}).expect(200);
    await h.drain();

    const slug = (await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200)).body
      .slug as string;
    await h.agent().get(`/v1/vehicles/${slug}`).expect(200);

    const takedown = await h
      .agent()
      .post(`/v1/admin/listings/${listingId}/takedown`)
      .send({ reason: 'Duplicate of another live listing.', refundCredit: true })
      .expect(200);

    expect(takedown.body.status).toBe('REMOVED');
    expect(takedown.body.creditRefunded).toBe(true);

    await h.drain();
    await h.agent().get(`/v1/vehicles/${slug}`).expect(404);

    const dealerView = await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(dealerView.body.displayStatus).toBe('REMOVED');
  });

  it('marks a live vehicle sold and removes it from the catalogue', async () => {
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
    await h.agent().get(`/v1/vehicles/${slug}`).expect(200);

    const sold = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`)
      .send({ soldPricePaise: 4_25_000_00 })
      .expect(200);

    expect(sold.body.displayStatus).toBe('SOLD');

    await h.drain();
    // A sold car leaves the catalogue: rule 6's visibility test fails for it.
    await h.agent().get(`/v1/vehicles/${slug}`).expect(404);
  });
});
