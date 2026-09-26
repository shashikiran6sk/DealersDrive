import type { RouteRegistrar } from '../../../http/route.js';
import type { VehiclesService } from '../vehicles.service.js';

export type VehiclesRoute = RouteRegistrar<VehiclesService>;

export { handle } from './handle.js';
