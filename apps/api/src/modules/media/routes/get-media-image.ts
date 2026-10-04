import { NotFoundError } from '../../../platform/errors.js';

import type { StorageRoute } from './route.js';
import { MediaPath } from './schemas.js';

export const getMediaImage: StorageRoute = (router, { service }) => {
  router.get('/media/by-media/:mediaId/:width.webp', (req, res, next) => {
    void (async () => {
      try {
        const parsed = MediaPath.safeParse({
          mediaId: req.params.mediaId,
          width: req.params.width,
        });
        if (!parsed.success) throw new NotFoundError('No such image.');

        const image = await service.serve(parsed.data.mediaId, parsed.data.width);
        if (!image) throw new NotFoundError('No such image.');

        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, must-revalidate');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.type(image.contentType).send(image.body);
      } catch (error) {
        next(error);
      }
    })();
  });
};
