/**
 * Three hundred and twenty cars for the hundred and twenty dev dealerships, for
 * local development only — so the marketplace search (F076) and its filter
 * panel have something worth filtering.
 *
 *     pnpm db:seed:dev                  dealerships, then these cars
 *     pnpm db:seed:vehicles:dev         only the cars (the dealerships must exist)
 *
 * ── Generated, not typed ────────────────────────────────────────────────────
 * Three hundred literal rows would be unreadable and unreviewable, and every
 * one of them a chance to write "Hyundai Swift". So this file holds the
 * **reference data** — a catalogue of real brand/model pairs, each with the
 * body, fuels, gearboxes, trims, price band and model years that belong to it
 * — and one pure function, `generateDevVehicles`, that deals cars out of it.
 * A brand can only ever be paired with its own models, because a car is always
 * drawn from inside one catalogue entry.
 *
 * ── Deterministic ───────────────────────────────────────────────────────────
 * The randomness is `mulberry32` from a fixed seed, and every date hangs off a
 * fixed anchor rather than `new Date()`. Two runs produce identical rows,
 * including ids, registrations and slugs — which is what lets the writer
 * upsert by id instead of appending three hundred more cars on every run, and
 * what keeps a test over this file from ever being flaky.
 *
 * ── Distribution ────────────────────────────────────────────────────────────
 * Every dev dealership gets at least one car, Tamil Nadu's get more, and the
 * cars are spread across twelve districts, forty-four towns, twelve brands,
 * every fuel, gearbox, body type, owner bucket and price band — so each facet
 * in the filter panel has several values with real counts behind them. About
 * one car in seven is in a non-public state (draft, in review, sent back,
 * rejected, sold, removed), so the public queries have something to exclude.
 *
 * ── No photographs ──────────────────────────────────────────────────────────
 * No media rows, no uploads, no invented image URLs. The card and the vehicle
 * page already draw a labelled slot for a car with no photograph, and that is
 * exactly what these render. Approval normally requires photographs; these
 * rows are written straight to the database and never go through it.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { createHash } from 'node:crypto';

import { slugify } from '@dealers-drive/contracts';

import type { DevDealerRow } from './dev-dealers.data.js';

type Fuel = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC' | 'HYBRID';
type Gearbox = 'MANUAL' | 'AUTOMATIC';
type Body = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'MUV' | 'LUXURY';

export type DevListingStatus =
  'DRAFT' | 'PENDING_REVIEW' | 'CHANGES_REQUESTED' | 'ACTIVE' | 'REJECTED' | 'SOLD' | 'REMOVED';

interface CatalogModel {
  model: string;
  body: Body;
  fuels: readonly Fuel[];
  gearboxes: readonly Gearbox[];
  variants: readonly string[];
  /** New-car price band, in lakh, which the used price is depreciated from. */
  lakh: readonly [number, number];
  years: readonly [number, number];
}

interface CatalogBrand {
  make: string;
  /** Relative share of the used-car market the seed deals from. */
  weight: number;
  models: readonly CatalogModel[];
}

const P = ['PETROL'] as const;
const PD = ['PETROL', 'DIESEL'] as const;
const PC = ['PETROL', 'CNG'] as const;
const M = ['MANUAL'] as const;
const MA = ['MANUAL', 'AUTOMATIC'] as const;
const A = ['AUTOMATIC'] as const;

