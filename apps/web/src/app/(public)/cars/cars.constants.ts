import { countLabel } from '@/lib/plural';

export const CARS_TEXT = {
  metaTitle: 'Used cars from verified dealers',
  metaDescription:
    'Used cars from verified independent dealerships, each photographed by Dealers-Drive and reviewed before it goes live.',
  breadcrumbLabel: 'Breadcrumb',
  home: 'Home',
  breadcrumb: 'Cars',
  title: 'Used cars',
  count: (total: number) => countLabel(total, 'car'),
  emptyTitle: 'No cars listed yet',
  emptyMessage:
    'Every car here is photographed by Dealers-Drive and reviewed before it goes live. The first ones are on their way — meet the dealers in the meantime.',
  emptyAction: 'Browse dealers',
  pagination: 'Pagination',
  previous: '← Previous',
  next: 'Next →',
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;
