import { customerPrincipal } from '../../../middleware/auth.js';
import { readSessionToken } from '../session.cookie.js';

import type { WorkspaceRoute } from './route.js';

export const getWorkspaces: WorkspaceRoute = (router, { workspaces }) => {
  router.get('/', (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(await workspaces.list(readSessionToken(req), customerPrincipal(req).userId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