/** Real pairs only. A model appears under exactly one brand. */
export const VEHICLE_CATALOG: readonly CatalogBrand[] = [
  {
    make: 'Maruti Suzuki',
    weight: 26,
    models: [
      {
        model: 'Swift',
        body: 'HATCHBACK',
        fuels: PC,
        gearboxes: MA,
        variants: ['LXi', 'VXi', 'ZXi', 'ZXi+'],
        lakh: [6, 9],
        years: [2015, 2024],
      },
      {
        model: 'Baleno',
        body: 'HATCHBACK',
        fuels: PC,
        gearboxes: MA,
        variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'],
        lakh: [6.5, 9.8],
        years: [2016, 2024],
      },
      {
        model: 'Dzire',
        body: 'SEDAN',
        fuels: PC,
        gearboxes: MA,
        variants: ['LXi', 'VXi', 'ZXi', 'ZXi+'],
        lakh: [6.5, 9.5],
        years: [2015, 2024],
      },
      {
        model: 'Brezza',
        body: 'SUV',
        fuels: PC,
        gearboxes: MA,
        variants: ['LXi', 'VXi', 'ZXi', 'ZXi+'],
        lakh: [8.3, 14],
        years: [2017, 2024],
      },
      {
        model: 'Ertiga',
        body: 'MUV',
        fuels: PC,
        gearboxes: MA,
        variants: ['LXi', 'VXi', 'ZXi'],
        lakh: [8.6, 13],
        years: [2016, 2024],
      },
      {
        model: 'Wagon R',
        body: 'HATCHBACK',
        fuels: PC,
        gearboxes: M,
        variants: ['LXi', 'VXi', 'ZXi'],
        lakh: [5.5, 7.3],
        years: [2014, 2024],
      },
    ],
  },
  {
    make: 'Hyundai',
    weight: 18,
    models: [
      {
        model: 'Creta',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['E', 'S', 'SX', 'SX(O)'],
        lakh: [11, 20],
        years: [2016, 2024],
      },
      {
        model: 'Venue',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['E', 'S', 'SX', 'SX(O)'],
        lakh: [7.9, 13.5],
        years: [2019, 2024],
      },
      {
        model: 'i20',
        body: 'HATCHBACK',
        fuels: P,
        gearboxes: MA,
        variants: ['Magna', 'Sportz', 'Asta', 'Asta(O)'],
        lakh: [7, 11.2],
        years: [2015, 2024],
      },
      {
        model: 'Verna',
        body: 'SEDAN',
        fuels: PD,
        gearboxes: MA,
        variants: ['EX', 'S', 'SX', 'SX(O)'],
        lakh: [10.9, 17.4],
        years: [2016, 2024],
      },
      {
        model: 'Grand i10 Nios',
        body: 'HATCHBACK',
        fuels: PC,
        gearboxes: MA,
        variants: ['Era', 'Magna', 'Sportz', 'Asta'],
        lakh: [5.9, 8.5],
        years: [2019, 2024],
      },
      {
        model: 'Alcazar',
        body: 'MUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['Prestige', 'Platinum', 'Signature'],
        lakh: [16.8, 21],
        years: [2021, 2024],
      },
    ],
  },
  {
    make: 'Tata',
    weight: 13,
    models: [
      {
        model: 'Nexon',
        body: 'SUV',
        fuels: ['PETROL', 'DIESEL', 'ELECTRIC'],
        gearboxes: MA,
        variants: ['Smart', 'Pure', 'Creative', 'Fearless'],
        lakh: [8, 15.5],
        years: [2018, 2024],
      },
      {
        model: 'Punch',
        body: 'SUV',
        fuels: PC,
        gearboxes: MA,
        variants: ['Pure', 'Adventure', 'Accomplished', 'Creative'],
        lakh: [6, 10],
        years: [2021, 2024],
      },
      {
        model: 'Altroz',
        body: 'HATCHBACK',
        fuels: ['PETROL', 'DIESEL', 'CNG'],
        gearboxes: MA,
        variants: ['XE', 'XM', 'XZ', 'XZ+'],
        lakh: [6.6, 10.7],
        years: [2020, 2024],
      },
      {
        model: 'Harrier',
        body: 'SUV',
        fuels: ['DIESEL'],
        gearboxes: MA,
        variants: ['Smart', 'Pure', 'Adventure', 'Fearless'],
        lakh: [15, 26],
        years: [2019, 2024],
      },
      {
        model: 'Tiago',
        body: 'HATCHBACK',
        fuels: ['PETROL', 'CNG', 'ELECTRIC'],
        gearboxes: MA,
        variants: ['XE', 'XM', 'XT', 'XZ+'],
        lakh: [5, 8.5],
        years: [2016, 2024],
      },
    ],
  },
  {
    make: 'Mahindra',
    weight: 10,
    models: [
      {
        model: 'XUV 3XO',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['MX1', 'MX3', 'AX5', 'AX7'],
        lakh: [7.8, 15],
        years: [2024, 2024],
      },
      {
        model: 'XUV300',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['W4', 'W6', 'W8', 'W8(O)'],
        lakh: [8, 14],
        years: [2019, 2023],
      },
      {
        model: 'XUV700',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['MX', 'AX3', 'AX5', 'AX7'],
        lakh: [14, 26],
        years: [2021, 2024],
      },
      {
        model: 'Scorpio-N',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['Z2', 'Z4', 'Z6', 'Z8'],
        lakh: [13.5, 24],
        years: [2022, 2024],
      },
      {
        model: 'Thar',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['AX(O)', 'LX'],
        lakh: [11.3, 17.6],
        years: [2020, 2024],
      },
      {
        model: 'Bolero Neo',
        body: 'SUV',
        fuels: ['DIESEL'],
        gearboxes: M,
        variants: ['N4', 'N8', 'N10'],
        lakh: [9.9, 12],
        years: [2021, 2024],
      },
    ],
  },
  {
    make: 'Honda',
    weight: 7,
    models: [
      {
        model: 'City',
        body: 'SEDAN',
        fuels: ['PETROL', 'HYBRID'],
        gearboxes: MA,
        variants: ['SV', 'V', 'VX', 'ZX'],
        lakh: [11.8, 16.3],
        years: [2015, 2024],
      },
      {
        model: 'Amaze',
        body: 'SEDAN',
        fuels: PD,
        gearboxes: MA,
        variants: ['E', 'S', 'V', 'VX'],
        lakh: [7.1, 9.9],
        years: [2016, 2024],
      },
      {
        model: 'Jazz',
        body: 'HATCHBACK',
        fuels: P,
        gearboxes: MA,
        variants: ['V', 'VX', 'ZX'],
        lakh: [7.5, 9.8],
        years: [2015, 2023],
      },
      {
        model: 'Elevate',
        body: 'SUV',
        fuels: P,
        gearboxes: MA,
        variants: ['SV', 'V', 'VX', 'ZX'],
        lakh: [11.6, 16.5],
        years: [2023, 2024],
      },
    ],
  },
  {
    make: 'Toyota',
    weight: 7,
    models: [
      {
        model: 'Innova Crysta',
        body: 'MUV',
        fuels: ['DIESEL'],
        gearboxes: MA,
        variants: ['GX', 'VX', 'ZX'],
        lakh: [19.9, 26.3],
        years: [2016, 2024],
      },
      {
        model: 'Glanza',
        body: 'HATCHBACK',
        fuels: PC,
        gearboxes: MA,
        variants: ['E', 'S', 'G', 'V'],
        lakh: [6.9, 10],
        years: [2019, 2024],
      },
      {
        model: 'Urban Cruiser Hyryder',
        body: 'SUV',
        fuels: ['PETROL', 'HYBRID', 'CNG'],
        gearboxes: MA,
        variants: ['E', 'S', 'G', 'V'],
        lakh: [11.1, 20],
        years: [2022, 2024],
      },
      {
        model: 'Fortuner',
        body: 'LUXURY',
        fuels: PD,
        gearboxes: A,
        variants: ['4x2', '4x4', 'Legender'],
        lakh: [33, 51],
        years: [2016, 2024],
      },
    ],
  },
  {
    make: 'Kia',
    weight: 7,
    models: [
      {
        model: 'Seltos',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['HTE', 'HTK', 'HTX', 'GTX+'],
        lakh: [11, 20],
        years: [2019, 2024],
      },
      {
        model: 'Sonet',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['HTE', 'HTK', 'HTX', 'GTX+'],
        lakh: [8, 15.7],
        years: [2020, 2024],
      },
      {
        model: 'Carens',
        body: 'MUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['Premium', 'Prestige', 'Luxury'],
        lakh: [10.5, 19.7],
        years: [2022, 2024],
      },
    ],
  },
  {
    make: 'Renault',
    weight: 4,
    models: [
      {
        model: 'Kwid',
        body: 'HATCHBACK',
        fuels: P,
        gearboxes: MA,
        variants: ['RXE', 'RXL', 'RXT', 'Climber'],
        lakh: [4.7, 6.5],
        years: [2016, 2024],
      },
      {
        model: 'Kiger',
        body: 'SUV',
        fuels: P,
        gearboxes: MA,
        variants: ['RXE', 'RXL', 'RXT', 'RXZ'],
        lakh: [6, 11.2],
        years: [2021, 2024],
      },
      {
        model: 'Triber',
        body: 'MUV',
        fuels: P,
        gearboxes: MA,
        variants: ['RXE', 'RXL', 'RXT', 'RXZ'],
        lakh: [6, 8.7],
        years: [2019, 2024],
      },
    ],
  },
  {
    make: 'Skoda',
    weight: 3,
    models: [
      {
        model: 'Slavia',
        body: 'SEDAN',
        fuels: P,
        gearboxes: MA,
        variants: ['Active', 'Ambition', 'Style'],
        lakh: [11.5, 19],
        years: [2022, 2024],
      },
      {
        model: 'Kushaq',
        body: 'SUV',
        fuels: P,
        gearboxes: MA,
        variants: ['Active', 'Ambition', 'Style'],
        lakh: [11.9, 20],
        years: [2021, 2024],
      },
      {
        model: 'Octavia',
        body: 'LUXURY',
        fuels: P,
        gearboxes: A,
        variants: ['Style', 'L&K'],
        lakh: [26, 30],
        years: [2016, 2023],
      },
    ],
  },
  {
    make: 'Volkswagen',
    weight: 2,
    models: [
      {
        model: 'Polo',
        body: 'HATCHBACK',
        fuels: P,
        gearboxes: MA,
        variants: ['Trendline', 'Comfortline', 'Highline', 'GT'],
        lakh: [6, 10],
        years: [2015, 2022],
      },
      {
        model: 'Virtus',
        body: 'SEDAN',
        fuels: P,
        gearboxes: MA,
        variants: ['Comfortline', 'Highline', 'Topline', 'GT'],
        lakh: [11.5, 19.4],
        years: [2022, 2024],
      },
      {
        model: 'Taigun',
        body: 'SUV',
        fuels: P,
        gearboxes: MA,
        variants: ['Comfortline', 'Highline', 'Topline', 'GT'],
        lakh: [11.7, 19.7],
        years: [2021, 2024],
      },
    ],
  },
  {
    make: 'MG',
    weight: 2,
    models: [
      {
        model: 'Hector',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['Style', 'Shine', 'Smart', 'Sharp'],
        lakh: [14, 22],
        years: [2019, 2024],
      },
      {
        model: 'Astor',
        body: 'SUV',
        fuels: P,
        gearboxes: MA,
        variants: ['Sprint', 'Shine', 'Select', 'Sharp'],
        lakh: [10, 18],
        years: [2021, 2024],
      },
      {
        model: 'ZS EV',
        body: 'SUV',
        fuels: ['ELECTRIC'],
        gearboxes: A,
        variants: ['Executive', 'Excite', 'Exclusive'],
        lakh: [19, 25],
        years: [2020, 2024],
      },
    ],
  },
  {
    make: 'Nissan',
    weight: 1,
    models: [
      {
        model: 'Magnite',
        body: 'SUV',
        fuels: P,
        gearboxes: MA,
        variants: ['XE', 'XL', 'XV', 'XV Premium'],
        lakh: [6, 11],
        years: [2020, 2024],
      },
      {
        model: 'Kicks',
        body: 'SUV',
        fuels: PD,
        gearboxes: MA,
        variants: ['XL', 'XV', 'XV Premium'],
        lakh: [9.5, 14.7],
        years: [2019, 2022],
      },
    ],
  },
];

