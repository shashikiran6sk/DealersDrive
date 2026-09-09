import {
  AdminDealerQuery,
  ApproveDealerInput,
  IdParam,
  NoteInput,
  ReasonInput,
  UpdateDealerInput,
  type AdminDealerQuery as AdminDealerQueryType,
  type ApproveDealerInput as ApproveDealerInputType,
  type IdParam as IdParamType,
  type NoteInput as NoteInputType,
  type ReasonInput as ReasonInputType,
  type UpdateDealerInput as UpdateDealerInputType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { adminPrincipal } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import type { AdminService } from './admin.service.js';

/**
 * D1–D15. Every write in this router is audit-logged with the admin identity.
 *
 * `Cache-Control: no-store` on everything: a moderator acting on a stale queue
 * approves a listing somebody else already rejected.
 *
 * This router deliberately carries **no** `requirePermission` middleware, and
 * that is worth being explicit about rather than reading as an omission. An
 * admin action's permission is checked inside `admin.service.ts`, in the same
 * function that performs it. Putting the check there rather than here means it
 * cannot be bypassed by a second caller reaching the service another way, and
 * it keeps the permission next to the audit row it justifies.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline declares 20 routes. F049 mounted the first, which is also the
 * one the console shell reads on every page, and F044 the two KYC review paths.
 * **F045 brings the six dealer paths** — bar `POST /dealers/:id/credits/grant`,
 * which moves credits and so waits for the ledger at F050/F054. The listing
 * queue, payments, configuration and the audit log belong to later tiers.
 * ────────────────────────────────────────────────────────────────────────────
 */
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

  /**
   * The dealer's own answers, amended by the console.
   *
   * Deliberately the **same schema** `PATCH /v1/dealer` validates with. An
   * admin editing a dealership is editing a dealership: the fields, their
   * bounds and the normalisation behind them are properties of the data, not of
   * who is holding the pen. A separate `AdminUpdateDealerInput` would be a
   * second place for the GSTIN pattern to live, and the two would drift.
   */
  router.patch(
    '/dealers/:id',
    validate({ params: IdParam, body: UpdateDealerInput }),
    handle((req) =>
      service.updateDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<UpdateDealerInputType>(req, 'body'),
      ),
    ),
  );

  /**
   * The two refusals, and they are different verbs on purpose.
   *
   * `reject` destroys the application — storage, documents, membership and the
   * dealership row. `request-changes` keeps every byte of it and hands it back
   * to the dealer to correct. Both take the same body, because the dealer reads
   * the reason verbatim either way; only one of them is reversible.
   */
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
    '/dealers/:id/request-changes',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.requestChanges(
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

  /**
   * D3b — the profile edits waiting for a decision (**R34**).
   *
   * A queue of its own rather than a filter on the dealer list, because it is
   * work rather than a property of a dealership: oldest first, and every row
   * carries what is live beside what is proposed so a moderator can decide
   * without opening the dealership.
   *
   * The dealer list carries `?pendingEdits=true` as well, for the moderator who
   * arrives from the other direction — looking at a dealership and wanting to
   * know whether it is waiting on them.
   */
  router.get(
    '/profile-changes',
    handle((req) => service.profileChanges(adminPrincipal(req))),
  );

  /**
   * Publish it, or refuse it with a reason.
   *
   * Keyed by the change rather than by the dealership, the way the document
   * decisions are: the thing being decided on has an id, and addressing it by
   * `/dealers/:id/profile-change` would make "which edit" a question the server
   * answers by guessing at the newest one — which is exactly wrong when a
   * dealer saves again while a moderator has the page open.
   *
   * `ReasonInput` on the refusal, shared with the dealer and document
   * rejections, and it is not a coincidence: all three are refusals a person
   * reads verbatim, and all three are worse than useless without a sentence.
   */
  router.post(
    '/profile-changes/:id/approve',
    validate({ params: IdParam }),
    handle((req) =>
      service.approveProfileChange(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );

  router.post(
    '/profile-changes/:id/reject',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.rejectProfileChange(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
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

  return router;
}
