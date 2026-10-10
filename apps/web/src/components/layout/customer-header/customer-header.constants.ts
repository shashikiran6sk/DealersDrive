import { DISTRICT_PICKER_TEXT } from '@/components/layout/district-picker';

export const HEADER_TEXT = {
  brand: 'Dealers-Drive',
  navLabel: 'Main',
  buyCars: 'Buy cars',
  dealers: 'Dealers',
  login: 'Login',
  home: 'Home',
  adminLogin: 'Admin login',
  dealerLogin: 'Dealer login',
  support: 'Help and support',
  selectDistrict: DISTRICT_PICKER_TEXT.selectDistrict,
  caret: '▾',
} as const;

export const HEADER_NAV = {
  home: '/',
  cars: '/cars',
  dealers: '/dealers',
  login: '/login',
  adminLogin: '/admin/login',
  dealerLogin: '/login?as=dealer',
  support: '/contact',
} as const;

export const MOBILE_HEADER_NAV = [
  { href: HEADER_NAV.home, label: HEADER_TEXT.home },
  { href: HEADER_NAV.cars, label: HEADER_TEXT.buyCars },
  { href: HEADER_NAV.dealers, label: HEADER_TEXT.dealers },
];
