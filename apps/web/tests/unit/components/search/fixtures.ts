import { KM_PRESETS, PRICE_PRESETS, type VehicleFacets } from '@dealers-drive/contracts';

export const FACETS: VehicleFacets = {
  cities: [
    { value: 'arcot', label: 'Arcot', count: 11 },
    { value: 'ranipet', label: 'Ranipet', count: 11 },
    { value: 'arakkonam', label: 'Arakkonam', count: 9 },
  ],
  brands: [
    { value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 11 },
    { value: 'hyundai', label: 'Hyundai', count: 6 },
    { value: 'tata', label: 'Tata', count: 6 },
    { value: 'honda', label: 'Honda', count: 5 },
    { value: 'kia', label: 'Kia', count: 4 },
    { value: 'mahindra', label: 'Mahindra', count: 3 },
    { value: 'toyota', label: 'Toyota', count: 3 },
    { value: 'skoda', label: 'Skoda', count: 1 },
  ],
  models: [],
  fuelTypes: [
    { value: 'petrol', label: 'Petrol', count: 18 },
    { value: 'cng', label: 'CNG', count: 12 },
    { value: 'diesel', label: 'Diesel', count: 8 },
  ],
  transmissions: [
    { value: 'manual', label: 'Manual', count: 20 },
    { value: 'automatic', label: 'Automatic', count: 19 },
  ],
  bodyTypes: [{ value: 'suv', label: 'SUV', count: 15 }],
  colors: [{ value: 'fiery-red', label: 'Fiery Red', count: 7 }],
  ownerCounts: [
    { value: '1', label: 'First owner', count: 20 },
    { value: '4', label: 'Fourth owner or more', count: 2 },
  ],
  dealers: [
    { value: 'arcot-city-cars', label: 'Arcot City Cars', count: 5 },
    { value: 'palar-bridge-autos', label: 'Palar Bridge Autos', count: 4 },
  ],
  years: [
    { value: '2023', label: '2023', count: 9 },
    { value: '2021', label: '2021', count: 6 },
    { value: '2019', label: '2019', count: 3 },
  ],
  price: PRICE_PRESETS.map((preset, index) => ({
    ...preset,
    count: [12, 18, 6, 2, 0][index] ?? 0,
  })),
  kilometers: KM_PRESETS.map((preset, index) => ({
    ...preset,
    count: [2, 14, 13, 9, 1][index] ?? 0,
  })),
};

export const HYUNDAI_MODELS: VehicleFacets['models'] = [
  { value: 'creta', label: 'Creta', count: 3, parent: 'hyundai' },
  { value: 'venue', label: 'Venue', count: 2, parent: 'hyundai' },
  { value: 'nexon', label: 'Nexon', count: 4, parent: 'tata' },
];
