import { LOCATION_SELECTOR_PATHS } from './customer-header.constants';

const TRAILING_SLASHES = /\/+$/;

export function showsLocationSelector(pathname: string): boolean {
  const path = pathname === '/' ? pathname : pathname.replace(TRAILING_SLASHES, '');
  return LOCATION_SELECTOR_PATHS.includes(path);
}
