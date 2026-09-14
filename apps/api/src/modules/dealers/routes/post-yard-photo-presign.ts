import {
  YardPhotoPresignInput,
  type YardPhotoPresignInput as YardPhotoPresignInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const postYardPhotoPresign: DealersRoute = (router, service) => {
  router.post(
    '/yard-photo/presign',
    requirePermission('document:upload'),
    validate({ body: YardPhotoPresignInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<YardPhotoPresignInputType>(req, 'body');
          res.status(201).json(await service.presignYardPhoto(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
