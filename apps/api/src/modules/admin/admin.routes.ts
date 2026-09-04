import { Router } from 'express';

import { adminPrincipal } from '../../middleware/auth.js';
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
 * The baseline declares 20 routes. **F049 mounts the first**, which is also the
 * one the console shell reads on every page. The KYC review paths arrive with
 * **F044** and the dealer status machine with **F045**; the listing queue,
 * payments, configuration and the audit log belong to later tiers.
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

  return router;
}
