import { describe, expect, it } from 'vitest';

import {
  AdminDealerQuery,
  AdminListingQuery,
  AdminPaymentQuery,
  ApproveDealerInput,
  AuditQuery,
  ConfigKeyParam,
  GrantCreditsInput,
  NoteInput,
  ReasonInput,
  RequestChangesInput,
  TakedownInput,
  UpdateConfigInput,
} from '../../src/admin.js';

/**
 * The moderation console's inputs. Every write here becomes an audit row, and
 * the audit row is only worth having if the reason in it is worth reading —
 * so most of these schemas exist to make an admin say *why*.
 *
 * `GrantCreditsInput` carries the one real refinement in the package: a
 * negative adjustment — taking credits away from a dealership that paid for
 * them — needs a reason of substance, while a positive grant does not. The
 * asymmetry is deliberate: the entry that costs someone money is the one that
 * has to be defensible six months later.
 */

const UUID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('GrantCreditsInput', () => {
  it('accepts a positive grant with a label', () => {
    expect(GrantCreditsInput.safeParse({ credits: 10, label: 'Launch bonus' }).success).toBe(true);
  });

  /** A no-op grant would write a ledger row that moves nothing. */
  it('refuses a grant of zero credits', () => {
    const result = GrantCreditsInput.safeParse({ credits: 0, label: 'Nothing' });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('non-zero');
  });

  it('refuses a fractional grant — a credit is a whole thing', () => {
    expect(GrantCreditsInput.safeParse({ credits: 1.5, label: 'Half a credit' }).success).toBe(
      false,
    );
  });

  /**
   * The asymmetry. Taking credits back is the action a dealership will
   * question, so it has to carry an explanation; handing them out does not.
   */
  it('lets a positive grant go through without a reason', () => {
    expect(GrantCreditsInput.safeParse({ credits: 5, label: 'Goodwill' }).success).toBe(true);
  });

  it('refuses a negative adjustment with no reason at all', () => {
    const result = GrantCreditsInput.safeParse({ credits: -5, label: 'Clawback' });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('negative adjustment needs a reason');
  });

  it('refuses a negative adjustment with a token reason', () => {
    expect(GrantCreditsInput.safeParse({ credits: -5, label: 'Clawback', reason: 'x' }).success)
      .toBe(false);
  });

  it('accepts a negative adjustment once the reason has substance', () => {
    expect(
      GrantCreditsInput.safeParse({
        credits: -5,
        label: 'Clawback',
        reason: 'Duplicate grant issued on 14 Aug; reversing.',
      }).success,
    ).toBe(true);
  });

  it('points the error at the reason field, so the form can show it', () => {
    const result = GrantCreditsInput.safeParse({ credits: -5, label: 'Clawback' });

    expect(result.error?.issues[0]?.path).toEqual(['reason']);
  });

  it('requires a label long enough to identify the grant in a ledger', () => {
    expect(GrantCreditsInput.safeParse({ credits: 5, label: 'ab' }).success).toBe(false);
    expect(GrantCreditsInput.safeParse({ credits: 5, label: 'x'.repeat(121) }).success).toBe(false);
  });

  it('caps the reason', () => {
    expect(
      GrantCreditsInput.safeParse({ credits: 5, label: 'Bonus', reason: 'x'.repeat(301) }).success,
    ).toBe(false);
  });

  it('takes no dealerId — the dealership is the path parameter', () => {
    expect(
      GrantCreditsInput.safeParse({ credits: 5, label: 'Bonus', dealerId: UUID }).success,
    ).toBe(false);
  });
});

