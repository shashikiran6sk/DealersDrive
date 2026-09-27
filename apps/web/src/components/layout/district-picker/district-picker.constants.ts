import { pluralLabel } from '@/lib/plural';

import type { DistrictUnit } from './district-picker.types';

export const DISTRICT_PICKER_TEXT = {
  selectDistrict: 'Select district',
  title: 'Select location',
  closeLabel: 'Close location picker',
  description: (unit: DistrictUnit) => `Choose a district to browse ${pluralLabel(2, unit)}`,
  searchLabel: 'Search districts',
  searchPlaceholder: 'Search district or state',
  stateFilterLabel: 'Filter by state',
  allStates: 'All states',
  allDistricts: 'All districts',
  unknownState: 'State not recorded',
  everyDistrict: (unit: DistrictUnit) => `Showing ${pluralLabel(2, unit)} in every district`,
  selectedPrefix: 'Selected: ',
  noMatches: 'No matching districts',
  nothingListed:
    'No dealerships are listed yet. “All districts” shows everything the platform has.',
  noMatchHint: (search: string) =>
    `Nothing here matches “${search}”. Try the district, or the state it is in.`,
  matchCount: (count: number) => `${String(count)} matching ${pluralLabel(count, 'district')}`,
  selectedDistrict: (name: string, state: string | null) => (state ? `${name}, ${state}` : name),
} as const;

export const DIRECTORY_PATH = '/dealers';

export const CARS_PATH = '/cars';

export const VEHICLE_PATH_PREFIX = '/car/';

export const LOCATION_CHILD_PARAMS = ['city', 'dealer', 'page'] as const;
