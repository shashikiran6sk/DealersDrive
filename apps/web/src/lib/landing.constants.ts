import type { LandingFacetKind } from '@dealers-drive/contracts';

import { countLabel } from './plural';

function subject(kind: LandingFacetKind | null, label: string | null, noun: string): string {
  if (kind === null || label === null) return `Used ${noun}`;
  if (kind === 'PRICE') return `Used ${noun} ${label}`;
  return `Used ${label} ${noun}`;
}

export interface LandingNaming {
  kind: LandingFacetKind | null;
  label: string | null;
  place: string;
}

export const LANDING_TEXT = {
  name: ({ kind, label, place }: LandingNaming) => `${subject(kind, label, 'Cars')} in ${place}`,
  heading: ({ kind, label, place }: LandingNaming, count: number) =>
    `${String(count)} ${subject(kind, label, count === 1 ? 'Car' : 'Cars')} in ${place}`,
  title: (naming: LandingNaming, count: number, page: number) =>
    `${LANDING_TEXT.heading(naming, count)}${page > 1 ? ` – Page ${String(page)}` : ''}`,
  description: (naming: LandingNaming, count: number) =>
    `${countLabel(count, 'used car')} for sale in ${naming.place}${
      naming.label ? ` — ${naming.label}` : ''
    }, from verified independent dealerships on Dealers-Drive. Every car is photographed by Dealers-Drive and reviewed before it goes live.`,
  related: (place: string) => `More used cars around ${place}`,
  searchesIn: (place: string) => `Popular searches in ${place}`,
  townsIn: (district: string) => `Towns in ${district} district`,
  wholeDistrict: (district: string) => `All used cars in ${district} district`,
  similarHeading: 'Find more cars like this',
  similarIn: (place: string) => `In ${place}`,
  similarAcross: (district: string) => `Across ${district} district`,
  browseHeading: 'Browse used cars',
  byPlace: 'By place',
  byBrand: 'By brand',
  byBudget: 'By budget',
  byBody: 'By body type',
  byFuelAndGearbox: 'By fuel and gearbox',
} as const;
