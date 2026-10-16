import type { CarSuggestion } from '@dealers-drive/contracts/public';
import { setParam, type VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';

export function suggestionParams(
  params: VehicleSearchParams,
  suggestion: CarSuggestion,
): VehicleSearchParams {
  let next = setParam(params, 'brand', suggestion.brand);
  next = setParam(next, 'model', suggestion.model ?? undefined);
  return setParam(next, 'q', suggestion.variant ?? undefined);
}
