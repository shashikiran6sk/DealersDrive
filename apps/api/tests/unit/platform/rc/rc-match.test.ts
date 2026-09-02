import { describe, expect, it } from 'vitest';

import type { RcSpecs } from '../../../../src/platform/rc/rc.port.js';
import {
  rankVariants,
  resolveColourFamily,
  resolveFuel,
  resolveMake,
  resolveModel,
  resolveYear,
  rtoCodeFromPlate,
  type CatalogMakeRow,
} from '../../../../src/platform/rc/rc-match.js';

/**
 * The resolver, against the strings VAHAN actually returns.
 *
 * This is the highest-value file in the RC feature. Everything else has a
 * fallback — a provider outage drops the dealer onto the manual form, a
 * missing report renders as "unavailable" — but a resolver that quietly maps
 * `SWIFT DZIRE VDI` onto `Swift` produces a *published listing* with the wrong
 * car in the title, and nothing downstream re-checks it.
 *
 * Written as a fixture table rather than prose because the interesting cases
 * are all data: the manufacturer that never names its brand, the ampersand,
 * the model whose name is a prefix of another model's.
 */
const MAKES: CatalogMakeRow[] = [
  {
    id: 'mk-maruti',
    slug: 'maruti-suzuki',
    name: 'Maruti Suzuki',
    models: [
      {
        id: 'md-swift',
        slug: 'swift',
        name: 'Swift',
        bodyType: 'HATCHBACK',
        yearFrom: 2005,
        yearTo: null,
      },
      {
        id: 'md-dzire',
        slug: 'swift-dzire',
        name: 'Swift Dzire',
        bodyType: 'SEDAN',
        yearFrom: 2008,
        yearTo: 2017,
      },
      {
        id: 'md-baleno',
        slug: 'baleno',
        name: 'Baleno',
        bodyType: 'HATCHBACK',
        yearFrom: 2015,
        yearTo: null,
      },
      {
        id: 'md-alto',
        slug: 'alto-800',
        name: 'Alto 800',
        bodyType: 'HATCHBACK',
        yearFrom: 2012,
        yearTo: 2022,
      },
    ],
  },
  {
    id: 'mk-hyundai',
    slug: 'hyundai',
    name: 'Hyundai',
    models: [
      {
        id: 'md-i20',
        slug: 'i20',
        name: 'i20',
        bodyType: 'HATCHBACK',
        yearFrom: 2008,
        yearTo: null,
      },
      {
        id: 'md-i20-active',
        slug: 'i20-active',
        name: 'i20 Active',
        bodyType: 'HATCHBACK',
        yearFrom: 2015,
        yearTo: 2020,
      },
      {
        id: 'md-creta',
        slug: 'creta',
        name: 'Creta',
        bodyType: 'SUV',
        yearFrom: 2015,
        yearTo: null,
      },
    ],
  },
  {
    id: 'mk-mahindra',
    slug: 'mahindra',
    name: 'Mahindra',
    models: [
      {
        id: 'md-xuv500',
        slug: 'xuv500',
        name: 'XUV500',
        bodyType: 'SUV',
        yearFrom: 2011,
        yearTo: 2021,
      },
    ],
  },
  {
    id: 'mk-chevrolet',
    slug: 'chevrolet',
    name: 'Chevrolet',
    models: [
      {
        id: 'md-beat',
        slug: 'beat',
        name: 'Beat',
        bodyType: 'HATCHBACK',
        yearFrom: 2010,
        yearTo: 2019,
      },
    ],
  },
  {
    id: 'mk-jaguar',
    slug: 'jaguar',
    name: 'Jaguar',
    models: [
      { id: 'md-xf', slug: 'xf', name: 'XF', bodyType: 'LUXURY', yearFrom: 2009, yearTo: null },
    ],
  },
  {
    id: 'mk-land-rover',
    slug: 'land-rover',
    name: 'Land Rover',
    models: [
      {
        id: 'md-discovery',
        slug: 'discovery',
        name: 'Discovery',
        bodyType: 'SUV',
        yearFrom: 2010,
        yearTo: null,
      },
    ],
  },
  { id: 'mk-toyota', slug: 'toyota', name: 'Toyota', models: [] },
  { id: 'mk-volvo', slug: 'volvo', name: 'Volvo', models: [] },
];

