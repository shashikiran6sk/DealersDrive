const LAKH_PAISE = 10_000_000;

const BUDGET_LAKH = [3, 5, 8, 10, 15, 20, 30] as const;

export const BUDGET_OPTIONS = BUDGET_LAKH.map((lakh) => ({
  value: String(lakh * LAKH_PAISE),
  label: `Up to ₹${String(lakh)} lakh`,
}));

export const CARS_PATH = '/cars';

export const HERO_SEARCH_TEXT = {
  formLabel: 'Find a car',
  district: 'District',
  selectDistrict: 'Select district',
  anyDistrict: 'Any district',
  brand: 'Brand',
  anyBrand: 'Any brand',
  model: 'Model',
  anyModel: 'Any model',
  chooseBrandFirst: 'Choose a brand first',
  budget: 'Budget',
  anyBudget: 'Any budget',
  submit: 'Search cars',
  optionCount: (label: string, count: number) => `${label} (${String(count)})`,
} as const;