export const VEHICLE_COLORS = [
  'Pearl White',
  'Silky Silver',
  'Magma Grey',
  'Midnight Black',
  'Fiery Red',
  'Nexa Blue',
  'Pearl Brown',
  'Sunset Orange',
] as const;

/** The RTO each district's cars are registered at. */
const RTO_BY_DISTRICT: Record<string, string> = {
  Vellore: 'TN23',
  Ranipet: 'TN73',
  Tirupattur: 'TN83',
  'Bengaluru Urban': 'KA01',
  Mysuru: 'KA09',
  Belagavi: 'KA22',
  Visakhapatnam: 'AP31',
  Guntur: 'AP07',
  Kurnool: 'AP21',
  Ernakulam: 'KL07',
  Thrissur: 'KL08',
  Kozhikode: 'KL11',
};

export const DEV_VEHICLE_COUNT = 320;

/** Every date hangs off this, never off `new Date()`. */
export const DEV_VEHICLE_ANCHOR = new Date('2026-09-20T09:00:00.000Z');

const DAY_MS = 86_400_000;
const PAISE_PER_LAKH = 10_000_000;
const PRICE_STEP_PAISE = 500_000;

/**
 * The non-public states, and how many of each. Everything else is ACTIVE —
 * 272 of 320 — which is the inventory the search is tested against.
 */
