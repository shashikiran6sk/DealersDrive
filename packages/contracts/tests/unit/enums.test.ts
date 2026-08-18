import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import * as enums from '../../src/enums.js';

/**
 * Every enum that crosses the wire, in one file so the API and the web app
 * cannot disagree about what a valid value is.
 *
 * The tests that matter are the ones about *membership*: an enum here is
 * mirrored by a Postgres enum in the Prisma schema, and a value present in one
 * and absent from the other is a runtime failure that no type check catches —
 * the database rejects the insert, or Zod rejects the response the database
 * just produced. Since the schema is not importable from this package, the
 * members are pinned here explicitly, so a change on either side has to be a
 * change in two places rather than a silent divergence in one.
 */

/** Walked at runtime, so an enum added tomorrow is held to the same rules. */
const zodEnums: [string, z.ZodEnum<Record<string, string>>][] = Object.entries(enums).flatMap(
  ([name, value]) => (value instanceof z.ZodEnum ? [[name, value] as const] : []),
);

describe('the enum set', () => {
  it('exports a substantial set of enums, not a stub', () => {
    expect(zodEnums.length).toBeGreaterThan(15);
  });

  /**
   * SCREAMING_SNAKE for anything that is a *stored* value. Mixed casing is how
   * `bodyType=SUV` and `bodyType=Suv` end up meaning different things in a
   * filter, and how a Postgres enum insert fails at runtime.
   *
   * `StatusTone` is exempt and is the only exemption: it is a presentation
   * vocabulary — the badge fills in DESIGN-SPEC §2.5 — that never reaches a
   * column, so it reads as the CSS token it becomes.
   */
  it('names every stored member in SCREAMING_SNAKE', () => {
    for (const [name, schema] of zodEnums) {
      if (name === 'StatusTone') continue;
      for (const option of schema.options) {
        expect(option, `${name}.${option}`).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    }
  });

  it('keeps StatusTone as lower-case design tokens', () => {
    expect(enums.StatusTone.options).toEqual(['ok', 'warn', 'err', 'neutral', 'accent']);
  });

  it('repeats no member within an enum', () => {
    for (const [name, schema] of zodEnums) {
      expect(new Set(schema.options).size, name).toBe(schema.options.length);
    }
  });

  it('leaves no enum empty', () => {
    for (const [name, schema] of zodEnums) {
      expect(schema.options.length, name).toBeGreaterThan(0);
    }
  });
});

describe('the vehicle vocabulary', () => {
  /** The facet groups on the search page are built from exactly these. */
  it('lists the fuels Indian used cars actually come in', () => {
    expect(enums.FuelType.options).toEqual([
      'PETROL',
      'DIESEL',
      'CNG',
      'ELECTRIC',
      'HYBRID',
      'LPG',
    ]);
  });

  it('has two transmissions and no third', () => {
    expect(enums.Transmission.options).toEqual(['MANUAL', 'AUTOMATIC']);
  });

  it('lists the five body types the homepage tiles render', () => {
    expect(enums.BodyType.options).toEqual(['HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'LUXURY']);
  });

  it('lets a price be slightly negotiable or fixed, and nothing vaguer', () => {
    expect(enums.PriceNegotiability.options).toEqual(['SLIGHTLY', 'FIXED']);
  });

  it('mirrors the four VehicleStatus values in the database', () => {
    expect(enums.VehicleStatus.options).toEqual(['DRAFT', 'READY', 'SOLD', 'ARCHIVED']);
  });
});

describe('listing status and its display form', () => {
  /**
   * §27: `ListingStatus` is the moderation state machine's own vocabulary;
   * `DisplayStatus` is the single derived field the API returns. They are
   * deliberately different — "Approved" is a moderation outcome, "Active" is
   * what a dealer cares about — and conflating them is why the derivation
   * happens once, in `listing.state.ts`.
   */
  it('keeps the two vocabularies separate', () => {
    expect(enums.ListingStatus.options).not.toEqual(enums.DisplayStatus.options);
  });

  it('has a display status for every moderation state a dealer can be in', () => {
    expect(enums.ListingStatus.options.length).toBeGreaterThan(3);
    expect(enums.DisplayStatus.options.length).toBeGreaterThan(3);
  });

  it('includes the three moderation outcomes', () => {
    for (const status of ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']) {
      expect(enums.ListingStatus.options, status).toContain(status);
    }
  });
});

describe('roles', () => {
  /** ARCHITECTURE §8.3's two role sets, kept separate so neither can grant the other. */
  it('lists the three dealer seats', () => {
    expect(enums.DealerRole.options).toEqual(['OWNER', 'MANAGER', 'SALES']);
  });

  it('lists the three admin seats', () => {
    expect(enums.AdminRole.options).toEqual(['SUPPORT', 'MODERATOR', 'SUPER_ADMIN']);
  });

  it('shares no member between the two, so a role name is unambiguous', () => {
    const dealer = new Set<string>(enums.DealerRole.options);

    for (const role of enums.AdminRole.options) {
      expect(dealer.has(role), role).toBe(false);
    }
  });
});

describe('the credit ledger vocabulary', () => {
  /**
   * CLAUDE.md rule 4: every movement writes a row, and the reason is what
   * makes the ledger auditable. The three moderation outcomes have to be
   * distinguishable — a hold consumed on approval and a hold released on
   * rejection are opposite events with the same net effect on the balance.
   */
  it('names each credit movement distinctly', () => {
    for (const reason of ['HOLD_SUBMIT', 'CONSUME_APPROVE', 'RELEASE_REJECT']) {
      expect(enums.CreditReason.options, reason).toContain(reason);
    }
  });

  it('includes a purchase reason, so bought credits are not indistinguishable from granted ones', () => {
    expect(enums.CreditReason.options.some((reason) => reason.includes('PURCHASE'))).toBe(true);
  });
});

describe('enquiry vocabulary', () => {
  it('lists the four lead states a dealer works through', () => {
    expect(enums.EnquiryStatus.options).toEqual(['NEW', 'CONTACTED', 'CLOSED', 'SPAM']);
  });

  it('lists the reasons a lead closes', () => {
    expect(enums.CloseReason.options).toEqual(['SOLD', 'NOT_INTERESTED', 'UNREACHABLE', 'OTHER']);
  });

  /** Where a lead came from decides which dealer metric it counts toward. */
  it('records the three places a lead can originate', () => {
    expect(enums.EnquirySource.options).toEqual(['LISTING_PAGE', 'CALL_BUTTON', 'DEALER_PAGE']);
  });
});

describe('parsing', () => {
  it('accepts a member', () => {
    expect(enums.FuelType.parse('PETROL')).toBe('PETROL');
  });

  it('rejects a non-member', () => {
    expect(enums.FuelType.safeParse('STEAM').success).toBe(false);
  });

  /** Case matters: an enum is a stored value, not a display label. */
  it('rejects the lower-cased form', () => {
    expect(enums.FuelType.safeParse('petrol').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(enums.FuelType.safeParse('').success).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(enums.FuelType.safeParse(1).success).toBe(false);
    expect(enums.FuelType.safeParse(null).success).toBe(false);
  });

  it('accepts every declared member of every enum', () => {
    for (const [name, schema] of zodEnums) {
      for (const option of schema.options) {
        expect(schema.safeParse(option).success, `${name}.${option}`).toBe(true);
      }
    }
  });
});

describe('the label maps', () => {
  /**
   * A label map with a hole renders `undefined` in the UI. TypeScript's
   * `Record<Enum, string>` catches a *missing* key at compile time but not a
   * stale one left behind after a member is renamed, and neither shows up in a
   * diff — so both directions are checked here.
   */
  const maps: [string, Record<string, string>, readonly string[]][] = [
    ['FUEL_LABELS', enums.FUEL_LABELS, enums.FuelType.options],
    ['TRANSMISSION_LABELS', enums.TRANSMISSION_LABELS, enums.Transmission.options],
    ['BODY_TYPE_LABELS', enums.BODY_TYPE_LABELS, enums.BodyType.options],
    ['DISPLAY_STATUS_LABELS', enums.DISPLAY_STATUS_LABELS, enums.DisplayStatus.options],
    ['DEALER_STATUS_LABELS', enums.DEALER_STATUS_LABELS, enums.DealerStatus.options],
  ];

  it.each(maps)('%s has an entry for every member and no extras', (_name, map, options) => {
    expect(Object.keys(map).sort()).toEqual([...options].sort());
  });

  it.each(maps)('%s labels every member with a non-empty string', (_name, map) => {
    for (const [key, label] of Object.entries(map)) {
      expect(label, key).toBeTruthy();
      expect(typeof label, key).toBe('string');
    }
  });

  /** DESIGN-SPEC §4.13: sentence case, so a badge never shouts at a dealer. */
  it.each(maps)('%s writes labels in sentence case, not SCREAMING_SNAKE', (_name, map) => {
    for (const [key, label] of Object.entries(map)) {
      expect(label, key).not.toContain('_');
      if (label.length > 4) expect(label, key).not.toBe(label.toUpperCase());
    }
  });

  it('gives every display status a badge tone', () => {
    expect(Object.keys(enums.DISPLAY_STATUS_TONES).sort()).toEqual(
      [...enums.DisplayStatus.options].sort(),
    );
  });

  it('gives every dealer status a badge tone', () => {
    expect(Object.keys(enums.DEALER_STATUS_TONES).sort()).toEqual(
      [...enums.DealerStatus.options].sort(),
    );
  });

  /** A tone outside the palette has no CSS class behind it and renders unstyled. */
  it('uses only tones the palette defines', () => {
    const palette = new Set<string>(enums.StatusTone.options);

    for (const tones of [enums.DISPLAY_STATUS_TONES, enums.DEALER_STATUS_TONES]) {
      for (const [key, tone] of Object.entries(tones)) {
        expect(palette.has(tone), `${key} → ${tone}`).toBe(true);
      }
    }
  });

  /** The colour carries meaning: a rejection must not read as a success. */
  it('tones a rejection as an error and an active listing as ok', () => {
    expect(enums.DISPLAY_STATUS_TONES.REJECTED).toBe('err');
    expect(enums.DISPLAY_STATUS_TONES.ACTIVE).toBe('ok');
    expect(enums.DISPLAY_STATUS_TONES.PENDING).toBe('warn');
  });
});

describe('ownerLabel', () => {
  /**
   * "1st owner" reads badly in a spec table, so the product spells the common
   * cases out. Five words cover essentially every used car on the site; past
   * that the ordinal suffix is a fallback nobody sees, not a formatting rule —
   * which is why it is `6th` and not a real ordinal function.
   */
  it.each([
    [1, 'First owner'],
    [2, 'Second owner'],
    [3, 'Third owner'],
    [4, 'Fourth owner'],
    [5, 'Fifth owner'],
  ])('renders %i as "%s"', (n, expected) => {
    expect(enums.ownerLabel(n)).toBe(expected);
  });

  it('falls back to an ordinal past the spelled-out range', () => {
    expect(enums.ownerLabel(6)).toBe('6th owner');
    expect(enums.ownerLabel(9)).toBe('9th owner');
  });

  it('never renders an empty word for a real owner count', () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(enums.ownerLabel(n), String(n)).not.toBe(' owner');
    }
  });
});
