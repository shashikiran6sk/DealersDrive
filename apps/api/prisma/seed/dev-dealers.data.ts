/**
 * Thirty dealerships across the three districts of the Vellore belt, for local
 * development only.
 *
 * ── Why this is not in `data.ts` ────────────────────────────────────────────
 * `prisma/seed/data.ts` is the **test** fixture: `tests/global-setup.ts` runs
 * `prisma/seed/index.ts` into `dealersdrive_test` before every integration run,
 * and `auth.test.ts` is written against exactly one seeded dealership. Thirty
 * more would be thirty more rows in every suite, for no test's benefit, and the
 * file belongs to **F097** besides.
 *
 * This file is the opposite: it exists so a laptop has something to look at.
 * The dealer directory (F085) counts its city chips over every ACTIVE
 * dealership, and one row makes a chip row of one — which tells you nothing
 * about whether the chips work. Nothing in `apps/api/src` imports it, no test
 * runs it, and `pnpm db:seed` does not call it. It runs when a developer asks:
 *
 *     pnpm --filter @dealers-drive/api db:seed:dev
 *
 * ── The geography, and why it is real ───────────────────────────────────────
 * Eleven towns across three districts, because the two location questions the
 * product asks are different questions and only real data shows it:
 *
 *   · the public directory groups by **city** — `slugify(dealer.city)` in
 *     `dealers.repository.ts` — so Katpadi and Vellore are separate chips even
 *     though a buyer would drive between them in twenty minutes;
 *   · the admin console filters by **district**, because support questions are
 *     district-shaped ("every dealer in Ranipet district"), and a district
 *     holds towns whose names give no hint they are related — Arakkonam and
 *     Walajapet share a district with Arcot and nothing else.
 *
 * Seed one town per district and neither behaviour is visible. Seed these and
 * both are: four chips resolve to one district, and the district filter pulls
 * together towns the city chips keep apart.
 *
 *   Vellore district     Vellore ×4 · Katpadi ×3 · Gudiyatham ×2 · Bagayam ×2
 *   Ranipet district     Ranipet ×3 · Arcot ×3 · Arakkonam ×3 · Walajapet ×2
 *   Tirupattur district  Tirupattur ×3 · Vaniyambadi ×3 · Ambur ×2
 *
 * Pincodes and coordinates are the towns' real ones. `mapsUrl` is built as a
 * Google Maps search link on `www.google.com`, which is one of the hosts
 * `GoogleMapsUrl` in `packages/contracts/src/common.ts` allows — a seed that
 * wrote a link the contract would reject on write is a seed that lies about
 * what the database can hold.
 *
 * GSTINs and PANs are structurally valid and unique but entirely invented:
 * they match the `GSTIN` and `PAN` regexes in `contracts/src/dealer.ts`
 * (`33` is Tamil Nadu, characters 3–12 are the PAN) and belong to nobody.
 * Same for the phone numbers, which sit in a block the seeded test dealership
 * does not use so the `users.phone` unique index stays quiet.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { dealerSlug } from '@dealers-drive/contracts';

/**
 * One state, and the slug's last segment. Written here rather than in
 * `dev-dealers.ts` because the slug is derived from it — two copies of the
 * string would mean a seeded row whose address and whose URL disagree.
 */
export const DEV_STATE = 'Tamil Nadu';

/** One town, written once so thirty rows cannot disagree about where it is. */
interface Town {
  city: string;
  district: string;
  lat: number;
  lng: number;
}

const TOWNS = {
  vellore: { city: 'Vellore', district: 'Vellore', lat: 12.9165, lng: 79.1325 },
  katpadi: { city: 'Katpadi', district: 'Vellore', lat: 12.9698, lng: 79.1378 },
  gudiyatham: { city: 'Gudiyatham', district: 'Vellore', lat: 12.945, lng: 78.87 },
  bagayam: { city: 'Bagayam', district: 'Vellore', lat: 12.888, lng: 79.118 },
  ranipet: { city: 'Ranipet', district: 'Ranipet', lat: 12.9276, lng: 79.333 },
  arcot: { city: 'Arcot', district: 'Ranipet', lat: 12.906, lng: 79.32 },
  arakkonam: { city: 'Arakkonam', district: 'Ranipet', lat: 13.08, lng: 79.67 },
  walajapet: { city: 'Walajapet', district: 'Ranipet', lat: 12.926, lng: 79.363 },
  tirupattur: { city: 'Tirupattur', district: 'Tirupattur', lat: 12.496, lng: 78.57 },
  vaniyambadi: { city: 'Vaniyambadi', district: 'Tirupattur', lat: 12.682, lng: 78.62 },
  ambur: { city: 'Ambur', district: 'Tirupattur', lat: 12.791, lng: 78.716 },
} as const satisfies Record<string, Town>;

