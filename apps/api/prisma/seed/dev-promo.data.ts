/**
 * The promotional demo — the story the Dealers-Drive promo film is shot
 * against, for local development only.
 *
 *     pnpm --filter @dealers-drive/api db:seed:promo
 *
 * ── What it adds on top of `db:seed:dev` ────────────────────────────────────
 * Nothing here is a new concept. It fills out rows the dev seed already has,
 * so the film can show them the way a working marketplace looks:
 *
 *   · **Green Circle Cars, Vellore** — an existing dev dealership, and the
 *     one the film features — gets seven more cars, spread across every state
 *     a dealer drives a listing through (active, reserved, sold, withdrawn,
 *     in review). The dev seed deals at most five cars to a dealership, which
 *     is too few to show an inventory being managed.
 *   · **Four customers and their enquiries** to Green Circle, so the inbox
 *     and the dashboard have something in them before the film's own enquiry
 *     arrives.
 *   · **Arjun Raman**, the customer the film follows. He exists so the film
 *     can sign him in by phone; his enquiries and saved cars are cleared on
 *     every run, so the enquiry he sends on camera is always his first.
 *   · **Metro Motors' owner**, a dealer who has proved his phone and linked a
 *     Google account but not yet started onboarding — the state the account
 *     step asks for, and one a local machine cannot reach on its own because
 *     Google sign-in needs real credentials. Any dealership he started on a
 *     previous run is deleted, so onboarding always starts at step one.
 *
 * ── Fictional, and recognisably so ──────────────────────────────────────────
 * Every name, number and address below is invented. The phone numbers sit in
 * one block, +91 90000 1xxxx to 3xxxx, so a screenshot that shows one is
 * obviously demo data, and every email is on `example.com`, which cannot
 * receive mail.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { DevListingStatus } from './dev-vehicles.data.js';

export const PROMO_DEALER_GSTIN = '33AACFG1002D1ZQ';

export const PROMO_PUBLISHED_ANCHOR = new Date('2026-09-28T06:30:00.000Z');

type Fuel = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC' | 'HYBRID';
type Gearbox = 'MANUAL' | 'AUTOMATIC';
type Body = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'MUV' | 'LUXURY';
type Colour =
  | 'BLACK'
  | 'WHITE'
  | 'GREY'
  | 'SILVER'
  | 'RED'
  | 'BLUE'
  | 'GREEN'
  | 'BROWN'
  | 'BEIGE'
  | 'YELLOW'
  | 'ORANGE'
  | 'OTHER';

export interface PromoVehicle {
  key: string;
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  fuelType: Fuel;
  transmission: Gearbox;
  bodyType: Body;
  kilometersDriven: number;
  ownerCount: number;
  color: Colour;
  priceRupees: number;
  status: DevListingStatus;
  daysBeforeAnchor: number;
  description: string;
  withdrawalReason?: 'TEMPORARILY_PAUSED';
}

export const PROMO_VEHICLES: readonly PromoVehicle[] = [
  {
    key: 'creta',
    registrationNumber: 'TN23DD2001',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX(O)',
    year: 2021,
    fuelType: 'DIESEL',
    transmission: 'AUTOMATIC',
    bodyType: 'SUV',
    kilometersDriven: 42_300,
    ownerCount: 1,
    color: 'WHITE',
    priceRupees: 13_45_000,
    status: 'ACTIVE',
    daysBeforeAnchor: 0,
    description:
      'Single-owner Creta, serviced at the authorised workshop in Vellore every 10,000 km. Panoramic sunroof, ventilated front seats and a new set of tyres at 38,000 km.',
  },
  {
    key: 'seltos',
    registrationNumber: 'TN23DD2002',
    make: 'Kia',
    model: 'Seltos',
    variant: 'HTX',
    year: 2022,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'SUV',
    kilometersDriven: 28_600,
    ownerCount: 1,
    color: 'GREY',
    priceRupees: 12_75_000,
    status: 'ACTIVE',
    daysBeforeAnchor: 1,
    description: 'City-driven Seltos with the full service record and both keys.',
  },
  {
    key: 'nexon',
    registrationNumber: 'TN23DD2003',
    make: 'Tata',
    model: 'Nexon',
    variant: 'Creative',
    year: 2023,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SUV',
    kilometersDriven: 14_800,
    ownerCount: 1,
    color: 'BLUE',
    priceRupees: 10_40_000,
    status: 'ACTIVE',
    daysBeforeAnchor: 2,
    description: 'Nearly new Nexon automatic, under the manufacturer warranty until 2026.',
  },
  {
    key: 'xuv300',
    registrationNumber: 'TN23DD2004',
    make: 'Mahindra',
    model: 'XUV300',
    variant: 'W8(O)',
    year: 2020,
    fuelType: 'DIESEL',
    transmission: 'MANUAL',
    bodyType: 'SUV',
    kilometersDriven: 51_200,
    ownerCount: 1,
    color: 'RED',
    priceRupees: 8_95_000,
    status: 'RESERVED',
    daysBeforeAnchor: 6,
    description: 'Top-trim XUV300 diesel with six airbags and a sunroof.',
  },
  {
    key: 'ertiga',
    registrationNumber: 'TN23DD2005',
    make: 'Maruti Suzuki',
    model: 'Ertiga',
    variant: 'ZXi',
    year: 2019,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'MUV',
    kilometersDriven: 63_900,
    ownerCount: 2,
    color: 'SILVER',
    priceRupees: 7_85_000,
    status: 'SOLD',
    daysBeforeAnchor: 12,
    description: 'Seven-seater Ertiga, second owner, family-maintained.',
  },
  {
    key: 'city',
    registrationNumber: 'TN23DD2006',
    make: 'Honda',
    model: 'City',
    variant: 'VX',
    year: 2021,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SEDAN',
    kilometersDriven: 36_100,
    ownerCount: 1,
    color: 'BROWN',
    priceRupees: 11_20_000,
    status: 'WITHDRAWN',
    daysBeforeAnchor: 9,
    withdrawalReason: 'TEMPORARILY_PAUSED',
    description: 'City VX CVT, back on sale once the insurance renewal is through.',
  },
  {
    key: 'venue',
    registrationNumber: 'TN23DD2007',
    make: 'Hyundai',
    model: 'Venue',
    variant: 'SX',
    year: 2022,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'SUV',
    kilometersDriven: 22_400,
    ownerCount: 1,
    color: 'ORANGE',
    priceRupees: 8_60_000,
    status: 'PENDING_REVIEW',
    daysBeforeAnchor: 0,
    description: 'Venue SX with the connected-car pack, submitted for photography.',
  },
];

export interface PromoCustomer {
  key: string;
  fullName: string;
  phone: string;
}

export const PROMO_FILM_CUSTOMER: PromoCustomer = {
  key: 'arjun',
  fullName: 'Arjun Raman',
  phone: '+919000020001',
};

export const PROMO_CUSTOMERS: readonly PromoCustomer[] = [
  { key: 'priya', fullName: 'Priya Venkatesh', phone: '+919000010001' },
  { key: 'karthik', fullName: 'Karthik Subramanian', phone: '+919000010002' },
  { key: 'meena', fullName: 'Meena Rajan', phone: '+919000010003' },
  { key: 'faizal', fullName: 'Faizal Ahmed', phone: '+919000010004' },
];

export interface PromoEnquiry {
  key: string;
  customer: string;
  vehicle: string;
  hoursAgo: number;
  status: 'NEW' | 'CONTACTED' | 'CLOSED';
  message: string;
}

/**
 * `vehicle` is a promo car's `key`, or `dev:<Model>` for one of Green
 * Circle's own dev-seeded cars, found by model at seed time.
 */
