export const DEALER_SEARCH_TEXT = {
  label: 'Search dealership name',
  placeholder: 'Search dealership name',
  placeholderInDistrict: (districtName: string) => `Search dealerships in ${districtName}…`,
  groupLabel: 'Dealerships',
  groupLabelInDistrict: (districtName: string) => `Dealerships in ${districtName} district`,
  noMatch: (search: string) => `No dealership matches “${search}”.`,
  noMatchGeneric: 'No dealerships match that search.',
  verified: '✓ Verified',
  selectHint: 'Select ↵',
} as const;

export const DEALER_SUGGEST_PATH = '/api/search/dealers';
