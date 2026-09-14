import {
  MediaPresignInput,
  type MediaPresignInput as MediaPresignInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { MediaRoute } from './route.js';

export const postMediaPresign: MediaRoute = (router, { service }) => {
  router.post(
    '/media/presign',
    requirePermission('vehicle:write'),
    validate({ body: MediaPresignInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<MediaPresignInputType>(req, 'body');
          res.status(201).json(await service.presign(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