export const PROMO_ENQUIRIES: readonly PromoEnquiry[] = [
  {
    key: 'faizal-nexon',
    customer: 'faizal',
    vehicle: 'nexon',
    hoursAgo: 2,
    status: 'NEW',
    message: 'Is the price negotiable if I pay in full this week?',
  },
  {
    key: 'karthik-innova',
    customer: 'karthik',
    vehicle: 'dev:Innova Crysta',
    hoursAgo: 5,
    status: 'NEW',
    message: 'Looking for a seven-seater for the family. Has it had any accident repairs?',
  },
  {
    key: 'priya-seltos',
    customer: 'priya',
    vehicle: 'seltos',
    hoursAgo: 26,
    status: 'CONTACTED',
    message: 'Is the service history available? I can visit on Saturday morning.',
  },
  {
    key: 'meena-xuv300',
    customer: 'meena',
    vehicle: 'xuv300',
    hoursAgo: 72,
    status: 'CLOSED',
    message: 'Can you hold it until my loan is approved?',
  },
];

export const PROMO_APPLICANT = {
  fullName: 'Ravi Shankar',
  phone: '+919000030001',
  email: 'metromotors.owner@example.com',
  googleSubject: 'promo-metro-motors-owner',
} as const;

/** The yard photograph the film's onboarding uploads, keyed for the art generator. */
export const PROMO_APPLICANT_YARD_KEY = 'metro-motors-vellore';
