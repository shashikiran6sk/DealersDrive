import { countLabel } from '@/lib/plural';

export const MOBILE_FILTER_SHEET_TEXT = {
  open: 'Filters',
  openLabel: (active: number) =>
    active > 0 ? `Filters, ${countLabel(active, 'filter')} applied` : 'Filters',
  title: 'Filters',
  close: 'Close filters',
  clearAll: 'Clear all',
  clearAllLabel: 'Clear every filter',
  show: (total: number) => `Show ${countLabel(total, 'car')}`,
  updating: 'Updating…',
} as const;
