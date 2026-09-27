export const CAR_SEARCH_TEXT = {
  label: 'Search cars by make, model or variant',
  placeholder: 'Search make, model or variant',
  placeholderInDistrict: (districtName: string) => `Search cars in ${districtName}…`,
  groupLabel: 'Makes and models',
  groupLabelInDistrict: (districtName: string) => `Cars in ${districtName} district`,
  noMatch: (search: string) => `No matching cars for “${search}”.`,
  noMatchGeneric: 'No matching cars.',
  selectHint: 'Select ↵',
  kind: { BRAND: 'B', MODEL: 'M', VARIANT: 'V' },
} as const;

export const CAR_SUGGEST_PATH = '/api/search/vehicles';
