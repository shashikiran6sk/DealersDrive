import { countLabel } from '@/lib/plural';

export const CARS_TEXT = {
  metaTitle: 'Used cars from verified dealers',
  metaDescription:
    'Used cars from verified independent dealerships, each photographed by Dealers-Drive and reviewed before it goes live.',
  breadcrumbLabel: 'Breadcrumb',
  home: 'Home',
  breadcrumb: 'Cars',
  title: 'Used cars',
  titleIn: (district: string) => `Cars in ${district}`,
  count: (total: number) => `${countLabel(total, 'car')} available`,
  emptyTitle: 'No cars listed yet',
  emptyMessage:
    'Every car here is photographed by Dealers-Drive and reviewed before it goes live. The first ones are on their way — meet the dealers in the meantime.',
  emptyAction: 'Browse dealers',
  emptyInTitle: (district: string) => `No cars found in ${district}`,
  emptyInMessage: (district: string) =>
    `No verified dealership in ${district} has a car on the marketplace right now. Every other district is one click away.`,
  emptyInAction: 'Show all districts',
  emptyFilteredTitle: 'No vehicles match your current filters.',
  emptyFilteredInTitle: (district: string) =>
    `No cars found in ${district} matching these filters.`,
  emptyFilteredMessage:
    'Try removing a filter or two — every one you clear can only bring more cars back.',
  emptyFilteredAction: 'Clear filters',
  filtersLabel: 'Filter cars',
  pagination: 'Pagination',
  previous: '← Previous',
  next: 'Next →',
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;
