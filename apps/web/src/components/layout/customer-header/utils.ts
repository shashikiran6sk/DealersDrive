import { HEADER_NAV, HOME_PATH_ALIAS, LOCATION_SELECTOR_PATHS } from './customer-header.constants';

const TRAILING_SLASHES = /\/+$/;

export function showsLocationSelector(pathname: string): boolean {
  const trimmed = pathname === '/' ? pathname : pathname.replace(TRAILING_SLASHES, '');
  const path = trimmed === HOME_PATH_ALIAS ? HEADER_NAV.home : trimmed;
  return LOCATION_SELECTOR_PATHS.includes(path);
}
