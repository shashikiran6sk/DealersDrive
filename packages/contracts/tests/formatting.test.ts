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
} from '../src/common.js';
import { formatRupees } from '../src/common.js';

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
