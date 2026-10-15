import { incomingLink } from '../src/features/navigation/incoming-link';
import { publicEnvironment } from '../src/services/environment';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const origin = publicEnvironment().webBaseUrl.replace(/\/$/, '');
  return `${origin}${incomingLink(path, origin)}`;
}
