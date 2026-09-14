import { DISTRICT_PICKER_TEXT } from '@/components/layout/district-picker';
import { countLabel } from '@/lib/plural';

export const DIRECTORY_FILTERS_TEXT = {
  selectDistrict: DISTRICT_PICKER_TEXT.selectDistrict,
  everyDistrictHint: 'Showing every district — pick one to filter by town.',
  clearTowns: (count: number) => `Clear ${count === 1 ? 'town' : countLabel(count, 'town')}`,
} as const;
