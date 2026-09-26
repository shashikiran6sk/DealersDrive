import type { RouteRegistrar } from '../../../http/route.js';
import type { VehicleImagesService } from '../vehicle-images.service.js';

export type VehicleImagesRoute = RouteRegistrar<VehicleImagesService>;

export { handle } from './handle.js';
