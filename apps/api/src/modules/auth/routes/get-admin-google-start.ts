import type { PublicAuthRoute } from './route.js';
import { startGoogle } from './start-google.js';

export const getAdminGoogleStart: PublicAuthRoute = (router, { service }) => {
  router.get('/admin/google/start', startGoogle(service, 'ADMIN'));
};