const specs = (over: Partial<RcSpecs> = {}): RcSpecs => ({
  makerDescription: null,
  makerModel: null,
  makerVariant: null,
  fuelType: null,
  colorType: null,
  cubicCapacity: null,
  seatingCapacity: null,
  normsType: null,
  ownerNumber: null,
  manufacturedOn: null,
  registeredOn: null,
  rtoName: null,
  ...over,
});

describe('the make', () => {
  const cases: [string, string | null][] = [
    // The spellings that differ only in corporate scaffolding. State RTOs use
    // `LTD` and `LIMITED` interchangeably for the same company.
    ['MARUTI SUZUKI INDIA LTD', 'mk-maruti'],
    ['MARUTI SUZUKI INDIA LIMITED', 'mk-maruti'],
    // Maruti's pre-2007 name. Every Alto and Zen of that era still carries it,
    // and those are exactly the cars a used-car yard holds.
    ['MARUTI UDYOG LTD', 'mk-maruti'],
    ['HYUNDAI MOTOR INDIA LTD', 'mk-hyundai'],

    // The ampersand. `&` becomes ` AND ` before punctuation is stripped, so
    // `M&M` survives as two words rather than collapsing to `MM`.
    ['MAHINDRA & MAHINDRA LTD', 'mk-mahindra'],
    ['MAHINDRA AND MAHINDRA LIMITED', 'mk-mahindra'],
    ['M&M LTD', 'mk-mahindra'],

    // The single clearest argument for the alias table existing: the brand is
    // Chevrolet and the manufacturer string never says so.
    ['GENERAL MOTORS INDIA PVT LTD', 'mk-chevrolet'],

    // No alias row — resolved by finding the brand name inside the string.
    ['VOLVO AUTO INDIA PVT LTD', 'mk-volvo'],

    // Genuinely unknown. Must be null, not a nearest guess: a wrong make
    // scopes every downstream field wrongly.
    ['SOME UNLISTED IMPORTER LLP', null],
    ['', null],
  ];

  for (const [input, expected] of cases) {
    it(`resolves ${input || '(empty)'}`, () => {
      const result = resolveMake(specs({ makerDescription: input }), MAKES);
      expect(result.value).toBe(expected);
    });
  }

  it('never guesses when the manufacturer builds for several brands', () => {
    // Jaguar Land Rover India builds both. The maker string cannot decide it.
    const undecidable = resolveMake(
      specs({ makerDescription: 'JAGUAR LAND ROVER INDIA LTD' }),
      MAKES,
    );

    expect(undecidable.value).toBeNull();
    expect(undecidable.confidence).toBe('NONE');
    // But it offers the two rather than leaving the dealer with nothing.
    expect(undecidable.candidates.map((row) => row.id).sort()).toEqual([
      'mk-jaguar',
      'mk-land-rover',
    ]);
  });

  it('lets the model decide a shared manufacturer', () => {
    const jaguar = resolveMake(
      specs({ makerDescription: 'JAGUAR LAND ROVER INDIA LTD', makerModel: 'XF 2.2' }),
      MAKES,
    );
    expect(jaguar.value).toBe('mk-jaguar');
    // LIKELY, not EXACT — it was inferred, and the dealer should glance at it.
    expect(jaguar.confidence).toBe('LIKELY');

    const landRover = resolveMake(
      specs({ makerDescription: 'JAGUAR LAND ROVER INDIA LTD', makerModel: 'DISCOVERY SPORT' }),
      MAKES,
    );
    expect(landRover.value).toBe('mk-land-rover');
  });

  it('retries the alias table with the corporate scaffolding removed', async () => {
    // `MAHINDRA AND MAHINDRA` is listed; `MAHINDRA & MAHINDRA PVT LTD` is what
    // one state actually prints. Stripping `PVT` and `LTD` turns the second
    // into the first, and it is still an exact match — the alias table decided
    // it, not a guess.
    const result = resolveMake(specs({ makerDescription: 'MAHINDRA & MAHINDRA PVT LTD' }), MAKES);

    expect(result).toMatchObject({ value: 'mk-mahindra', confidence: 'EXACT' });
  });

  it('falls back to the brand name appearing in the string, marked LIKELY', async () => {
    // No alias row for this spelling. The brand name is in there, so it
    // resolves — but as LIKELY, because a substring match is an inference and
    // the dealer should glance at it.
    const result = resolveMake(specs({ makerDescription: 'VOLVO SVERIGE AB' }), MAKES);

    expect(result).toMatchObject({ value: 'mk-volvo', confidence: 'LIKELY' });
  });

  it('gives up rather than guessing when nothing matches', async () => {
    const result = resolveMake(specs({ makerDescription: 'SOME COACHBUILDER LLP' }), MAKES);

    expect(result).toMatchObject({ value: null, confidence: 'NONE', candidates: [] });
  });
});

