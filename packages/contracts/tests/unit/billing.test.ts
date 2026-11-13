import { describe, expect, it } from 'vitest';

import {
  AdminCreditAdjustmentInput,
  CreateCreditOrderInput,
  VerifyCreditOrderInput,
  creditsLabel,
  gstPaise,
  packId,
  parseCreditPacks,
  perCreditLabel,
  submissionCost,
} from '../../src/index.js';

const COSTS = { listing: 1, photoshoot: 1 };

describe('what a submission costs', () => {
  it('charges the base listing credits when the dealer photographs the car', () => {
    expect(submissionCost('DEALER', COSTS)).toBe(1);
  });

  it('adds the photoshoot credits when Dealers-Drive photographs it', () => {
    expect(submissionCost('DEALERS_DRIVE', COSTS)).toBe(2);
    expect(submissionCost('DEALERS_DRIVE', { listing: 2, photoshoot: 3 })).toBe(5);
  });

  it('charges a listing with no plan — legacy or assisted — the base only', () => {
    expect(submissionCost(null, COSTS)).toBe(1);
  });

  it('makes the photoshoot free when an admin sets its credits to 0', () => {
    expect(submissionCost('DEALERS_DRIVE', { listing: 1, photoshoot: 0 })).toBe(1);
  });
});

describe('billing.creditPacks', () => {
  it('parses credits=paise entries and sorts them by size', () => {
    expect(parseCreditPacks(['10=400000', '1=50000', ' 5 = 225000 '])).toEqual({
      ok: true,
      packs: [
        { credits: 1, pricePaise: 50000 },
        { credits: 5, pricePaise: 225000 },
        { credits: 10, pricePaise: 400000 },
      ],
    });
  });

  it('refuses malformed, zero, duplicate and empty lists, naming each problem', () => {
    const parsed = parseCreditPacks(['five=500', '0=100', '2=10', '1=50000', '1=40000']);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problems).toHaveLength(4);
    expect(parseCreditPacks([])).toEqual({ ok: false, problems: ['At least one pack is needed.'] });
  });

  it('labels a pack the way the console shows it', () => {
    expect(packId(5)).toBe('pack-5');
    expect(perCreditLabel({ credits: 5, pricePaise: 225000 })).toBe('₹450 per credit');
    expect(creditsLabel(1)).toBe('1 credit');
    expect(creditsLabel(-3)).toBe('-3 credits');
  });

  it('rounds GST to the paisa', () => {
    expect(gstPaise(50000, 18)).toBe(9000);
    expect(gstPaise(33333, 18)).toBe(6000);
  });
});

describe('billing inputs', () => {
  it('names a pack and never an amount', () => {
    expect(CreateCreditOrderInput.safeParse({ packId: 'pack-5' }).success).toBe(true);
    expect(CreateCreditOrderInput.safeParse({ packId: 'pack-5', amountPaise: 1 }).success).toBe(
      false,
    );
    expect(CreateCreditOrderInput.safeParse({ packId: '5' }).success).toBe(false);
  });

  it('accepts only a hex SHA-256 signature', () => {
    const base = { razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1' };
    expect(
      VerifyCreditOrderInput.safeParse({ ...base, razorpaySignature: 'a'.repeat(64) }).success,
    ).toBe(true);
    expect(VerifyCreditOrderInput.safeParse({ ...base, razorpaySignature: 'nope' }).success).toBe(
      false,
    );
  });

  it('refuses a zero adjustment and one without a note', () => {
    expect(AdminCreditAdjustmentInput.safeParse({ credits: 0, note: 'nothing' }).success).toBe(
      false,
    );
    expect(AdminCreditAdjustmentInput.safeParse({ credits: 3, note: '' }).success).toBe(false);
    expect(AdminCreditAdjustmentInput.safeParse({ credits: -2, note: 'refund' }).success).toBe(
      true,
    );
  });
});
