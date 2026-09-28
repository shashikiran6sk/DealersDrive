import type { FacetOption } from '@dealers-drive/contracts';

export interface HeroFacets {
  brands: FacetOption[];
  models: FacetOption[];
}

const MODELS: Record<string, FacetOption[]> = {
  hyundai: [
    { value: 'creta', label: 'Creta', count: 6, parent: 'hyundai' },
    { value: 'venue', label: 'Venue', count: 4, parent: 'hyundai' },
    { value: 'i20', label: 'i20', count: 3, parent: 'hyundai' },
  ],
  'maruti-suzuki': [
    { value: 'swift', label: 'Swift', count: 7, parent: 'maruti-suzuki' },
    { value: 'baleno', label: 'Baleno', count: 5, parent: 'maruti-suzuki' },
  ],
};

export const HOME_BRANDS: FacetOption[] = [
  { value: 'hyundai', label: 'Hyundai', count: 13 },
  { value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 12 },
  { value: 'tata', label: 'Tata', count: 8 },
];

export async function heroFacetsAction(_district?: string, brand?: string): Promise<HeroFacets> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { brands: HOME_BRANDS, models: brand ? (MODELS[brand] ?? []) : [] };
}
