import { UnauthorizedError } from '../../../platform/errors.js';
import type { LegalRoute } from './route.js';
export const getHistory: LegalRoute = (router, service) => {
  router.get('/history', (req, res, next) => {
    void (async () => {
      if (!req.principal) throw new UnauthorizedError();
      res.set('Cache-Control', 'no-store').json(await service.history(req.principal));
    })().catch(next);
  });
};
