/**
 * VAHAN's vocabulary, mapped onto ours.
 *
 * ## Why this is a committed constant and not a table
 *
 * The same reasoning `prisma/seed/catalog/schema.ts` gives for the catalogue
 * itself: a diff shows exactly which manufacturer string someone added, and a
 * reviewer can tell whether `FCA INDIA AUTOMOBILES` really should resolve to
 * Jeep. An admin screen for this would produce silent, unreviewed changes to
 * how every incoming registration is interpreted.
 *
 * ## Why it is needed at all
 *
 * An RC records the *manufacturing entity*, not the brand a car is sold under.
 * A Swift's RC says `MARUTI SUZUKI INDIA LTD`; an XUV500's says
 * `MAHINDRA & MAHINDRA LTD`; a Beat's says `GENERAL MOTORS INDIA PVT LTD` and
 * the brand is Chevrolet, which appears nowhere in the string. No amount of
 * fuzzy matching gets from the third to the fourth — it needs a table.
 */

/** Corporate scaffolding that carries no brand information. Order matters: longest first. */
const SUFFIX_NOISE = [
  'PASSENGER VEHICLES',
  'PRIVATE LIMITED',
  'AUTOMOBILES',
  'INDUSTRIES',
  'AUTOMOTIVE',
  'LIMITED',
  'PRIVATE',
  'COMPANY',
  'INDIA',
  'AUTO',
  'CARS',
  'PVT',
  'LTD',
  'INC',
  'CO',
  'AG',
] as const;

/**
 * Normalises a maker or model string to a comparable form.
 *
 * `&` becomes `AND` before punctuation is stripped, so `M&M` and
 * `MAHINDRA & MAHINDRA` both survive as words rather than collapsing to `MM`.
 */
