import {
  VehicleSuggestions,
  existingVehicleSpelling,
  normaliseVehicleText,
  vehicleTextKey,
} from '@dealers-drive/contracts';

import { SUGGESTIONS_PATH } from '@/components/forms/suggest-input';

import type { VehicleOptionRow, VehicleOptionScope } from './vehicle-option-select.types';

export function filterVehicleOptions(options: readonly string[], typed: string): string[] {
  const key = vehicleTextKey(typed);
  return key ? options.filter((option) => vehicleTextKey(option).includes(key)) : [...options];
}

export function resolveVehicleOption(typed: string, options: readonly string[]): string {
  const value = normaliseVehicleText(typed);
  return existingVehicleSpelling(value, options) ?? value;
}

export function vehicleOptionRows(
  options: readonly string[],
  search: string,
  committed: string,
): VehicleOptionRow[] {
  const typed = search === committed ? '' : search;
  const rows: VehicleOptionRow[] = filterVehicleOptions(options, typed).map((value) => ({
    kind: 'option',
    value,
  }));
  const value = normaliseVehicleText(typed);
  if (value && !existingVehicleSpelling(value, options)) rows.push({ kind: 'new', value });
  return rows;
}

export async function fetchVehicleOptions(
  scope: VehicleOptionScope,
  signal: AbortSignal,
): Promise<string[]> {
  const params = new URLSearchParams({ field: scope.field, make: scope.make });
  if (scope.model) params.set('model', scope.model);
  const response = await fetch(`${SUGGESTIONS_PATH}?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(String(response.status));
  return VehicleSuggestions.parse(await response.json()).values;
}
