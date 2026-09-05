/**
 * Reference rows the seed writes, kept apart from the writing of them.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is 1,212 lines: cities, RTOs, colours, credit packs, five
 * dealerships and their inventory, all of it shaped by the catalogue that
 * decision D1 removes. What is here is the part `tests/auth.test.ts` needs —
 * the one dealership whose owner address the admin sign-in cases refer to.
 * The rest arrives with **F097**.
 *
 * `CITIES` was here too, five rows of reference data written verbatim from the
 * baseline. The `cities` table is gone: a dealership's city is text it typed,
 * so there is nothing to seed and nothing to choose from.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface SeedDealer {
  slug: string;
  brandName: string;
  legalName: string;
  tagline: string;
  gstin: string;
  pan: string;
  city: string;
  state: string;
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
}

export const DEALERS: SeedDealer[] = [
  {
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    legalName: 'Sri Lakshmi Automobiles Pvt Ltd',
    tagline: 'Family-run since 2014 — single-owner cars with full service history.',
    gstin: '33AABCS1429P1ZK',
    pan: 'AABCS1429P',
    city: 'Vellore',
    state: 'Tamil Nadu',
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
  },
];
