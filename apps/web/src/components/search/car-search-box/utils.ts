import type { CarSuggestion } from '@dealers-drive/contracts';

import { setParam, type VehicleSearchParams } from '@/lib/vehicle-search';

export function suggestionParams(
  params: VehicleSearchParams,
  suggestion: CarSuggestion,
): VehicleSearchParams {
  const withBrand = setParam(params, 'brand', suggestion.brand);
  const withModel = setParam(withBrand, 'model', suggestion.model ?? undefined);
  return setParam(withModel, 'q', suggestion.variant ?? undefined);
}

export function suggestQuery(
  params: Pick<VehicleSearchParams, 'district' | 'city' | 'dealer'>,
  search: string,
): string {
  const query = new URLSearchParams({ search });
  if (params.district) query.set('district', params.district);
  if (params.city) query.set('city', params.city);
  if (params.dealer) query.set('dealer', params.dealer);
  return query.toString();
}

export function suggestionKey(suggestion: CarSuggestion): string {
  return [suggestion.kind, suggestion.brand, suggestion.model, suggestion.variant]
    .filter((part) => part !== null)
    .join(':');
}
