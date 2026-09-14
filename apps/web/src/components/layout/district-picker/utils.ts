import type { DistrictChip } from '@dealers-drive/contracts';

import type { StateGroup } from './district-picker.types';

/** Every dealership under a state heading. */
export function dealersIn(group: StateGroup): number {
  return group.districts.reduce((sum, district) => sum + district.count, 0);
}

/**
 * The districts, grouped under the state each one is in.
 *
 * The pairing comes off the payload — `DistrictChip.state`, which the API takes
 * from the dealership's own address (**R22**). Nothing here infers a state from
 * a district's name, and there is nothing it could infer one from: D6 removed
 * the table that would have held the pair.
 *
 * Order is the API's, twice over. Districts arrive busiest first and stay that
 * way; states are ordered by the dealerships in them, then by name, so two
 * states of the same size cannot swap places between requests. The districts
 * with no state recorded sort last whatever their size — it is a heading that
 * explains an absence, and an absence does not lead.
 */
export function groupByState(districts: readonly DistrictChip[]): StateGroup[] {
  const groups = new Map<string, StateGroup>();

  for (const district of districts) {
    const key = district.state ?? '';
    const group = groups.get(key);
    if (group) group.districts.push(district);
    else
      groups.set(key, {
        key: key === '' ? 'unknown' : key,
        state: district.state,
        districts: [district],
      });
  }

  return [...groups.values()].sort((a, b) => {
    if ((a.state === null) !== (b.state === null)) return a.state === null ? 1 : -1;
    return dealersIn(b) - dealersIn(a) || (a.state ?? '').localeCompare(b.state ?? '');
  });
}
