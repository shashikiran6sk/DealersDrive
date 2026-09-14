import type { RequestHandler } from 'express';

import type { RouteRegistrar } from '../../../http/route.js';
import type { DealersPublicService } from '../dealers.public.service.js';

export interface PublicDealersDeps {
  service: DealersPublicService;
  publicReads: RequestHandler;
}

export type PublicDealersRoute = RouteRegistrar<PublicDealersDeps>;