describe('the reason-carrying inputs', () => {
  /**
   * Rejecting a dealership, rejecting a listing, requesting changes and taking
   * something down all become an audit row *and* a message the dealer reads.
   * A blank one is a support ticket waiting to happen.
   */
  it('requires a note when requesting changes', () => {
    expect(RequestChangesInput.safeParse({}).success).toBe(false);
  });

  /** Named `note` here rather than `reason`: it is written *to the dealer*. */
  it('accepts a substantive change request', () => {
    expect(
      RequestChangesInput.safeParse({ note: 'Photos 3 and 4 show a different car.' }).success,
    ).toBe(true);
  });

  it('refuses a change request too short to act on', () => {
    const result = RequestChangesInput.safeParse({ note: 'fix' });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('at least 6 characters');
  });

  it('requires a reason on a takedown', () => {
    expect(TakedownInput.safeParse({}).success).toBe(false);
    expect(TakedownInput.safeParse({ reason: 'Reported as already sold elsewhere.' }).success).toBe(
      true,
    );
  });

  it('bounds a reason so an audit row stays readable', () => {
    expect(ReasonInput.safeParse({ reason: 'x'.repeat(1000) }).success).toBe(false);
  });

  /** A note is optional — approving something needs no justification. */
  it('lets a note be omitted entirely', () => {
    expect(NoteInput.safeParse({}).success).toBe(true);
    expect(ApproveDealerInput.safeParse({}).success).toBe(true);
  });

  it('trims a note, so whitespace does not pass as one', () => {
    expect(RequestChangesInput.safeParse({ note: '        ' }).success).toBe(false);
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

  it('filters the moderation queue by listing status and dealership', () => {
    expect(
      AdminListingQuery.safeParse({ status: 'PENDING_REVIEW', dealer: 'sri-lakshmi-motors' })
        .success,
    ).toBe(true);
  });

  it('filters payments by status and date range', () => {
    expect(
      AdminPaymentQuery.safeParse({ status: 'CAPTURED', from: '2026-01-01', to: '2026-03-01' })
        .success,
    ).toBe(true);
  });

  /** A date is `YYYY-MM-DD`, so a range cannot smuggle a timestamp or a fragment. */
  it('refuses a date that is not a plain calendar day', () => {
    expect(AdminPaymentQuery.safeParse({ from: '2026-01-01T00:00:00Z' }).success).toBe(false);
    expect(AdminPaymentQuery.safeParse({ from: '01-01-2026' }).success).toBe(false);
  });

  /** An admin has no tenant, so naming a dealership is a filter, not a claim. */
  it('lets the audit log be narrowed to one dealership', () => {
    expect(AuditQuery.safeParse({ dealerId: UUID }).success).toBe(true);
  });

  it('narrows the audit log by entity as well', () => {
    expect(AuditQuery.safeParse({ entityType: 'Listing', entityId: UUID }).success).toBe(true);
  });

  it.each([
    ['AdminDealerQuery', AdminDealerQuery],
    ['AdminListingQuery', AdminListingQuery],
    ['AdminPaymentQuery', AdminPaymentQuery],
    ['AuditQuery', AuditQuery],
  ])('%s rejects a typo’d filter rather than ignoring it', (_name, schema) => {
    expect(schema.safeParse({ staus: 'PENDING' }).success).toBe(false);
  });

  it('defaults a page size on every list', () => {
    for (const schema of [AdminDealerQuery, AdminListingQuery, AdminPaymentQuery, AuditQuery]) {
      const parsed = schema.parse({}) as { limit?: number };
      expect(typeof parsed.limit).toBe('number');
    }
  });
});

describe('the platform config', () => {
  it('addresses a setting by key', () => {
    expect(ConfigKeyParam.safeParse({ key: 'moderation.sla_hours' }).success).toBe(true);
  });

  it('refuses an empty or over-long key', () => {
    expect(ConfigKeyParam.safeParse({ key: '' }).success).toBe(false);
    expect(ConfigKeyParam.safeParse({ key: 'x'.repeat(81) }).success).toBe(false);
  });

  it('takes the new value in the body, not the key', () => {
    expect(Object.keys(UpdateConfigInput.shape)).not.toContain('key');
  });

  it('rejects an unknown field on a config write', () => {
    expect(UpdateConfigInput.safeParse({ value: '24', nope: 1 }).success).toBe(false);
  });
});
