import {
  DealerDirectoryQuery,
  HomeQuery,
  IdOrSlugParam,
  IdParam,
  SimilarQuery,
  SlugParam,
  VehicleBatchInput,
  VehicleQuery,
  type DealerDirectoryQuery as DealerDirectoryQueryType,
  type HomeQuery as HomeQueryType,
  type IdOrSlugParam as IdOrSlugParamType,
  type IdParam as IdParamType,
  type SimilarQuery as SimilarQueryType,
  type SlugParam as SlugParamType,
  type VehicleBatchInput as VehicleBatchInputType,
  type VehicleQuery as VehicleQueryType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { rateLimit } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import { carCountLabel } from './search.mapper.js';
import type { SearchService } from './search.service.js';
import type { DealersPublicService } from '../dealers/dealers.facade.js';

/**
 * A1–A6, A8–A11. Public, IP rate-limited, CDN-cacheable.
 *
 * `validate({ query: VehicleQuery })` is doing real work here: the schema is
 * `.strict()`, so `/v1/vehicles?colour=white` is a 400 rather than a silently
 * unfiltered result set (ARCHITECTURE §9.2).
 */
export function createSearchRouter(
  service: SearchService,
  dealers: DealersPublicService,
): Router {
  const router = Router();
  const publicReads = rateLimit('public-read', { limit: 120, windowSeconds: 60 });

  router.get('/home', publicReads, validate({ query: HomeQuery }), (req, res, next) => {
    void (async () => {
      try {
        const query = validated<HomeQueryType>(req, 'query');
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.json(await service.home(query.city));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.get('/vehicles', publicReads, validate({ query: VehicleQuery }), (req, res, next) => {
    void (async () => {
      try {
        const query = validated<VehicleQueryType>(req, 'query');
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.json(await service.search(query));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.get(
    '/vehicles/facets',
    publicReads,
    validate({ query: VehicleQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<VehicleQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=60');
          res.json(await service.facets(query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/vehicles/batch',
    rateLimit('vehicles-batch', { limit: 60, windowSeconds: 60 }),
    validate({ body: VehicleBatchInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const body = validated<VehicleBatchInputType>(req, 'body');
          res.json(await service.batch(body.ids));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/vehicles/:idOrSlug',
    publicReads,
    validate({ params: IdOrSlugParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<IdOrSlugParamType>(req, 'params');
          res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
          res.json(await service.detail(params.idOrSlug));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/vehicles/:id/similar',
    publicReads,
    validate({ params: IdParam, query: SimilarQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<IdParamType>(req, 'params');
          const query = validated<SimilarQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=300');
          res.json(await service.similar(params.id, query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/dealers',
    publicReads,
    validate({ query: DealerDirectoryQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<DealerDirectoryQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=300');
          res.json(await dealers.directory(query));
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
        res.set('Cache-Control', 'public, max-age=600');
        res.json(await dealers.profile(params.slug));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.get(
    '/dealers/:slug/vehicles',
    publicReads,
    validate({ params: SlugParam, query: VehicleQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<SlugParamType>(req, 'params');
          const query = validated<VehicleQueryType>(req, 'query');
          const { data, total } = await service.dealerVehicles(params.slug, query);
          res.set('Cache-Control', 'public, max-age=300');
          res.json({
            data,
            page: {
              page: query.page,
              limit: query.limit,
              total,
              totalPages: Math.ceil(total / query.limit),
            },
            resultLabel: carCountLabel(total, '').trim(),
          });
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/dealers/:slug/facets',
    publicReads,
    validate({ params: SlugParam, query: VehicleQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<SlugParamType>(req, 'params');
          const query = validated<VehicleQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=60');
          res.json(await service.dealerFacets(params.slug, query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
