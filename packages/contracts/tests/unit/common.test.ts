import { describe, expect, it } from 'vitest';

import {
  emiPaise,
  formatDate,
  formatKm,
  formatLakh,
  formatMonthYear,
  formatPhone,
  initialsOf,
  dealerSlug,
  GoogleMapsUrl,
  isIndianMobile,
  mapsUrlFrom,
  normaliseLocality,
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

/**
 * A dealership's slug is two things at once — the URL of its public portfolio,
 * and the name of its folder in object storage — and both are read by people.
 * That is why the address is in it.
 *
 * It is also **derived once and never recomputed**: the KYC document keys hang
 * off it, so these cases are as much about what the storage layout depends on
 * as about what a link looks like.
 */
describe('dealerSlug', () => {
  it('puts the place after the name', () => {
    expect(
      dealerSlug({
        legalName: 'Sri Lakshmi Motors',
        city: 'Katpadi',
        district: 'Vellore',
        state: 'Tamil Nadu',
      }),
    ).toBe('sri-lakshmi-motors-katpadi-vellore-tamil-nadu');
  });

  it('collapses a city that shares its district name', () => {
    // The ordinary Indian case: Vellore town sits in Vellore district, and
    // `…-vellore-vellore-tamil-nadu` reads like a bug rather than an address.
    expect(
      dealerSlug({
        legalName: 'Annamalai Auto Mart Pvt Ltd',
        city: 'Vellore',
        district: 'Vellore',
        state: 'Tamil Nadu',
      }),
    ).toBe('annamalai-auto-mart-pvt-ltd-vellore-tamil-nadu');
  });

  it('drops the parts a dealership has not given yet', () => {
    // Onboarding asks for all of them, but a row written before it did — or by
    // an admin — must still produce a usable slug rather than a trailing dash.
    expect(dealerSlug({ legalName: 'Green Circle Cars', city: 'Vellore' })).toBe(
      'green-circle-cars-vellore',
    );
    expect(dealerSlug({ legalName: 'Green Circle Cars', city: null, state: null })).toBe(
      'green-circle-cars',
    );
  });

  it('keeps the place when the trading name is enormous', () => {
    // The suffix is the whole point of the shape, so it survives truncation.
    // A name capped mid-word must not leave a dash against the town either.
    const slug = dealerSlug({
      legalName: `${'Balaji '.repeat(20)}Motors`,
      city: 'Ambur',
      district: 'Tirupattur',
      state: 'Tamil Nadu',
    });
    expect(slug.endsWith('-ambur-tirupattur-tamil-nadu')).toBe(true);
    expect(slug).not.toContain('--');
    expect(slug.length).toBeLessThanOrEqual(120);
  });

  it('never yields an empty slug', () => {
    // A registered name of nothing but punctuation is not a name the schema
    // accepts, but the fallback is what stops it becoming a bare `-vellore`.
    expect(dealerSlug({ legalName: '???', city: 'Vellore' })).toBe('dealership-vellore');
  });
});

/**
 * The guard rail free-text localities need.
 *
 * There is no `cities` table any more: a dealership's city and state are typed,
 * which is what lets the product reach past the five towns somebody seeded. The
 * price of that is fragmentation — `vellore`, `Vellore` and `VELLORE ` are one
 * city filtered three ways — and this is what is paid instead, once, on write.
 */
describe('normaliseLocality', () => {
  it('settles case and spacing so one town cannot become three', () => {
    expect(normaliseLocality('  VELLORE ')).toBe('Vellore');
    expect(normaliseLocality('vellore')).toBe('Vellore');
    expect(normaliseLocality('tamil   nadu')).toBe('Tamil Nadu');
  });

  it('capitalises after a hyphen, an apostrophe and a full stop', () => {
    // Real place names, all of them. Title-casing on spaces alone would give
    // "Jammu-kashmir", "D'souza Nagar" and "N.c.r.".
    expect(normaliseLocality('jammu-kashmir')).toBe('Jammu-Kashmir');
    expect(normaliseLocality("d'souza nagar")).toBe("D'Souza Nagar");
    expect(normaliseLocality('n.c.r.')).toBe('N.C.R.');
  });

  it('leaves non-Latin scripts alone rather than mangling them', () => {
    // The `u` flag matters here: `\p{L}` matches a Devanagari letter, which has
    // no upper case, so the string comes back as typed rather than corrupted.
    expect(normaliseLocality('  वेल्लोर ')).toBe('वेल्लोर');
  });

  /**
   * Deliberately conservative. It does not correct spelling, expand
   * abbreviations or transliterate — each of those is a judgement about a place
   * name that the dealer standing in it knows better than we do.
   */
  it('changes nothing else', () => {
    expect(normaliseLocality('Bengaluru')).toBe('Bengaluru');
    expect(normaliseLocality('N.C.R.')).toBe('N.C.R.');
    expect(normaliseLocality('')).toBe('');
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

/**
 * The one field in this package whose validation is a *security* boundary
 * rather than a data-quality one.
 *
 * A dealer pastes this and a buyer's browser follows it from the public
 * portfolio. Accepting any URL would make the "Get directions" button a
 * self-service open redirect with a dealership's name on it — so the host is
 * checked against a list, and the scheme is checked with it.
 */
/** The URL out of Google's Share → Embed panel, trimmed to the parts that matter. */
const EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.5!2d79.1453092!3d12.9346947!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCHENNAI%20CARS!5e0!3m2!1sen!2sin';

describe('GoogleMapsUrl', () => {
  it.each([
    'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    'https://goo.gl/maps/abc123',
    'https://www.google.com/maps/place/Sri+Lakshmi+Motors/@12.9,79.1,17z',
    'https://maps.google.com/?q=12.9,79.1',
    'https://www.google.co.in/maps/@12.9,79.1,17z',
  ])('accepts %s', (url) => {
    expect(GoogleMapsUrl.safeParse(url).success).toBe(true);
  });

  it.each([
    // Not Google at all — the case the check exists for.
    'https://evil.example.com/maps',
    // A host that merely *contains* a Google domain. Substring matching would
    // let this through; comparing the parsed hostname does not.
    'https://maps.google.com.evil.example/place',
    'https://google.com.attacker.test/maps',
    // Right host, wrong scheme: a downgrade a buyer cannot see in a link.
    'http://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    // Not a link at all — what a dealer types when they misread the question.
    'Sri Lakshmi Motors, Katpadi Road',
    '',
  ])('refuses %j', (url) => {
    expect(GoogleMapsUrl.safeParse(url).success).toBe(false);
  });

  it('trims what was pasted, and keeps the rest of the link untouched', () => {
    const link = 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9';

    // Stored verbatim: the query string of a Maps link is Google's business,
    // and a share link that has been "cleaned up" stops resolving.
    expect(GoogleMapsUrl.parse(`  ${link}  `)).toBe(link);
    expect(GoogleMapsUrl.parse(`${link}?g_st=iw`)).toBe(`${link}?g_st=iw`);
  });

  /**
   * Share → Embed is the other half of Google's own share panel, and what it
   * copies to the clipboard is not a URL — it is an `<iframe>` element. A
   * dealer following a "put a map on your website" guide pastes exactly that.
   *
   * Both halves of that panel are now accepted: the embed URL on its own, and
   * the whole element with the URL inside it. Refusing the element told a
   * dealer that what Google had just handed them was not a Google Maps link.
   */
  it('accepts an embed URL, which is the other thing the share panel gives', () => {
    expect(GoogleMapsUrl.parse(EMBED)).toBe(EMBED);
  });

  it('lifts the link out of a pasted <iframe>, and stores only the link', () => {
    const pasted = `<iframe src="${EMBED}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;

    // The HTML is never stored — the width, the style and the closing tag are
    // all discarded, and what lands in the column is a URL like any other.
    expect(GoogleMapsUrl.parse(pasted)).toBe(EMBED);
    expect(GoogleMapsUrl.parse(`  ${pasted}  `)).toBe(EMBED);
    expect(GoogleMapsUrl.parse(pasted.replace(/"/gu, "'"))).toBe(EMBED);
  });

  /**
   * Unwrapping happens *before* the host check, not instead of it. An element
   * is a way to smuggle a URL past a reader's eye, so the URL that comes out of
   * one faces exactly the same test as one typed in directly.
   */
  it('refuses an <iframe> whose src is not Google, and one with no src at all', () => {
    expect(
      GoogleMapsUrl.safeParse('<iframe src="https://evil.example.com/maps"></iframe>').success,
    ).toBe(false);
    expect(GoogleMapsUrl.safeParse('<iframe></iframe>').success).toBe(false);
    // Not an iframe: left alone, and refused for the ordinary reason.
    expect(
      GoogleMapsUrl.safeParse('<script src="https://www.google.com/maps"></script>').success,
    ).toBe(false);
  });

  it('reads the src of an <iframe>, and leaves anything else exactly as it was', () => {
    expect(mapsUrlFrom(`<iframe src="${EMBED}"></iframe>`)).toBe(EMBED);
    expect(mapsUrlFrom(EMBED)).toBe(EMBED);
    // A word that merely starts with the tag name is not the tag.
    expect(mapsUrlFrom('<iframely>')).toBe('<iframely>');
  });
});

/**
 * One rule for a phone number, in the package both apps import.
 *
 * There were three copies before — the onboarding schema, the profile schema
 * and the wizard's browser-side check — and they agreed with each other but
 * not with the placeholder in the form, which shows `98400 12345`. A dealer who
 * typed what the box suggested was told it was not a phone number.
 */
describe('isIndianMobile', () => {
  it.each([
    '9840012345',
    '98400 12345',
    '98400-12345',
    '+919840012345',
    '+91 98400 12345',
    '  9840012345  ',
    '919840012345',
  ])('accepts %j, however it was spaced', (value) => {
    expect(isIndianMobile(value)).toBe(true);
  });

  it.each([
    // Indian mobile numbers start 6-9. A landline typed into the mobile box is
    // the mistake this catches.
    '0416224889',
    '1234567890',
    // Too short, too long, and not a number at all.
    '98400123',
    '98400123456',
    'nine eight four',
    '',
  ])('refuses %j', (value) => {
    expect(isIndianMobile(value)).toBe(false);
  });

  it('agrees with toE164 on everything it accepts', () => {
    // The two are a pair: this decides what may be stored, that decides the one
    // form it is stored in. A number this accepts and that mangles would be a
    // silent corruption.
    for (const value of ['9840012345', '98400 12345', '+91 98400-12345']) {
      expect(toE164(value)).toBe('+919840012345');
    }
  });
});
