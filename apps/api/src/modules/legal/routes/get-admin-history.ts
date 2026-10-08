import { LegalEvidenceQuery } from '@dealers-drive/contracts';
import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import type { LegalRoute } from './route.js';
export const getAdminHistory: LegalRoute = (router, service) => {
  router.get(
    '/legal/events',
    requirePermission('admin:audit:read'),
    validate({ query: LegalEvidenceQuery }),
    (req, res, next) => {
      void (async () => {
        res
          .set('Cache-Control', 'no-store')
          .json(
            await service.adminHistory(
              adminPrincipal(req),
              validated<LegalEvidenceQuery>(req, 'query'),
            ),
          );
      })().catch(next);
    },
  );
};
