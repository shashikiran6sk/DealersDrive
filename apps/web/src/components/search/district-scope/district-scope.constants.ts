import { DISTRICT_PICKER_TEXT } from '@/components/layout/district-picker';

export const DISTRICT_SCOPE_TEXT = {
  selectDistrict: DISTRICT_PICKER_TEXT.selectDistrict,
  change: 'Change district',
  everyDistrictHint: 'Showing cars in every district — pick one to see what is near you.',
  label: (place: string) => `District: ${place}`,
  place: DISTRICT_PICKER_TEXT.selectedDistrict,
} as const;
