import { createHash } from 'node:crypto';

import {
  RcLookupError,
  type ChallanRecord,
  type RcLookupPort,
  type RcLookupResult,
} from './rc.port.js';

/**
 * The RC provider for `pnpm dev`, the test suite, and every demo.
 *
 * Selected by `RC_LOOKUP_DRIVER=mock`, which is the default everywhere but
 * production. This is not a stub that returns one canned car: the whole intake
 * flow, the resolver, the report, the blacklist blocker and every failure
 * branch have to be exercisable without an Attestr account and without
 * spending money per keystroke. A developer who cannot reach the interesting
 * branches locally will not test them.
 *
 * ## Deterministic, not random
 *
 * The same plate always yields the same car. A random mock makes a failing
 * test unreproducible and makes a screenshot in a bug report meaningless.
 * Everything is derived from a SHA-256 of the registration.
 *
 * ## Reserved plates
 *
 * The interesting branches are addressable rather than luck:
 *
 *   `TN01AA0000`  → NOT_FOUND      — the manual-entry fallback
 *   `TN01AA9999`  → UNAVAILABLE    — provider outage
 *   `TN01BL0001`  → BLACKLISTED    — the submission blocker
 *   `TN01NC0001`  → NOC_ISSUED     — the amber advisory
 *   `TN01CH0001`  → three challans, two unpaid, one in court
 *   `TN01NF0001`  → RC found, challan feed silent (`challansAvailable: false`)
 *   `TN01ZZ0001`  → a maker string absent from the catalogue
 *
 * The last two matter most. They are the cases a real provider produces on a
 * bad day and the ones a hand-written happy-path mock never covers — and
 * "records unavailable" rendering as "no challans" is the worst bug this
 * feature can ship.
 */
const CARS = [
  { maker: 'MARUTI SUZUKI INDIA LTD', model: 'SWIFT VXI', fuel: 'PETROL', cc: 1197, seats: 5 },
  { maker: 'MARUTI SUZUKI INDIA LTD', model: 'BALENO ZETA', fuel: 'PETROL', cc: 1197, seats: 5 },
  { maker: 'HYUNDAI MOTOR INDIA LTD', model: 'I20 ASTA', fuel: 'PETROL', cc: 1197, seats: 5 },
  { maker: 'HYUNDAI MOTOR INDIA LIMITED', model: 'CRETA SX', fuel: 'DIESEL', cc: 1493, seats: 5 },
  { maker: 'TATA MOTORS LTD', model: 'NEXON XZ PLUS', fuel: 'PETROL', cc: 1199, seats: 5 },
  { maker: 'MAHINDRA & MAHINDRA LIMITED', model: 'XUV500 W8', fuel: 'DIESEL', cc: 2179, seats: 7 },
  {
    maker: 'TOYOTA KIRLOSKAR MOTOR PVT LTD',
    model: 'INNOVA CRYSTA GX',
    fuel: 'DIESEL',
    cc: 2393,
    seats: 7,
  },
  { maker: 'HONDA CARS INDIA LTD', model: 'CITY VX', fuel: 'PETROL', cc: 1497, seats: 5 },
  {
    maker: 'KIA INDIA PRIVATE LIMITED',
    model: 'SELTOS HTK PLUS',
    fuel: 'PETROL',
    cc: 1497,
    seats: 5,
  },
  { maker: 'RENAULT INDIA PVT LTD', model: 'KWID RXT', fuel: 'PETROL', cc: 999, seats: 5 },
] as const;

const COLOURS = ['WHITE', 'SILVER', 'GREY', 'RED', 'BLUE', 'BLACK'] as const;

