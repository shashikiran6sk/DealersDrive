import { countLabel } from '@/lib/plural';

export const DEALER_INVENTORY_TEXT = {
  heading: 'Inventory',
  count: (total: number) => `${countLabel(total, 'car')} available`,
  emptyTitle: 'No vehicles currently available.',
  emptyMessage: (brandName: string) =>
    `${brandName} is verified and open for enquiries, but has no cars on the marketplace right now. Browse every car on Dealers-Drive in the meantime.`,
  emptyAction: 'Browse all cars',
  pagination: 'Inventory pages',
  previous: '← Previous',
  next: 'Next →',
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;

export const INVENTORY_ANCHOR = 'inventory';
