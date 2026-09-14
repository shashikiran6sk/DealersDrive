import {
  IdParam,
  MediaCommitInput,
  type IdParam as IdParamType,
  type MediaCommitInput as MediaCommitInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { MediaRoute } from './route.js';

export const postMediaCommit: MediaRoute = (router, { service }) => {
  router.post(
    '/media/:id/commit',
    requirePermission('vehicle:write'),
    validate({ params: IdParam, body: MediaCommitInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          const body = validated<MediaCommitInputType>(req, 'body');
          res.status(202).json(await service.commit(dealerId, params.id, body.position));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