describe('the model', () => {
  const maruti = MAKES[0] as CatalogMakeRow;
  const hyundai = MAKES[1] as CatalogMakeRow;

  it('prefers the longest match, so a Dzire is not a Swift', () => {
    // The case that breaks naive matching. VAHAN runs model and trim together
    // with no separator, and `Swift` is a prefix of `Swift Dzire`.
    const dzire = resolveModel('SWIFT DZIRE VDI', maruti.models, 2014);
    expect(dzire.value).toBe('md-dzire');

    const swift = resolveModel('SWIFT VXI', maruti.models, 2014);
    expect(swift.value).toBe('md-swift');
  });

  it('does the same for i20 and i20 Active', () => {
    expect(resolveModel('I20 ACTIVE SX', hyundai.models, 2017).value).toBe('md-i20-active');
    expect(resolveModel('I20 ASTA', hyundai.models, 2017).value).toBe('md-i20');
  });

  it('matches a model whose name carries digits', () => {
    const mahindra = MAKES[2] as CatalogMakeRow;
    expect(resolveModel('XUV500 W8', mahindra.models, 2015).value).toBe('md-xuv500');
  });

  it('breaks a tie on the production window', () => {
    // A Dzire was not sold in 2022; the Swift was. Year decides.
    const result = resolveModel('SWIFT', maruti.models, 2022);
    expect(result.value).toBe('md-swift');
  });

  it('does not match on a trailing token', () => {
    // `DZIRE` alone must not reach `Swift Dzire` — the catalogue name has to
    // start where the RC string starts, or every model matches everything.
    expect(resolveModel('VDI DZIRE', maruti.models, 2014).value).not.toBe('md-dzire');
  });

  it('returns nothing for a model the catalogue does not carry', () => {
    const result = resolveModel('FRONX DELTA', maruti.models, 2023);
    expect(result.value).toBeNull();
    expect(result.confidence).toBe('NONE');
  });
});

describe('the variant', () => {
  const VARIANTS = [
    {
      id: 'vr-lxi',
      name: 'LXi',
      fuel: 'PETROL' as const,
      transmission: 'MANUAL',
      engineCc: 1197,
      seats: 5,
    },
    {
      id: 'vr-vxi',
      name: 'VXi',
      fuel: 'PETROL' as const,
      transmission: 'MANUAL',
      engineCc: 1197,
      seats: 5,
    },
    {
      id: 'vr-vdi',
      name: 'VDi',
      fuel: 'DIESEL' as const,
      transmission: 'MANUAL',
      engineCc: 1248,
      seats: 5,
    },
  ];

  it('never resolves a value, however good the match', () => {
    const result = rankVariants(
      specs({ makerModel: 'SWIFT VXI', fuelType: 'PETROL', cubicCapacity: 1197 }),
      'Swift',
      VARIANTS,
    );

    // A deliberate refusal to guess. `SWIFT VXI` could be a VXi, a VXi (O) or
    // a VXi AMT — a lakh apart — and the RC string cannot tell them apart.
    expect(result.value).toBeNull();
    expect(result.confidence).toBe('NONE');

    // It still puts the right one first.
    expect(result.candidates[0]?.id).toBe('vr-vxi');
  });

  it('rules out variants the engine size contradicts', () => {
    const result = rankVariants(
      specs({ makerModel: 'SWIFT VDI', fuelType: 'DIESEL', cubicCapacity: 1248 }),
      'Swift',
      VARIANTS,
    );
    expect(result.candidates.map((row) => row.id)).toEqual(['vr-vdi']);
  });

  it('falls back to every variant rather than offering none', () => {
    // An engine size that matches nothing. An empty dropdown would strand the
    // dealer on a mandatory field; the full list is worse than a filtered one
    // and far better than nothing.
    const result = rankVariants(
      specs({ makerModel: 'SWIFT', fuelType: 'PETROL', cubicCapacity: 9999 }),
      'Swift',
      VARIANTS,
    );
    expect(result.candidates.length).toBe(3);
  });
});

