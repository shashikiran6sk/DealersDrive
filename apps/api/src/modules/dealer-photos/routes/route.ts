import type { RouteRegistrar } from '../../../http/route.js';
import type { DealerPhotosService } from '../dealer-photos.service.js';

export type DealerPhotosRoute = RouteRegistrar<DealerPhotosService>;

export { handle } from './handle.js';