export interface DevDealer {
  brandName: string;
  legalName: string;
  tagline: string;
  about: string;
  gstin: string;
  pan: string;
  town: keyof typeof TOWNS;
  addressLine: string;
  pincode: string;
  phone: string;
  email: string;
  landline: string;
  ownerName: string;
  ownerRole: string;
  establishedYear: number;
  specialities: string[];
  /** `null` renders as "New dealer" — see `responseLabel` in the public service. */
  medianResponseMins: number | null;
}

/**
 * The row as the seed writes it: the town's fields flattened in, and the two
 * derived columns (`mapsUrl`, `workingHours`) built from the same source so a
 * corrected coordinate cannot leave a stale link behind it.
 */
export interface DevDealerRow extends DevDealer, Town {
  /** Derived, not typed: see the note on `DEV_DEALERS` below. */
  slug: string;
  mapsUrl: string;
  workingHours: { mon_sat: string; sun: string | null };
}

/**
 * Sunday is the interesting one. A used-car yard is busiest on a Sunday and
 * most of these open; the two that close are here so the portfolio page's
 * hours block is exercised in both shapes rather than only the cheerful one.
 */
function hoursFor(index: number): { mon_sat: string; sun: string | null } {
  if (index % 7 === 3) return { mon_sat: '9:30 AM – 8:00 PM', sun: null };
  if (index % 3 === 0) return { mon_sat: '9:00 AM – 8:30 PM', sun: '10:00 AM – 6:00 PM' };
  return { mon_sat: '10:00 AM – 8:00 PM', sun: '10:00 AM – 2:00 PM' };
}

