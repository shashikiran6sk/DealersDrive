import { SelectWorkspaceInput } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { readSessionToken } from '../session.cookie.js';

import type { WorkspaceRoute } from './route.js';

export const putWorkspace: WorkspaceRoute = (router, { workspaces }) => {
  router.put('/current', validate({ body: SelectWorkspaceInput }), (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(
          await workspaces.select(
            readSessionToken(req),
            customerPrincipal(req).userId,
            validated<SelectWorkspaceInput>(req, 'body'),
          ),
        );
      } catch (error) {
        next(error);
      }
    })();
  });
};
