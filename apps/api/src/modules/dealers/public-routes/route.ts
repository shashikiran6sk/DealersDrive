import type { RequestHandler } from 'express';

import type { RouteRegistrar } from '../../../http/route.js';
import type { DealersPublicService } from '../dealers.public.service.js';

export interface PublicDealersDeps {
  service: DealersPublicService;
  /**
   * The window the public reads share, and the same name, so that when F076
   * mounts `/v1/vehicles` beside these the two count against one bucket rather
   * than two — a scraper walking the directory and the catalogue is one scraper.
   * It goes through the `CachePort` rather than a module-level Map (rule 10).
   */
  publicReads: RequestHandler;
}

export type PublicDealersRoute = RouteRegistrar<PublicDealersDeps>;