const DEALERS: DevDealer[] = [
  // ── Vellore district ──────────────────────────────────────────────────────
  {
    brandName: 'Annamalai Auto Mart',
    legalName: 'Annamalai Auto Mart Pvt Ltd',
    tagline: 'Fort-road yard since 2009 — every car with a service book.',
    about:
      'Three generations on Officers Line. We stock single-owner hatchbacks and sedans, and every car leaves after a 120-point check and a fresh service.',
    gstin: '33AABCA1001C1ZP',
    pan: 'AABCA1001C',
    town: 'vellore',
    addressLine: '22, Officers Line, Near Fort',
    pincode: '632001',
    phone: '+919842010001',
    email: 'owner@annamalaiautomart.in',
    landline: '0416 222 1001',
    ownerName: 'S. Annamalai',
    ownerRole: 'Proprietor',
    establishedYear: 2009,
    specialities: ['Hatchbacks', 'Sedans', 'Single-owner cars'],
    medianResponseMins: 12,
  },
  {
    brandName: 'Green Circle Cars',
    legalName: 'Green Circle Motors LLP',
    tagline: 'Compact SUVs and MUVs, exchange welcome.',
    about:
      'Opposite the Green Circle bus stand. We specialise in compact SUVs and seven-seaters, and we take your old car in exchange the same day.',
    gstin: '33AACFG1002D1ZQ',
    pan: 'AACFG1002D',
    town: 'vellore',
    addressLine: '7, Bagayam Road, Green Circle',
    pincode: '632009',
    phone: '+919842010002',
    email: 'sales@greencirclecars.in',
    landline: '0416 222 1002',
    ownerName: 'K. Prabhakaran',
    ownerRole: 'Managing Partner',
    establishedYear: 2016,
    specialities: ['Compact SUVs', 'MUVs', 'Exchange'],
    medianResponseMins: 25,
  },
  {
    brandName: 'Thiru Motors',
    legalName: 'Thiru Motors and Finance',
    tagline: 'Finance sorted before you drive out.',
    about:
      'A small yard with an in-house finance desk. We work with four banks and two NBFCs, so most buyers are approved before they leave the shop.',
    gstin: '33AAEFT1003E1ZR',
    pan: 'AAEFT1003E',
    town: 'vellore',
    addressLine: '154, Arcot Road, Sathuvachari',
    pincode: '632009',
    phone: '+919842010003',
    email: 'contact@thirumotors.in',
    landline: '0416 222 1003',
    ownerName: 'M. Thirumurugan',
    ownerRole: 'Proprietor',
    establishedYear: 2019,
    specialities: ['Finance assistance', 'Hatchbacks', 'RC transfer'],
    medianResponseMins: null,
  },
  {
    brandName: 'CMC Road Autos',
    legalName: 'CMC Road Autos Enterprises',
    tagline: 'Diesel SUVs, sold and serviced.',
    about:
      'We deal only in diesel — SUVs, pickups and the occasional sedan. Our own workshop is behind the yard, so anything we sell we can also service.',
    gstin: '33AAFCC1004F1ZS',
    pan: 'AAFCC1004F',
    town: 'vellore',
    addressLine: '3/91, CMC Hospital Road, Thottapalayam',
    pincode: '632004',
    phone: '+919842010004',
    email: 'desk@cmcroadautos.in',
    landline: '0416 222 1004',
    ownerName: 'A. Ravichandran',
    ownerRole: 'Proprietor',
    establishedYear: 2012,
    specialities: ['SUVs', 'Diesel', 'Commercial vehicles'],
    medianResponseMins: 45,
  },
  {
    brandName: 'Katpadi Car Junction',
    legalName: 'Katpadi Car Junction Pvt Ltd',
    tagline: 'Two minutes from the railway junction.',
    about:
      'The closest yard to Katpadi junction, which is how most of our buyers find us. Strong on first cars — hatchbacks under five lakh, all petrol.',
    gstin: '33AABCK1005G1ZT',
    pan: 'AABCK1005G',
    town: 'katpadi',
    addressLine: '19, Station Road, Katpadi',
    pincode: '632007',
    phone: '+919842010005',
    email: 'owner@katpadicarjunction.in',
    landline: '0416 226 1005',
    ownerName: 'R. Selvakumar',
    ownerRole: 'Director',
    establishedYear: 2015,
    specialities: ['Hatchbacks', 'Petrol', 'First-time buyers'],
    medianResponseMins: 8,
  },
  {
    brandName: 'VIT Gate Motors',
    legalName: 'VIT Gate Motors LLP',
    tagline: 'Small cars for people who are new to driving.',
    about:
      'Beside the university gate. Almost everything on our lot is under four lakh and under 60,000 km — student and staff budgets, and we do the RC transfer ourselves.',
    gstin: '33AACFV1006H1ZU',
    pan: 'AACFV1006H',
    town: 'katpadi',
    addressLine: '61, Chennai–Bengaluru Highway, Near VIT Gate',
    pincode: '632007',
    phone: '+919842010006',
    email: 'hello@vitgatemotors.in',
    landline: '0416 226 1006',
    ownerName: 'D. Hariharan',
    ownerRole: 'Partner',
    establishedYear: 2020,
    specialities: ['Hatchbacks', 'RC transfer', 'Insurance renewal'],
    medianResponseMins: 15,
  },
  {
    brandName: 'Sri Balaji Cars',
    legalName: 'Sri Balaji Cars and Credits',
    tagline: 'Family cars, family business, since 1998.',
    about:
      'Twenty-six years on the same road. We buy directly from first owners in and around Katpadi and we do not deal in accident-repaired cars.',
    gstin: '33AAGFS1007J1ZV',
    pan: 'AAGFS1007J',
    town: 'katpadi',
    addressLine: '88, Gandhi Nagar Main Road, Katpadi',
    pincode: '632007',
    phone: '+919842010007',
    email: 'balaji@sribalajicars.in',
    landline: '0416 226 1007',
    ownerName: 'B. Venkatesan',
    ownerRole: 'Proprietor',
    establishedYear: 1998,
    specialities: ['Sedans', 'MUVs', 'Single-owner cars'],
    medianResponseMins: 30,
  },
  {
    brandName: 'Gudiyatham Auto Hub',
    legalName: 'Gudiyatham Auto Hub Pvt Ltd',
    tagline: 'The largest yard between Vellore and Krishnagiri.',
    about:
      'Forty cars on the lot on any given week. We serve the whole taluk, and we deliver to your door anywhere inside Vellore district at no charge.',
    gstin: '33AABCG1008K1ZW',
    pan: 'AABCG1008K',
    town: 'gudiyatham',
    addressLine: '45, Pernambut Road, Gudiyatham',
    pincode: '632602',
    phone: '+919842010008',
    email: 'owner@gudiyathamautohub.in',
    landline: '04171 22 1008',
    ownerName: 'S. Ilangovan',
    ownerRole: 'Director',
    establishedYear: 2011,
    specialities: ['SUVs', 'Hatchbacks', 'Home delivery'],
    medianResponseMins: 20,
  },
  {
    brandName: 'Pernambut Road Motors',
    legalName: 'Pernambut Road Motors Enterprises',
    tagline: 'Straight prices, no negotiation theatre.',
    about:
      'One price on the windscreen and that is the price. We publish the service history and the insurance status of every car before you ask for it.',
    gstin: '33AAFPP1009L1ZX',
    pan: 'AAFPP1009L',
    town: 'gudiyatham',
    addressLine: '12, Bazaar Street, Gudiyatham',
    pincode: '632602',
    phone: '+919842010009',
    email: 'sales@pernambutroadmotors.in',
    landline: '04171 22 1009',
    ownerName: 'P. Murugesan',
    ownerRole: 'Proprietor',
    establishedYear: 2018,
    specialities: ['Petrol', 'Sedans', 'Fixed price'],
    medianResponseMins: null,
  },
  {
    brandName: 'Bagayam Motors',
    legalName: 'Bagayam Motors and Spares',
    tagline: 'Cars and the workshop to keep them running.',
    about:
      'A workshop first, a yard second. Everything we sell has been through our own bay, and the first two services after purchase are on us.',
    gstin: '33AAGCB1010M1ZY',
    pan: 'AAGCB1010M',
    town: 'bagayam',
    addressLine: '2, Kalinjur Main Road, Bagayam',
    pincode: '632002',
    phone: '+919842010010',
    email: 'workshop@bagayammotors.in',
    landline: '0416 227 1010',
    ownerName: 'N. Karthikeyan',
    ownerRole: 'Proprietor',
    establishedYear: 2007,
    specialities: ['Diesel', 'SUVs', 'Free servicing'],
    medianResponseMins: 60,
  },
  {
    brandName: 'Kalinjur Used Cars',
    legalName: 'Kalinjur Used Cars LLP',
    tagline: 'CNG and petrol runabouts, city-driven only.',
    about:
      'We stock what people in Vellore actually drive: small petrol cars and CNG conversions with a valid certificate. Nothing on our lot has done highway miles.',
    gstin: '33AACFK1011N1ZZ',
    pan: 'AACFK1011N',
    town: 'bagayam',
    addressLine: '31, Bagayam–Kalinjur Road',
    pincode: '632002',
    phone: '+919842010011',
    email: 'contact@kalinjurusedcars.in',
    landline: '0416 227 1011',
    ownerName: 'V. Sathish',
    ownerRole: 'Partner',
    establishedYear: 2021,
    specialities: ['CNG', 'Petrol', 'Hatchbacks'],
    medianResponseMins: 18,
  },

  // ── Ranipet district ──────────────────────────────────────────────────────
  {
    brandName: 'Ranipet Auto World',
    legalName: 'Ranipet Auto World Pvt Ltd',
    tagline: 'Serving the SIPCOT belt since 2010.',
    about:
      'Most of our buyers work in the SIPCOT estates, so we keep the paperwork simple and we open early enough to catch the morning shift.',
    gstin: '33AABCR1012P1ZA',
    pan: 'AABCR1012P',
    town: 'ranipet',
    addressLine: '9, SIPCOT Main Road, Ranipet',
    pincode: '632401',
    phone: '+919842010012',
    email: 'owner@ranipetautoworld.in',
    landline: '04172 27 1012',
    ownerName: 'G. Rajendran',
    ownerRole: 'Director',
    establishedYear: 2010,
    specialities: ['Sedans', 'Hatchbacks', 'Finance assistance'],
    medianResponseMins: 22,
  },
  {
    brandName: 'Walaja Highway Cars',
    legalName: 'Walaja Highway Cars Enterprises',
    tagline: 'On NH-48, open till nine.',
    about:
      'Right on the national highway, which means we see cars from Chennai and Bengaluru both. Good stock of highway-driven diesels with full records.',
    gstin: '33AAFCW1013Q1ZB',
    pan: 'AAFCW1013Q',
    town: 'ranipet',
    addressLine: '160, NH-48 Service Road, Ranipet',
    pincode: '632401',
    phone: '+919842010013',
    email: 'sales@walajahighwaycars.in',
    landline: '04172 27 1013',
    ownerName: 'T. Anbarasu',
    ownerRole: 'Proprietor',
    establishedYear: 2014,
    specialities: ['Diesel', 'SUVs', 'Extended warranty'],
    medianResponseMins: 35,
  },
  {
    brandName: 'SIPCOT Car Bazaar',
    legalName: 'SIPCOT Car Bazaar LLP',
    tagline: 'Company buy-backs and fleet cars.',
    about:
      'We buy fleet cars from the estates when they come off lease. Single-driver, fully serviced, and priced below what a private sale would fetch.',
    gstin: '33AAGFS1014R1ZC',
    pan: 'AAGFS1014R',
    town: 'ranipet',
    addressLine: '5, Phase II, SIPCOT Industrial Complex',
    pincode: '632401',
    phone: '+919842010014',
    email: 'fleet@sipcotcarbazaar.in',
    landline: '04172 27 1014',
    ownerName: 'J. Saravanan',
    ownerRole: 'Managing Partner',
    establishedYear: 2017,
    specialities: ['Fleet cars', 'Sedans', 'Corporate buy-back'],
    medianResponseMins: null,
  },
  {
    brandName: 'Arcot Fort Motors',
    legalName: 'Arcot Fort Motors Pvt Ltd',
    tagline: 'Behind the fort, in front on price.',
    about:
      'A twenty-year-old yard in the old town. We know every car we sell because we bought it from someone in Arcot, usually the first owner.',
    gstin: '33AABCA1015S1ZD',
    pan: 'AABCA1015S',
    town: 'arcot',
    addressLine: '76, Fort Road, Arcot',
    pincode: '632503',
    phone: '+919842010015',
    email: 'owner@arcotfortmotors.in',
    landline: '04172 23 1015',
    ownerName: 'A. Jayaprakash',
    ownerRole: 'Director',
    establishedYear: 2004,
    specialities: ['Hatchbacks', 'Sedans', 'Single-owner cars'],
    medianResponseMins: 40,
  },
  {
    brandName: 'Palar Valley Autos',
    legalName: 'Palar Valley Autos Enterprises',
    tagline: 'Pickups and vans for the trade.',
    about:
      'We deal mainly in light commercial vehicles — pickups, tempo vans, and the small trucks the leather trade runs on. Finance available for GST-registered buyers.',
    gstin: '33AAFPP1016T1ZE',
    pan: 'AAFPP1016T',
    town: 'arcot',
    addressLine: '14, Ranipet Road, Arcot',
    pincode: '632503',
    phone: '+919842010016',
    email: 'trade@palarvalleyautos.in',
    landline: '04172 23 1016',
    ownerName: 'S. Elumalai',
    ownerRole: 'Proprietor',
    establishedYear: 2013,
    specialities: ['Commercial vehicles', 'Diesel', 'Finance assistance'],
    medianResponseMins: 50,
  },
  {
    brandName: 'Arcot City Cars',
    legalName: 'Arcot City Cars LLP',
    tagline: 'Everything under six lakh.',
    about:
      'A deliberately narrow yard: nothing over six lakh, nothing over eight years old, nothing without two keys and a clean insurance record.',
    gstin: '33AACFA1017U1ZF',
    pan: 'AACFA1017U',
    town: 'arcot',
    addressLine: '3, Big Bazaar Street, Arcot',
    pincode: '632503',
    phone: '+919842010017',
    email: 'hello@arcotcitycars.in',
    landline: '04172 23 1017',
    ownerName: 'K. Dhanasekaran',
    ownerRole: 'Partner',
    establishedYear: 2019,
    specialities: ['Hatchbacks', 'Petrol', 'Budget cars'],
    medianResponseMins: 14,
  },
  {
    brandName: 'Arakkonam Junction Motors',
    legalName: 'Arakkonam Junction Motors Pvt Ltd',
    tagline: 'Railway-town stock, railway-town prices.',
    about:
      'Half our buyers are railway employees, so we are used to salary-slip finance and we do the whole loan file in the shop.',
    gstin: '33AABCA1018V1ZG',
    pan: 'AABCA1018V',
    town: 'arakkonam',
    addressLine: '27, Station Road, Arakkonam',
    pincode: '631001',
    phone: '+919842010018',
    email: 'owner@arakkonamjunctionmotors.in',
    landline: '04177 22 1018',
    ownerName: 'R. Manoharan',
    ownerRole: 'Director',
    establishedYear: 2008,
    specialities: ['Sedans', 'Finance assistance', 'Hatchbacks'],
    medianResponseMins: 28,
  },
  {
    brandName: 'Thakkolam Road Cars',
    legalName: 'Thakkolam Road Cars Enterprises',
    tagline: 'Seven-seaters for large families.',
    about:
      'We stock MUVs and seven-seaters almost exclusively — the cars people around here actually need. Test drives to your house on request.',
    gstin: '33AAFCT1019W1ZH',
    pan: 'AAFCT1019W',
    town: 'arakkonam',
    addressLine: '90, Thakkolam Road, Arakkonam',
    pincode: '631001',
    phone: '+919842010019',
    email: 'sales@thakkolamroadcars.in',
    landline: '04177 22 1019',
    ownerName: 'V. Gopinath',
    ownerRole: 'Proprietor',
    establishedYear: 2016,
    specialities: ['MUVs', 'SUVs', 'Home test drive'],
    medianResponseMins: null,
  },
  {
    brandName: 'Nemili Auto Traders',
    legalName: 'Nemili Auto Traders LLP',
    tagline: 'Village-route cars, honestly graded.',
    about:
      'We grade every car A, B or C on the board and we do not move the grade to make a sale. C-grade cars are cheap and we tell you exactly why.',
    gstin: '33AAGFN1020X1ZJ',
    pan: 'AAGFN1020X',
    town: 'arakkonam',
    addressLine: '8, Nemili Main Road, Arakkonam',
    pincode: '631001',
    phone: '+919842010020',
    email: 'contact@nemiliautotraders.in',
    landline: '04177 22 1020',
    ownerName: 'M. Chandrasekar',
    ownerRole: 'Partner',
    establishedYear: 2022,
    specialities: ['Budget cars', 'Petrol', 'Graded stock'],
    medianResponseMins: 10,
  },
  {
    brandName: 'Walajapet Motors',
    legalName: 'Walajapet Motors and Finance',
    tagline: 'On the Palar bridge road since 2006.',
    about:
      'A quiet yard with a long list of repeat buyers. We hold cars back rather than sell something we would not put a family in.',
    gstin: '33AAGCW1021Y1ZK',
    pan: 'AAGCW1021Y',
    town: 'walajapet',
    addressLine: '55, Bridge Road, Walajapet',
    pincode: '632513',
    phone: '+919842010021',
    email: 'owner@walajapetmotors.in',
    landline: '04172 24 1021',
    ownerName: 'P. Sundaramoorthy',
    ownerRole: 'Proprietor',
    establishedYear: 2006,
    specialities: ['Sedans', 'Single-owner cars', 'Insurance renewal'],
    medianResponseMins: 55,
  },
  {
    brandName: 'Palar Bridge Autos',
    legalName: 'Palar Bridge Autos Enterprises',
    tagline: 'Exchange your old car the same day.',
    about:
      'Bring the RC and the keys and you will have a number before you leave. We buy anything running, and we are the yard other yards sell to.',
    gstin: '33AAFPP1022Z1ZL',
    pan: 'AAFPP1022Z',
    town: 'walajapet',
    addressLine: '2/17, Arcot Road, Walajapet',
    pincode: '632513',
    phone: '+919842010022',
    email: 'exchange@palarbridgeautos.in',
    landline: '04172 24 1022',
    ownerName: 'S. Baskaran',
    ownerRole: 'Proprietor',
    establishedYear: 2015,
    specialities: ['Exchange', 'Hatchbacks', 'Instant valuation'],
    medianResponseMins: 16,
  },

  // ── Tirupattur district ───────────────────────────────────────────────────
  {
    brandName: 'Tirupattur Car Company',
    legalName: 'Tirupattur Car Company Pvt Ltd',
    tagline: 'The district headquarters yard.',
    about:
      'The largest stock in the new district, and the only yard here with an indoor showroom. Cars from Bengaluru and Salem as well as local trade-ins.',
    gstin: '33AABCT1023A1ZM',
    pan: 'AABCT1023A',
    town: 'tirupattur',
    addressLine: '101, Krishnagiri Road, Tirupattur',
    pincode: '635601',
    phone: '+919842010023',
    email: 'owner@tirupatturcarcompany.in',
    landline: '04179 22 1023',
    ownerName: 'C. Rajkumar',
    ownerRole: 'Director',
    establishedYear: 2011,
    specialities: ['SUVs', 'Sedans', 'Extended warranty'],
    medianResponseMins: 19,
  },
  {
    brandName: 'Jolarpettai Road Motors',
    legalName: 'Jolarpettai Road Motors LLP',
    tagline: 'Diesel workhorses, checked and certified.',
    about:
      'Diesel only, and every engine goes on the compression tester before it goes on the lot. If it does not pass we send it to auction, not to you.',
    gstin: '33AACFJ1024B1ZN',
    pan: 'AACFJ1024B',
    town: 'tirupattur',
    addressLine: '38, Jolarpettai Road, Tirupattur',
    pincode: '635601',
    phone: '+919842010024',
    email: 'sales@jolarpettairoadmotors.in',
    landline: '04179 22 1024',
    ownerName: 'A. Senthilnathan',
    ownerRole: 'Partner',
    establishedYear: 2018,
    specialities: ['Diesel', 'SUVs', 'Certified engines'],
    medianResponseMins: 33,
  },
  {
    brandName: 'Yelagiri Hills Cars',
    legalName: 'Yelagiri Hills Cars Enterprises',
    tagline: 'Hill-road tested before it is hill-road sold.',
    about:
      'We take every car up to Yelagiri and back before we list it. If the brakes or the clutch will not take fourteen hairpins, we fix it or we do not sell it.',
    gstin: '33AAFCY1025C1ZP',
    pan: 'AAFCY1025C',
    town: 'tirupattur',
    addressLine: '6, Athanavur Road, Tirupattur',
    pincode: '635601',
    phone: '+919842010025',
    email: 'contact@yelagirihillscars.in',
    landline: '04179 22 1025',
    ownerName: 'D. Vijayakumar',
    ownerRole: 'Proprietor',
    establishedYear: 2020,
    specialities: ['SUVs', 'MUVs', 'Road-tested stock'],
    medianResponseMins: null,
  },
  {
    brandName: 'Vaniyambadi Auto Mart',
    legalName: 'Vaniyambadi Auto Mart Pvt Ltd',
    tagline: 'Leather-town trade, forty years of it.',
    about:
      'We started as a tannery transport fleet and kept the workshop. Strong stock of vans and pickups alongside the family cars.',
    gstin: '33AABCV1026D1ZQ',
    pan: 'AABCV1026D',
    town: 'vaniyambadi',
    addressLine: '44, Bazaar Road, Vaniyambadi',
    pincode: '635751',
    phone: '+919842010026',
    email: 'owner@vaniyambadiautomart.in',
    landline: '04174 22 1026',
    ownerName: 'M. Abdul Rahman',
    ownerRole: 'Director',
    establishedYear: 2003,
    specialities: ['Commercial vehicles', 'MUVs', 'Diesel'],
    medianResponseMins: 26,
  },
  {
    brandName: 'NH-44 Car Point',
    legalName: 'NH-44 Car Point LLP',
    tagline: 'Highway yard, open seven days.',
    about:
      'On the Chennai–Bengaluru highway with parking for twenty cars. We stay open on Sundays because that is when people actually come to look.',
    gstin: '33AACFN1027E1ZR',
    pan: 'AACFN1027E',
    town: 'vaniyambadi',
    addressLine: '2, NH-44 Service Road, Vaniyambadi',
    pincode: '635751',
    phone: '+919842010027',
    email: 'sales@nh44carpoint.in',
    landline: '04174 22 1027',
    ownerName: 'S. Ashok Kumar',
    ownerRole: 'Partner',
    establishedYear: 2017,
    specialities: ['SUVs', 'Sedans', 'Open Sundays'],
    medianResponseMins: 11,
  },
  {
    brandName: 'Vaniyambadi Family Cars',
    legalName: 'Vaniyambadi Family Cars Enterprises',
    tagline: 'First cars, second chances, fair paperwork.',
    about:
      'We sell mostly to first-time buyers, so we take the time to explain the insurance, the RC transfer and what the loan actually costs over five years.',
    gstin: '33AAFPV1028F1ZS',
    pan: 'AAFPV1028F',
    town: 'vaniyambadi',
    addressLine: '17, Ambur Road, Vaniyambadi',
    pincode: '635751',
    phone: '+919842010028',
    email: 'hello@vaniyambadifamilycars.in',
    landline: '04174 22 1028',
    ownerName: 'K. Fathima Begum',
    ownerRole: 'Proprietor',
    establishedYear: 2021,
    specialities: ['Hatchbacks', 'First-time buyers', 'RC transfer'],
    medianResponseMins: 21,
  },
  {
    brandName: 'Ambur Motor House',
    legalName: 'Ambur Motor House Pvt Ltd',
    tagline: 'Since 1996 — the oldest yard in the district.',
    about:
      'Three decades on Vellore Road. We have sold cars to the grandchildren of our first customers, and we still do the paperwork by hand because it never goes missing.',
    gstin: '33AABCA1029G1ZT',
    pan: 'AABCA1029G',
    town: 'ambur',
    addressLine: '12, Vellore Road, Ambur',
    pincode: '635802',
    phone: '+919842010029',
    email: 'owner@amburmotorhouse.in',
    landline: '04174 24 1029',
    ownerName: 'S. Mohammed Yusuf',
    ownerRole: 'Director',
    establishedYear: 1996,
    specialities: ['Sedans', 'Single-owner cars', 'MUVs'],
    medianResponseMins: 48,
  },
  {
    brandName: 'Ambur Star Autos',
    legalName: 'Ambur Star Autos LLP',
    tagline: 'Premium pre-owned, fully reconditioned.',
    about:
      'The upper end of the local market — executive sedans and full-size SUVs, each one reconditioned inside and out before it is photographed.',
    gstin: '33AACFA1030H1ZU',
    pan: 'AACFA1030H',
    town: 'ambur',
    addressLine: '3/45, Bypass Road, Ambur',
    pincode: '635802',
    phone: '+919842010030',
    email: 'sales@amburstarautos.in',
    landline: '04174 24 1030',
    ownerName: 'N. Imran Khan',
    ownerRole: 'Managing Partner',
    establishedYear: 2019,
    specialities: ['Luxury pre-owned', 'SUVs', 'Extended warranty'],
    medianResponseMins: 9,
  },
];

/**
 * The seed rows, with the town flattened in and the three derived columns built.
 *
 * `slug` is **derived rather than written**, through the same `dealerSlug` the
 * registration path uses. Thirty hand-typed slugs were thirty chances for the
 * seed to disagree with the function that produces every real one — and the
 * disagreement would be invisible, because a hand-typed slug is a perfectly
 * valid slug. Deriving it means correcting a town in `TOWNS` corrects the
 * addresses that follow from it, in the URL and in the bucket, without anybody
 * remembering to.
 *
 * `mapsUrl` is composed here rather than stored per dealer because these pins
 * are the town's, not the yard's — a real dealer pastes their own Share link at
 * onboarding, and inventing thirty distinct `maps.app.goo.gl` short codes would
 * be inventing links that resolve to nothing.
 */
export const DEV_DEALERS: DevDealerRow[] = DEALERS.map((dealer, index) => {
  const town = TOWNS[dealer.town];
  return {
    ...dealer,
    ...town,
    slug: dealerSlug({
      legalName: dealer.legalName,
      city: town.city,
      district: town.district,
      state: DEV_STATE,
    }),
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${String(town.lat)},${String(town.lng)}`,
    workingHours: hoursFor(index),
  };
});
