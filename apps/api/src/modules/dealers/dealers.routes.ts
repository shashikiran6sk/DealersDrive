import {
  DocTypeParam,
  DocumentCommitInput,
  DocumentPresignInput,
  UpdateDealerInput,
  type DocTypeParam as DocTypeParamType,
  type DocumentCommitInput as DocumentCommitInputType,
  type DocumentPresignInput as DocumentPresignInputType,
  type UpdateDealerInput as UpdateDealerInputType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { dealerPrincipal, requirePermission } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import type { DealersService } from './dealers.service.js';

/**
 * C1–C5 and C18. Mounted under `/v1/dealer`.
 *
 * The line this router draws is between *reading* your dealership and
 * *changing* it. Reads are open to any seat that got through `requireDealer` —
 * a salesperson can see the dashboard. Writes are OWNER-only, because the
 * profile and the KYC documents are the dealership's identity.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * F040 mounted the document checklist, F041 five more, **F043 the completeness
 * read**. `POST /submit` arrives with **F042** and `GET /dashboard` with
 * **F048**.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function createDealersRouter(service: DealersService): Router {
  const router = Router();

  router.get('/', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.profile(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.patch(
    '/',
    requirePermission('dealer:update'),
    validate({ body: UpdateDealerInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<UpdateDealerInputType>(req, 'body');
          res.json(await service.update(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get('/completeness', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.completeness(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.get('/documents', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.documents(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.post(
    '/documents/presign',
    requirePermission('document:upload'),
    validate({ body: DocumentPresignInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<DocumentPresignInputType>(req, 'body');
          res.status(201).json(await service.presignDocument(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/documents/:type/commit',
    requirePermission('document:upload'),
    validate({ params: DocTypeParam, body: DocumentCommitInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<DocTypeParamType>(req, 'params');
          const body = validated<DocumentCommitInputType>(req, 'body');
          res.json(await service.commitDocument(dealerId, params.type, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/documents/:type',
    requirePermission('document:upload'),
    validate({ params: DocTypeParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<DocTypeParamType>(req, 'params');
          await service.deleteDocument(dealerId, params.type);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
