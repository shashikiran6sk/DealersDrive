import express from 'express';
import { type z } from 'zod';

import { DomainError } from '../../../platform/errors.js';
import { validate, validated } from '../../../middleware/validate.js';
import { verifySignature } from '../../../platform/storage/local.adapter.js';

import type { StorageRoute } from './route.js';
import { UploadQuery } from './schemas.js';

export const putUploads: StorageRoute = (router, { storage }) => {
  router.put(
    '/uploads',
    express.raw({ type: '*/*', limit: '12mb' }),
    validate({ query: UploadQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<z.infer<typeof UploadQuery>>(req, 'query');
          const body = req.body as Buffer;

          const valid = verifySignature(
            {
              key: query.key,
              contentType: query.contentType,
              contentLength: query.contentLength,
              expiresAt: query.expiresAt,
            },
            query.signature,
          );
          if (!valid)
            throw new DomainError('UPLOAD_SIGNATURE_INVALID', 'That upload link has expired.');

          if (body.length !== query.contentLength) {
            throw new DomainError(
              'UPLOAD_LENGTH_MISMATCH',
              'The uploaded body does not match the signed content length.',
            );
          }

          await storage.put(query.key, body, query.contentType);
          res.status(200).json({ ok: true });
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
