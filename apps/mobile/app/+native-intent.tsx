import { incomingLink } from '../src/features/navigation/incoming-link';
import { publicEnvironment } from '../src/services/environment';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return incomingLink(path, publicEnvironment().webBaseUrl);
}
