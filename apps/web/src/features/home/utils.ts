import { searchHref } from '@/lib/vehicle-search';

import { HOME_SEARCH_PATH, type HomeCategory } from './home.constants';

export function categoryHref(category: Pick<HomeCategory, 'params'>): string {
  return searchHref(HOME_SEARCH_PATH, category.params);
}
