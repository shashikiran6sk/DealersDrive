import {
  CreateEnquiryInput,
  EnquiryQuery,
  IdParam,
  RevealContactInput,
  UpdateEnquiryInput,
  type CreateEnquiryInput as CreateEnquiryInputType,
  type EnquiryQuery as EnquiryQueryType,
  type IdParam as IdParamType,
  type RevealContactInput as RevealContactInputType,
  type UpdateEnquiryInput as UpdateEnquiryInputType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { dealerPrincipal, requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import type { EnquiriesService } from './enquiries.service.js';

/** A7 · A15 — public, hard rate limits, no session. */
export function createPublicEnquiriesRouter(service: EnquiriesService): Router {
  const router = Router();

  router.post(
    '/enquiries',
    rateLimit('enquiries', {
      limit: 5,
      windowSeconds: 3600,
      message: 'Too many enquiries from this network. Try again in an hour.',
    }),
    validate({ body: CreateEnquiryInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const body = validated<CreateEnquiryInputType>(req, 'body');
          const result = await service.create(body, {
            ip: req.ip ?? 'unknown',
            ...(req.get('user-agent') === undefined ? {} : { userAgent: req.get('user-agent') }),
          });
          res.status(result.status).json(result.body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/vehicles/:id/reveal-contact',
    validate({ params: IdParam, body: RevealContactInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<IdParamType>(req, 'params');
          const body = validated<RevealContactInputType>(req, 'body');
          res.set('Cache-Control', 'no-store');
          res.json(
            await service.revealContact(
              params.id,
              { name: body.name ?? null },
              {
                ip: req.ip ?? 'unknown',
                ...(req.get('user-agent') === undefined
                  ? {}
                  : { userAgent: req.get('user-agent') }),
              },
            ),
          );
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}

/** C15–C17 — the dealer's inbox. Every read is scoped by the session's dealer. */
export function createDealerEnquiriesRouter(service: EnquiriesService): Router {
  const router = Router();

  router.get(
    '/enquiries',
    requirePermission('enquiry:read'),
    validate({ query: EnquiryQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const query = validated<EnquiryQueryType>(req, 'query');
          res.json(await service.listForDealer(dealerId, query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get('/enquiries/counts', requirePermission('enquiry:read'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.countsForDealer(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.patch(
    '/enquiries/:id',
    requirePermission('enquiry:update'),
    validate({ params: IdParam, body: UpdateEnquiryInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          const body = validated<UpdateEnquiryInputType>(req, 'body');
          res.json(await service.updateForDealer(dealerId, params.id, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
