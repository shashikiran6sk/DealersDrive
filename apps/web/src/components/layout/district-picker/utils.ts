import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';

import { CARS_PATH, DIRECTORY_PATH, VEHICLE_PATH_PREFIX } from './district-picker.constants';
import type { DistrictUnit, StateGroup } from './district-picker.types';

export function scopedPathOf(pathname: string): string {
  if (pathname === CARS_PATH || pathname.startsWith(VEHICLE_PATH_PREFIX)) return CARS_PATH;
  return DIRECTORY_PATH;
}

export function unitOf(pathname: string): DistrictUnit {
  return scopedPathOf(pathname) === CARS_PATH ? 'car' : 'dealership';
}

export function countIn(
  locations: PublicLocations,
  district: DistrictChip,
  unit: DistrictUnit,
): number {
  return unit === 'car' ? (locations.cars.districts[district.slug] ?? 0) : district.count;
}

export function totalIn(locations: PublicLocations, unit: DistrictUnit): number {
  return unit === 'car' ? locations.cars.total : locations.total;
}

export function groupTotal(
  locations: PublicLocations,
  group: StateGroup,
  unit: DistrictUnit,
): number {
  return group.districts.reduce((sum, district) => sum + countIn(locations, district, unit), 0);
}

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
