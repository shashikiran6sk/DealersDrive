import {
  DealerSelfUpdateInput,
  DocTypeParam,
  DocumentCommitInput,
  DocumentPresignInput,
  UpdateDealerInput,
  YardPhotoCommitInput,
  YardPhotoPresignInput,
  type DealerSelfUpdateInput as DealerSelfUpdateInputType,
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

  /**
   * C2 — the dealership editing itself, after onboarding is over (**R27**),
   * with two of the three fields held for review (**R34**).
   *
   * `DealerSelfUpdateInput`, not `UpdateDealerInput`. The difference is the
   * whole of a dealer's authority over their own record: the year they started,
   * the line they describe themselves in, and what their yard does. The
   * registered name, the address, the town, the pin, the mobile and the email
   * are absent from that schema, so sending one is a 400 that names the field
   * rather than a silent write — see the schema for why each of them is
   * evidence rather than a preference.
   *
   * **This is a 200 either way, and that is deliberate.** On an ACTIVE
   * dealership the tagline and the service list do not reach the dealership row
   * — they become a `DealerProfileChange` a moderator decides on — but the save
   * *succeeded*: the dealer's edit was accepted and recorded. A 202 would be
   * more literally accurate about the queue and would tell a browser the wrong
   * thing about the response body, which is the dealership as it stands now,
   * with `profileChange` on it saying what is waiting. The screen reads that
   * field rather than the status code.
   *
   * `selfUpdate` rather than `update`, and the second argument is why: the
   * queue records *who* typed the words, not only which dealership they belong
   * to. `dealerId` still comes from the session and never from the body
   * (rule 1); so does the user id.
   *
   * The admin console keeps the full shape at
   * `PATCH /v1/admin/dealers/:id`, and a dealership still answering the
   * onboarding questions keeps it at `PATCH /v1/dealer/onboarding` below.
   */
  router.patch(
    '/',
    requirePermission('dealer:update'),
    validate({ body: DealerSelfUpdateInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const body = validated<DealerSelfUpdateInputType>(req, 'body');
          res.json(await service.selfUpdate(dealerId, userId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  /**
   * C2c — the dealer taking their own proposal back (**R34**).
   *
   * `DELETE` on the thing being removed, and no body: there is at most one
   * request waiting per dealership, so naming it in the URL would be asking the
   * client for an id it can only have got from the same response that told it
   * the button should exist.
   *
   * A button rather than an inference. The first shape of this read "the dealer
   * retyped the live value" as a cancellation, which made the way out something
   * to discover rather than press — and was wrong on its own terms besides,
   * since an edit that happens to restore the live text is still an edit.
   *
   * `dealer:update` is the permission, because withdrawing is the other half of
   * submitting. It answers **404** when nothing is waiting: the button only
   * renders when there is one, so reaching here empty-handed is a double-click
   * or a stale page, and both want the screen re-read.
   */
  router.delete('/profile-change', requirePermission('dealer:update'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId, userId } = dealerPrincipal(req);
        res.json(await service.withdrawProfileChange(dealerId, userId));
      } catch (error) {
        next(error);
      }
    })();
  });

  /**
   * C2b — the same dealership, while it is still a DRAFT (**R27**).
   *
   * The onboarding wizard's Back button leads to steps 1 and 2, and those steps
   * ask for exactly the fields the profile screen may no longer touch. That is
   * not a contradiction: a DRAFT dealership is one that is still *answering*
   * these questions, or one a moderator has sent back to fix an answer. Nothing
   * has been verified about it yet, so there is nothing an edit can invalidate.
   *
   * The whole of the difference between this route and the one above is the
   * status guard in `amendDraft`, and it is a guard rather than a permission:
   * `dealer:update` is the same permission both routes need, and the question
   * here is not who is holding the pen but whether the record has been checked
   * yet.
   */
  router.patch(
    '/onboarding',
    requirePermission('dealer:update'),
    validate({ body: UpdateDealerInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<UpdateDealerInputType>(req, 'body');
          res.json(await service.amendDraft(dealerId, body));
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
