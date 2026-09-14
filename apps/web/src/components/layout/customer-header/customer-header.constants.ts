import { DISTRICT_PICKER_TEXT } from '@/components/layout/district-picker';

export const HEADER_TEXT = {
  brand: 'Dealers-Drive',
  navLabel: 'Main',
  buyCars: 'Buy cars',
  dealers: 'Dealers',
  savedCars: 'Saved cars',
  dealerLogin: 'Dealer login',
  login: 'Login',
  selectDistrict: DISTRICT_PICKER_TEXT.selectDistrict,
  caret: '▾',
} as const;

export const HEADER_NAV = {
  cars: '/cars',
  dealers: '/dealers',
  saved: '/saved',
  dealerConsole: '/dealer',
} as const;
