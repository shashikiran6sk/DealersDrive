import { type z } from 'zod';

import { validate, validated } from '../../../middleware/validate.js';
import { NotFoundError } from '../../../platform/errors.js';
import { contentTypeOf, verifySignature } from '../../../platform/storage/local.adapter.js';

import type { StorageRoute } from './route.js';
import { PrivateReadQuery } from './schemas.js';

const NO_SUCH_OBJECT = 'No such object.';

export const getPrivate: StorageRoute = (router, { storage }) => {
  router.get('/private', validate({ query: PrivateReadQuery }), (req, res, next) => {
    void (async () => {
      try {
        const query = validated<z.infer<typeof PrivateReadQuery>>(req, 'query');
        const valid = verifySignature(
          { key: query.key, contentType: 'read', contentLength: 0, expiresAt: query.expiresAt },
          query.signature,
        );
        if (!valid) throw new NotFoundError(NO_SUCH_OBJECT);

        const body = await storage.get(query.key);
        if (!body) throw new NotFoundError(NO_SUCH_OBJECT);

        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.type(contentTypeOf(query.key)).send(body);
      } catch (error) {
        next(error);
      }
    })();
  });
};
