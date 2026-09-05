import {
  DocTypeParam,
  DocumentCommitInput,
  DocumentPresignInput,
  UpdateDealerInput,
  YardPhotoCommitInput,
  YardPhotoPresignInput,
  type DocTypeParam as DocTypeParamType,
  type DocumentCommitInput as DocumentCommitInputType,
  type DocumentPresignInput as DocumentPresignInputType,
  type UpdateDealerInput as UpdateDealerInputType,
  type YardPhotoCommitInput as YardPhotoCommitInputType,
  type YardPhotoPresignInput as YardPhotoPresignInputType,
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
 * F040 mounted the document checklist, F041 five more, F043 the completeness
 * read, **F042 the submit**. `GET /dashboard` arrives with **F048** and closes
 * the module.
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

  router.post('/submit', requirePermission('dealer:update'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.submitForVerification(dealerId));
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

  /**
   * The yard photograph — three writes and a read, mounted beside the KYC
   * documents because a dealer meets them on the same onboarding step, and
   * kept separate from them because it is the opposite kind of image: destined
   * for the public portfolio rather than for a moderator's eyes only.
   */
  router.get('/yard-photo', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.yardPhoto(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

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

  router.delete('/yard-photo', requirePermission('document:upload'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        await service.deleteYardPhoto(dealerId);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}