const HIDDEN: readonly [DevListingStatus, number][] = [
  ['DRAFT', 8],
  ['PENDING_REVIEW', 10],
  ['CHANGES_REQUESTED', 6],
  ['REJECTED', 6],
  ['SOLD', 12],
  ['REMOVED', 6],
];

export interface DevVehicle {
  id: string;
  listingId: string;
  dealerGstin: string;
  dealerSlug: string;
  city: string;
  district: string;
  state: string;
  registrationNumber: string;
  rtoCode: string;
  make: string;
  model: string;
  variant: string;
  manufacturingYear: number;
  registrationYear: number;
  fuelType: Fuel;
  transmission: Gearbox;
  bodyType: Body;
  kilometersDriven: number;
  ownerCount: number;
  color: string;
  pricePaise: bigint;
  status: DevListingStatus;
  listingSlug: string | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  soldAt: Date | null;
  removedAt: Date | null;
  claimedAt: Date | null;
  releasedAt: Date | null;
  decisionReason: string | null;
}

/** `mulberry32` — small, fast, and the same sequence on every machine. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A UUID derived from a name, so a row's id is the same on every run. */
export function devUuid(name: string): string {
  const hex = createHash('sha1').update(`dealers-drive-dev:${name}`).digest('hex');
  const variant = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function pick<T>(random: () => number, values: readonly T[]): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error('pick from an empty list');
  return value;
}

