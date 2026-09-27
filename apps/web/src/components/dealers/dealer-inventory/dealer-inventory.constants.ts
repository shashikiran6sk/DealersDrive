import { countLabel } from '@/lib/plural';

export const DEALER_INVENTORY_TEXT = {
  heading: 'Inventory',
  count: (total: number) => `${countLabel(total, 'car')} available`,
  countOf: (shown: number, total: number) => `${String(shown)} of ${countLabel(total, 'car')}`,
  filtersHeading: 'Filter inventory',
  filtersLabel: 'Filter this dealership’s cars',
  locationLabel: 'Every car here is at',
  emptyTitle: 'No vehicles currently available.',
  emptyMessage: (brandName: string) =>
    `${brandName} is verified and open for enquiries, but has no cars on the marketplace right now. Browse every car on Dealers-Drive in the meantime.`,
  emptyAction: 'Browse all cars',
  emptyFilteredTitle: 'No vehicles match your current filters.',
  emptyFilteredMessage: (brandName: string) =>
    `${brandName} has cars on the marketplace, just none that match every filter. Clear one or two to see more.`,
  emptyFilteredAction: 'Clear filters',
  pagination: 'Inventory pages',
  previous: '← Previous',
  next: 'Next →',
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;

export const INVENTORY_ANCHOR = 'inventory';
