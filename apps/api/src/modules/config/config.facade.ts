/**
 * `config` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * Nothing outside this module constructs the service — the container does the
 * wiring, and every other module that needs a setting takes the
 * `PlatformConfigService` port directly rather than going through here.
 */
export type { ConfigService } from './config.service.js';
