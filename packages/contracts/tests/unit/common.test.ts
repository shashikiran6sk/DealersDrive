import { describe, expect, it } from 'vitest';

import {
  emiPaise,
  formatDate,
  formatKm,
  formatLakh,
  formatMonthYear,
  formatPhone,
  initialsOf,
  slugify,
  timeAgo,
  toE164,
} from '../../src/common.js';
import { formatRupees } from '../../src/common.js';

/**
 * DESIGN-SPEC §4.14 fixes these forms exactly — `₹6.45 Lakh`, `02 Aug 2026`,
 * `+91 98400 12345` — and CLAUDE.md repeats them as a rule. They live in one
 * package so the two apps cannot round differently; these tests are what keeps
 * that single implementation honest.
 */
describe('money', () => {
  it('renders lakhs to exactly two decimals', () => {
    expect(formatLakh(6_45_000_00)).toBe('₹6.45 Lakh');
    expect(formatLakh(3_00_000_00)).toBe('₹3.00 Lakh');
    // Not "₹6.5 Lakh": a price column with a ragged decimal reads as a typo.
    expect(formatLakh(6_50_000_00)).toBe('₹6.50 Lakh');
  });

  it('switches to crores above a hundred lakh', () => {
    expect(formatLakh(1_00_00_000_00)).toBe('₹1.00 Cr');
    expect(formatLakh(2_35_00_000_00)).toBe('₹2.35 Cr');
  });

  it('renders below a lakh in grouped rupees', () => {
    expect(formatLakh(85_000_00)).toBe('₹85,000');
    expect(formatLakh(999_00)).toBe('₹999');
  });

  it('renders exact amounts for invoices and packs', () => {
    expect(formatRupees(10_000_00)).toBe('₹10,000');
    expect(formatRupees(1_77_00_000n)).toBe('₹1,77,000');
  });

  it('accepts bigint paise, because the ledger stores bigint', () => {
    expect(formatLakh(6_45_000_00n)).toBe(formatLakh(6_45_000_00));
  });

  it('computes an indicative EMI from paise, in paise', () => {
    // 85% of ₹6.45 Lakh over 60 months at 9.5% — an integer, never a float
    // rupee amount.
    const emi = emiPaise(6_45_000_00);
    expect(Number.isInteger(emi)).toBe(true);
    expect(Math.round(emi / 100)).toBe(11_514);
  });
});

describe('dates', () => {
  it('renders three-letter months, zero-padded days', () => {
    expect(formatDate('2026-08-02T10:30:00.000Z')).toBe('02 Aug 2026');
    expect(formatDate('2026-12-31T23:59:00.000Z')).toBe('31 Dec 2026');
  });

  it('keeps September to three letters', () => {
    // `toLocaleString` renders this as "Sept" under current ICU, which overflows
    // a column the design sizes for three characters.
    expect(formatDate('2026-09-09T00:00:00.000Z')).toBe('09 Sep 2026');
  });

  it('renders insurance validity as month and year', () => {
    expect(formatMonthYear('2027-03-01T00:00:00.000Z')).toBe('Mar 2027');
  });

  it('renders the relative forms the design uses, and nothing else', () => {
    const now = new Date('2026-08-17T12:00:00.000Z');
    expect(timeAgo('2026-08-17T11:59:30.000Z', now)).toBe('just now');
    expect(timeAgo('2026-08-17T11:42:00.000Z', now)).toBe('18 min ago');
    expect(timeAgo('2026-08-17T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-08-16T12:00:00.000Z', now)).toBe('1 day ago');
    expect(timeAgo('2026-08-15T12:00:00.000Z', now)).toBe('2 days ago');
    // Past a month it becomes an absolute date rather than "47 days ago".
    expect(timeAgo('2026-06-01T12:00:00.000Z', now)).toBe('01 Jun 2026');
  });
});

describe('numbers and identifiers', () => {
  it('groups kilometres in the Indian system', () => {
    expect(formatKm(42_180)).toBe('42,180 km');
    expect(formatKm(1_25_000)).toBe('1,25,000 km');
  });

  it('renders phone numbers as +91 98400 12345', () => {
    expect(formatPhone('+919840012345')).toBe('+91 98400 12345');
    expect(formatPhone('9840012345')).toBe('+91 98400 12345');
    expect(formatPhone('+91 98400 12345')).toBe('+91 98400 12345');
  });

  it('normalises any Indian input to E.164', () => {
    expect(toE164('9840012345')).toBe('+919840012345');
    expect(toE164('+91 98400 12345')).toBe('+919840012345');
    expect(toE164('91-9840012345')).toBe('+919840012345');
  });

  it('always produces two initials for the square avatar', () => {
    expect(initialsOf('Sri Lakshmi Motors')).toBe('SL');
    expect(initialsOf('Velavan')).toBe('VE');
    expect(initialsOf('A1 Cars')).toBe('AC');
    expect(initialsOf('')).toBe('?');
  });

  it('slugifies to url-safe, bounded text', () => {
    expect(slugify('2021 Maruti Suzuki Swift VXi')).toBe('2021-maruti-suzuki-swift-vxi');
    expect(slugify('  Hyundai   i20 (Asta) ')).toBe('hyundai-i20-asta');
    expect(slugify('x'.repeat(120))).toHaveLength(80);
  });
});

