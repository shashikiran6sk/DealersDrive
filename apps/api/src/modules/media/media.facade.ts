/**
 * `media` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * `toMediaStatus` maps a stored status onto the one the dealer is shown, and the
 * vehicle DTO has to render it. The processing pipeline behind it does not
 * leave this module.
 */
export { toMediaStatus } from './media.service.js';
export type { MediaService } from './media.service.js';
