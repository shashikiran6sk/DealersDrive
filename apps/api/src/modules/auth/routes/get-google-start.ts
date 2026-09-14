import type { PublicAuthRoute } from './route.js';
import { startGoogle } from './start-google.js';

export const getGoogleStart: PublicAuthRoute = (router, { service }) => {
  router.get('/google/start', startGoogle(service, 'DEALER'));
};
