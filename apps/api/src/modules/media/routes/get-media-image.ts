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

        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        // These bytes stand in for the R2/Cloudflare Images origin, which is a
        // different host from the web app in every environment. Helmet's
        // default `same-origin` would stop the browser embedding them, so this
        // route sends what a public media origin sends (§12.1). It applies to
        // this route only — the JSON API keeps the strict default.
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.type(image.contentType).send(image.body);
      } catch (error) {
        next(error);
      }
    })();
  });
};
