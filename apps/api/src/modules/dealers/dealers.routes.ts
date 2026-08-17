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

/** C1–C5 and C18. Mounted under `/v1/dealer`. */
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

  router.get('/dashboard', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.set('Cache-Control', 'no-store');
        res.json(await service.dashboard(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}

/** B4 · B5 — session shape. Identity itself comes from the session resolver. */
export function createAuthRouter(service: DealersService): Router {
  const router = Router();

  router.get('/auth/me', (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(await service.session(dealerPrincipal(req)));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.post('/auth/logout', (_req, res) => {
    // Nothing to revoke while the session is server-configured (CLAUDE.md §5).
    // The route exists so the client contract does not change when it is.
    res.status(204).end();
  });

  return router;
}