export function normaliseRcString(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The same, with corporate scaffolding removed. `TATA MOTORS LTD` → `TATA MOTORS`. */
export function stripCorporateNoise(normalised: string): string {
  let value = ` ${normalised} `;
  for (const noise of SUFFIX_NOISE) {
    value = value.replace(new RegExp(`\\s${noise}\\s`, 'g'), ' ');
  }
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Exact, normalised maker string → make slug.
 *
 * Keys are the output of `normaliseRcString`, not raw VAHAN text, so a lookup
 * is a hash hit rather than a scan. Several spellings of the same
 * manufacturer are listed separately because state RTOs genuinely differ —
 * `LTD` and `LIMITED` are both common for the same company.
 */
export const MAKER_ALIASES: Readonly<Record<string, string>> = {
  // ── volume ───────────────────────────────────────────────────────────────
  'MARUTI SUZUKI INDIA LTD': 'maruti-suzuki',
  'MARUTI SUZUKI INDIA LIMITED': 'maruti-suzuki',
  'MARUTI SUZUKI': 'maruti-suzuki',
  // Maruti's pre-2007 name. Every Alto and Zen of that era still carries it.
  'MARUTI UDYOG LTD': 'maruti-suzuki',
  'MARUTI UDYOG LIMITED': 'maruti-suzuki',
  'SUZUKI MOTOR GUJARAT PVT LTD': 'maruti-suzuki',

  'HYUNDAI MOTOR INDIA LTD': 'hyundai',
  'HYUNDAI MOTOR INDIA LIMITED': 'hyundai',
  'HYUNDAI MOTORS INDIA LTD': 'hyundai',

  'TATA MOTORS LTD': 'tata',
  'TATA MOTORS LIMITED': 'tata',
  'TATA MOTORS PASSENGER VEHICLES LTD': 'tata',
  'TATA MOTORS PASSENGER VEHICLES LIMITED': 'tata',

  'MAHINDRA AND MAHINDRA LTD': 'mahindra',
  'MAHINDRA AND MAHINDRA LIMITED': 'mahindra',
  'MAHINDRA AND MAHINDRA': 'mahindra',
  'M AND M LTD': 'mahindra',
  'M AND M': 'mahindra',

  'TOYOTA KIRLOSKAR MOTOR PVT LTD': 'toyota',
  'TOYOTA KIRLOSKAR MOTOR PRIVATE LIMITED': 'toyota',
  'TOYOTA KIRLOSKAR': 'toyota',

  'HONDA CARS INDIA LTD': 'honda',
  'HONDA CARS INDIA LIMITED': 'honda',
  // Honda's Indian arm before the 2012 rename.
  'HONDA SIEL CARS INDIA LTD': 'honda',

  'KIA MOTORS INDIA PVT LTD': 'kia',
  'KIA INDIA PRIVATE LIMITED': 'kia',
  'KIA INDIA PVT LTD': 'kia',

  'RENAULT INDIA PVT LTD': 'renault',
  'RENAULT INDIA PRIVATE LIMITED': 'renault',

  'NISSAN MOTOR INDIA PVT LTD': 'nissan',
  'NISSAN MOTOR INDIA PRIVATE LIMITED': 'nissan',

  // Datsun was Nissan's budget brand and its RCs name Nissan's entity, so the
  // maker string cannot distinguish them. Resolved from the model instead.
  DATSUN: 'datsun',

  'FORD INDIA PVT LTD': 'ford',
  'FORD INDIA PRIVATE LIMITED': 'ford',

  'SKODA AUTO INDIA PVT LTD': 'skoda',
  'SKODA AUTO INDIA PRIVATE LIMITED': 'skoda',

  'VOLKSWAGEN INDIA PVT LTD': 'volkswagen',
  'VOLKSWAGEN INDIA PRIVATE LIMITED': 'volkswagen',
  'VOLKSWAGEN GROUP SALES INDIA PVT LTD': 'volkswagen',

  // The brand is Chevrolet and the string never says so. This single row is
  // the clearest argument for the whole file existing.
  'GENERAL MOTORS INDIA PVT LTD': 'chevrolet',
  'GENERAL MOTORS INDIA PRIVATE LIMITED': 'chevrolet',
  'CHEVROLET SALES INDIA PVT LTD': 'chevrolet',

  'FIAT INDIA AUTOMOBILES PVT LTD': 'fiat',
  'FIAT INDIA AUTOMOBILES LTD': 'fiat',

  'MG MOTOR INDIA PVT LTD': 'mg',
  'MG MOTOR INDIA PRIVATE LIMITED': 'mg',

  'PCA AUTOMOBILES INDIA PVT LTD': 'citroen',
  'CITROEN INDIA': 'citroen',

  'ISUZU MOTORS INDIA PVT LTD': 'isuzu',
  'FORCE MOTORS LTD': 'force',
  'FORCE MOTORS LIMITED': 'force',
  'BYD INDIA PVT LTD': 'byd',
  'HINDUSTAN MOTORS LTD': 'hindustan-motors',
  'HINDUSTAN MOTORS LIMITED': 'hindustan-motors',
  'PREMIER LTD': 'premier',
  'PREMIER LIMITED': 'premier',
  'MITSUBISHI MOTORS': 'mitsubishi',
  'HINDUSTAN MOTORS FINANCE CORPORATION LTD': 'hindustan-motors',
  'MAHINDRA SSANGYONG': 'ssangyong',
  'SSANGYONG MOTOR COMPANY': 'ssangyong',

  // ── luxury ───────────────────────────────────────────────────────────────
  'MERCEDES BENZ INDIA PVT LTD': 'mercedes-benz',
  'MERCEDES BENZ INDIA PRIVATE LIMITED': 'mercedes-benz',
  'MERCEDES BENZ AG': 'mercedes-benz',
  'DAIMLER CHRYSLER INDIA PVT LTD': 'mercedes-benz',
  'BMW INDIA PVT LTD': 'bmw',
  'BMW INDIA PRIVATE LIMITED': 'bmw',
  'BMW AG': 'bmw',
  'AUDI AG': 'audi',
  'AUDI INDIA': 'audi',
  'VOLVO AUTO INDIA PVT LTD': 'volvo',
  'VOLVO CAR INDIA PVT LTD': 'volvo',
  'PORSCHE AG': 'porsche',
  'LEXUS INDIA': 'lexus',
  'TESLA INC': 'tesla',
  'ROLLS ROYCE MOTOR CARS': 'rolls-royce',
  'BENTLEY MOTORS': 'bentley',
  'ASTON MARTIN LAGONDA': 'aston-martin',
  'AUTOMOBILI LAMBORGHINI': 'lamborghini',
  'FERRARI SPA': 'ferrari',
  'MASERATI SPA': 'maserati',
};

/**
 * Manufacturing entities that build for more than one brand.
 *
 * The maker string cannot decide these, so the resolver falls through to the
 * model: `JAGUAR LAND ROVER` plus a model starting `XF` is a Jaguar, plus
 * `DISCOVERY` is a Land Rover. When the model does not decide it either, the
 * result is a `LIKELY` shortlist rather than a guess — a wrong make is the
 * most expensive error this resolver can make, because every downstream field
 * is scoped by it.
 */
export const AMBIGUOUS_MAKERS: Readonly<Record<string, readonly string[]>> = {
  'JAGUAR LAND ROVER INDIA LTD': ['jaguar', 'land-rover'],
  'JAGUAR LAND ROVER INDIA LIMITED': ['jaguar', 'land-rover'],
  'JAGUAR LAND ROVER': ['jaguar', 'land-rover'],
  // Skoda Auto Volkswagen India Pvt Ltd builds Skoda, VW and Audi.
  'SKODA AUTO VOLKSWAGEN INDIA PVT LTD': ['skoda', 'volkswagen', 'audi'],
  'SKODA AUTO VOLKSWAGEN INDIA PRIVATE LIMITED': ['skoda', 'volkswagen', 'audi'],
  // FCA builds Jeep in India and built Fiat before that.
  'FCA INDIA AUTOMOBILES PVT LTD': ['jeep', 'fiat'],
  'FCA INDIA AUTOMOBILES PRIVATE LIMITED': ['jeep', 'fiat'],
  // Nissan's plant builds both brands.
  'NISSAN MOTOR INDIA PVT LTD DATSUN': ['nissan', 'datsun'],
};

/**
 * VAHAN fuel descriptions → our `FuelType`.
 *
 * The dual-fuel cases are the interesting ones. An RC reading `PETROL/CNG`
 * describes a factory CNG car, and a buyer filtering for CNG must find it —
 * so it resolves to `CNG`, the fuel that changes the running cost, not to
 * `PETROL`, the one listed first.
 */
export const FUEL_ALIASES: Readonly<Record<string, string>> = {
  PETROL: 'PETROL',
  DIESEL: 'DIESEL',
  CNG: 'CNG',
  'PETROL CNG': 'CNG',
  'CNG PETROL': 'CNG',
  'PETROL ONLY': 'PETROL',
  'DIESEL ONLY': 'DIESEL',
  LPG: 'LPG',
  'PETROL LPG': 'LPG',
  ELECTRIC: 'ELECTRIC',
  'ELECTRIC BOV': 'ELECTRIC',
  'PURE EV': 'ELECTRIC',
  BATTERY: 'ELECTRIC',
  HYBRID: 'HYBRID',
  'PETROL HYBRID': 'HYBRID',
  'STRONG HYBRID EV': 'HYBRID',
  'MILD HYBRID': 'PETROL',
};

/**
 * VAHAN colour text → the `Color.family` values already in the catalogue.
 *
 * Resolution stops at the family deliberately. An RC says `WHITE`; the
 * catalogue distinguishes Pearl White from Arctic White, and only the dealer
 * looking at the car can say which. Pre-selecting one would be a confident
 * wrong answer where an unfilled dropdown is an honest one.
 */
export const COLOUR_FAMILY_ALIASES: Readonly<Record<string, string>> = {
  WHITE: 'white',
  'PEARL WHITE': 'white',
  'GLACIER WHITE': 'white',
  SILVER: 'silver',
  'SILKY SILVER': 'silver',
  GREY: 'grey',
  GRAY: 'grey',
  'GRANITE GREY': 'grey',
  BLACK: 'black',
  RED: 'red',
  MAROON: 'red',
  BLUE: 'blue',
  'SKY BLUE': 'blue',
  BROWN: 'brown',
  BEIGE: 'brown',
  BRONZE: 'brown',
  GOLD: 'brown',
};

/**
 * Only the seven families the catalogue actually seeds appear above: white,
 * silver, grey, black, red, blue, brown. An RC reading `ORANGE` therefore
 * resolves to nothing and the dealer picks — which is the correct outcome, not
 * a gap. Mapping it to a family that does not exist would look like coverage
 * while behaving identically, and the next person to add an orange colour row
 * would have no reason to look here.
 */
