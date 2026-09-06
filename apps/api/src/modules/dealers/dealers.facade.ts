/**
 * `dealers` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * Repository types only. Four modules need to read a dealership — vehicles to
 * check it is active before publishing, billing to price an order, enquiries to
 * route a lead, search to render the card — and all four do it through the same
 * scoped repository rather than reaching for prisma themselves.
 */
export type { DealersRepository, DealerWithRelations } from './dealers.repository.js';
/**
 * One consumer, and only for `session()`: the auth module composes the session
 * body it returns from `/v1/auth/me` out of the dealership half this service
 * renders. It is a type-only export, so nothing is constructed across the
 * boundary — the container still does the wiring.
 */
export type { DealersService } from './dealers.service.js';
/**
 * Where a dealership's private files live.
 *
 * The admin module needs it for two things the dealer module has no reason to
 * do: signing a KYC document for a reviewer to read, and emptying the bucket
 * when an application is rejected. The key is *derived* — its last segment is
 * the document row's id — so a copy of the template in the console would be a
 * second definition of where a scan of somebody's PAN card is stored, and the
 * day they disagreed the purge would silently leave files behind.
 */
export { documentKey, yardPhotoKey } from './dealer-storage-keys.js';
