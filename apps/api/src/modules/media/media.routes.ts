import {
  IdParam,
  MediaCommitInput,
  MediaPresignInput,
  type IdParam as IdParamType,
  type MediaCommitInput as MediaCommitInputType,
  type MediaPresignInput as MediaPresignInputType,
} from '@dealers-drive/contracts';
import express, { Router } from 'express';
import { z } from 'zod';

import { dealerPrincipal, requirePermission } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import { verifySignature } from '../../platform/storage/local.adapter.js';
import { DomainError, NotFoundError } from '../../platform/errors.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { MediaService } from './media.service.js';

/**
 * C14 — dealer-scoped media.
 *
 * Every route is `requirePermission`-guarded and takes its `dealerId` from the
 * session, never from the path: `/media/:id` is looked up as
 * `{ id, dealerId }`, so another tenant's upload reads as absent rather than
 * as forbidden.
 */
export function createMediaRouter(service: MediaService): Router {
  const router = Router();

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

  router.get(
    '/media/:id',
    requirePermission('vehicle:read'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.json(await service.get(dealerId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/media/:id',
    requirePermission('vehicle:write'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          await service.remove(dealerId, params.id);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────
   * `PUT /vehicles/:id/media/order` sits here in the baseline. It is **F035**
   * — position and the primary photo — and needs `VehicleMedia`, which does
   * not exist yet. It returns with that feature, along with
   * `ReorderMediaInput` and `service.reorder()`.
   */

  return router;
}

const UploadQuery = z
  .object({
    key: z.string().min(1).max(300),
    contentType: z.string().min(1).max(120),
    contentLength: z.coerce.number().int().min(1),
    expiresAt: z.coerce.number().int(),
    signature: z.string().min(16).max(256),
  })
  .strict();

const MediaPath = z
  .object({ mediaId: z.string().uuid(), width: z.coerce.number().int().min(1).max(4000) })
  .strict();

/**
 * The endpoints that stand in for R2 locally.
 *
 * `PUT /uploads` terminates the presigned upload: it verifies the HMAC, the
 * expiry, the declared content-type and the declared content-length before a
 * byte is written — the same conditions an S3 presigned PUT enforces. It is
 * mounted outside `/v1` because it is storage, not API surface.
 */
export function createStorageRouter(storage: StoragePort, service: MediaService): Router {
  const router = Router();

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

  // Content-addressed delivery: a new upload is a new id and a new URL, so the
  // cache never has to be invalidated (§12.1).
  router.get('/media/vehicles/by-media/:mediaId/:width.webp', (req, res, next) => {
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

  return router;
}
