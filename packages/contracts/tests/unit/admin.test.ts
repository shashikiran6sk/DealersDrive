import { describe, expect, it } from 'vitest';

import { AdminDealerQuery, ApproveDealerInput, NoteInput, ReasonInput } from '../../src/admin.js';

/**
 * The moderation console's inputs. Every write here becomes an audit row, and
 * the audit row is only worth having if the reason in it is worth reading —
 * so most of these schemas exist to make an admin say *why*.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file also covers `GrantCreditsInput`, `RequestChangesInput`,
 * `TakedownInput`, `UpdateConfigInput`, `ConfigKeyParam` and the listing,
 * payment and audit queries. Each lands with the schema it describes; **F045
 * brings the dealer status machine's four**.
 * ────────────────────────────────────────────────────────────────────────────
 */

const UUID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('the reason-carrying inputs', () => {
  /**
   * Rejecting or suspending a dealership becomes an audit row *and* a message
   * the dealer reads. A blank one is a support ticket waiting to happen.
   */
  it('requires a reason to reject or suspend', () => {
    expect(ReasonInput.safeParse({}).success).toBe(false);
    expect(ReasonInput.safeParse({ reason: 'GSTIN does not match the PAN.' }).success).toBe(true);
  });

  it('refuses a reason too short to act on', () => {
    const result = ReasonInput.safeParse({ reason: 'no' });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('at least 6 characters');
  });

  it('bounds a reason so an audit row stays readable', () => {
    expect(ReasonInput.safeParse({ reason: 'x'.repeat(1000) }).success).toBe(false);
  });

  it('trims a reason, so whitespace does not pass as one', () => {
    expect(ReasonInput.safeParse({ reason: '        ' }).success).toBe(false);
  });

  /** A note is optional — approving or reinstating needs no justification. */
  it('lets a note be omitted entirely', () => {
    expect(NoteInput.safeParse({}).success).toBe(true);
    expect(ApproveDealerInput.safeParse({}).success).toBe(true);
  });

  /**
   * ── Reconstruction slice ──────────────────────────────────────────────────
   * The baseline's `ApproveDealerInput` also carries `grantCredits`, seeding an
   * onboarding bonus in the same transaction as the approval. Rule 4 says every
   * credit movement writes a `CreditTransaction` through `moveCredits`, and
   * neither exists until **F050** — so the field is out of the schema, and
   * because the schema is `.strict()` sending it is a 400 that *names* it,
   * rather than an approval that quietly granted nothing.
   * ──────────────────────────────────────────────────────────────────────────
   */
  it('refuses an onboarding grant by name until the ledger can honour it', () => {
    const result = ApproveDealerInput.safeParse({ grantCredits: 5 });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('grantCredits');
  });
});

describe('the console queries', () => {
  it('filters dealerships by status, city and free text', () => {
    expect(
      AdminDealerQuery.safeParse({ status: 'PENDING_APPROVAL', city: 'vellore', q: 'lakshmi' })
        .success,
    ).toBe(true);
  });

  it('refuses a dealer status outside the enum', () => {
    expect(AdminDealerQuery.safeParse({ status: 'BANNED' }).success).toBe(false);
  });

  it('rejects a typo’d filter rather than ignoring it', () => {
    expect(AdminDealerQuery.safeParse({ staus: 'PENDING' }).success).toBe(false);
  });

  it('defaults a page size, so an unbounded list cannot be asked for', () => {
    expect(AdminDealerQuery.parse({}).limit).toBe(20);
    expect(AdminDealerQuery.safeParse({ limit: 500 }).success).toBe(false);
  });

  /** A query string carries strings; `limit` still has to arrive as a number. */
  it('coerces the limit a query string actually carries', () => {
    expect(AdminDealerQuery.parse({ limit: '50' }).limit).toBe(50);
  });

  /** The city filter is a slug, so it cannot smuggle a pattern into the query. */
  it('takes a city slug rather than a name', () => {
    expect(AdminDealerQuery.safeParse({ city: 'Vellore' }).success).toBe(false);
    expect(AdminDealerQuery.safeParse({ city: 'vellore' }).success).toBe(true);
  });

  /** An admin has no tenant, so the dealership is the path, never the body. */
  it('takes no dealerId', () => {
    expect(ApproveDealerInput.safeParse({ dealerId: UUID }).success).toBe(false);
    expect(ReasonInput.safeParse({ reason: 'Good enough.', dealerId: UUID }).success).toBe(false);
  });
});
