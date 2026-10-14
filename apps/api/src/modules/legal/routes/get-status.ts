import { UnauthorizedError } from '../../../platform/errors.js';
import type { LegalRoute } from './route.js';
export const getStatus: LegalRoute = (router, service) => {
  router.get('/status', (req, res, next) => {
    void (async () => {
      if (!req.principal) throw new UnauthorizedError();
      res.set('Cache-Control', 'no-store').json(await service.status(req.principal));
    })().catch(next);
  });
};
