import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createSubmittableVehicle,
  ensureCredits,
  ledgerRows,
  newestLedgerRow,
} from './fixtures.js';
import { createHarness, DEALER_A, type Harness } from './harness.js';

/**
 * CLAUDE.md rule 4 and ARCHITECTURE §26: **every** credit movement appends a
 * `CreditTransaction`, and the ledger — not `Dealer.creditBalance` — is the
 * balance.
 *
 * These tests assert the ledger's *shape*, not just the arithmetic. A suite that
 * only checked the final number would pass for an implementation that did
 * `creditBalance += n`, which is the exact thing the rule forbids.
 */
describe('credit accounting', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
    await ensureCredits(h, 6);
  });

  afterAll(async () => {
    await h.close();
  });

  it('holds exactly one credit on submit, and records it', async () => {
    const before = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    const vehicleId = await createSubmittableVehicle(h);

    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);

    expect(submit.body.credit.held).toBe(1);
    expect(submit.body.credit.balanceAfter).toBe(submit.body.credit.balanceBefore - 1);

    const row = await newestLedgerRow(h);
    expect(row.reason).toBe('HOLD_SUBMIT');
    expect(row.delta).toBe(-1);
    expect(row.balanceAfter).toBe(submit.body.credit.balanceAfter);
    expect(row.listingId).toBe(submit.body.listingId);

    const after = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    expect(after.body.creditBalance).toBe((before.body.creditBalance as number) - 1);
    expect(after.body.creditsHeld).toBe((before.body.creditsHeld as number) + 1);
  });

  it('spends the held credit on approval with a zero-delta row', async () => {
    const vehicleId = await createSubmittableVehicle(h);
    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);
    const balanceAfterHold = submit.body.credit.balanceAfter as number;

    await h
      .agent()
      .post(`/v1/admin/listings/${submit.body.listingId}/approve`)
      .send({})
      .expect(200);

    // Approval writes a row even though it moves nothing. The ledger has to be
    // able to answer "what happened to that credit?", and silence is not an
    // answer a dealer can read (§26.2).
    const row = await newestLedgerRow(h);
    expect(row.reason).toBe('CONSUME_APPROVE');
    expect(row.delta).toBe(0);
    expect(row.balanceAfter).toBe(balanceAfterHold);
    expect(row.listingId).toBe(submit.body.listingId);

    const summary = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    expect(summary.body.creditBalance).toBe(balanceAfterHold);
  });

  it('returns the credit on rejection', async () => {
    const before = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    const vehicleId = await createSubmittableVehicle(h);
    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);
    const balanceAfterHold = submit.body.credit.balanceAfter as number;

    await h
      .agent()
      .post(`/v1/admin/listings/${submit.body.listingId}/reject`)
      .send({ reason: 'Photos show a different vehicle to the one described.' })
      .expect(200);

    const row = await newestLedgerRow(h);
    expect(row.reason).toBe('RELEASE_REJECT');
    expect(row.delta).toBe(1);
    expect(row.balanceAfter).toBe(balanceAfterHold + 1);

    const summary = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    expect(summary.body.creditBalance).toBe(balanceAfterHold + 1);
    // Back to whatever was held before this listing — earlier tests leave their
    // own listings in review, and this one is only responsible for its own.
    expect(summary.body.creditsHeld).toBe(before.body.creditsHeld);
  });

  /**
   * The regression this suite exists for.
   *
   * "Request changes" keeps the credit held — that is the *only* thing that
   * separates it from a rejection. So the resubmit must reuse the existing hold.
   * Charging again would make the dealer pay twice for one listing and would
   * leave `creditsHeld` disagreeing with the ledger.
   */
  it('keeps the credit held through request-changes and does not charge twice on resubmit', async () => {
    const vehicleId = await createSubmittableVehicle(h);
    const submit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);
    const listingId = submit.body.listingId as string;
    const balanceAfterHold = submit.body.credit.balanceAfter as number;

    const changes = await h
      .agent()
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ note: 'Add an interior photo and confirm the odometer reading.' })
      .expect(200);

    expect(changes.body.credit.stillHeld).toBe(1);
    expect(changes.body.credit.dealerBalanceAfter).toBe(balanceAfterHold);

    // Nothing was appended: no movement happened.
    const afterChanges = await newestLedgerRow(h);
    expect(afterChanges.reason).toBe('HOLD_SUBMIT');
    expect(afterChanges.listingId).toBe(listingId);

    const rowsBefore = await ledgerRows(h, 50);

    const resubmit = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(201);

    expect(resubmit.body.listingId).toBe(listingId);
    expect(resubmit.body.credit.balanceBefore).toBe(balanceAfterHold);
    expect(resubmit.body.credit.balanceAfter).toBe(balanceAfterHold);
    // Same hold, reused — not a second one.
    expect(resubmit.body.credit.transactionId).toBe(submit.body.credit.transactionId);

    const rowsAfter = await ledgerRows(h, 50);
    expect(rowsAfter).toHaveLength(rowsBefore.length);

    const summary = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    expect(summary.body.creditBalance).toBe(balanceAfterHold);
    expect(summary.body.creditsHeld).toBeGreaterThanOrEqual(1);

    // And approving still consumes that one hold, exactly once.
    await h.agent().post(`/v1/admin/listings/${listingId}/approve`).send({}).expect(200);
    const consumed = await newestLedgerRow(h);
    expect(consumed.reason).toBe('CONSUME_APPROVE');
    expect(consumed.delta).toBe(0);
    expect(consumed.balanceAfter).toBe(balanceAfterHold);
  });

  it('refuses to submit with no credits, and appends nothing', async () => {
    // Spend the balance down to zero through the ledger's own admin path
    // rather than by writing the column — the point is that the refusal is
    // computed from the ledger.
    const dealer = await h.agent().get('/v1/dealer').expect(200);
    const summary = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    const balance = summary.body.creditBalance as number;

    if (balance > 0) {
      await h
        .agent()
        .post(`/v1/admin/dealers/${dealer.body.id}/credits/grant`)
        .send({
          credits: -balance,
          label: 'Test drain',
          reason: 'Draining the balance to assert the insufficient-credit path.',
        })
        .expect(201);
    }

    const drained = await newestLedgerRow(h);
    expect(drained.balanceAfter).toBe(0);

    const vehicleId = await createSubmittableVehicle(h);
    const refused = await h
      .agent()
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .send({})
      .expect(422);

    expect(refused.body.code).toBe('INSUFFICIENT_CREDITS');
    expect(refused.headers['content-type']).toContain('application/problem+json');

    const unchanged = await newestLedgerRow(h);
    expect(unchanged.balanceAfter).toBe(0);
    expect(unchanged.reason).not.toBe('HOLD_SUBMIT');
  });

  it('never lets an admin adjustment drive the balance negative', async () => {
    const dealer = await h.agent().get('/v1/dealer').expect(200);
    const before = await newestLedgerRow(h);

    const refused = await h
      .agent()
      .post(`/v1/admin/dealers/${dealer.body.id}/credits/grant`)
      .send({
        credits: -(before.balanceAfter + 5),
        label: 'Over-deduction',
        reason: 'Asserting that the ledger floors at zero.',
      })
      .expect(422);

    expect(refused.body.code).toBe('INSUFFICIENT_CREDITS');

    const after = await newestLedgerRow(h);
    expect(after.balanceAfter).toBe(before.balanceAfter);
  });

  it('records a purchase as one ledger row and issues an invoice', async () => {
    const before = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    const packs = await h.agent().get('/v1/dealer/billing/packs').expect(200);
    const pack = packs.body.data[0];

    const order = await h
      .agent()
      .post('/v1/dealer/billing/orders')
      .send({ packId: pack.id })
      .expect(201);

    // The development provider settles inline — the same function a webhook
    // would call. No gateway page, and no second "add credits" implementation.
    expect(order.body.gateway).toBe('development');
    expect(order.body.credits).toBe(pack.credits);
    // The server prices the pack: the client sent nothing but an id.
    expect(order.body.amountPaise).toBe(pack.pricePaise);
    expect(order.body.taxPaise).toBeGreaterThan(0);
    expect(order.body.totalPaise).toBe(pack.pricePaise + order.body.taxPaise);

    const verify = await h
      .agent()
      .post(`/v1/dealer/billing/orders/${order.body.orderId}/verify`)
      .send({})
      .expect(200);

    expect(verify.body.orderStatus).toBe('PAID');
    expect(verify.body.creditsAdded).toBe(pack.credits);
    expect(verify.body.invoice).not.toBeNull();

    const row = await newestLedgerRow(h);
    expect(row.reason).toBe('PURCHASE');
    expect(row.delta).toBe(pack.credits);
    expect(row.balanceAfter).toBe((before.body.creditBalance as number) + pack.credits);

    const summary = await h.agent().get('/v1/dealer/billing/summary').expect(200);
    expect(summary.body.creditBalance).toBe(row.balanceAfter);

    const invoices = await h.agent().get('/v1/dealer/billing/invoices?limit=5').expect(200);
    const invoice = invoices.body.data.find(
      (entry: { id: string }) => entry.id === verify.body.invoice.id,
    );
    expect(invoice).toBeDefined();
    expect(invoice.totalPaise).toBe(order.body.totalPaise);
  });

  it('keeps the cached balance equal to the newest ledger row', async () => {
    const dealer = await h.agent().get('/v1/dealer').expect(200);
    const newest = await newestLedgerRow(h);

    const cached = await h.prisma.dealer.findUniqueOrThrow({
      where: { id: dealer.body.id as string },
      select: { creditBalance: true },
    });

    expect(cached.creditBalance).toBe(newest.balanceAfter);
  });

  it('runs the ledger monotonically: every row equals the previous balance plus its delta', async () => {
    const rows = await ledgerRows(h, 100);

    // Newest first, so walk backwards.
    for (let i = rows.length - 2; i >= 0; i -= 1) {
      const previous = rows[i + 1];
      const current = rows[i];
      if (!previous || !current) continue;
      expect(current.balanceAfter).toBe(previous.balanceAfter + current.delta);
    }
  });
});
