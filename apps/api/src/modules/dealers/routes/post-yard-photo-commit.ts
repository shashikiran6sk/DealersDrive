import {
  YardPhotoCommitInput,
  type YardPhotoCommitInput as YardPhotoCommitInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const postYardPhotoCommit: DealersRoute = (router, service) => {
  router.post(
    '/yard-photo/commit',
    requirePermission('document:upload'),
    validate({ body: YardPhotoCommitInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<YardPhotoCommitInputType>(req, 'body');
          res.json(await service.commitYardPhoto(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
