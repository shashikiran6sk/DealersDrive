import type { HealthRoute } from './route.js';

export const getLive: HealthRoute = (router, _container) => {
  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });
};
