import type { RouteRegistrar } from '../../../http/route.js';
import type { ConfigService } from '../config.service.js';

export type ConfigRoute = RouteRegistrar<{ service: ConfigService }>;
