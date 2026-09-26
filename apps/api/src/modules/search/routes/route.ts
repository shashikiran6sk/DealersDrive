import type { RequestHandler } from 'express';

import type { RouteRegistrar } from '../../../http/route.js';
import type { SearchService } from '../search.service.js';

export interface SearchRouteDeps {
  service: SearchService;
  publicReads: RequestHandler;
}

export type SearchRoute = RouteRegistrar<SearchRouteDeps>;
