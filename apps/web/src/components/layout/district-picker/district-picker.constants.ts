import { pluralLabel } from '@/lib/plural';

export const DISTRICT_PICKER_TEXT = {
  selectDistrict: 'Select district',
  title: 'Select location',
  closeLabel: 'Close location picker',
  description: 'Choose a district to browse dealerships',
  searchLabel: 'Search districts',
  searchPlaceholder: 'Search district or state',
  stateFilterLabel: 'Filter by state',
  allStates: 'All states',
  allDistricts: 'All districts',
  unknownState: 'State not recorded',
  everyDistrict: 'Showing dealerships in every district',
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
