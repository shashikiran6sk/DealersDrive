import { NotFoundError } from '../../../platform/errors.js';

import { matchesEtag } from './if-none-match.js';
import type { StorageRoute } from './route.js';
import { MediaPath } from './schemas.js';

export const getMediaImage: StorageRoute = (router, { service }) => {
  router.get('/media/by-media/:mediaId/:width.webp', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    void (async () => {
      try {
        const parsed = MediaPath.safeParse({
          mediaId: req.params.mediaId,
          width: req.params.width,
        });
        if (!parsed.success) throw new NotFoundError('No such image.');

        const image = await service.locate(parsed.data.mediaId, parsed.data.width);
        if (!image) throw new NotFoundError('No such image.');

        if (matchesEtag(req.headers['if-none-match'], image.etag)) {
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('ETag', image.etag);
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.status(304).end();
          return;
        }

        const body = await service.read(image);
        if (!body) throw new NotFoundError('No such image.');

        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('ETag', image.etag);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.type(image.contentType).send(body);
      } catch (error) {
        next(error);
      }
    })();
  });
};
