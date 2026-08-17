/**
 * Development seed data.
 *
 * The dealerships, the vehicles, their prices, their kilometre readings and
 * their statuses are taken from the interactive prototype
 * (`docs/Dealers-Drive-UI/Dealers-Drive.dc.html`) so that a freshly seeded
 * database renders the screens in `docs/screens/` rather than something that
 * merely contains the same kinds of data.
 */

export interface SeedCity {
  slug: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export const CITIES: SeedCity[] = [
  { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu', lat: 12.9165, lng: 79.1325 },
  { slug: 'katpadi', name: 'Katpadi', state: 'Tamil Nadu', lat: 12.9698, lng: 79.1378 },
  { slug: 'ranipet', name: 'Ranipet', state: 'Tamil Nadu', lat: 12.9277, lng: 79.3335 },
  { slug: 'arcot', name: 'Arcot', state: 'Tamil Nadu', lat: 12.9057, lng: 79.3199 },
  { slug: 'gudiyattam', name: 'Gudiyattam', state: 'Tamil Nadu', lat: 12.9463, lng: 78.8712 },
];

export const RTOS = [
  { code: 'TN-23', name: 'Vellore', city: 'Vellore', state: 'TN' },
  { code: 'TN-24', name: 'Vaniyambadi', city: 'Vaniyambadi', state: 'TN' },
  { code: 'TN-25', name: 'Tirupattur', city: 'Tirupattur', state: 'TN' },
  { code: 'TN-83', name: 'Ranipet', city: 'Ranipet', state: 'TN' },
  { code: 'TN-84', name: 'Arcot', city: 'Arcot', state: 'TN' },
  { code: 'TN-85', name: 'Gudiyattam', city: 'Gudiyattam', state: 'TN' },
];

/** Normalized so the filter can group "Pearl White" and "Arctic White" (§6.1). */
export const COLORS = [
  { slug: 'pearl-white', name: 'Pearl White', hex: '#F2F3F4', family: 'white', sortOrder: 1 },
  { slug: 'arctic-white', name: 'Arctic White', hex: '#FBFCFD', family: 'white', sortOrder: 2 },
  { slug: 'metallic-silver', name: 'Metallic Silver', hex: '#C6C9CE', family: 'silver', sortOrder: 3 },
  { slug: 'granite-grey', name: 'Granite Grey', hex: '#8A8F98', family: 'grey', sortOrder: 4 },
  { slug: 'midnight-black', name: 'Midnight Black', hex: '#15181D', family: 'black', sortOrder: 5 },
  { slug: 'fiery-red', name: 'Fiery Red', hex: '#B7202B', family: 'red', sortOrder: 6 },
  { slug: 'ocean-blue', name: 'Ocean Blue', hex: '#1E4B8F', family: 'blue', sortOrder: 7 },
  { slug: 'earth-brown', name: 'Earth Brown', hex: '#6B4A2F', family: 'brown', sortOrder: 8 },
];

export const FEATURES = [
  'Sunroof',
  '6 airbags',
  'ABS with EBD',
  'Android Auto',
  'Apple CarPlay',
  'Cruise control',
  'Reverse camera',
  'Push-button start',
  'Alloy wheels',
  'Climate control',
  'Rear defogger',
  'Leather seats',
  'Ventilated seats',
  '360 camera',
  'Hill hold assist',
];

export type SeedFuel = 'PETROL' | 'DIESEL' | 'CNG';
export type SeedTransmission = 'MANUAL' | 'AUTOMATIC';
export type SeedBody = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'MUV' | 'LUXURY';

export interface SeedVariant {
  slug: string;
  name: string;
  fuel: SeedFuel;
  transmission: SeedTransmission;
  engineCc: number;
  seats: number;
}

export interface SeedModel {
  slug: string;
  name: string;
  bodyType: SeedBody;
  yearFrom: number;
  variants: SeedVariant[];
}

export interface SeedMake {
  slug: string;
  name: string;
  popularity: number;
  models: SeedModel[];
}

export const MAKES: SeedMake[] = [
  {
    slug: 'maruti-suzuki',
    name: 'Maruti Suzuki',
    popularity: 100,
    models: [
      {
        slug: 'swift',
        name: 'Swift',
        bodyType: 'HATCHBACK',
        yearFrom: 2005,
        variants: [
          { slug: 'vxi', name: 'VXi', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 1197, seats: 5 },
          { slug: 'zxi-plus', name: 'ZXi+', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 1197, seats: 5 },
        ],
      },
      {
        slug: 'baleno',
        name: 'Baleno',
        bodyType: 'HATCHBACK',
        yearFrom: 2015,
        variants: [
          { slug: 'zeta-at', name: 'Zeta AT', fuel: 'PETROL', transmission: 'AUTOMATIC', engineCc: 1197, seats: 5 },
          { slug: 'delta', name: 'Delta', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 1197, seats: 5 },
        ],
      },
      {
        slug: 'dzire',
        name: 'Dzire',
        bodyType: 'SEDAN',
        yearFrom: 2008,
        variants: [
          { slug: 'zxi', name: 'ZXi', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 1197, seats: 5 },
        ],
      },
      {
        slug: 'ertiga',
        name: 'Ertiga',
        bodyType: 'MUV',
        yearFrom: 2012,
        variants: [
          { slug: 'vdi', name: 'VDi', fuel: 'DIESEL', transmission: 'MANUAL', engineCc: 1248, seats: 7 },
        ],
      },
      {
        slug: 'celerio',
        name: 'Celerio',
        bodyType: 'HATCHBACK',
        yearFrom: 2014,
        variants: [
          { slug: 'vxi-amt', name: 'VXi AMT', fuel: 'PETROL', transmission: 'AUTOMATIC', engineCc: 998, seats: 5 },
        ],
      },
      {
        slug: 'alto-800',
        name: 'Alto 800',
        bodyType: 'HATCHBACK',
        yearFrom: 2012,
        variants: [
          { slug: 'lxi', name: 'LXi', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 796, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'hyundai',
    name: 'Hyundai',
    popularity: 92,
    models: [
      {
        slug: 'creta',
        name: 'Creta',
        bodyType: 'SUV',
        yearFrom: 2015,
        variants: [
          { slug: '1-6-sx-o', name: '1.6 SX(O)', fuel: 'DIESEL', transmission: 'MANUAL', engineCc: 1582, seats: 5 },
        ],
      },
      {
        slug: 'i20',
        name: 'i20',
        bodyType: 'HATCHBACK',
        yearFrom: 2008,
        variants: [
          { slug: 'asta', name: 'Asta', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 1197, seats: 5 },
        ],
      },
      {
        slug: 'venue',
        name: 'Venue',
        bodyType: 'SUV',
        yearFrom: 2019,
        variants: [
          { slug: 'sx-turbo', name: 'SX Turbo', fuel: 'PETROL', transmission: 'AUTOMATIC', engineCc: 998, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'toyota',
    name: 'Toyota',
    popularity: 88,
    models: [
      {
        slug: 'fortuner',
        name: 'Fortuner',
        bodyType: 'SUV',
        yearFrom: 2009,
        variants: [
          { slug: '2-8-4x2-at', name: '2.8 4x2 AT', fuel: 'DIESEL', transmission: 'AUTOMATIC', engineCc: 2755, seats: 7 },
        ],
      },
      {
        slug: 'innova-crysta',
        name: 'Innova Crysta',
        bodyType: 'MUV',
        yearFrom: 2016,
        variants: [
          { slug: '2-4-vx', name: '2.4 VX', fuel: 'DIESEL', transmission: 'MANUAL', engineCc: 2393, seats: 7 },
        ],
      },
    ],
  },
  {
    slug: 'honda',
    name: 'Honda',
    popularity: 80,
    models: [
      {
        slug: 'city',
        name: 'City',
        bodyType: 'SEDAN',
        yearFrom: 2008,
        variants: [
          { slug: 'zx-cvt', name: 'ZX CVT', fuel: 'PETROL', transmission: 'AUTOMATIC', engineCc: 1498, seats: 5 },
        ],
      },
      {
        slug: 'jazz',
        name: 'Jazz',
        bodyType: 'HATCHBACK',
        yearFrom: 2009,
        variants: [
          { slug: 'v-cvt', name: 'V CVT', fuel: 'PETROL', transmission: 'AUTOMATIC', engineCc: 1199, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'tata',
    name: 'Tata',
    popularity: 78,
    models: [
      {
        slug: 'nexon',
        name: 'Nexon',
        bodyType: 'SUV',
        yearFrom: 2017,
        variants: [
          { slug: 'xz-plus', name: 'XZ+', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 1199, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'kia',
    name: 'Kia',
    popularity: 74,
    models: [
      {
        slug: 'seltos',
        name: 'Seltos',
        bodyType: 'SUV',
        yearFrom: 2019,
        variants: [
          { slug: 'htx', name: 'HTX', fuel: 'PETROL', transmission: 'AUTOMATIC', engineCc: 1497, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'mahindra',
    name: 'Mahindra',
    popularity: 70,
    models: [
      {
        slug: 'xuv300',
        name: 'XUV300',
        bodyType: 'SUV',
        yearFrom: 2019,
        variants: [
          { slug: 'w8-o', name: 'W8 (O)', fuel: 'DIESEL', transmission: 'MANUAL', engineCc: 1497, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'ford',
    name: 'Ford',
    popularity: 50,
    models: [
      {
        slug: 'ecosport',
        name: 'EcoSport',
        bodyType: 'SUV',
        yearFrom: 2013,
        variants: [
          { slug: 'titanium', name: 'Titanium', fuel: 'DIESEL', transmission: 'MANUAL', engineCc: 1498, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'renault',
    name: 'Renault',
    popularity: 48,
    models: [
      {
        slug: 'triber',
        name: 'Triber',
        bodyType: 'MUV',
        yearFrom: 2019,
        variants: [
          { slug: 'rxz', name: 'RXZ', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 999, seats: 7 },
        ],
      },
    ],
  },
  {
    slug: 'skoda',
    name: 'Skoda',
    popularity: 46,
    models: [
      {
        slug: 'slavia',
        name: 'Slavia',
        bodyType: 'SEDAN',
        yearFrom: 2022,
        variants: [
          { slug: 'style-1-0-at', name: 'Style 1.0 AT', fuel: 'PETROL', transmission: 'AUTOMATIC', engineCc: 999, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'jeep',
    name: 'Jeep',
    popularity: 44,
    models: [
      {
        slug: 'compass',
        name: 'Compass',
        bodyType: 'SUV',
        yearFrom: 2017,
        variants: [
          { slug: 'longitude-4x2', name: 'Longitude 4x2', fuel: 'DIESEL', transmission: 'AUTOMATIC', engineCc: 1956, seats: 5 },
        ],
      },
    ],
  },
  {
    slug: 'datsun',
    name: 'Datsun',
    popularity: 30,
    models: [
      {
        slug: 'go-plus',
        name: 'GO+',
        bodyType: 'MUV',
        yearFrom: 2015,
        variants: [
          { slug: 't-option', name: 'T Option', fuel: 'PETROL', transmission: 'MANUAL', engineCc: 1198, seats: 7 },
        ],
      },
    ],
  },
];

export interface SeedDealer {
  key: string;
  slug: string;
  brandName: string;
  legalName: string;
  tagline: string;
  about: string;
  services: string[];
  gstin: string;
  pan: string;
  citySlug: string;
  addressLine: string;
  pincode: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  landline: string;
  ownerName: string;
  ownerRole: string;
  establishedYear: number;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED';
  medianResponseMins: number | null;
  startingCredits: number;
}

export const DEALERS: SeedDealer[] = [
  {
    key: 'sl',
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    legalName: 'Sri Lakshmi Automobiles Pvt Ltd',
    tagline: 'Family-run since 2014 — single-owner cars with full service history.',
    about:
      'A family-run dealership operating on Katpadi Main Road since 2014. We buy directly from single-owner customers in and around Vellore, put every car through a 120-point check at our own workshop, and sell with the full service history in hand. RC transfer, loan tie-ups and insurance renewal are handled in-house.',
    services: [
      'In-house workshop',
      'RC transfer assistance',
      'Bank loan tie-ups',
      'Exchange accepted',
      '7-day return window',
    ],
    gstin: '33AABCS1429P1ZK',
    pan: 'AABCS1429P',
    citySlug: 'vellore',
    addressLine: '14, Katpadi Main Road, Gandhi Nagar',
    pincode: '632006',
    lat: 12.9165,
    lng: 79.1325,
    phone: '+919840012345',
    email: 'owner@srilakshmimotors.in',
    landline: '0416 224 8890',
    ownerName: 'R. Manikandan',
    ownerRole: 'Proprietor',
    establishedYear: 2014,
    status: 'ACTIVE',
    medianResponseMins: 96,
    startingCredits: 23,
  },
  {
    key: 'ah',
    slug: 'anbu-auto-hub',
    brandName: 'Anbu Auto Hub',
    legalName: 'Anbu Automobiles',
    tagline: 'Well-kept hatchbacks and compact SUVs under ₹12 Lakh.',
    about:
      'Katpadi-based multi-brand dealership focused on well-kept hatchbacks and compact SUVs under ₹12 Lakh. Every vehicle is sourced locally and inspected before listing.',
    services: ['Multi-brand inventory', 'Free first service', 'Exchange accepted'],
    gstin: '33AAFCA8821K1ZP',
    pan: 'AAFCA8821K',
    citySlug: 'katpadi',
    addressLine: '221, Bagayam Road, Katpadi',
    pincode: '632007',
    lat: 12.9698,
    lng: 79.1378,
    phone: '+919003144521',
    email: 'anbu@anbuautohub.in',
    landline: '0416 227 3310',
    ownerName: 'S. Anbarasu',
    ownerRole: 'Owner',
    establishedYear: 2019,
    status: 'ACTIVE',
    medianResponseMins: 135,
    startingCredits: 14,
  },
  {
    key: 'vc',
    slug: 'velavan-cars',
    brandName: 'Velavan Cars',
    legalName: 'Velavan Motors Pvt Ltd',
    tagline: 'Premium SUVs and executive sedans, in Vellore town since 2011.',
    about:
      'The oldest independent used-car dealership in Vellore town, specialising in premium SUVs and executive sedans. Extended warranty available on vehicles under 60,000 km.',
    services: [
      'Premium inventory',
      'Extended warranty',
      'Doorstep test drive',
      'Bank loan tie-ups',
    ],
    gstin: '33AACCV3391M1ZR',
    pan: 'AACCV3391M',
    citySlug: 'vellore',
    addressLine: '5, Officers Line',
    pincode: '632001',
    lat: 12.9202,
    lng: 79.1364,
    phone: '+919444190210',
    email: 'sales@velavancars.in',
    landline: '0416 222 4477',
    ownerName: 'K. Velavan',
    ownerRole: 'Managing Partner',
    establishedYear: 2011,
    status: 'ACTIVE',
    medianResponseMins: 74,
    startingCredits: 31,
  },
  {
    key: 'mm',
    slug: 'mrv-motors',
    brandName: 'MRV Motors',
    legalName: 'MRV Motors',
    tagline: 'Budget hatchbacks and MUVs across the Arcot–Ranipet belt.',
    about:
      'Ranipet dealership dealing mainly in budget hatchbacks and MUVs for first-time buyers across the Arcot–Ranipet belt.',
    services: ['Budget inventory', 'First-time buyer support', 'Exchange accepted'],
    gstin: '33AAKCM5512J1ZQ',
    pan: 'AAKCM5512J',
    citySlug: 'ranipet',
    addressLine: '88, Arcot Road',
    pincode: '632401',
    lat: 12.9277,
    lng: 79.3335,
    phone: '+919940177362',
    email: 'contact@mrvmotors.in',
    landline: '04172 24 5566',
    ownerName: 'M. Raghuvaran',
    ownerRole: 'Proprietor',
    establishedYear: 2021,
    status: 'ACTIVE',
    medianResponseMins: 210,
    startingCredits: 9,
  },
  {
    key: 'gc',
    slug: 'gokul-cars',
    brandName: 'Gokul Cars',
    legalName: 'Gokul Cars & Finance',
    tagline: 'Arcot-based dealer awaiting verification.',
    about: 'Arcot dealership applying to join Dealers-Drive.',
    services: ['Exchange accepted'],
    gstin: '33AAGCG7781L1ZW',
    pan: 'AAGCG7781L',
    citySlug: 'arcot',
    addressLine: '19, Ranipet Main Road',
    pincode: '632503',
    lat: 12.9057,
    lng: 79.3199,
    phone: '+919865471120',
    email: 'gokul@gokulcars.in',
    landline: '04172 22 1188',
    ownerName: 'G. Sathish',
    ownerRole: 'Proprietor',
    establishedYear: 2023,
    status: 'PENDING_APPROVAL',
    medianResponseMins: null,
    startingCredits: 0,
  },
];

export type SeedListingState =
  | 'ACTIVE'
  | 'PENDING'
  | 'DRAFT'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SOLD'
  | 'CHANGES_REQUESTED';

export interface SeedVehicle {
  ref: string;
  dealerKey: string;
  makeSlug: string;
  modelSlug: string;
  variantSlug: string;
  year: number;
  pricePaise: number;
  km: number;
  fuel: SeedFuel;
  transmission: SeedTransmission;
  bodyType: SeedBody;
  owners: number;
  citySlug: string;
  colorSlug: string;
  rtoCode: string;
  seats: number;
  airbags: number;
  state: SeedListingState;
  /** Days ago the listing was approved; drives `expiresAt` and the sort order. */
  approvedDaysAgo?: number;
  views: number;
  enquiries: number;
  description: string;
  features: string[];
  reason?: string;
}

const DESC_A =
  'Single owner, serviced only at the authorised service centre with the full history available for inspection at our yard. Original paint on every panel, new tyres fitted this year, and the insurance is transferable. RC transfer and loan assistance handled in-house.';
const DESC_B =
  'Well-maintained example bought directly from its previous owner in Vellore and put through our 120-point workshop check before listing. Clutch and brakes replaced during the last service; interiors are clean and smoke-free. Available for inspection any day of the week.';
const DESC_C =
  'Regularly serviced family car with genuine kilometres and a complete service book. Recent work includes a new battery and a full suspension check. We handle RC transfer, insurance renewal and bank finance at the yard.';

export const VEHICLES: SeedVehicle[] = [
  { ref: 'v1', dealerKey: 'sl', makeSlug: 'maruti-suzuki', modelSlug: 'swift', variantSlug: 'vxi', year: 2021, pricePaise: 64500000, km: 42180, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'HATCHBACK', owners: 1, citySlug: 'vellore', colorSlug: 'pearl-white', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 34, views: 412, enquiries: 9, description: DESC_A, features: ['Android Auto', 'Reverse camera', 'Alloy wheels', 'Climate control', 'ABS with EBD'] },
  { ref: 'v2', dealerKey: 'ah', makeSlug: 'hyundai', modelSlug: 'creta', variantSlug: '1-6-sx-o', year: 2019, pricePaise: 112000000, km: 61340, fuel: 'DIESEL', transmission: 'MANUAL', bodyType: 'SUV', owners: 2, citySlug: 'katpadi', colorSlug: 'granite-grey', rtoCode: 'TN-23', seats: 5, airbags: 6, state: 'ACTIVE', approvedDaysAgo: 12, views: 688, enquiries: 14, description: DESC_B, features: ['Sunroof', '6 airbags', 'Cruise control', 'Reverse camera', 'Climate control', 'Alloy wheels'] },
  { ref: 'v3', dealerKey: 'vc', makeSlug: 'toyota', modelSlug: 'fortuner', variantSlug: '2-8-4x2-at', year: 2021, pricePaise: 285000000, km: 38900, fuel: 'DIESEL', transmission: 'AUTOMATIC', bodyType: 'SUV', owners: 1, citySlug: 'vellore', colorSlug: 'arctic-white', rtoCode: 'TN-23', seats: 7, airbags: 7, state: 'ACTIVE', approvedDaysAgo: 27, views: 1204, enquiries: 27, description: DESC_A, features: ['Sunroof', '6 airbags', 'ABS with EBD', 'Android Auto', 'Cruise control', 'Reverse camera', 'Push-button start', 'Alloy wheels', 'Climate control'] },
  { ref: 'v4', dealerKey: 'sl', makeSlug: 'honda', modelSlug: 'city', variantSlug: 'zx-cvt', year: 2020, pricePaise: 98500000, km: 34520, fuel: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'SEDAN', owners: 1, citySlug: 'gudiyattam', colorSlug: 'metallic-silver', rtoCode: 'TN-85', seats: 5, airbags: 6, state: 'ACTIVE', approvedDaysAgo: 48, views: 531, enquiries: 11, description: DESC_C, features: ['Sunroof', 'Apple CarPlay', 'Cruise control', 'Reverse camera', 'Climate control'] },
  { ref: 'v5', dealerKey: 'mm', makeSlug: 'maruti-suzuki', modelSlug: 'ertiga', variantSlug: 'vdi', year: 2018, pricePaise: 71000000, km: 88400, fuel: 'DIESEL', transmission: 'MANUAL', bodyType: 'MUV', owners: 2, citySlug: 'ranipet', colorSlug: 'metallic-silver', rtoCode: 'TN-83', seats: 7, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 9, views: 297, enquiries: 6, description: DESC_C, features: ['ABS with EBD', 'Rear defogger', 'Climate control'] },
  { ref: 'v6', dealerKey: 'ah', makeSlug: 'tata', modelSlug: 'nexon', variantSlug: 'xz-plus', year: 2022, pricePaise: 94000000, km: 21760, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'SUV', owners: 1, citySlug: 'vellore', colorSlug: 'fiery-red', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 3, views: 744, enquiries: 18, description: DESC_A, features: ['Sunroof', 'Android Auto', 'Reverse camera', 'Alloy wheels', 'Climate control', 'Push-button start'] },
  { ref: 'v7', dealerKey: 'mm', makeSlug: 'hyundai', modelSlug: 'i20', variantSlug: 'asta', year: 2017, pricePaise: 52500000, km: 74900, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'HATCHBACK', owners: 3, citySlug: 'arcot', colorSlug: 'ocean-blue', rtoCode: 'TN-84', seats: 5, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 61, views: 203, enquiries: 4, description: DESC_C, features: ['ABS with EBD', 'Rear defogger', 'Alloy wheels'] },
  { ref: 'v8', dealerKey: 'vc', makeSlug: 'kia', modelSlug: 'seltos', variantSlug: 'htx', year: 2023, pricePaise: 159000000, km: 18240, fuel: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'SUV', owners: 1, citySlug: 'vellore', colorSlug: 'midnight-black', rtoCode: 'TN-23', seats: 5, airbags: 6, state: 'ACTIVE', approvedDaysAgo: 1, views: 961, enquiries: 22, description: DESC_A, features: ['Sunroof', '6 airbags', 'Ventilated seats', '360 camera', 'Cruise control', 'Push-button start', 'Climate control'] },
  { ref: 'v9', dealerKey: 'sl', makeSlug: 'mahindra', modelSlug: 'xuv300', variantSlug: 'w8-o', year: 2020, pricePaise: 87500000, km: 52300, fuel: 'DIESEL', transmission: 'MANUAL', bodyType: 'SUV', owners: 1, citySlug: 'vellore', colorSlug: 'ocean-blue', rtoCode: 'TN-23', seats: 5, airbags: 7, state: 'PENDING', views: 0, enquiries: 0, description: DESC_B, features: ['Sunroof', '6 airbags', 'Hill hold assist', 'Reverse camera', 'Climate control'] },
  { ref: 'v10', dealerKey: 'sl', makeSlug: 'ford', modelSlug: 'ecosport', variantSlug: 'titanium', year: 2016, pricePaise: 49500000, km: 96500, fuel: 'DIESEL', transmission: 'MANUAL', bodyType: 'SUV', owners: 2, citySlug: 'vellore', colorSlug: 'fiery-red', rtoCode: 'TN-23', seats: 5, airbags: 6, state: 'REJECTED', views: 0, enquiries: 0, description: DESC_C, features: ['ABS with EBD', 'Rear defogger', 'Alloy wheels'], reason: 'Odometer photo does not match the declared KM reading.' },
  { ref: 'v11', dealerKey: 'sl', makeSlug: 'maruti-suzuki', modelSlug: 'dzire', variantSlug: 'zxi', year: 2019, pricePaise: 64000000, km: 57200, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'SEDAN', owners: 1, citySlug: 'vellore', colorSlug: 'metallic-silver', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 38, views: 388, enquiries: 8, description: DESC_A, features: ['Android Auto', 'Reverse camera', 'Climate control', 'Alloy wheels'] },
  { ref: 'v12', dealerKey: 'sl', makeSlug: 'hyundai', modelSlug: 'venue', variantSlug: 'sx-turbo', year: 2021, pricePaise: 96500000, km: 31450, fuel: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'SUV', owners: 1, citySlug: 'vellore', colorSlug: 'pearl-white', rtoCode: 'TN-23', seats: 5, airbags: 6, state: 'ACTIVE', approvedDaysAgo: 22, views: 502, enquiries: 12, description: DESC_B, features: ['Sunroof', 'Apple CarPlay', 'Cruise control', 'Push-button start', 'Climate control'] },
  { ref: 'v13', dealerKey: 'ah', makeSlug: 'maruti-suzuki', modelSlug: 'celerio', variantSlug: 'vxi-amt', year: 2017, pricePaise: 38500000, km: 68900, fuel: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'HATCHBACK', owners: 2, citySlug: 'katpadi', colorSlug: 'arctic-white', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 66, views: 241, enquiries: 5, description: DESC_C, features: ['ABS with EBD', 'Rear defogger'] },
  { ref: 'v14', dealerKey: 'ah', makeSlug: 'renault', modelSlug: 'triber', variantSlug: 'rxz', year: 2020, pricePaise: 58500000, km: 44300, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'MUV', owners: 1, citySlug: 'katpadi', colorSlug: 'earth-brown', rtoCode: 'TN-23', seats: 7, airbags: 4, state: 'ACTIVE', approvedDaysAgo: 6, views: 319, enquiries: 7, description: DESC_A, features: ['Android Auto', 'Reverse camera', 'Climate control'] },
  { ref: 'v15', dealerKey: 'ah', makeSlug: 'honda', modelSlug: 'jazz', variantSlug: 'v-cvt', year: 2018, pricePaise: 56200000, km: 63100, fuel: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'HATCHBACK', owners: 2, citySlug: 'katpadi', colorSlug: 'granite-grey', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 44, views: 276, enquiries: 6, description: DESC_C, features: ['ABS with EBD', 'Climate control', 'Alloy wheels'] },
  { ref: 'v16', dealerKey: 'vc', makeSlug: 'skoda', modelSlug: 'slavia', variantSlug: 'style-1-0-at', year: 2022, pricePaise: 148500000, km: 22800, fuel: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'SEDAN', owners: 1, citySlug: 'vellore', colorSlug: 'fiery-red', rtoCode: 'TN-23', seats: 5, airbags: 6, state: 'ACTIVE', approvedDaysAgo: 4, views: 812, enquiries: 19, description: DESC_A, features: ['Sunroof', '6 airbags', 'Ventilated seats', 'Cruise control', 'Push-button start'] },
  { ref: 'v17', dealerKey: 'vc', makeSlug: 'toyota', modelSlug: 'innova-crysta', variantSlug: '2-4-vx', year: 2019, pricePaise: 179000000, km: 71400, fuel: 'DIESEL', transmission: 'MANUAL', bodyType: 'MUV', owners: 1, citySlug: 'vellore', colorSlug: 'metallic-silver', rtoCode: 'TN-23', seats: 7, airbags: 7, state: 'ACTIVE', approvedDaysAgo: 31, views: 1043, enquiries: 24, description: DESC_B, features: ['Leather seats', 'Cruise control', 'Reverse camera', 'Climate control', 'Alloy wheels'] },
  { ref: 'v18', dealerKey: 'vc', makeSlug: 'jeep', modelSlug: 'compass', variantSlug: 'longitude-4x2', year: 2020, pricePaise: 168500000, km: 48600, fuel: 'DIESEL', transmission: 'AUTOMATIC', bodyType: 'SUV', owners: 2, citySlug: 'vellore', colorSlug: 'midnight-black', rtoCode: 'TN-23', seats: 5, airbags: 6, state: 'ACTIVE', approvedDaysAgo: 10, views: 733, enquiries: 15, description: DESC_A, features: ['Sunroof', '6 airbags', 'Leather seats', 'Cruise control', '360 camera'] },
  { ref: 'v19', dealerKey: 'mm', makeSlug: 'maruti-suzuki', modelSlug: 'alto-800', variantSlug: 'lxi', year: 2015, pricePaise: 22500000, km: 82400, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'HATCHBACK', owners: 3, citySlug: 'ranipet', colorSlug: 'arctic-white', rtoCode: 'TN-83', seats: 5, airbags: 1, state: 'ACTIVE', approvedDaysAgo: 55, views: 164, enquiries: 3, description: DESC_C, features: ['Rear defogger'] },
  { ref: 'v20', dealerKey: 'mm', makeSlug: 'datsun', modelSlug: 'go-plus', variantSlug: 't-option', year: 2018, pricePaise: 34200000, km: 59700, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'MUV', owners: 2, citySlug: 'arcot', colorSlug: 'ocean-blue', rtoCode: 'TN-84', seats: 7, airbags: 2, state: 'ACTIVE', approvedDaysAgo: 18, views: 198, enquiries: 4, description: DESC_C, features: ['ABS with EBD', 'Rear defogger'] },
  { ref: 'v21', dealerKey: 'vc', makeSlug: 'honda', modelSlug: 'city', variantSlug: 'zx-cvt', year: 2018, pricePaise: 82000000, km: 66200, fuel: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'SEDAN', owners: 2, citySlug: 'vellore', colorSlug: 'granite-grey', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'EXPIRED', approvedDaysAgo: 94, views: 623, enquiries: 13, description: DESC_C, features: ['Cruise control', 'Reverse camera', 'Climate control'] },
  { ref: 'v22', dealerKey: 'sl', makeSlug: 'maruti-suzuki', modelSlug: 'baleno', variantSlug: 'delta', year: 2019, pricePaise: 61000000, km: 49800, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'HATCHBACK', owners: 1, citySlug: 'vellore', colorSlug: 'ocean-blue', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'SOLD', approvedDaysAgo: 70, views: 455, enquiries: 16, description: DESC_A, features: ['Android Auto', 'Reverse camera', 'Alloy wheels'] },
  { ref: 'v23', dealerKey: 'sl', makeSlug: 'maruti-suzuki', modelSlug: 'swift', variantSlug: 'zxi-plus', year: 2022, pricePaise: 76500000, km: 27600, fuel: 'PETROL', transmission: 'MANUAL', bodyType: 'HATCHBACK', owners: 1, citySlug: 'vellore', colorSlug: 'fiery-red', rtoCode: 'TN-23', seats: 5, airbags: 2, state: 'DRAFT', views: 0, enquiries: 0, description: '', features: [] },
];

/** The four photo slots the add-vehicle wizard names, then the rest of the set. */
export const PHOTO_LABELS = [
  'Three-quarter front',
  'Rear three-quarter',
  'Interior — front seats',
  'Odometer reading',
  'Dashboard',
  'Rear seats',
  'Boot space',
  'Alloy wheels',
];

export const CREDIT_PACKS = [
  { slug: 'pack-10', credits: 10, pricePaise: 450000, badge: null, highlighted: false, sortOrder: 1 },
  { slug: 'pack-25', credits: 25, pricePaise: 1000000, badge: 'Most popular', highlighted: true, sortOrder: 2 },
  { slug: 'pack-50', credits: 50, pricePaise: 1750000, badge: null, highlighted: false, sortOrder: 3 },
  { slug: 'pack-100', credits: 100, pricePaise: 3000000, badge: 'Best value', highlighted: false, sortOrder: 4 },
];

export interface SeedEnquiry {
  dealerKey: string;
  vehicleRef: string | null;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  source: 'LISTING_PAGE' | 'CALL_BUTTON' | 'DEALER_PAGE';
  status: 'NEW' | 'CONTACTED' | 'CLOSED' | 'SPAM';
  minutesAgo: number;
}

export const ENQUIRIES: SeedEnquiry[] = [
  { dealerKey: 'sl', vehicleRef: 'v1', name: 'Karthik Raja', phone: '+919840722118', email: 'karthik.raja@example.com', message: 'Is the price negotiable? Can I see it on Saturday morning?', source: 'LISTING_PAGE', status: 'NEW', minutesAgo: 18 },
  { dealerKey: 'sl', vehicleRef: null, name: 'Arun Fernandes', phone: '+919940155219', email: null, message: 'Interested if you can include a new set of tyres.', source: 'DEALER_PAGE', status: 'NEW', minutesAgo: 2880 },
  { dealerKey: 'sl', vehicleRef: 'v12', name: 'Priya Selvam', phone: '+919003188420', email: 'priya.s@example.com', message: 'Do you have any automatic hatchbacks under ₹7 Lakh?', source: 'LISTING_PAGE', status: 'NEW', minutesAgo: 220 },
  { dealerKey: 'sl', vehicleRef: 'v11', name: 'Caller', phone: '+919566210044', email: null, message: null, source: 'CALL_BUTTON', status: 'NEW', minutesAgo: 95 },
  { dealerKey: 'sl', vehicleRef: 'v4', name: 'Vignesh Kumar', phone: '+919789234561', email: 'vignesh@example.com', message: 'Can you send the service history?', source: 'LISTING_PAGE', status: 'CONTACTED', minutesAgo: 4320 },
  { dealerKey: 'sl', vehicleRef: 'v1', name: 'Deepa Ravi', phone: '+919600114477', email: null, message: 'What is the final price?', source: 'LISTING_PAGE', status: 'CONTACTED', minutesAgo: 7200 },
  { dealerKey: 'sl', vehicleRef: 'v22', name: 'Suresh Babu', phone: '+919345667788', email: 'suresh.b@example.com', message: 'Booked. Thanks.', source: 'LISTING_PAGE', status: 'CLOSED', minutesAgo: 12960 },
  { dealerKey: 'sl', vehicleRef: null, name: 'Loan Offer', phone: '+917000000000', email: null, message: 'Get instant business loan approval today!!!', source: 'DEALER_PAGE', status: 'SPAM', minutesAgo: 5760 },
  { dealerKey: 'vc', vehicleRef: 'v3', name: 'Mohan Das', phone: '+919841234567', email: 'mohan@example.com', message: 'Is the Fortuner still available?', source: 'LISTING_PAGE', status: 'NEW', minutesAgo: 40 },
  { dealerKey: 'vc', vehicleRef: 'v8', name: 'Lakshmi Narayanan', phone: '+919677889900', email: null, message: 'Interested in a test drive this weekend.', source: 'LISTING_PAGE', status: 'CONTACTED', minutesAgo: 1440 },
  { dealerKey: 'ah', vehicleRef: 'v6', name: 'Ramesh S', phone: '+919655443322', email: null, message: 'Exchange possible for my Alto?', source: 'LISTING_PAGE', status: 'NEW', minutesAgo: 300 },
];
