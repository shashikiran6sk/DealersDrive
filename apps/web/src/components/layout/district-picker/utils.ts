import type { DistrictChip } from '@dealers-drive/contracts';

import type { StateGroup } from './district-picker.types';

export function dealersIn(group: StateGroup): number {
  return group.districts.reduce((sum, district) => sum + district.count, 0);
}

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
