import { pluralLabel } from '@/lib/plural';

export const DISTRICT_PICKER_TEXT = {
  /** The resting label on every trigger that opens this dialog (**R23**). */
  selectDistrict: 'Select district',
  title: 'Select location',
  closeLabel: 'Close location picker',
  description: 'Choose a district to browse dealerships',
  searchLabel: 'Search districts',
  /* It says what it searches. The reference's placeholder offers taluk and
     pincode; the payload is districts and the states they are in, and a
     placeholder promising a field the data does not have is a bug report
     waiting to be filed. */
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
