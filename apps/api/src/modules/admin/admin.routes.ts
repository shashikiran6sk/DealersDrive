import {
  AdminDealerQuery,
  AdminListingQuery,
  AdminPaymentQuery,
  ApproveDealerInput,
  AuditQuery,
  ConfigKeyParam,
  GrantCreditsInput,
  IdParam,
  NoteInput,
  ReasonInput,
  RequestChangesInput,
  TakedownInput,
  UpdateConfigInput,
  type AdminDealerQuery as AdminDealerQueryType,
  type AdminListingQuery as AdminListingQueryType,
  type AdminPaymentQuery as AdminPaymentQueryType,
  type ApproveDealerInput as ApproveDealerInputType,
  type AuditQuery as AuditQueryType,
  type ConfigKeyParam as ConfigKeyParamType,
  type GrantCreditsInput as GrantCreditsInputType,
  type IdParam as IdParamType,
  type NoteInput as NoteInputType,
  type ReasonInput as ReasonInputType,
  type RequestChangesInput as RequestChangesInputType,
  type TakedownInput as TakedownInputType,
  type UpdateConfigInput as UpdateConfigInputType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { adminPrincipal } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import type { AdminService } from './admin.service.js';

/** D1–D15. Every write in this router is audit-logged with the admin identity. */
export function createAdminRouter(service: AdminService): Router {
  const router = Router();

  const handle =
    <T>(work: (req: Parameters<Parameters<Router['get']>[1]>[0]) => Promise<T>, status = 200) =>
    (
      req: Parameters<Parameters<Router['get']>[1]>[0],
      res: Parameters<Parameters<Router['get']>[1]>[1],
      next: Parameters<Parameters<Router['get']>[1]>[2],
    ): void => {
      void (async () => {
        try {
          res.set('Cache-Control', 'no-store');
          const body = await work(req);
          if (body === undefined) res.status(204).end();
          else res.status(status).json(body);
        } catch (error) {
          next(error);
        }
      })();
    };

  router.get(
    '/metrics/overview',
    handle((req) => service.overview(adminPrincipal(req))),
  );

  router.get(
    '/dealers',
    validate({ query: AdminDealerQuery }),
    handle((req) => service.dealers(validated<AdminDealerQueryType>(req, 'query'))),
  );

  router.get(
    '/dealers/:id',
    validate({ params: IdParam }),
    handle((req) =>
      service.dealerDetail(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );

  router.post(
    '/dealers/:id/approve',
    validate({ params: IdParam, body: ApproveDealerInput }),
    handle((req) =>
      service.approveDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ApproveDealerInputType>(req, 'body'),
      ),
    ),
  );

  router.post(
    '/dealers/:id/reject',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.rejectDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );

  router.post(
    '/dealers/:id/suspend',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.suspendDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );

  router.post(
    '/dealers/:id/reinstate',
    validate({ params: IdParam, body: NoteInput }),
    handle((req) =>
      service.reinstateDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<NoteInputType>(req, 'body').note,
      ),
    ),
  );

  router.post(
    '/dealers/:id/credits/grant',
    validate({ params: IdParam, body: GrantCreditsInput }),
    handle(
      (req) =>
        service.grantCredits(
          adminPrincipal(req),
          validated<IdParamType>(req, 'params').id,
          validated<GrantCreditsInputType>(req, 'body'),
        ),
      201,
    ),
  );

  router.post(
    '/documents/:id/verify',
    validate({ params: IdParam }),
    handle((req) =>
      service.verifyDocument(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );

  router.post(
    '/documents/:id/reject',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.rejectDocument(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );

  router.get(
    '/listings',
    validate({ query: AdminListingQuery }),
    handle((req) => service.queue(validated<AdminListingQueryType>(req, 'query'))),
  );

  router.get(
    '/listings/:id',
    validate({ params: IdParam }),
    handle((req) => service.listingDetail(validated<IdParamType>(req, 'params').id)),
  );

  router.post(
    '/listings/:id/approve',
    validate({ params: IdParam, body: NoteInput }),
    handle((req) =>
      service.approveListing(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );

  router.post(
    '/listings/:id/reject',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.rejectListing(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );

  router.post(
    '/listings/:id/request-changes',
    validate({ params: IdParam, body: RequestChangesInput }),
    handle((req) =>
      service.requestChanges(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<RequestChangesInputType>(req, 'body').note,
      ),
    ),
  );

  router.post(
    '/listings/:id/takedown',
    validate({ params: IdParam, body: TakedownInput }),
    handle((req) =>
      service.takedown(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<TakedownInputType>(req, 'body'),
      ),
    ),
  );

  router.get(
    '/payments',
    validate({ query: AdminPaymentQuery }),
    handle((req) =>
      service.payments(adminPrincipal(req), validated<AdminPaymentQueryType>(req, 'query')),
    ),
  );

  router.get(
    '/config',
    handle(() => service.config()),
  );

  router.put(
    '/config/:key',
    validate({ params: ConfigKeyParam, body: UpdateConfigInput }),
    handle((req) =>
      service.setConfig(
        adminPrincipal(req),
        validated<ConfigKeyParamType>(req, 'params').key,
        validated<UpdateConfigInputType>(req, 'body').value,
      ),
    ),
  );

  router.get(
    '/audit-logs',
    validate({ query: AuditQuery }),
    handle((req) => service.auditLogs(adminPrincipal(req), validated<AuditQueryType>(req, 'query'))),
  );

  return router;
}
