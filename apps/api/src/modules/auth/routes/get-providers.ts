import type { PublicAuthRoute } from './route.js';

export const getProviders: PublicAuthRoute = (router, { service }) => {
  router.get('/providers', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(service.providers());
  });
};
