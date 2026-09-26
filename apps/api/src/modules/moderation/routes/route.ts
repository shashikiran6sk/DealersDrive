import type { RouteRegistrar } from '../../../http/route.js';
import type { ModerationService } from '../moderation.service.js';

export type ModerationRoute = RouteRegistrar<ModerationService>;

export { handle } from './handle.js';
