import { incomingLink } from '../src/features/navigation/incoming-link';
import { publicEnvironment } from '../src/services/environment';
import { locationStore } from '../src/features/location/location';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const origin = publicEnvironment().webBaseUrl.replace(/\/$/, '');
  const destination = incomingLink(path, origin);
  const url = new URL(destination, origin);
  const district = url.searchParams.get('district');
  if ((url.pathname === '/cars' || url.pathname === '/dealers') && district !== null)
    locationStore.choose(district);
  return `${origin}${destination}`;
}
