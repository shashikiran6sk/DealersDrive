export type { DealersRepository, DealerWithRelations } from './dealers.repository.js';
export type { DealersPublicService } from './dealers.public.service.js';
export type { DealersService } from './dealers.service.js';
export { documentKey, yardPhotoKey } from './dealer-storage-keys.js';
export { uniqueDealerSlug } from './dealer-slug.js';
export {
  normaliseDealerEmail,
  withDealerEmailConflict,
  assertDealerEmailFree,
} from './dealer-email-identity.js';

export { invalidateDealerVerification } from './dealer-verification.js';

export { withDealerRegistrationConflict } from './dealer-registration-conflict.js';
