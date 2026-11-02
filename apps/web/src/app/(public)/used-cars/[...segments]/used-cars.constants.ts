export interface CountedName {
  label: string;
  count: number;
}

const MAX_NAMED = 3;

function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

export const USED_CARS_TEXT = {
  breadcrumbLabel: 'Breadcrumb',
  home: 'Home',
  cars: 'Cars',
  listedBy: (dealers: readonly string[]) => {
    const named = dealers.slice(0, MAX_NAMED);
    const more = dealers.length - named.length;
    return `Listed by ${listOf(more > 0 ? [...named, `${String(more)} more`] : named)}.`;
  },
  mostListed: (items: readonly CountedName[]) =>
    `Most listed: ${items
      .slice(0, MAX_NAMED)
      .map((item) => `${item.label} (${String(item.count)})`)
      .join(', ')}.`,
  promise:
    'Every car is photographed by Dealers-Drive and reviewed before it goes live, and you enquire directly with the dealership.',
  refine: 'Filter and sort these cars',
  emptyMessage:
    'The cars that were here have been sold or reserved. Every other car nearby is one click away.',
  emptyAction: (place: string) => `See all used cars in ${place}`,
  pagination: 'Pagination',
  previous: '← Previous',
  next: 'Next →',
  pageOf: (page: number, total: number) => `Page ${String(page)} of ${String(total)}`,
} as const;
