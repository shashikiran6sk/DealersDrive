import { slugify } from './common.js';

/**
 * The manufacturers a dealer can choose for a car's make — the closed list the
 * vehicle form offers and the API accepts for a new value.
 *
 * Spellings are the brands' own (`MG`, `Mercedes-Benz`, `Citroen` without the
 * diaeresis because the RC never carries it). Adding a manufacturer is adding a
 * line here; nothing in the database lists them, so nothing needs migrating.
 */
export const VEHICLE_MAKES = [
  'Maruti Suzuki',
  'Hyundai',
  'Tata',
  'Mahindra',
  'Kia',
  'Toyota',
  'Honda',
  'MG',
  'Renault',
  'Nissan',
  'Skoda',
  'Volkswagen',
  'Ford',
  'Chevrolet',
  'Fiat',
  'Jeep',
  'Citroen',
  'BYD',
  'VinFast',
  'Datsun',
  'Mitsubishi',
  'Isuzu',
  'Force Motors',
  'Mercedes-Benz',
  'BMW',
  'Audi',
  'Volvo',
  'Jaguar',
  'Land Rover',
  'Lexus',
  'Mini',
  'Porsche',
  'Maserati',
  'Ferrari',
  'Lamborghini',
  'Bentley',
  'Rolls-Royce',
  'Aston Martin',
  'Hindustan Motors',
  'Premier',
  'Opel',
  'Daewoo',
] as const;
export type VehicleMake = (typeof VEHICLE_MAKES)[number];

/**
 * Reviewed alternative spellings, keyed the way `vehicleMakeKey` keys them.
 *
 * Exact keys only — no prefix, no edit distance. A misspelling is not an alias,
 * and a maker string that names two brands (`SKODA AUTO VOLKSWAGEN`,
 * `JAGUAR LAND ROVER`) is deliberately absent: guessing between them would file
 * a car under the wrong brand, which is worse than asking the dealer to choose.
 */
export const VEHICLE_MAKE_ALIASES: Readonly<Record<string, VehicleMake>> = {
  MARUTI: 'Maruti Suzuki',
  MARUTHI: 'Maruti Suzuki',
  'MARUTHI SUZUKI': 'Maruti Suzuki',
  'MARUTI UDYOG': 'Maruti Suzuki',
  'TATA MOTORS': 'Tata',
  'TATA MOTORS PASSENGER VEHICLES': 'Tata',
  'MAHINDRA AND MAHINDRA': 'Mahindra',
  'M AND M': 'Mahindra',
  'HYUNDAI MOTOR': 'Hyundai',
  'HYUNDAI MOTORS': 'Hyundai',
  'KIA MOTORS': 'Kia',
  'TOYOTA KIRLOSKAR': 'Toyota',
  'TOYOTA KIRLOSKAR MOTOR': 'Toyota',
  'HONDA CARS': 'Honda',
  'MG MOTOR': 'MG',
  'MORRIS GARAGES': 'MG',
  'JSW MG MOTOR': 'MG',
  'NISSAN MOTOR': 'Nissan',
  'SKODA AUTO': 'Skoda',
  VW: 'Volkswagen',
  'FORD MOTOR': 'Ford',
  'GENERAL MOTORS': 'Chevrolet',
  'FIAT INDIA AUTOMOBILES': 'Fiat',
  MERCEDES: 'Mercedes-Benz',
  'VOLVO AUTO': 'Volvo',
  'FORCE MOTOR': 'Force Motors',
  FORCE: 'Force Motors',
  HM: 'Hindustan Motors',
  'PREMIER AUTOMOBILES': 'Premier',
};

const CORPORATE_SUFFIX = new Set([
  'LTD',
  'LIMITED',
  'PVT',
  'PRIVATE',
  'CO',
  'COMPANY',
  'CORP',
  'CORPORATION',
  'INC',
  'INDIA',
]);

/**
 * `"Maruti Suzuki India Pvt. Ltd."` -> `"MARUTI SUZUKI"`.
 *
 * Accents folded, `&` read as `AND`, punctuation to spaces, and trailing
 * corporate words dropped — only trailing ones, so `Force Motors` keeps its
 * second word and `India` inside a name would survive.
 */
export function vehicleMakeKey(input: string): string {
  const words = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0);
  while (words.length > 1 && CORPORATE_SUFFIX.has(words[words.length - 1] ?? '')) words.pop();
  return words.join(' ');
}

const ENTRIES: readonly (readonly [string, VehicleMake])[] = [
  ...VEHICLE_MAKES.map((make) => [vehicleMakeKey(make), make] as const),
  ...Object.entries(VEHICLE_MAKE_ALIASES),
];
const BY_KEY: ReadonlyMap<string, VehicleMake> = new Map(ENTRIES);

/**
 * The same keys with their spaces removed, so `marutisuzuki` and `LANDROVER`
 * resolve. A compacted key that two different makes share would be ambiguous;
 * the contracts tests assert there is none.
 */
export function compactVehicleMakeKey(key: string): string {
  return key.replace(/ /g, '');
}
const BY_COMPACT: ReadonlyMap<string, VehicleMake> = new Map(
  ENTRIES.map(([key, make]) => [compactVehicleMakeKey(key), make] as const),
);

/** The canonical make a typed or RC-supplied string names, or `null` if it names none. */
export function canonicalVehicleMake(input: string): VehicleMake | null {
  const key = vehicleMakeKey(input);
  return BY_KEY.get(key) ?? BY_COMPACT.get(compactVehicleMakeKey(key)) ?? null;
}

export function isVehicleMake(value: string): value is VehicleMake {
  return VEHICLE_MAKES.some((make) => make === value);
}

/**
 * The facet and filter key for a stored make: the canonical brand's slug when
 * the spelling resolves to one, the spelling's own slug otherwise. This is how
 * cars saved as `Maruti` before the list existed sit under Maruti Suzuki
 * without rewriting their rows.
 */
export function vehicleMakeSlug(value: string): string {
  return slugify(vehicleMakeLabel(value));
}

/** How a stored make is shown: its canonical brand when it resolves to one, as stored otherwise. */
export function vehicleMakeLabel(value: string): string {
  return canonicalVehicleMake(value) ?? value.trim();
}
