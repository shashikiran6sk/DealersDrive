export const APPLIED_FILTERS_TEXT = {
  label: 'Applied filters',
  clearAll: 'Clear all',
  clearAllLabel: 'Clear every filter',
  remove: (label: string) => `Remove filter: ${label}`,
  search: (q: string) => `“${q}”`,
  price: (range: string) => `Price: ${range}`,
  year: (range: string) => `Year: ${range}`,
  km: (range: string) => `Km: ${range}`,
  openEnded: '…',
} as const;