function weighted<T extends { weight: number }>(random: () => number, values: readonly T[]): T {
  const total = values.reduce((sum, value) => sum + value.weight, 0);
  let at = random() * total;
  for (const value of values) {
    at -= value.weight;
    if (at < 0) return value;
  }
  return values[values.length - 1] ?? pick(random, values);
}

function between(random: () => number, low: number, high: number): number {
  return low + random() * (high - low);
}

function ownersFor(random: () => number, age: number): number {
  const roll = random() + Math.min(age, 10) * 0.04;
  if (roll < 0.62) return 1;
  if (roll < 0.9) return 2;
  if (roll < 1.08) return 3;
  return 4 + Math.floor(random() * 2);
}

/**
 * How many cars each dealership gets: at least one, more in Tamil Nadu — the
 * state the marketplace starts in — and the total exactly `DEV_VEHICLE_COUNT`.
 */
export function carsPerDealer(dealers: readonly DevDealerRow[], random: () => number): number[] {
  const weights = dealers.map((dealer) => (dealer.state === 'Tamil Nadu' ? 2.2 : 1) + random());
  const spare = DEV_VEHICLE_COUNT - dealers.length;
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const counts = weights.map((weight) => 1 + Math.floor((weight / sum) * spare));
  let missing = DEV_VEHICLE_COUNT - counts.reduce((total, count) => total + count, 0);
  for (let index = 0; missing > 0; index = (index + 1) % counts.length, missing -= 1) {
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

function statusPlan(): DevListingStatus[] {
  const statuses = new Array<DevListingStatus>(DEV_VEHICLE_COUNT).fill('ACTIVE');
  const hidden = HIDDEN.flatMap(([status, count]) => Array.from({ length: count }, () => status));
  const stride = Math.floor(DEV_VEHICLE_COUNT / hidden.length);
  hidden.forEach((status, index) => {
    statuses[index * stride + (index % stride)] = status;
  });
  return statuses;
}

/**
 * Deals `DEV_VEHICLE_COUNT` cars out to the dev dealerships. Pure: the same
 * dealerships in give the same cars out, byte for byte.
 */
export function generateDevVehicles(dealers: readonly DevDealerRow[]): DevVehicle[] {
  const random = mulberry32(20_260_920);
  const counts = carsPerDealer(dealers, random);
  const statuses = statusPlan();
  const anchorYear = DEV_VEHICLE_ANCHOR.getUTCFullYear();
  const vehicles: DevVehicle[] = [];

  dealers.forEach((dealer, dealerIndex) => {
    for (let n = 0; n < (counts[dealerIndex] ?? 0); n += 1) {
      const index = vehicles.length;
      const brand = weighted(random, VEHICLE_CATALOG);
      const entry = pick(random, brand.models);
      const year = Math.round(between(random, entry.years[0], entry.years[1]));
      const age = Math.max(0, anchorYear - year);
      const km = Math.round((between(random, 6_000, 15_000) * Math.max(age, 0.4)) / 100) * 100;
      const newPrice = between(random, entry.lakh[0], entry.lakh[1]) * PAISE_PER_LAKH;
      const worth = newPrice * Math.pow(0.92, age) * (1 - Math.min(km, 150_000) / 1_500_000);
      const pricePaise = BigInt(
        Math.max(1, Math.round(worth / PRICE_STEP_PAISE)) * PRICE_STEP_PAISE,
      );
      const variant = pick(random, entry.variants);
      const status = statuses[index] ?? 'ACTIVE';

      const rto = RTO_BY_DISTRICT[dealer.district] ?? 'TN23';
      const registrationNumber = `${rto}DD${String(1001 + index)}`;

      const submittedAt = new Date(
        DEV_VEHICLE_ANCHOR.getTime() - Math.floor(between(random, 3, 90)) * DAY_MS,
      );
      const isLive = status === 'ACTIVE' || status === 'SOLD' || status === 'REMOVED';
      const publishedAt = isLive
        ? new Date(submittedAt.getTime() + Math.floor(between(random, 1, 3)) * DAY_MS)
        : null;
      const hasClaim = status !== 'DRAFT';
      const released = status === 'SOLD' || status === 'REMOVED' || status === 'REJECTED';
      const suffix = devUuid(`vehicle-${index}`).slice(0, 8);

      vehicles.push({
        id: devUuid(`vehicle-${index}`),
        listingId: devUuid(`listing-${index}`),
        dealerGstin: dealer.gstin,
        dealerSlug: dealer.slug,
        city: dealer.city,
        district: dealer.district,
        state: dealer.state,
        registrationNumber,
        rtoCode: rto,
        make: brand.make,
        model: entry.model,
        variant,
        manufacturingYear: year,
        registrationYear: year,
        fuelType: pick(random, entry.fuels),
        transmission: pick(random, entry.gearboxes),
        bodyType: entry.body,
        kilometersDriven: km,
        ownerCount: ownersFor(random, age),
        color: pick(random, VEHICLE_COLORS),
        pricePaise,
        status,
        listingSlug: isLive
          ? `${slugify(`${year} ${brand.make} ${entry.model} ${variant} ${dealer.city}`)}-${suffix}`
          : null,
        submittedAt: status === 'DRAFT' ? null : submittedAt,
        publishedAt,
        soldAt:
          status === 'SOLD' && publishedAt ? new Date(publishedAt.getTime() + 5 * DAY_MS) : null,
        removedAt:
          status === 'REMOVED' && publishedAt ? new Date(publishedAt.getTime() + 4 * DAY_MS) : null,
        claimedAt: hasClaim ? submittedAt : null,
        releasedAt: released ? DEV_VEHICLE_ANCHOR : null,
        decisionReason:
          status === 'CHANGES_REQUESTED'
            ? 'The odometer photograph does not match the kilometres entered.'
            : status === 'REJECTED'
              ? 'The registration certificate belongs to a different vehicle.'
              : null,
      });
    }
  });

  return vehicles;
}