describe('the scalars', () => {
  it('reads a factory CNG car as CNG, not petrol', () => {
    // The fuel that changes the running cost wins over the one listed first —
    // a buyer filtering for CNG must find this car.
    expect(resolveFuel(specs({ fuelType: 'PETROL/CNG' }))).toBe('CNG');
    expect(resolveFuel(specs({ fuelType: 'PETROL' }))).toBe('PETROL');
    expect(resolveFuel(specs({ fuelType: 'SOMETHING NEW' }))).toBeNull();
  });

  it('prefers the manufacture year over the registration year', () => {
    // Built December 2019, registered January 2020: a 2019 model to every
    // buyer and every price guide.
    const result = resolveYear(
      specs({
        manufacturedOn: '2019-12-11T00:00:00.000Z',
        registeredOn: '2020-01-07T00:00:00.000Z',
      }),
    );
    expect(result.value).toBe(2019);
    expect(result.confidence).toBe('EXACT');
  });

  it('falls back to the registration year, but says it is only likely', () => {
    const result = resolveYear(specs({ registeredOn: '2020-01-07T00:00:00.000Z' }));
    expect(result.value).toBe(2020);
    expect(result.confidence).toBe('LIKELY');
  });

  it('resolves colour to a family, never a shade', () => {
    expect(resolveColourFamily(specs({ colorType: 'WHITE' }))).toBe('white');
    expect(resolveColourFamily(specs({ colorType: 'PEARL WHITE' }))).toBe('white');
    // Not in the seeded families. Null is correct — the dealer picks.
    expect(resolveColourFamily(specs({ colorType: 'ORANGE' }))).toBeNull();
  });

  it('derives the RTO code from the plate, not the provider', () => {
    expect(rtoCodeFromPlate('TN09BX1234')).toBe('TN-09');
    // Single-digit districts are padded, because the catalogue stores TN-09.
    expect(rtoCodeFromPlate('TN9BX1234')).toBe('TN-09');
    expect(rtoCodeFromPlate('KA51MH2020')).toBe('KA-51');
    // BH-series marks are national rather than state-issued and have no RTO.
    expect(rtoCodeFromPlate('24BH1234AB')).toBeNull();
  });
});

describe('the year, when the certificate carries none', () => {
  /**
   * Both dates absent is not a malformed response — it is an old record that
   * was digitised without them. The resolver has to say "I do not know" rather
   * than fall back to the current year, which would be a plausible, wrong
   * number sitting pre-filled in the form the dealer is about to publish.
   */
  it('resolves to nothing rather than to a plausible guess', () => {
    const result = resolveYear(specs({ manufacturedOn: null, registeredOn: null }));

    expect(result).toMatchObject({ value: null, name: null, confidence: 'NONE' });
  });

  it('ignores a date outside the range a car can have been made in', () => {
    // `1900` and `2099` both appear in real records as placeholder values.
    const result = resolveYear(specs({ manufacturedOn: '1900-01-01', registeredOn: '2099-01-01' }));

    expect(result.value).toBeNull();
  });
});