export function createMockRcLookup(): RcLookupPort {
  return {
    provider: 'mock',

    async lookup(registrationNumber: string): Promise<RcLookupResult> {
      await Promise.resolve();
      const reg = registrationNumber.toUpperCase();

      if (reg.endsWith('0000')) {
        throw new RcLookupError(
          'NOT_FOUND',
          'No registration certificate is on record for that number.',
        );
      }
      if (reg.endsWith('9999')) {
        throw new RcLookupError('UNAVAILABLE', 'The vehicle records service is not responding.');
      }

      const seed = createHash('sha256').update(reg).digest();
      const pick = <T>(rows: readonly T[], byte: number): T =>
        rows[(seed[byte] ?? 0) % rows.length] as T;

      const car = reg.includes('ZZ')
        ? // A maker the catalogue does not carry. The lookup succeeds and the
          // records are real; only the taxonomy match fails, which is exactly
          // how a genuinely unlisted import behaves.
          {
            maker: 'FORCE MOTORS LIMITED',
            model: 'TRAVELLER 3350',
            fuel: 'DIESEL',
            cc: 2596,
            seats: 13,
          }
        : pick(CARS, 0);

      // 4 to 15 years old — the range a Tamil Nadu yard actually holds.
      const year = 2011 + ((seed[1] ?? 0) % 15);

      const blacklisted = reg.includes('BL');
      const nocIssued = reg.includes('NC');
      const challanFeedSilent = reg.includes('NF');
      const hasChallans = reg.includes('CH');

      return {
        specs: {
          makerDescription: car.maker,
          makerModel: car.model,
          makerVariant: null,
          fuelType: car.fuel,
          colorType: pick(COLOURS, 2),
          cubicCapacity: car.cc,
          seatingCapacity: car.seats,
          normsType: year >= 2020 ? 'BHARAT STAGE VI' : 'BHARAT STAGE IV',
          // 1–3 owners. Never 0, which is not a thing.
          ownerNumber: 1 + ((seed[3] ?? 0) % 3),
          manufacturedOn: new Date(Date.UTC(year, (seed[4] ?? 0) % 12, 12)).toISOString(),
          registeredOn: new Date(Date.UTC(year, (seed[4] ?? 0) % 12, 26)).toISOString(),
          rtoName: 'VELLORE',
        },
        records: {
          rcStatus: nocIssued ? 'NOC ISSUED' : 'ACTIVE',
          blacklistStatus: blacklisted ? 'BLACKLISTED' : nocIssued ? 'NOC_ISSUED' : 'CLEAR',
          blacklistReasons: blacklisted ? ['Reported stolen — Tamil Nadu Police, 14 Jan 2025'] : [],
          nocIssuedTo: nocIssued ? 'Karnataka' : null,
          challansAvailable: !challanFeedSilent,
          challans: challanFeedSilent || !hasChallans ? [] : MOCK_CHALLANS,
          financed: (seed[5] ?? 0) % 4 === 0,
          insuranceUpto: inMonths(11),
          fitnessUpto: inMonths(26),
          pucUpto: inMonths(5),
          taxUpto: inMonths(38),
        },
      };
    },
  };
}

const MOCK_CHALLANS: ChallanRecord[] = [
  {
    challanRef: '4417',
    offenceDate: '2025-11-03T00:00:00.000Z',
    offence: 'Over-speeding',
    amountPaise: 100000,
    status: 'UNPAID',
    court: false,
  },
  {
    challanRef: '8820',
    offenceDate: '2025-06-19T00:00:00.000Z',
    offence: 'Driving without seat belt',
    amountPaise: 100000,
    status: 'UNPAID',
    court: false,
  },
  {
    challanRef: '1043',
    offenceDate: '2024-09-02T00:00:00.000Z',
    offence: 'Signal jumping',
    amountPaise: 50000,
    status: 'DISPOSED',
    court: true,
  },
];

/**
 * A validity date `months` out, anchored to UTC midnight today.
 *
 * Midnight rather than `now` so the adapter is genuinely deterministic: two
 * lookups of the same plate a millisecond apart have to return byte-identical
 * results, or every consumer that memoises or diffs a lookup behaves
 * differently in development from the way it behaves against a real provider,
 * whose dates do not move while you refresh the page.
 */
function inMonths(months: number): string {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate()),
  );
  return date.toISOString();
}
