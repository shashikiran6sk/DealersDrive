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
    const variant = await h.prisma.variant.findFirstOrThrow({
      include: { model: true },
      orderBy: { name: 'asc' },
    });

    const created = await h
      .agent()
      .post('/v1/dealer/vehicles')
      .send({
        makeId: variant.model.makeId,
        modelId: variant.modelId,
        variantId: variant.id,
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

  /** Publishes a vehicle and returns its id and public slug. */
  async function publish(): Promise<{ vehicleId: string; slug: string; listingId: string }> {
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

    return { vehicleId, slug, listingId };
  }

  /**
   * A sold car stays on the marketplace. It keeps its row in `listing_search`
   * so it still appears in results — greyed out, badged, sorted last — but it is
   * excluded from every *available* count and its detail page stops answering.
   *
   * Both halves matter. Dropping the row loses the social proof; keeping it
   * without `is_sold` advertises a car nobody can buy.
   */
  it('marks a live vehicle sold, keeps it visible, and closes its detail page', async () => {
    const { vehicleId, slug } = await publish();

    // Drain first: an earlier test in this file may have submitted a vehicle
    // and left the resulting unindex pending, and the drain below would flush
    // it and move the catalogue counts under this test's feet.
    await h.drain();
    const before = await h.agent().get('/v1/vehicles?limit=1').expect(200);

    const sold = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`)
      .send({ soldPricePaise: 4_25_000_00 })
      .expect(200);

    expect(sold.body.displayStatus).toBe('SOLD');
    expect(sold.body.remainsVisible).toBe(true);
    await h.drain();

    // Still indexed, and flagged.
    const row = await h.prisma.$queryRaw<{ is_sold: boolean; sold_at: Date | null }[]>`
      SELECT is_sold, sold_at FROM listing_search WHERE vehicle_id = ${vehicleId}::uuid`;
    expect(row[0]?.is_sold).toBe(true);
    expect(row[0]?.sold_at).toBeInstanceOf(Date);

    // The page still counts it — sold rows sort last and have to stay
    // reachable — while the available count drops by exactly one.
    const after = await h.agent().get('/v1/vehicles?limit=1').expect(200);
    expect(after.body.page.total).toBe(before.body.page.total);

    const availableBefore = Number(/^([\d,]+)/.exec(before.body.resultLabel)?.[1]?.replace(/,/g, ''));
    const availableAfter = Number(/^([\d,]+)/.exec(after.body.resultLabel)?.[1]?.replace(/,/g, ''));
    expect(availableAfter).toBe(availableBefore - 1);

    // …and the detail page is closed, so a stale link says "gone" rather than
    // opening a car that cannot be bought.
    await h.agent().get(`/v1/vehicles/${slug}`).expect(404);
  });

  it('marks the sold card as sold wherever it still appears', async () => {
    const { vehicleId } = await publish();
    await h.drain();

    await h.agent().post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).send({}).expect(200);
    await h.drain();

    const results = await h.agent().get('/v1/vehicles?limit=48').expect(200);
    const card = results.body.data.find((entry: { id: string }) => entry.id === vehicleId);

    // The API decides this once, so no client can render a clickable sold car
    // by forgetting a check.
    expect(card?.isSold).toBe(true);
    expect(card?.soldLabel).toBeTruthy();

    // And it sorts behind every available car.
    const soldIndex = results.body.data.findIndex((entry: { id: string }) => entry.id === vehicleId);
    const lastAvailable = results.body.data
      .map((entry: { isSold: boolean }) => entry.isSold)
      .lastIndexOf(false);
    expect(soldIndex).toBeGreaterThan(lastAvailable);
  });

  /**
   * "Non-clickable" has to mean more than a missing anchor. A buyer with the
   * vehicle id — from a stale saved-cars list, a shared link, or curl — must not
   * be able to enquire about or reveal the number for a car that is gone.
   *
   * Both paths resolve the car through `search.byVehicleId`, which carries the
   * `is_sold = false` predicate, so this is one rule rather than a check at each
   * call site that someone can forget to add to the third one.
   */
  it('refuses every buyer action on a sold car, not just the link to it', async () => {
    const { vehicleId } = await publish();
    await h.drain();

    await h.agent().post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).send({}).expect(200);
    await h.drain();

    const enquiry = await h
      .agent()
      .post('/v1/enquiries')
      .send({
        vehicleId,
        name: 'Priya Raman',
        phone: '9876543210',
        message: 'Is this still available for a test drive this weekend?',
        source: 'LISTING_PAGE',
      })
      .expect(404);
    expect(enquiry.body.code).toBe('NOT_FOUND');

    await h.agent().post(`/v1/vehicles/${vehicleId}/reveal-contact`).send({}).expect(404);

    // Similar cars answer 200 with nothing rather than 404 — it is a
    // below-the-fold widget and must never take the page down — but a car that
    // is gone recommends nothing, and is recommended to nobody.
    const similar = await h.agent().get(`/v1/vehicles/${vehicleId}/similar?limit=12`).expect(200);
    expect(similar.body.data).toEqual([]);

    const others = await h.agent().get('/v1/vehicles?limit=48').expect(200);
    const stillForSale = others.body.data.find((entry: { isSold: boolean }) => !entry.isSold);
    const recommended = await h
      .agent()
      .get(`/v1/vehicles/${stillForSale.id}/similar?limit=12`)
      .expect(200);
    expect(recommended.body.data.map((entry: { id: string }) => entry.id)).not.toContain(vehicleId);
  });

  /**
   * C12b. Distinct from the admin takedown above and from `DELETE` (C10): this
   * ends the publication and keeps the asset.
   */
  it('lets a dealer withdraw their own listing, keeping the vehicle as a draft', async () => {
    const { vehicleId, slug } = await publish();

    const removed = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/remove-listing`)
      .send({})
      .expect(200);

    expect(removed.body.displayStatus).toBe('REMOVED');
    expect(removed.body.vehicleRetained).toBe(true);
    expect(removed.body.canRelist).toBe(true);
    await h.drain();

    // Gone from the marketplace entirely — not merely flagged, as a sale is.
    await h.agent().get(`/v1/vehicles/${slug}`).expect(404);
    const indexed = await h.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM listing_search WHERE vehicle_id = ${vehicleId}::uuid`;
    expect(Number(indexed[0]?.count ?? 0)).toBe(0);

    // The vehicle survives, editable, back in the dealer's inventory.
    const dealerView = await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(dealerView.body.displayStatus).toBe('REMOVED');
    expect(dealerView.body.status).toBe('DRAFT');

    await h
      .agent()
      .patch(`/v1/dealer/vehicles/${vehicleId}`)
      .send({ kmDriven: 51_000 })
      .expect(200);
  });

  it('withdraws a sold listing without un-selling the car', async () => {
    const { vehicleId } = await publish();

    await h.agent().post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).send({}).expect(200);
    await h.drain();

    const removed = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/remove-listing`)
      .send({})
      .expect(200);

    // Withdrawing removes the advertisement, not the sale — resetting the
    // vehicle to DRAFT here would quietly re-list a car that is gone.
    expect(removed.body.canRelist).toBe(false);
    await h.drain();

    const dealerView = await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
    expect(dealerView.body.status).toBe('SOLD');
    expect(dealerView.body.displayStatus).toBe('REMOVED');
  });

  it('refuses to withdraw a listing that is still with the reviewers', async () => {
    const vehicleId = await createSubmittableVehicle(h);
    await h.agent().post(`/v1/dealer/vehicles/${vehicleId}/submit`).send({}).expect(201);

    // PENDING_REVIEW holds a credit and shows nobody anything. Unwinding the
    // hold is `submit`'s business, not this event's.
    const refused = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/remove-listing`)
      .send({})
      .expect(409);

    expect(refused.body.code).toBe('INVALID_TRANSITION');
  });
});

/**
 * Found by running the generated Postman collection with newman: a `makeId` that
 * is a well-formed uuid but names nothing produced a **500** with a Prisma error
 * attached, because the ids went straight into the insert and the foreign-key
 * violation was never caught. A client mistake reported as a server fault.
 *
 * The schema cannot catch this — `Uuid` says the shape is right, not that the
 * row exists — so the check belongs in the service.
 */
describe('catalogue references', () => {
  let h: Harness;
  let real: { makeId: string; modelId: string; variantId: string };

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
    // Picked by having a variant, because variant is mandatory on create — a
    // model with none seeded would fail these tests on the wrong field.
    const variant = await h.prisma.variant.findFirstOrThrow({
      include: { model: true },
      orderBy: { name: 'asc' },
    });
    real = { makeId: variant.model.makeId, modelId: variant.modelId, variantId: variant.id };
  });

  afterAll(async () => {
    await h.close();
  });

  const UNKNOWN = '2f9a6f1e-0000-4000-8000-000000000000';

  const draft = (overrides: Record<string, unknown>) => ({
    makeId: real.makeId,
    modelId: real.modelId,
    variantId: real.variantId,
    year: 2021,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'HATCHBACK',
    ...overrides,
  });

  it('404s an unknown make rather than 500ing', async () => {
    const response = await h
      .agent()
      .post('/v1/dealer/vehicles')
      .send(draft({ makeId: UNKNOWN }))
      .expect(404);

    expect(response.body.code).toBe('NOT_FOUND');
    expect(response.body.errors?.[0]?.field).toBe('makeId');
    // The whole point: no Prisma, no SQL, no file path.
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|invocation|\.ts:/i);
  });

  it('404s an unknown model', async () => {
    const response = await h
      .agent()
      .post('/v1/dealer/vehicles')
      .send(draft({ modelId: UNKNOWN }))
      .expect(404);
    expect(response.body.errors?.[0]?.field).toBe('modelId');
  });

  /**
   * Existence alone would not be enough. Dealers are constrained to dropdowns
   * because a Kia Seltos filed under Maruti Suzuki takes search, filters and SEO
   * down with it (ARCHITECTURE §6.2), and nothing downstream re-checks the pair.
   */
  it('404s a real model that belongs to a different make', async () => {
    const other = await h.prisma.model.findFirstOrThrow({
      where: { makeId: { not: real.makeId } },
    });

    const response = await h
      .agent()
      .post('/v1/dealer/vehicles')
      .send(draft({ modelId: other.id }))
      .expect(404);

    expect(response.body.errors?.[0]?.field).toBe('modelId');
  });

  it('404s a colour or city that is not in the catalogue', async () => {
    const created = await h.agent().post('/v1/dealer/vehicles').send(draft({})).expect(201);

    await h
      .agent()
      .patch(`/v1/dealer/vehicles/${created.body.id}`)
      .send({ colorId: UNKNOWN })
      .expect(404);

    await h
      .agent()
      .patch(`/v1/dealer/vehicles/${created.body.id}`)
      .send({ cityId: UNKNOWN })
      .expect(404);
  });

  it('still accepts a real combination, and leaves untouched edits alone', async () => {
    const created = await h.agent().post('/v1/dealer/vehicles').send(draft({})).expect(201);

    // A PATCH that names none of make/model/variant must not re-validate them.
    await h
      .agent()
      .patch(`/v1/dealer/vehicles/${created.body.id}`)
      .send({ kmDriven: 12_000 })
      .expect(200);
  });
});