describe('the defensive fallbacks', () => {
  /**
   * `MONTHS[getUTCMonth()]` is total for a valid date — the index is always
   * 0–11 — but an unparseable string produces an Invalid Date whose
   * `getUTCMonth()` is NaN. The `?? ''` is what stops that rendering as
   * `undefined` in the middle of a spec table. It is still not a *good*
   * output, which is why the caller validates the date; this pins that the
   * degradation is quiet rather than loud.
   */
  it('does not render the word "undefined" for an unparseable date', () => {
    expect(formatDate('not-a-date')).not.toContain('undefined');
    expect(formatMonthYear('not-a-date')).not.toContain('undefined');
  });

  it('renders a single-word dealership with two letters', () => {
    expect(initialsOf('Maruti')).toBe('MA');
  });

  it('falls back to a placeholder rather than an empty avatar', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });

  /** A name of punctuation has no letters to take, and must not render blank. */
  it('handles a name with no letters at all', () => {
    expect(initialsOf('!!! ???')).toBe('?');
  });

  it('ignores punctuation when picking the letters', () => {
    expect(initialsOf('Sri-Lakshmi Motors')).toBe('SM');
  });

  it('returns a single letter when that is all there is', () => {
    expect(initialsOf('A')).toBe('A');
  });
});

describe('the Date-or-string arms', () => {
  /**
   * Every formatter takes `Date | string`, because a value read straight off a
   * JSON response is a string and one read off Prisma is a Date. Both arms have
   * to render identically or the same timestamp would print two ways depending
   * on which side of the wire it came from.
   */
  const iso = '2026-08-02T10:30:00.000Z';

  it('formats a Date and its ISO string the same way', () => {
    expect(formatDate(new Date(iso))).toBe(formatDate(iso));
  });

  it('formats a month-year from either form the same way', () => {
    expect(formatMonthYear(new Date(iso))).toBe(formatMonthYear(iso));
  });

  it('measures elapsed time from either form the same way', () => {
    const now = new Date('2026-08-02T11:00:00.000Z');

    expect(timeAgo(new Date(iso), now)).toBe(timeAgo(iso, now));
  });
});

describe('toE164 normalisation', () => {
  /**
   * A number is stored in one form so a duplicate lead is detectable — the
   * 24-hour dedupe matches on the phone column, and `9840012345` and
   * `+91 98400 12345` are the same buyer.
   */
  it('adds the +91 a bare ten-digit number omits', () => {
    expect(toE164('9840012345')).toBe('+919840012345');
  });

  it('normalises a number already carrying its country code', () => {
    expect(toE164('919840012345')).toBe('+919840012345');
    expect(toE164('+91 98400 12345')).toBe('+919840012345');
    expect(toE164('91-98400-12345')).toBe('+919840012345');
  });

  /**
   * Anything else is passed through with a `+` rather than rejected: this is a
   * normaliser, not a validator, and the schema has already run the regex that
   * decides what is acceptable.
   */
  it('passes an unexpected length through rather than guessing', () => {
    expect(toE164('12345')).toBe('+12345');
    expect(toE164('001984001234567')).toBe('+001984001234567');
  });

  it('strips every non-digit, whatever the separator', () => {
    expect(toE164('(984) 001-2345')).toBe('+919840012345');
  });
});

describe('timeAgo across every unit', () => {
  const now = new Date('2026-08-02T12:00:00.000Z');
  const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms), now);

  it('says "just now" under a minute', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(59_000)).toBe('just now');
  });

  it('counts minutes up to an hour', () => {
    expect(ago(60_000)).toBe('1 min ago');
    expect(ago(59 * 60_000)).toBe('59 min ago');
  });

  /** Singular and plural both render, because "1 hours ago" reads as a bug. */
  it('counts hours, singular and plural', () => {
    expect(ago(60 * 60_000)).toBe('1 hour ago');
    expect(ago(2 * 60 * 60_000)).toBe('2 hours ago');
    expect(ago(23 * 60 * 60_000)).toBe('23 hours ago');
  });

  it('counts days, singular and plural', () => {
    expect(ago(24 * 60 * 60_000)).toBe('1 day ago');
    expect(ago(29 * 24 * 60 * 60_000)).toBe('29 days ago');
  });

  /** Past a month a relative form stops being useful; the date itself is clearer. */
  it('falls back to an absolute date past 30 days', () => {
    expect(ago(30 * 24 * 60 * 60_000)).toMatch(/^\d{2} \w{3} \d{4}$/);
  });

  it('never counts backwards for a clock skew into the future', () => {
    expect(timeAgo(new Date(now.getTime() + 60_000), now)).toBe('just now');
  });
});
