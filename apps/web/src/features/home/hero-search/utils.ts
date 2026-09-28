import { searchHref } from '@/lib/vehicle-search';

import { CARS_PATH } from './hero-search.constants';
import type { HeroSearchValues } from './hero-search.types';

export function heroHref(values: HeroSearchValues): string {
  return searchHref(CARS_PATH, {
    district: values.district,
    brand: values.brand,
    model: values.brand ? values.model : '',
    maxPrice: values.maxPrice,
  });
}
