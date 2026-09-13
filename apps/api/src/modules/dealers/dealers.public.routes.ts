import { DealerDirectoryQuery, DealerSuggestQuery, SlugParam } from '@dealers-drive/contracts';
import type {
  DealerDirectoryQuery as DealerDirectoryQueryType,
  DealerSuggestQuery as DealerSuggestQueryType,
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

  /*
   * A8b — the dealer typeahead (**R43**).
   *
   * Mounted at `/v1/search/dealers` rather than `/v1/dealers/suggest`, and the
   * namespace is the point: `/v1/search/vehicles` arrives at **F076** with the
   * same query grammar and the same response shape, and a buyer typing into
   * two boxes on two pages should be hitting one family of endpoints rather
   * than a dealer-shaped one and a vehicle-shaped one.
   *
   * It still lives in this module, for the reason the file docblock gives: it
   * calls `dealersPublic` and nothing else. The path is about the audience, not
   * about the folder.
   *
   * **`Cache-Control: public, max-age=60`**, a fifth of what the directory
   * gets. The rows are the same rows, but this is answered while somebody is
   * typing — every extra character is another request, so the cache is doing
   * more work per unit of staleness here than anywhere else in the product, and
   * a minute is short enough that a newly-approved dealership appears in the
   * dropdown at about the same time it appears in the grid.
   */
  router.get(
    '/search/dealers',
    publicReads,
    validate({ query: DealerSuggestQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<DealerSuggestQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=60');
          res.json(await service.suggest(query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  /*
   * The places, for the header's location button.
   *
   * Mounted before `/dealers/:slug` is irrelevant — it is a different path —
   * but it is deliberately **not** `/dealers/locations`, which would be: Express
   * matches in definition order, and a resource whose correctness depends on
   * sitting above a wildcard is one line away from becoming a dealership called
   * "locations".
   */
  router.get('/locations', publicReads, (_req, res, next) => {
    void (async () => {
      try {
        // The same five minutes the directory gets, and for the same reason:
        // this changes at the pace of onboarding, not of trading.
        res.set('Cache-Control', 'public, max-age=300');
        res.json(await service.locations());
      } catch (error) {
        next(error);
      }
    })();
  });

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
