import { VehicleSuggestions } from '@dealers-drive/contracts';

import { SUGGESTIONS_PATH } from './suggest-input.constants';

export async function fetchSuggestions(
  field: string,
  query: string,
  signal: AbortSignal,
): Promise<string[]> {
  const params = new URLSearchParams({ field, q: query });
  const response = await fetch(`${SUGGESTIONS_PATH}?${params.toString()}`, { signal });
  if (!response.ok) return [];
  const parsed = VehicleSuggestions.safeParse(await response.json());
  return parsed.success ? parsed.data.values : [];
}
