import { incomingLink } from '../src/features/navigation/incoming-link';
import { publicEnvironment } from '../src/services/environment';
import { locationStore } from '../src/features/location/location';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const origin = publicEnvironment().webBaseUrl.replace(/\/$/, '');
  const destination = incomingLink(path, origin);
  const url = new URL(destination, origin);
  if (url.pathname === '/cars' || url.pathname === '/dealers')
    locationStore.choose(url.searchParams.get('district') ?? undefined);
  return `${origin}${destination}`;
}
