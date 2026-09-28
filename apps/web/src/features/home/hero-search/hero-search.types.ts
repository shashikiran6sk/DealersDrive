import type { FacetOption, PublicLocations } from '@dealers-drive/contracts';

export interface HeroFacets {
  brands: FacetOption[];
  models: FacetOption[];
}

export type HeroFacetsLoader = (district?: string, brand?: string) => Promise<HeroFacets>;

export interface HeroSearchProps {
  locations: PublicLocations;
  brands: FacetOption[];
  loadFacets?: HeroFacetsLoader;
}

export interface HeroSearchValues {
  district: string;
  brand: string;
  model: string;
  maxPrice: string;
}
