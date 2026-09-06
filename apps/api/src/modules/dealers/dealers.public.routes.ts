import { DealerDirectoryQuery, SlugParam } from '@dealers-drive/contracts';
import type {
  DealerDirectoryQuery as DealerDirectoryQueryType,
  SlugParam as SlugParamType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import type { DealersPublicService } from './dealers.public.service.js';

/**
 * A8–A9. Public, IP rate-limited, CDN-cacheable. Mounted under `/v1`.
 *
 * `validate({ query: DealerDirectoryQuery })` is doing real work here: the
 * schema is `.strict()`, so `/v1/dealers?town=vellore` is a 400 that *names*
 * `town` rather than a silently unfiltered page of every dealership on the
 * platform (ARCHITECTURE §9.2).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline mounted these two paths inside `search.routes.ts`, alongside
 * `/v1/vehicles`, and handed that router a `DealersPublicService` to call. The
 * search module does not exist yet — it arrives at **F076** — and these two
 * routes touch nothing it owns: they call `dealersPublic` and nothing else.
 *
 * So they live in the module whose service answers them. F076 has no reason to
 * take them back, and if it did the mount point would stay `/v1/dealers`
 * either way.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function createPublicDealersRouter(
  service: DealersPublicService,
  rateLimit: RateLimiter,
): Router {
  const router = Router();

  /*
   * The same window the baseline's public reads share, and the same name, so
   * that when F076 mounts `/v1/vehicles` beside these the two count against one
   * bucket rather than two — a scraper walking the directory and the catalogue
   * is one scraper. It goes through the `CachePort` rather than a module-level
   * Map, because a counter in process memory is correct for one process and
   * silently N times too permissive behind N tasks (CLAUDE.md rule 10).
   */
  const publicReads = rateLimit('public-read', { limit: 120, windowSeconds: 60 });

  router.get(
    '/dealers',
    publicReads,
    validate({ query: DealerDirectoryQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<DealerDirectoryQueryType>(req, 'query');
          // A directory changes at the pace of onboarding, not of trading.
          res.set('Cache-Control', 'public, max-age=300');
          res.json(await service.directory(query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get('/dealers/:slug', publicReads, validate({ params: SlugParam }), (req, res, next) => {
    void (async () => {
      try {
        const params = validated<SlugParamType>(req, 'params');
        res.set('Cache-Control', 'public, max-age=300');
        res.json(await service.profile(params.slug));
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}
